import { z } from "zod";
import { sessionHeaders } from "./supabase";
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
export async function api<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await sessionHeaders()),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(path.includes("tutor") ? 45000 : 15000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      "Não foi possível acessar o serviço. Tente novamente; sua resposta foi preservada.",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      typeof data?.detail === "string"
        ? data.detail
        : data?.detail?.message || "Serviço indisponível. Tente novamente.",
      data?.detail?.demo_available === true,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      "O serviço retornou uma resposta inválida. Tente novamente.",
    );
  }
}
export async function requestFeedback(
  answer: string,
  cefr: string,
  demo = false,
  mission_slug = "phishing-incident-communication",
  attempt_id?: string,
): Promise<Envelope> {
  return envelopeSchema.parse(
    await api("tutor/feedback", {
      answer,
      cefr,
      demo,
      mission_slug,
      attempt_id,
      source_locale: "pt-BR",
      target_locale: "en",
    }),
  );
}
export const gameSchema = z.object({
  id: text,
  type: z.enum(["order", "select_many", "single", "classify"]),
  title: text,
  prompt: text,
  options: z.array(z.object({ id: text, text })),
  labels: z.array(text).optional(),
});
export const missionSchema = z.object({
  slug: text,
  title: text,
  scenario: text,
  briefing: text,
  language_objective: text,
  professional_objective: text,
  vocabulary: z.array(z.tuple([text, text])),
  grammar: text,
  worked_example: text,
  base_explanation: text,
  games: z.array(gameSchema),
  position: z.number(),
});
export type Mission = z.infer<typeof missionSchema>;
export type Game = z.infer<typeof gameSchema>;
export const profileSchema = z.object({
  source_locale: z.literal("pt-BR"),
  target_locale: z.literal("en"),
  cefr: z.enum(["A1", "A2", "B1"]),
  area: z.enum(["development", "security", "support", "other"]),
  role: text,
  goal: text,
  daily_minutes: z.union([
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(20),
    z.literal(30),
  ]),
});
export type Profile = z.infer<typeof profileSchema>;
export const progressSchema = z.object({
  missions: z.array(
    z.object({
      mission_slug: text,
      context_xp: z.number(),
      language_xp: z.number(),
      communication_xp: z.number(),
      completed_at: text,
    }),
  ),
  competencies: z.object({
    context_xp: z.number(),
    language_xp: z.number(),
    communication_xp: z.number(),
  }),
  total_xp: z.number(),
  readiness: text,
  mode: z.enum(["live", "demo"]),
});
export const queueSchema = z.array(
  z.object({
    id: text,
    mission_slug: text,
    concept_id: text,
    due_at: text,
    interval_days: z.number(),
    reason: text,
    due: z.boolean(),
    question: z.object({ id: text, prompt: text, answer_type: text }),
  }),
);
