"""Bounded process-local abuse controls and explicit trust boundaries."""

import asyncio
import math
import re
import time
import unicodedata
from collections import OrderedDict, deque
from contextlib import contextmanager
from urllib.parse import urlsplit

from fastapi import HTTPException
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse


def frontend_origin(value: str) -> str:
    parsed = urlsplit(value)
    if (
        parsed.scheme not in {"https", "http"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path
        or parsed.query
        or parsed.fragment
        or "*" in value
        or any(c.isspace() for c in value)
        or (parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"})
    ):
        raise ValueError("FRONTEND_ORIGIN deve ser uma origem HTTPS exata ou localhost HTTP.")
    try:
        _ = parsed.port
    except ValueError:
        raise ValueError("Porta inválida em FRONTEND_ORIGIN.") from None
    return value


class WindowLimiter:
    def __init__(self, capacity=10000):
        self.buckets = OrderedDict()
        self.capacity = capacity

    def clear(self):
        self.buckets.clear()

    def hit(self, key, limit, now=None):
        now = time.monotonic() if now is None else now
        while self.buckets and next(iter(self.buckets.values()))[-1] <= now - 60:
            self.buckets.popitem(last=False)
        if key not in self.buckets:
            if len(self.buckets) >= self.capacity:
                return 60  # Fail closed; never evict active quotas to enable bypass.
            self.buckets[key] = deque()
        bucket = self.buckets[key]
        while bucket and bucket[0] <= now - 60:
            bucket.popleft()
        if len(bucket) >= limit:
            return max(1, math.ceil(60 - (now - bucket[0])))
        bucket.append(now)
        self.buckets.move_to_end(key)
        return 0


request_limiter = WindowLimiter()
ai_limiter = WindowLimiter()
_active_ai: set[str] = set()


@contextmanager
def ai_slot(user_id: str):
    # Called on the event loop with no await between check and reservation.
    if user_id in _active_ai or len(_active_ai) >= 4:
        raise HTTPException(
            429, "Tutora ocupada. Aguarde e tente novamente.", headers={"Retry-After": "5"}
        )
    retry = ai_limiter.hit(user_id, 6)
    if retry:
        raise HTTPException(
            429,
            "Limite de IA atingido. Aguarde e tente novamente.",
            headers={"Retry-After": str(retry)},
        )
    _active_ai.add(user_id)
    try:
        yield
    finally:
        _active_ai.discard(user_id)


_INJECTION = re.compile(
    r"(?:ignore|disregard|override|forget|desconsidere|ignore|esqueca).{0,100}(?:instructions|rules|prompt|instrucoes|regras)|"
    r"(?:reveal|print|show|expose|revele|mostre).{0,80}(?:system prompt|developer message|api.?key|secret|prompt de sistema|segredo|chave)|"
    r"(?:system|developer|assistant)\s*:|<\|(?:im_start|system|developer)|"
    r"(?:award|grant|give|conceda).{0,40}(?:\bxp\b|full marks|maximum score)|"
    r"(?:developer mode|modo desenvolvedor)|"
    r"(?:decode|decodifique).{0,60}(?:base64|instructions|instrucoes)",
    re.IGNORECASE | re.DOTALL,
)


def suspicious_instruction(value: str) -> bool:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    normalized = "".join(c for c in normalized if unicodedata.category(c) not in {"Cf", "Mn"})
    return bool(_INJECTION.search(normalized))


class SecurityMiddleware:
    """Pure ASGI: streaming byte/deadline limits, redacted failures, consistent headers."""

    def __init__(self, app, origin, body_timeout=5):
        self.app, self.origin, self.body_timeout = app, origin, body_timeout

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def safe_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-store"
                headers["X-Content-Type-Options"] = "nosniff"
                headers["Referrer-Policy"] = "no-referrer"
            await send(message)

        async def reject(code, detail, extra=None):
            await JSONResponse({"detail": detail}, status_code=code, headers=extra)(
                scope, receive, safe_send
            )

        headers = Headers(scope=scope)
        method = scope["method"]
        if headers.get("origin") and headers["origin"] != self.origin:
            return await reject(403, "Origem não permitida.")
        client = (scope.get("client") or ("unknown", 0))[0]
        retry = request_limiter.hit(
            (client, "write" if method == "POST" else "read"), 60 if method == "POST" else 120
        )
        if retry:
            return await reject(
                429, "Limite local atingido. Aguarde um minuto.", {"Retry-After": str(retry)}
            )
        if method == "POST":
            length = headers.get("content-length")
            if length is not None:
                if not length.isdecimal():
                    return await reject(400, "Tamanho de requisição inválido.")
                if len(length) > 8 or int(length) > 12000:
                    return await reject(413, "Requisição muito grande.")
            if headers.get("content-encoding", "identity") != "identity":
                return await reject(415, "Envie JSON sem compressão.")
            chunks, size = [], 0
            try:
                async with asyncio.timeout(self.body_timeout):
                    while True:
                        message = await receive()
                        if message["type"] == "http.disconnect":
                            return
                        size += len(message.get("body", b""))
                        if size > 12000:
                            return await reject(413, "Requisição muito grande.")
                        chunks.append(message.get("body", b""))
                        if not message.get("more_body", False):
                            break
            except TimeoutError:
                return await reject(408, "Tempo de envio excedido.")
            if (
                size
                and headers.get("content-type", "").split(";")[0].strip().lower()
                != "application/json"
            ):
                return await reject(415, "Envie application/json.")
            body = b"".join(chunks)
            delivered = False
            original_receive = receive

            async def buffered_receive():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await original_receive()

            receive = buffered_receive
        try:
            await self.app(scope, receive, safe_send)
        except Exception:  # noqa: BLE001 — never log provider/user payloads in uncaught errors
            if not started:
                await reject(500, "Erro interno. Tente novamente.")
