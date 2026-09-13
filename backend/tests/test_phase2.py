import asyncio
import json
import time
from unittest.mock import AsyncMock
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import auth, main
from app.catalog import GAMES, MISSIONS, RETRIEVALS, SLUGS, public_mission
from app.companion import ALLOWED_URLS, companion
from app.learning import schedule
from app.storage import _demo_data, _demo_sessions


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    main.requests_window.clear()
    main.app.dependency_overrides.clear()
    _demo_data.clear()
    _demo_sessions.clear()
    monkeypatch.setenv("AI_DEMO_FALLBACK_ENABLED", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://unit.example")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")


@pytest.fixture
def token_factory(monkeypatch):
    private = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    public.update(kid="test-signing", alg="ES256")
    monkeypatch.setattr(auth, "signing_keys", AsyncMock(return_value={"keys": [public]}))

    def make(**changes):
        payload = {
            "sub": str(uuid4()),
            "iss": "https://unit.example/auth/v1",
            "aud": "authenticated",
            "role": "authenticated",
            "exp": int(time.time()) + 300,
            "iat": int(time.time()) - 5,
            **changes,
        }
        return jwt.encode(payload, private, algorithm="ES256", headers={"kid": "test-signing"})

    return make


def test_valid_signed_jwt(token_factory):
    result = asyncio.run(auth.verify_token(token_factory()))
    assert result.demo is False


@pytest.mark.parametrize(
    "claims",
    [
        {"exp": 1},
        {"iss": "https://other.example/auth/v1"},
        {"aud": "other"},
        {"role": "service_role"},
        {"sub": "bad-id"},
        {"is_anonymous": True},
    ],
)
def test_reject_jwt_claims(token_factory, claims):
    with pytest.raises(HTTPException) as e:
        asyncio.run(auth.verify_token(token_factory(**claims)))
    assert e.value.status_code == 401


def test_reject_tampered_signature(token_factory):
    token = token_factory()
    a, b, c = token.split(".")
    corrupted = f"{a}.{b}.{'A' if c[0] != 'A' else 'B'}{c[1:]}"
    with pytest.raises(HTTPException) as e:
        asyncio.run(auth.verify_token(corrupted))
    assert e.value.status_code == 401


def test_reject_unsigned_and_legacy():
    for token in [
        jwt.encode({"sub": str(uuid4())}, "", algorithm="none"),
        jwt.encode(
            {"sub": str(uuid4())}, "a-local-test-signing-placeholder-long", algorithm="HS256"
        ),
        "not-a-jwt",
    ]:
        with pytest.raises(HTTPException) as e:
            asyncio.run(auth.verify_token(token))
        assert e.value.status_code == 401


def test_jwks_outage_is_safe(monkeypatch, token_factory):
    monkeypatch.setattr(
        auth,
        "signing_keys",
        AsyncMock(side_effect=HTTPException(503, "Autenticação indisponível.")),
    )
    with pytest.raises(HTTPException) as e:
        asyncio.run(auth.verify_token(token_factory()))
    assert e.value.status_code == 503


def test_no_auth_rejected_before_provider(monkeypatch):
    provider = AsyncMock()
    monkeypatch.setattr(main.live_provider, "feedback", provider)
    c = TestClient(main.app)
    for path in ["profile", "progress", "review/queue"]:
        assert c.get(f"/api/v1/{path}").status_code == 401
    r = c.post(
        "/api/v1/tutor/feedback",
        json={"mission_slug": SLUGS[0], "answer": "Today I will write tests."},
    )
    assert r.status_code == 401
    provider.assert_not_called()


def session(c):
    token = c.post("/api/v1/demo/session").json()["token"]
    return {"X-Demo-Session": token}


PROFILE = {
    "cefr": "A2",
    "area": "development",
    "role": "Student",
    "goal": "Communicate at work",
    "daily_minutes": 10,
    "source_locale": "pt-BR",
    "target_locale": "en",
}


@pytest.mark.parametrize("slug", SLUGS)
def test_demo_complete_isolated_flow_no_real_xp(slug, monkeypatch):
    provider = AsyncMock()
    monkeypatch.setattr(main.live_provider, "feedback", provider)
    c = TestClient(main.app)
    a = session(c)
    b = session(c)
    assert c.post("/api/v1/onboarding", headers=a, json=PROFILE).status_code == 200
    assert c.get("/api/v1/profile", headers=b).json()["profile"] is None
    games = {g["id"]: g["accepted"] for g in GAMES[slug]}
    attempt = c.post(
        "/api/v1/attempts", headers=a, json={"mission_slug": slug, "games": games}
    ).json()["attempt_id"]
    payload = {
        "mission_slug": slug,
        "attempt_id": attempt,
        "answer": "This is a synthetic written response.",
    }
    assert c.post("/api/v1/tutor/feedback", headers=b, json=payload).status_code == 404
    r = c.post("/api/v1/tutor/feedback", headers=a, json=payload)
    assert r.status_code == 200
    assert r.json()["ai_mode"] == "demo"
    q = RETRIEVALS[slug]
    recall = {
        "attempt_id": attempt,
        "question_id": q["id"],
        "answer": q["answers"][0],
        "confidence": 4,
    }
    result = c.post("/api/v1/review/answer", headers=a, json=recall)
    assert result.json()["correct"] is True
    assert result.json()["xp_awarded"] == 0
    assert c.post("/api/v1/review/answer", headers=a, json=recall).json()["xp_awarded"] == 0
    assert len(c.get("/api/v1/progress", headers=a).json()["missions"]) == 1
    assert c.get("/api/v1/progress", headers=b).json()["missions"] == []
    queue = c.get("/api/v1/review/queue", headers=a).json()
    assert len(queue) == 1 and queue[0]["due"] is False
    assert "answers" not in queue[0]["question"]
    provider.assert_not_called()


def test_wrong_games_and_forged_owner_rejected():
    c = TestClient(main.app)
    a = session(c)
    c.post("/api/v1/onboarding", headers=a, json=PROFILE)
    assert (
        c.post(
            "/api/v1/attempts", headers=a, json={"mission_slug": SLUGS[0], "games": {}}
        ).status_code
        == 422
    )
    assert (
        c.post(
            "/api/v1/onboarding", headers=a, json={**PROFILE, "user_id": str(uuid4())}
        ).status_code
        == 422
    )


def test_public_catalog_no_answer_keys():
    assert len(MISSIONS) == 3
    for slug in SLUGS:
        public = public_mission(slug)
        assert len(public["games"]) == 2
        assert "accepted_answers" not in public
        assert all("accepted" not in g for g in public["games"])


@pytest.mark.parametrize(
    "correct,confidence,streak,days",
    [
        (False, 5, 3, 1),
        (True, 1, 3, 2),
        (True, 5, 0, 3),
        (True, 5, 1, 7),
        (True, 5, 2, 14),
        (True, 5, 3, 30),
        (True, 5, 9, 30),
    ],
)
def test_schedule(correct, confidence, streak, days):
    assert schedule(correct, confidence, streak)["interval_days"] == days


def test_companion_allowlist():
    url = companion()["url"]
    assert url in ALLOWED_URLS
    assert url + "?redirect=https://untrusted.example" not in ALLOWED_URLS
    assert "https://www.paloaltonetworks.com.evil.example" not in ALLOWED_URLS


def test_supabase_adapter_uses_user_jwt_for_reads_and_secret_only_for_writes(monkeypatch):
    import httpx

    from app.storage import SupabaseStore

    identity = auth.Identity("00000000-0000-4000-8000-000000000001", "unit-user-token")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "unit-public-placeholder")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "unit-server-placeholder")
    calls = []

    async def send(self, method, url, **kw):
        calls.append((method, url, kw))
        return httpx.Response(200, json=[], request=httpx.Request(method, url))

    monkeypatch.setattr(httpx.AsyncClient, "request", send)
    store = SupabaseStore(identity)
    asyncio.run(store.progress())
    asyncio.run(
        store.rpc(
            "finish_attempt",
            p_attempt_id=str(uuid4()),
            p_correct=True,
            p_confidence=3,
            p_concept="need-to-1",
        )
    )
    read = calls[0][2]
    write = calls[1][2]
    assert read["headers"]["Authorization"] == "Bearer unit-user-token"
    assert read["params"]["user_id"] == f"eq.{identity.user_id}"
    assert write["headers"]["apikey"] == "unit-server-placeholder"
    assert "Authorization" not in write["headers"]
    assert write["json"]["p_user_id"] == identity.user_id


def test_companion_rejects_nested_input():
    c = TestClient(main.app)
    headers = session(c)
    assert (
        c.post("/api/v1/companion/answer", headers=headers, json={"answer": {}}).status_code == 422
    )
