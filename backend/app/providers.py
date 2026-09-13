import json
import os
from pathlib import Path
from typing import Protocol

from openai import AsyncOpenAI

from .catalog import MISSIONS, retrieval
from .schemas import Attempt, Feedback

ROOT = Path(__file__).parent
MISSION = json.loads((ROOT / "content/phishing.json").read_text())
PROMPT = (ROOT / "prompts/tutor-v3.txt").read_text()


class ProviderUnavailable(Exception):
    pass


class TutorProvider(Protocol):
    async def feedback(self, attempt: Attempt, context: dict | None = None) -> Feedback: ...


class OpenAITutorProvider:
    async def feedback(self, attempt: Attempt, context: dict | None = None) -> Feedback:
        if (
            os.getenv("AI_PROVIDER", "openai") != "openai"
            or not os.getenv("OPENAI_API_KEY")
            or not os.getenv("OPENAI_MODEL")
        ):
            raise ProviderUnavailable()
        async with AsyncOpenAI(timeout=35.0, max_retries=0) as client:
            response = await client.responses.parse(
                model=os.environ["OPENAI_MODEL"],
                store=False,
                max_output_tokens=4500,
                input=[
                    {"role": "system", "content": PROMPT},
                    {
                        "role": "developer",
                        "content": json.dumps(
                            {
                                "mission": MISSIONS[attempt.mission_slug],
                                "retrieval_question": retrieval(attempt.mission_slug),
                                "context": context or {"history": []},
                            },
                            ensure_ascii=False,
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps(
                            attempt.model_dump(mode="json", exclude={"demo", "attempt_id"}),
                            ensure_ascii=False,
                        ),
                    },
                ],
                text_format=Feedback,
            )
        if response.status != "completed" or response.output_parsed is None:
            raise ProviderUnavailable()
        return Feedback.model_validate(response.output_parsed.model_dump())


class DemoTutorProvider:
    async def feedback(self, attempt: Attempt, context: dict | None = None) -> Feedback:
        # A curated example, intentionally never presented as analysis of the submission.
        return Feedback.model_validate(
            json.loads(
                (
                    ROOT
                    / "content"
                    / (
                        "demo-feedback.json"
                        if attempt.mission_slug == "phishing-incident-communication"
                        else f"demo-{attempt.mission_slug}.json"
                    )
                ).read_text()
            )
        )
