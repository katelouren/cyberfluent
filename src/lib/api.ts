import { z } from "zod";
const text = z.string();
export const envelopeSchema = z.object({
  ai_mode: z.enum(["live", "demo"]),
  prompt_version: text,
  request_id: text,
  feedback: z.object({
    communication_success: text,
    corrected_answer: text,
    highlighted_change: text,
    language_errors: z.array(
      z.object({
        type: z.enum(["grammar", "vocabulary", "spelling", "pragmatics"]),
        original: text,
        correction: text,
        concept_id: text,
      }),
    ),
    professional_feedback: z.object({
      status: z.enum([
        "appropriate",
        "partially_appropriate",
        "inappropriate",
        "not_applicable",
      ]),
      explanation: text,
    }),
    technical_feedback: z.object({
      status: z.enum([
        "correct",
        "partially_correct",
        "incorrect",
        "not_applicable",
      ]),
      explanation: text,
    }),
    quick_explanation: text,
    deep_explanation: text,
    sentence_map: z.array(
      z.object({ segment: text, role: text, meaning: text }),
    ),
    contrasts: z.array(
      z.object({
        example: text,
        label: z.enum(["correct", "common_error", "comparison"]),
        explanation: text,
      }),
    ),
    tech_examples: z.array(z.object({ english: text, support_language: text })),
    retrieval_question: z.object({
      id: text,
      prompt: text,
      answer_type: z.enum([
        "fill_blank",
        "rewrite",
        "multiple_choice",
        "short_answer",
      ]),
    }),
    review_items: z.array(
      z.object({
        concept_id: text,
        reason: text,
        next_review_days: z.number().int().min(1).max(30),
      }),
    ),
    confidence_prompt: text,
    needs_human_review: z.boolean(),
  }),
});
export type Envelope = z.infer<typeof envelopeSchema>;
export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export class ApiError extends Error {
  constructor(
    message: string,
    public demoAvailable = false,
  ) {
    super(message);
  }
}
export async function requestFeedback(
  answer: string,
  cefr: string,
  demo = false,
): Promise<Envelope> {
  const response = await fetch(`${apiUrl}/api/v1/tutor/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      mission_slug: "phishing-incident-communication",
      answer,
      cefr,
      source_locale: "pt-BR",
      target_locale: "en",
      demo,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      typeof data?.detail === "string"
        ? data.detail
        : data?.detail?.message || "IA indisponível. Tente novamente.",
      data?.detail?.demo_available === true,
    );
  }
  return envelopeSchema.parse(await response.json());
}
