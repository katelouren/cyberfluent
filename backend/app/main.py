import os
import re
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAIError
from pydantic import ValidationError

from .auth import Identity, current_user
from .catalog import GAMES, MISSIONS, RETRIEVALS, SLUGS, grade_game, public_mission, retrieval
from .companion import companion
from .providers import DemoTutorProvider, OpenAITutorProvider, ProviderUnavailable
from .schemas import (
    Attempt,
    CompanionAnswer,
    Envelope,
    GameAnswer,
    Profile,
    RecallAnswer,
    Retrieval,
    StartAttempt,
)
from .storage import get_store, start_demo

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
app = FastAPI(title="Cyber.fluent API", version="0.1.0")
live_provider = OpenAITutorProvider()
demo_provider = DemoTutorProvider()
requests_window: deque[float] = deque()
INJECTION = re.compile(
    r"(ignore|disregard).{0,40}(instructions|rules|prompt)|reveal.{0,30}(prompt|secret|key)|ignore.{0,30}(instruções|regras)|revele.{0,30}(prompt|segredo|chave)",
    re.IGNORECASE | re.DOTALL,
)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Default validation errors echo input; never return submitted content.
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Entrada inválida. Confira os campos e seus limites. A escrita aceita 10 a 2000 caracteres."
        },
    )


@app.middleware("http")
async def limits(request: Request, call_next):
    if request.method == "POST":
        now = time.monotonic()
        while requests_window and requests_window[0] < now - 60:
            requests_window.popleft()
        if len(requests_window) >= 60:
            return JSONResponse(
                status_code=429, content={"detail": "Limite local atingido. Aguarde um minuto."}
            )
        requests_window.append(now)
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            chunks.append(chunk)
            if size > 12000:
                return JSONResponse(status_code=413, content={"detail": "Requisição muito grande."})
        request._body = b"".join(chunks)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Demo-Session"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "openai",
        "configured": bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_MODEL")),
        "auth_configured": bool(
            os.getenv("SUPABASE_URL")
            and os.getenv("SUPABASE_PUBLISHABLE_KEY")
            and os.getenv("SUPABASE_SECRET_KEY")
        ),
        "demo_enabled": os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() == "true",
    }


@app.post("/api/v1/demo/session")
def demo_session():
    if os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() != "true":
        raise HTTPException(403, "Modo demo desabilitado.")
    return start_demo()


@app.get("/api/v1/missions")
def missions():
    return [public_mission(slug) for slug in SLUGS]


@app.get("/api/v1/missions/{slug}")
def mission(slug: str):
    if slug not in MISSIONS:
        raise HTTPException(404, "Missão não encontrada.")
    return public_mission(slug)


@app.get("/api/v1/paths")
def paths():
    return [
        {
            "slug": "tech-english-starter-path",
            "title": "Tech English Starter Path",
            "missions": missions(),
        }
    ]


@app.get("/api/v1/profile")
async def profile(user: Annotated[Identity, Depends(current_user)]):
    return {"profile": await get_store(user).profile(), "mode": "demo" if user.demo else "live"}


@app.post("/api/v1/onboarding")
async def onboarding(profile: Profile, user: Annotated[Identity, Depends(current_user)]):
    return await get_store(user).upsert_profile(profile.model_dump())


@app.post("/api/v1/games/answer")
def game_answer(answer: GameAnswer, user: Annotated[Identity, Depends(current_user)]):
    return grade_game(answer.mission_slug, answer.game_id, answer.answers)


@app.post("/api/v1/attempts")
async def start_attempt(attempt: StartAttempt, user: Annotated[Identity, Depends(current_user)]):
    store = get_store(user)
    if not await store.profile():
        raise HTTPException(409, "Conclua o onboarding antes da missão.")
    expected = {g["id"] for g in GAMES[attempt.mission_slug]}
    if set(attempt.games) != expected or not all(
        grade_game(attempt.mission_slug, k, v)["correct"] for k, v in attempt.games.items()
    ):
        raise HTTPException(422, "Conclua os dois minigames para iniciar a produção escrita.")
    row = await store.start(attempt.mission_slug)
    return {"attempt_id": row["id"]}


