"""Opt-in bidirectional hosted RLS and FastAPI ownership proof, safe output only."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import dotenv_values, load_dotenv
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
load_dotenv(ROOT / "backend/.env")
from app.main import app


def run():
    cfg = dotenv_values(ROOT / "tests/.env.live")
    url = cfg["SUPABASE_TEST_URL"].rstrip("/")
    checks = {}

    def verify(name, condition):
        checks[name] = bool(condition)
        if not condition:
            raise RuntimeError(name)

    with httpx.Client(timeout=20) as remote, TestClient(app) as api:
        sessions = {}
        for label in ("A", "B"):
            r = remote.post(
                url + "/auth/v1/token?grant_type=password",
                headers={"apikey": cfg["SUPABASE_TEST_PUBLISHABLE_KEY"]},
                json={
                    "email": cfg[f"SUPABASE_TEST_EMAIL_{label}"],
                    "password": cfg[f"SUPABASE_TEST_PASSWORD_{label}"],
                },
            )
            verify(f"login_{label}", r.status_code == 200)
            sessions[label] = r.json()
        verify("distinct_identities", sessions["A"]["user"]["id"] != sessions["B"]["user"]["id"])
        for label, other in (("A", "B"), ("B", "A")):
            own, peer = sessions[label], sessions[other]
            headers = {"Authorization": "Bearer " + own["access_token"]}
            rest = {
                **headers,
                "apikey": cfg["SUPABASE_TEST_PUBLISHABLE_KEY"],
                "Prefer": "return=representation",
            }
            peer_rest = {
                "Authorization": "Bearer " + peer["access_token"],
                "apikey": cfg["SUPABASE_TEST_PUBLISHABLE_KEY"],
            }
            verify(
                f"jwt_{label}_accepted",
                api.get("/api/v1/progress", headers=headers).status_code == 200,
            )
            peer_rows = {}
            for table in (
                "profiles",
                "attempts",
                "user_progress",
                "review_queue",
                "concept_mastery",
                "language_error_events",
            ):
                params = {"user_id": "eq." + peer["user"]["id"]}
                visible = remote.get(url + "/rest/v1/" + table, headers=peer_rest, params=params)
                verify(
                    f"{other}_has_{table}", visible.status_code == 200 and len(visible.json()) > 0
                )
                peer_rows[table] = visible.json()
                hidden = remote.get(url + "/rest/v1/" + table, headers=rest, params=params)
                verify(
                    f"{label}_cannot_read_{other}_{table}",
                    hidden.status_code == 200 and hidden.json() == [],
                )
            # Same existing value: even a broken policy cannot alter the user's goal.
            patched = remote.patch(
                url + "/rest/v1/profiles",
                headers=rest,
                params={"user_id": "eq." + peer["user"]["id"]},
                json={"goal": peer_rows["profiles"][0]["goal"]},
            )
            verify(
                f"{label}_cannot_update_{other}_profile",
                patched.status_code == 200 and patched.json() == [],
            )
            attempt = peer_rows["attempts"][0]
            blocked = api.post(
                "/api/v1/tutor/feedback",
                headers=headers,
                json={
                    "attempt_id": attempt["id"],
                    "mission_slug": attempt["mission_slug"],
                    "answer": "Today, I will write tests. Could you help me get staging access?",
                    "cefr": "A2",
                    "source_locale": "pt-BR",
                    "target_locale": "en",
                },
            )
            verify(f"{label}_foreign_attempt_404", blocked.status_code == 404)
            row = peer_rows["review_queue"][0]
            question = {
                "daily-standup": "future-will",
                "bug-report": "modal-should",
                "phishing-incident-communication": "need-to-1",
            }[row["mission_slug"]]
            blocked = api.post(
                "/api/v1/review/answer",
                headers=headers,
                json={
                    "review_id": row["id"],
                    "question_id": question,
                    "answer": "incorrect",
                    "confidence": 1,
                },
            )
            verify(f"{label}_foreign_review_404", blocked.status_code == 404)
        evidence = {
            "date": datetime.now(timezone.utc).isoformat(),
            "scope": "Real hosted Supabase Auth/PostgREST, bidirectional RLS, real FastAPI ASGI ownership; no mocks",
            "checks": checks,
        }
        (ROOT / "docs/evidence/phase-2/isolation-check.json").write_text(
            json.dumps(evidence, indent=2) + "\n"
        )
        print(json.dumps({"passed": len(checks), "checks": checks}))


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # noqa: BLE001 — redact remote errors at CLI boundary
        print(json.dumps({"passed": False, "error_type": type(exc).__name__}))
        sys.exit(1)
