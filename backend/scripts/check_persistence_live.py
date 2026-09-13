"""Opt-in hosted Supabase checks; temporary review fixture, safe evidence only.

Uses the real FastAPI ASGI app and hosted Auth/PostgREST (no dependency overrides).
Time passage is represented by moving only this script's temporary review due date.
No OpenAI call or browser-flow proof is claimed by this supplementary check.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

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
    public = {"apikey": cfg["SUPABASE_TEST_PUBLISHABLE_KEY"]}
    privileged = {"apikey": os.environ["SUPABASE_SECRET_KEY"], "Prefer": "return=representation"}
    checks = {}

    def verify(name, condition):
        checks[name] = bool(condition)
        if not condition:
            raise RuntimeError(name)

    with httpx.Client(timeout=20) as remote, TestClient(app) as api:
        auth = remote.post(
            url + "/auth/v1/token?grant_type=password",
            headers=public,
            json={
                "email": cfg["SUPABASE_TEST_EMAIL_B"],
                "password": cfg["SUPABASE_TEST_PASSWORD_B"],
            },
        )
        verify("account_b_real_login", auth.status_code == 200)
        session = auth.json()
        token, owner = session["access_token"], session["user"]["id"]
        headers = {"Authorization": "Bearer " + token}
        verify(
            "verified_jwt_accepted", api.get("/api/v1/progress", headers=headers).status_code == 200
        )
        verify("missing_jwt_rejected", api.get("/api/v1/progress").status_code == 401)
        parts = token.split(".")
        parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
        verify(
            "tampered_signature_rejected",
            api.get(
                "/api/v1/progress",
                headers={
                    "Authorization": "Bearer " + ".".join(parts),
                },
            ).status_code
            == 401,
        )
        verify("demo_disabled", api.post("/api/v1/demo/session").status_code == 403)
        before = api.get("/api/v1/progress", headers=headers).json()
        existing = remote.get(
            url + "/rest/v1/review_queue", headers=privileged, params={"user_id": "eq." + owner}
        ).json()
        slug = next(
            (
                s
                for s in ["daily-standup", "bug-report", "phishing-incident-communication"]
                if not any(r["mission_slug"] == s for r in existing)
            ),
            None,
        )
        verify("unused_fixture_slot", slug is not None)
        question, answer = {
            "daily-standup": ("future-will", "write"),
            "bug-report": ("modal-should", "save"),
            "phishing-incident-communication": ("need-to-1", "to"),
        }[slug]
        fixture, concept = str(uuid4()), "validation-" + str(uuid4())
        selector = {"id": "eq." + fixture, "user_id": "eq." + owner}
        created = remote.post(
            url + "/rest/v1/review_queue",
            headers=privileged,
            json={
                "id": fixture,
                "user_id": owner,
                "mission_slug": slug,
                "concept_id": concept,
                "due_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
                "interval_days": 1,
                "streak": 0,
                "reason": "Temporary integration validation fixture",
            },
        )
        verify("temporary_fixture_created", created.status_code == 201)
        try:
            for index, (response, confidence, expected) in enumerate(
                [
                    (answer, 5, 3),
                    (answer, 5, 7),
                    (answer, 5, 14),
                    (answer, 5, 30),
                    ("incorrect", 5, 1),
                    (answer, 1, 2),
                ]
            ):
                if index:
                    moved = remote.patch(
                        url + "/rest/v1/review_queue",
                        headers=privileged,
                        params=selector,
                        json={
                            "due_at": (
                                datetime.now(timezone.utc) - timedelta(minutes=1)
                            ).isoformat()
                        },
                    )
                    verify(f"fixture_due_{index}", moved.status_code == 200)
                payload = {
                    "review_id": fixture,
                    "question_id": question,
                    "answer": response,
                    "confidence": confidence,
                }
                result = api.post("/api/v1/review/answer", headers=headers, json=payload)
                verify(
                    f"review_interval_{expected}",
                    result.status_code == 200
                    and result.json().get("interval_days") == expected
                    and result.json().get("xp_awarded") == 0,
                )
                queue = api.get("/api/v1/review/queue", headers=headers).json()
                row = next(r for r in queue if r["id"] == fixture)
                remaining = datetime.fromisoformat(row["due_at"]) - datetime.now(timezone.utc)
                verify(
                    f"persisted_schedule_{expected}",
                    row["interval_days"] == expected
                    and row["version"] == index + 1
                    and not row["due"]
                    and abs(remaining.total_seconds() - expected * 86400) < 60,
                )
                verify(
                    f"early_repeat_denied_{expected}",
                    api.post(
                        "/api/v1/review/answer",
                        headers=headers,
                        json=payload,
                    ).status_code
                    == 409,
                )
            verify(
                "review_does_not_farm_xp",
                api.get(
                    "/api/v1/progress",
                    headers=headers,
                ).json()
                == before,
            )
        finally:
            removed = remote.delete(
                url + "/rest/v1/review_queue", headers=privileged, params=selector
            )
            mastery = remote.delete(
                url + "/rest/v1/concept_mastery",
                headers=privileged,
                params={"user_id": "eq." + owner, "concept_id": "eq." + concept},
            )
            checks["temporary_fixture_cleanup"] = (
                removed.status_code == 200 and mastery.status_code == 200
            )
        verify("temporary_fixture_cleanup", checks["temporary_fixture_cleanup"])
    evidence = {
        "date": datetime.now(timezone.utc).isoformat(),
        "scope": "Real FastAPI ASGI app, hosted Supabase; temporary review fixture with controlled due dates; no browser or OpenAI call in this check",
        "checks": checks,
    }
    (ROOT / "docs/evidence/phase-2/persistence-check.json").write_text(
        json.dumps(evidence, indent=2) + "\n"
    )
    print(json.dumps({"passed": len(checks), "checks": checks}))


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # noqa: BLE001 — redact all remote errors at CLI boundary
        # Exception messages can contain remote URLs or response data. Never print them.
        print(json.dumps({"passed": False, "error_type": type(exc).__name__}))
        sys.exit(1)
