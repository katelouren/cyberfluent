"""RLS-scoped reads, server-only writes, and isolated local demo sessions."""

import copy
import os
import secrets
import time
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import HTTPException

from .auth import Identity
from .learning import schedule


class SupabaseStore:
    def __init__(self, identity: Identity):
        self.identity = identity
        self.url = os.getenv("SUPABASE_URL", "").rstrip("/")

    async def call(self, method: str, path: str, *, data=None, server=False, params=None):
        key = os.getenv("SUPABASE_SECRET_KEY" if server else "SUPABASE_PUBLISHABLE_KEY", "")
        if not self.url or not key:
            raise HTTPException(503, "Persista seus dados após configurar o Supabase.")
        headers = {"apikey": key, "Prefer": "return=representation"}
        if not server:
            headers["Authorization"] = f"Bearer {self.identity.token}"
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.request(
                    method, f"{self.url}/rest/v1/{path}", headers=headers, json=data, params=params
                )
            if response.status_code in (401, 403) and server:
                raise HTTPException(
                    503, "Persistência indisponível. Confira a configuração do servidor."
                )
            if response.status_code in (401, 403):
                raise HTTPException(401, "A sessão não permite esta operação. Entre novamente.")
            if response.status_code == 400:
                raise HTTPException(
                    409, "O registro mudou ou a operação não está disponível. Atualize a página."
                )
            response.raise_for_status()
            return response.json() if response.content else None
        except (httpx.HTTPError, ValueError):
            raise HTTPException(
                503, "Não foi possível acessar seus dados. Tente novamente."
            ) from None

    async def rows(self, table, **filters):
        return await self.call(
            "GET", table, params={"user_id": f"eq.{self.identity.user_id}", **filters}
        )

    async def profile(self):
        rows = await self.rows("profiles")
        return rows[0] if rows else None

    async def save_profile(self, profile):
        return await self.call(
            "POST",
            "profiles",
            data={"user_id": self.identity.user_id, **profile},
            params={"on_conflict": "user_id"},
        )

    async def upsert_profile(self, profile):
        # PATCH if present; inserts and updates remain subject to the user's RLS.
        existing = await self.profile()
        if existing:
            await self.call(
                "PATCH", "profiles", data=profile, params={"user_id": f"eq.{self.identity.user_id}"}
            )
        else:
            await self.save_profile(profile)
        return profile

    async def start(self, slug):
        rows = await self.call(
            "POST",
            "attempts",
            server=True,
            data={"user_id": self.identity.user_id, "mission_slug": slug},
        )
        return rows[0]

    async def attempt(self, attempt_id):
        rows = await self.rows("attempts", id=f"eq.{attempt_id}")
        if not rows:
            raise HTTPException(404, "Tentativa não encontrada.")
        return rows[0]

    async def rpc(self, name, **args):
        return await self.call(
            "POST", f"rpc/{name}", server=True, data={"p_user_id": self.identity.user_id, **args}
        )

    async def feedback(self, attempt_id, summary, mode):
        return await self.rpc(
            "save_feedback", p_attempt_id=str(attempt_id), p_feedback=summary, p_mode=mode
        )

    async def finish(self, attempt_id, correct, confidence, concept):
        return await self.rpc(
            "finish_attempt",
            p_attempt_id=str(attempt_id),
            p_correct=correct,
            p_confidence=confidence,
            p_concept=concept,
        )

    async def reviews(self):
        return await self.rows("review_queue", order="due_at.asc")

    async def review(self, review_id):
        rows = await self.rows("review_queue", id=f"eq.{review_id}")
        if not rows:
            raise HTTPException(404, "Revisão não encontrada.")
        return rows[0]

    async def answer_review(self, row, correct, confidence):
        return await self.rpc(
            "review_result",
            p_review_id=row["id"],
            p_version=row["version"],
            p_correct=correct,
            p_confidence=confidence,
        )

    async def progress(self):
        return await self.rows("user_progress")

    async def history(self, slug):
        rows = await self.rows(
            "attempts",
            mission_slug=f"eq.{slug}",
            order="created_at.desc",
            limit="3",
            select="feedback,ai_mode",
        )
        return [r for r in rows if r.get("feedback")]