@app.post("/api/v1/tutor/feedback", response_model=Envelope)
async def feedback(attempt: Attempt, user: Annotated[Identity, Depends(current_user)]):
    if INJECTION.search(attempt.answer):
        raise HTTPException(
            422, "Escreva apenas uma orientação profissional para o cenário da missão."
        )
    if attempt.attempt_id is None:
        raise HTTPException(422, "Inicie uma tentativa antes de pedir feedback.")
    store = get_store(user)
    row = await store.attempt(attempt.attempt_id)
    if row["mission_slug"] != attempt.mission_slug or row["recalled"]:
        raise HTTPException(409, "Tentativa incompatível ou já concluída.")
    use_demo = user.demo or attempt.demo
    if use_demo and os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() != "true":
        raise HTTPException(403, "Fallback demo não habilitado no servidor.")
    profile = await store.profile()
    if not profile:
        raise HTTPException(409, "Conclua o onboarding.")
    attempt = attempt.model_copy(
        update={
            "cefr": profile["cefr"],
            "source_locale": profile["source_locale"],
            "target_locale": profile["target_locale"],
        }
    )
    context = {
        "profile": {k: profile[k] for k in ("cefr", "source_locale", "target_locale", "role")},
        "history": await store.history(attempt.mission_slug),
        "review_concepts": [r["concept_id"] for r in await store.reviews()],
    }
    try:
        result = await (demo_provider if use_demo else live_provider).feedback(attempt, context)
        result.retrieval_question = Retrieval(**retrieval(attempt.mission_slug))
        # Persist only competence/error categories, not the student's prose or corrections.
        summary = {
            "language_errors": [
                {"concept_id": e.concept_id, "type": e.type} for e in result.language_errors
            ],
            "professional_feedback": {"status": result.professional_feedback.status},
            "technical_feedback": {"status": result.technical_feedback.status},
            "needs_human_review": result.needs_human_review,
        }
        if not use_demo or user.demo:
            await store.feedback(attempt.attempt_id, summary, "demo" if use_demo else "live")
        return Envelope(
            feedback=result,
            ai_mode="demo" if use_demo else "live",
            prompt_version="tutor-v3",
            request_id=str(uuid4()),
        )
    except (OpenAIError, ValidationError, ProviderUnavailable, ValueError):
        raise HTTPException(
            503,
            detail={
                "message": "IA indisponível ou resposta não validada. Tente novamente.",
                "demo_available": os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() == "true",
            },
        ) from None


@app.post("/api/v1/review/answer")
async def recall(answer: RecallAnswer, user: Annotated[Identity, Depends(current_user)]):
    store = get_store(user)
    if (answer.attempt_id is None) == (answer.review_id is None):
        raise HTTPException(422, "Informe uma tentativa ou uma revisão.")
    row = await (
        store.attempt(answer.attempt_id) if answer.attempt_id else store.review(answer.review_id)
    )
    q = RETRIEVALS[row["mission_slug"]]
    if answer.question_id != q["id"]:
        raise HTTPException(422, "Pergunta incompatível com a missão.")
    correct = answer.answer.strip().lower().strip(". ") in q["answers"]
    if answer.demo and not user.demo:
        if os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() != "true":
            raise HTTPException(403, "Demo desabilitado.")
        result = {"correct": correct, "xp_awarded": 0, "demo": True}
    elif answer.attempt_id:
        result = await store.finish(answer.attempt_id, correct, answer.confidence, q["id"])
    else:
        result = await store.answer_review(row, correct, answer.confidence)
    return {
        **result,
        "explanation": "Correto. Você recuperou a estrutura."
        if correct
        else "Ainda não. Pense na estrutura e tente novamente sem consultar a explicação.",
    }


@app.get("/api/v1/review/queue")
async def queue(user: Annotated[Identity, Depends(current_user)]):
    rows = await get_store(user).reviews()
    return [
        {
            **r,
            "question": retrieval(r["mission_slug"]),
            "due": datetime.fromisoformat(r["due_at"].replace("Z", "+00:00"))
            <= datetime.now(timezone.utc),
        }
        for r in rows
    ]


@app.get("/api/v1/progress")
async def progress(user: Annotated[Identity, Depends(current_user)]):
    rows = await get_store(user).progress()
    competencies = {
        key: sum(r[key] for r in rows) for key in ("context_xp", "language_xp", "communication_xp")
    }
    total = sum(competencies.values())
    return {
        "missions": rows,
        "competencies": competencies,
        "total_xp": total,
        "readiness": "Explorando" if total < 60 else "Praticando" if total < 140 else "Comunicando",
        "mode": "demo" if user.demo else "live",
    }


@app.get("/api/v1/companion")
def get_companion():
    return companion()


@app.post("/api/v1/companion/answer")
def companion_answer(answer: CompanionAnswer, user: Annotated[Identity, Depends(current_user)]):
    return {
        "correct": answer.answer == "known",
        "explanation": "Trusted channel é um canal conhecido e verificado, não um endereço indicado pelo remetente suspeito.",
    }
