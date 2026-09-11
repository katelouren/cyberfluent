from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Attempt(StrictModel):
    mission_slug: Literal["phishing-incident-communication"]
    answer: str = Field(min_length=10, max_length=2000)
    cefr: Literal["A1", "A2", "B1"] = "A2"
    source_locale: Literal["pt-BR"] = "pt-BR"
    target_locale: Literal["en"] = "en"
    demo: bool = False


class LanguageError(StrictModel):
    type: Literal["grammar", "vocabulary", "spelling", "pragmatics"]
    original: str
    correction: str
    concept_id: str


class Professional(StrictModel):
    status: Literal["appropriate", "partially_appropriate", "inappropriate", "not_applicable"]
    explanation: str


class Technical(StrictModel):
    status: Literal["correct", "partially_correct", "incorrect", "not_applicable"]
    explanation: str


class Segment(StrictModel):
    segment: str
    role: str
    meaning: str


class Contrast(StrictModel):
    example: str
    label: Literal["correct", "common_error", "comparison"]
    explanation: str


class Example(StrictModel):
    english: str
    support_language: str


class Retrieval(StrictModel):
    id: str
    prompt: str
    answer_type: Literal["fill_blank", "rewrite", "multiple_choice", "short_answer"]


class Review(StrictModel):
    concept_id: str
    reason: str
    next_review_days: int = Field(ge=1, le=30)


class Feedback(StrictModel):
    communication_success: str
    corrected_answer: str
    highlighted_change: str
    language_errors: list[LanguageError]
    professional_feedback: Professional
    technical_feedback: Technical
    quick_explanation: str
    deep_explanation: str
    sentence_map: list[Segment]
    contrasts: list[Contrast]
    tech_examples: list[Example]
    retrieval_question: Retrieval
    review_items: list[Review]
    confidence_prompt: str
    needs_human_review: bool


class Envelope(StrictModel):
    feedback: Feedback
    ai_mode: Literal["live", "demo"]
    prompt_version: str
    request_id: str


class RecallAnswer(StrictModel):
    question_id: Literal["need-to-1"]
    answer: str = Field(min_length=1, max_length=200)