_demo_sessions: dict[str, tuple[float, str]] = {}
_demo_data: dict[str, dict] = {}


def start_demo():
    now = time.monotonic()
    for token, (expires, user) in list(_demo_sessions.items()):
        if expires < now:
            _demo_sessions.pop(token, None)
            _demo_data.pop(user, None)
    if len(_demo_sessions) >= 100:
        raise HTTPException(429, "Limite de sessões demo atingido.")
    token = secrets.token_urlsafe(32)
    user = str(uuid4())
    _demo_sessions[token] = (now + 7200, user)
    _demo_data[user] = {"profile": None, "attempts": {}, "reviews": {}, "progress": {}}
    return {"token": token, "expires_in": 7200, "mode": "demo"}


def demo_identity(token):
    entry = _demo_sessions.get(token)
    if not entry or entry[0] < time.monotonic():
        raise HTTPException(401, "Sessão demo expirada. Inicie uma nova demonstração.")
    return Identity(user_id=entry[1], token=token, demo=True)


class DemoStore:
    def __init__(self, identity):
        self.identity = identity
        self.data = _demo_data.setdefault(
            identity.user_id, {"profile": None, "attempts": {}, "reviews": {}, "progress": {}}
        )

    async def profile(self):
        return copy.deepcopy(self.data["profile"])

    async def upsert_profile(self, profile):
        self.data["profile"] = profile
        return profile

    async def start(self, slug):
        row = {
            "id": str(uuid4()),
            "mission_slug": slug,
            "feedback": None,
            "recalled": False,
            "ai_mode": None,
        }
        self.data["attempts"][row["id"]] = row
        return copy.deepcopy(row)

    async def attempt(self, attempt_id):
        row = self.data["attempts"].get(str(attempt_id))
        if not row:
            raise HTTPException(404, "Tentativa não encontrada.")
        return copy.deepcopy(row)

    async def feedback(self, attempt_id, summary, mode):
        row = await self.attempt(attempt_id)
        if row["recalled"]:
            raise HTTPException(409, "Tentativa já concluída.")
        row.update(feedback=summary, ai_mode=mode)
        self.data["attempts"][str(attempt_id)] = row

    async def finish(self, attempt_id, correct, confidence, concept):
        row = await self.attempt(attempt_id)
        if row["recalled"]:
            return {"correct": True, "xp_awarded": 0, "already_completed": True}
        if not row["feedback"]:
            raise HTTPException(409, "Receba feedback antes da recuperação.")
        slug = row["mission_slug"]
        if slug not in self.data["reviews"] or not correct:
            self.data["reviews"][slug] = {
                "id": str(uuid4()),
                "mission_slug": slug,
                "concept_id": concept,
                "version": 0,
                **schedule(correct, confidence, 0),
            }
        if correct:
            self.data["attempts"][str(attempt_id)]["recalled"] = True
            self.data["progress"][slug] = {
                "mission_slug": slug,
                "context_xp": 0,
                "language_xp": 0,
                "communication_xp": 0,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        return {"correct": correct, "xp_awarded": 0, "already_completed": False, "demo": True}

    async def reviews(self):
        return list(copy.deepcopy(self.data["reviews"]).values())

    async def review(self, review_id):
        row = next((r for r in self.data["reviews"].values() if r["id"] == str(review_id)), None)
        if not row:
            raise HTTPException(404, "Revisão não encontrada.")
        return copy.deepcopy(row)

    async def answer_review(self, row, correct, confidence):
        if datetime.fromisoformat(row["due_at"]) > datetime.now(timezone.utc):
            raise HTTPException(409, "Esta revisão ainda não venceu.")
        updated = {
            **row,
            **schedule(correct, confidence, row["streak"]),
            "version": row["version"] + 1,
        }
        self.data["reviews"][row["mission_slug"]] = updated
        return {
            "correct": correct,
            "xp_awarded": 0,
            "interval_days": updated["interval_days"],
            "reason": updated["reason"],
        }

    async def progress(self):
        return list(copy.deepcopy(self.data["progress"]).values())

    async def history(self, slug):
        return []


def get_store(identity):
    return DemoStore(identity) if identity.demo else SupabaseStore(identity)
