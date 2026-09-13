"""Real account B JWT, persisted XP idempotence and client-write denial checks."""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import dotenv_values, load_dotenv
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
load_dotenv(ROOT / "backend/.env")
os.environ["AI_DEMO_FALLBACK_ENABLED"] = "false"
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
        auth = remote.post(
            url + "/auth/v1/token?grant_type=password",
            headers={"apikey": cfg["SUPABASE_TEST_PUBLISHABLE_KEY"]},
            json={
                "email": cfg["SUPABASE_TEST_EMAIL_B"],
                "password": cfg["SUPABASE_TEST_PASSWORD_B"],
            },
        )
        verify("real_login_b", auth.status_code == 200)
        session = auth.json()
        owner = session["user"]["id"]
        headers = {"Authorization": "Bearer " + session["access_token"]}
        rest_headers = {**headers, "apikey": cfg["SUPABASE_TEST_PUBLISHABLE_KEY"]}
        before = api.get("/api/v1/progress", headers=headers).json()
        verify("three_persisted_missions", len(before["missions"]) == 3)
        verify(
            "competency_xp",
            before["competencies"]["context_xp"] == 60
            and before["competencies"]["language_xp"] == 60
            and before["total_xp"] == sum(before["competencies"].values()),
        )
        rows = remote.get(
            url + "/rest/v1/attempts",
            headers=rest_headers,
            params={"user_id": "eq." + owner, "recalled": "eq.true"},
        ).json()
        for slug, question, answer in [
            ("daily-standup", "future-will", "write"),
            ("bug-report", "modal-should", "save"),
            ("phishing-incident-communication", "need-to-1", "to"),
        ]:
            row = next(r for r in rows if r["mission_slug"] == slug)
            repeated = api.post(
                "/api/v1/review/answer",
                headers=headers,
                json={
                    "attempt_id": row["id"],
                    "question_id": question,
                    "answer": answer,
                    "confidence": 5,
                },
            )
            verify(
                "no_duplicate_xp_" + slug,
                repeated.status_code == 200
                and repeated.json().get("xp_awarded") == 0
                and repeated.json().get("already_completed") is True,
            )
        verify(
            "progress_unchanged_after_replay",
            api.get("/api/v1/progress", headers=headers).json() == before,
        )
        forged = remote.post(
            url + "/rest/v1/user_progress",
            headers=rest_headers,
            json={
                "user_id": owner,
                "mission_slug": "daily-standup",
                "context_xp": 20,
                "language_xp": 20,
                "communication_xp": 20,
            },
        )
        verify("client_xp_write_denied", forged.status_code in (401, 403))
        rpc = remote.post(
            url + "/rest/v1/rpc/finish_attempt",
            headers=rest_headers,
            json={
                "p_user_id": owner,
                "p_attempt_id": rows[0]["id"],
                "p_correct": True,
                "p_confidence": 5,
                "p_concept": "future-will",
            },
        )
        verify("client_reward_rpc_denied", rpc.status_code in (401, 403))
        evidence = {
            "date": datetime.now(timezone.utc).isoformat(),
            "scope": "FastAPI ASGI with real JWT and hosted Supabase; account B",
            "checks": checks,
            "competencies": before["competencies"],
            "total_xp": before["total_xp"],
        }
        (ROOT / "docs/evidence/phase-2/xp-check.json").write_text(
            json.dumps(evidence, indent=2) + "\n"
        )
        print(json.dumps(evidence))


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # noqa: BLE001 — never expose remote errors or credentials
        print(json.dumps({"passed": False, "error_type": type(exc).__name__}))
        sys.exit(1)
