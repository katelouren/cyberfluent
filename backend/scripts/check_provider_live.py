"""Optional three paid calls. Provider-only evidence, NOT Supabase acceptance."""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
load_dotenv(ROOT / "backend/.env")
from openai import OpenAIError

from app.providers import OpenAITutorProvider, ProviderUnavailable
from app.schemas import Attempt

CASES = [
    (
        "daily-standup",
        "Yesterday, I fixed the login bug. Today, I will writing tests. I need access to staging. Could you help me?",
    ),
    (
        "bug-report",
        "Click Save. The app should saves the task, but it shows Error 500. After refreshing, the task is missing. Users cannot record their work.",
    ),
    ("phishing-incident-communication", "You need change your password and report the email."),
]


async def main():
    if not os.getenv("OPENAI_API_KEY") or not os.getenv("OPENAI_MODEL"):
        print("Provider configuration missing; no calls made.")
        return 1
    records = []
    for slug, answer in CASES:
        try:
            result = await OpenAITutorProvider().feedback(
                Attempt(mission_slug=slug, answer=answer), {"history": [], "review_concepts": []}
            )
            cited = any(e.original in answer for e in result.language_errors)
            records.append(
                {
                    "mission": slug,
                    "structured_output_validated": True,
                    "input_excerpt_cited": cited,
                    "language_error_count": len(result.language_errors),
                    "professional_status": result.professional_feedback.status,
                    "technical_status": result.technical_feedback.status,
                }
            )
            print(json.dumps(records[-1]))
        except (OpenAIError, ProviderUnavailable, ValueError):
            print(f"Provider check failed for {slug}; private error details omitted.")
            return 1
    output = {
        "date": datetime.now(timezone.utc).isoformat(),
        "configured_model": os.getenv("OPENAI_MODEL"),
        "prompt_version": "tutor-v3",
        "scope": "provider only; no Supabase, JWT or browser integration proven by this check",
        "records": records,
    }
    (ROOT / "docs/evidence/phase-2/provider-check.json").write_text(
        json.dumps(output, indent=2) + "\n"
    )
    return 0 if all(r["input_excerpt_cited"] for r in records) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
