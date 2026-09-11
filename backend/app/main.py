import os
import re
import time
from collections import deque
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAIError
from pydantic import ValidationError

from .providers import MISSION, DemoTutorProvider, OpenAITutorProvider, ProviderUnavailable
from .schemas import Attempt, Envelope, RecallAnswer, Retrieval

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
app = FastAPI(title="Cyber.fluent API", version="0.1.0")
live_provider = OpenAITutorProvider()
demo_provider = DemoTutorProvider()
requests_window: deque[float] = deque()
INJECTION = re.compile(
    r"(ignore|disregard).{0,40}(instructions|rules|prompt)|reveal.{0,30}(prompt|secret|key)|ignore.{0,30}(instruções|regras)|revele.{0,30}(prompt|segredo|chave)",
    re.IGNORECASE | re.DOTALL,
)
RETRIEVAL = Retrieval(
    id="need-to-1",
    prompt="Complete: The analyst needs ___ review the alert and notify the manager.",
    answer_type="fill_blank",
)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Default validation errors echo input; never return submitted content.
    return JSONResponse(
        status_code=422,
        content={"detail": "Entrada inválida. Use 10 a 2000 caracteres e os campos permitidos."},
    )


@app.middleware("http")
async def limits(request: Request, call_next):
    if request.method == "POST":
        now = time.monotonic()
        while requests_window and requests_window[0] < now - 60:
            requests_window.popleft()
        if len(requests_window) >= 20:
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
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "openai",
        "configured": bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_MODEL")),
        "demo_enabled": os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() == "true",
    }


@app.get("/api/v1/missions/{slug}")
def mission(slug: str):
    if slug != MISSION["slug"]:
        raise HTTPException(404, "Missão não encontrada.")
    return MISSION


@app.post("/api/v1/tutor/feedback", response_model=Envelope)
async def feedback(attempt: Attempt):
    if INJECTION.search(attempt.answer):
        raise HTTPException(
            422, "Escreva apenas uma orientação profissional para o cenário da missão."
        )
    if attempt.demo and os.getenv("AI_DEMO_FALLBACK_ENABLED", "false").lower() != "true":
        raise HTTPException(403, "Fallback demo não habilitado no servidor.")
    try:
        result = await (demo_provider if attempt.demo else live_provider).feedback(attempt)
        # Curated retrieval: the answer remains exclusively on the server.
        result.retrieval_question = RETRIEVAL
        return Envelope(
            feedback=result,
            ai_mode="demo" if attempt.demo else "live",
            prompt_version="tutor-v2",
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
def recall(answer: RecallAnswer):
    correct = answer.answer.strip().lower().strip(". ") == "to"
    return {
        "correct": correct,
        "explanation": "To marca o infinitivo depois de needs."
        if correct
        else "Ainda não. Pense no marcador que conecta needs ao verbo na forma base. Tente novamente.",
    }
