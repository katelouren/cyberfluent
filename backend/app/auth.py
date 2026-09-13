"""Supabase JWT validation. User IDs always come from verified claims."""

import os
import time
from dataclasses import dataclass
from uuid import UUID

import httpx
import jwt
from fastapi import HTTPException, Request


@dataclass(frozen=True)
class Identity:
    user_id: str
    token: str
    demo: bool = False


_jwks: dict = {}
_cached_at = 0.0
_cached_url = ""


async def signing_keys(url: str, refresh: bool = False) -> dict:
    global _jwks, _cached_at, _cached_url
    if refresh or url != _cached_url or time.monotonic() - _cached_at > 300:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                response = await client.get(f"{url}/auth/v1/.well-known/jwks.json")
                response.raise_for_status()
                data = response.json()
                if (
                    not isinstance(data, dict)
                    or not isinstance(data.get("keys"), list)
                    or not all(isinstance(key, dict) for key in data["keys"])
                ):
                    raise TypeError()
            _jwks, _cached_at, _cached_url = data, time.monotonic(), url
        except (httpx.HTTPError, ValueError, TypeError):
            raise HTTPException(503, "Autenticação indisponível. Tente novamente.") from None
    return _jwks


async def verify_token(token: str) -> Identity:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise HTTPException(503, "Supabase ainda não configurado.")
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") not in {"ES256", "RS256"} or not header.get("kid"):
            raise ValueError()
        keys = await signing_keys(url)
        key = next((k for k in keys["keys"] if k.get("kid") == header["kid"]), None)
        if not key:
            keys = await signing_keys(url, refresh=True)
            key = next((k for k in keys["keys"] if k.get("kid") == header["kid"]), None)
        if not key or key.get("alg", header["alg"]) != header["alg"]:
            raise ValueError()
        claims = jwt.decode(
            token,
            jwt.PyJWK.from_dict(key).key,
            algorithms=[header["alg"]],
            audience=os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated"),
            issuer=f"{url}/auth/v1",
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            leeway=5,
        )
        if claims.get("role") != "authenticated" or claims.get("is_anonymous") is True:
            raise ValueError()
        user_id = str(UUID(claims["sub"]))
        return Identity(user_id=user_id, token=token)
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise HTTPException(
            401,
            "Sessão inválida ou expirada. Entre novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


async def current_user(request: Request) -> Identity:
    from .storage import demo_identity

    demo = request.headers.get("x-demo-session")
    if demo:
        if os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() != "true":
            raise HTTPException(403, "Modo demo desabilitado.")
        return demo_identity(demo)
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer ") or len(auth) > 16000:
        raise HTTPException(
            401, "Entre na sua conta para continuar.", headers={"WWW-Authenticate": "Bearer"}
        )
    return await verify_token(auth[7:])
