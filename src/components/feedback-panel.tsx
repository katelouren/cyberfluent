"use client";
import { useState } from "react";
import { api, type Envelope } from "@/lib/api";
import Link from "next/link";
import { messages } from "@/messages/pt-BR";
export function FeedbackPanel({
  result,
  attemptId,
  missionSlug,
  onCompleted,
}: {
  result: Envelope;
  attemptId: string;
  missionSlug: string;
  onCompleted: () => void;
}) {
  const f = result.feedback;
  const [confidence, setConfidence] = useState(3);
  const [xp, setXp] = useState(0);
  const [recall, setRecall] = useState(false),
    [answer, setAnswer] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api<{
        correct: boolean;
        explanation: string;
        xp_awarded: number;
      }>("review/answer", {
        question_id: f.retrieval_question.id,
        answer,
        attempt_id: attemptId,
        confidence,
        demo: result.ai_mode === "demo",
      });
      setXp(data.xp_awarded);
      setStatus(data.explanation);
      setDone(data.correct);
    } catch {
      setStatus("Não foi possível verificar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feedback" aria-label="Feedback da tutora">
      <span className={`badge ${result.ai_mode === "demo" ? "demo" : ""}`}>
        {result.ai_mode === "live" ? messages.live : messages.demo}
      </span>
      {!recall ? (
        <>
          <h2>
            Uma mensagem melhor.
            <br />
            Um conceito que fica.
          </h2>
          <h3>01 / Acerto comunicativo</h3>
          <p>{f.communication_success}</p>
          <h3>02 / Forma recomendada</h3>
          <blockquote lang="en">{f.corrected_answer}</blockquote>
          <p className="accent">
            Mudança em foco: <span lang="en">{f.highlighted_change}</span>
          </p>
          <h3>Entenda rápido</h3>
          <p>{f.quick_explanation}</p>
          <details>
            <summary>03 / Diagnóstico: língua, profissão e técnica</summary>
            {f.language_errors.length === 0 ? (
              <p>Nenhum erro linguístico apontado.</p>
            ) : (
              f.language_errors.map((e, i) => (
                <p key={i}>
                  <strong>{e.type}</strong>:{" "}
                  <span lang="en">
                    {e.original} → {e.correction}
                  </span>
                </p>
              ))
            )}
            <h4>Adequação profissional · {f.professional_feedback.status}</h4>
            <p>{f.professional_feedback.explanation}</p>
            <h4>Avaliação técnica · {f.technical_feedback.status}</h4>
            <p>{f.technical_feedback.explanation}</p>
          </details>
          <details>
            <summary>04 / Por que funciona</summary>
            <p>{f.deep_explanation}</p>
          </details>
          <details>
            <summary>05 / Mapa da frase</summary>
            <dl>
              {f.sentence_map.map((s, i) => (
                <div key={i}>
                  <dt lang="en">{s.segment}</dt>
                  <dd>
                    {s.role} — {s.meaning}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
          <details>
            <summary>06 / Compare as estruturas</summary>
            {f.contrasts.map((c, i) => (
              <div key={i}>
                <p lang="en">
                  <strong>{c.example}</strong>
                </p>
                <p>{c.explanation}</p>
              </div>
            ))}
          </details>
          <details>
            <summary>07 / No mundo tech</summary>
            {f.tech_examples.map((e, i) => (
              <div key={i}>
                <p lang="en">{e.english}</p>
                <p>{e.support_language}</p>
              </div>
            ))}
          </details>
          <details>
            <summary>08 / Sugestões de revisão</summary>
            {f.review_items.map((r, i) => (
              <p key={i}>
                {r.concept_id}: {r.reason} Rever em {r.next_review_days} dia(s).
              </p>
            ))}
            <p className="muted">
              Sugestão para estudo; a fila persistente será adicionada na Fase
              2.
            </p>
          </details>
          {f.needs_human_review && (
            <p className="notice">
              Esta explicação pede revisão humana. Use-a como apoio, não como
              fonte oficial.
            </p>
          )}
          <button className="button primary" onClick={() => setRecall(true)}>
            Praticar sem consultar o feedback →
          </button>
        </>
      ) : (
        <>
          <p className="eyebrow">RECUPERAÇÃO ATIVA</p>
          <h2>Agora, com suas palavras.</h2>
          <p lang="en">{f.retrieval_question.prompt}</p>
          <form onSubmit={check}>
            <label htmlFor="recall">Palavra que completa a frase</label>
            <input
              id="recall"
              autoComplete="off"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
              maxLength={200}
              disabled={done}
            />
            <button className="button primary" disabled={busy || done}>
              {busy ? "Verificando…" : "Verificar resposta"}
            </button>
          </form>
          <p role="status">{status}</p>
          {done && (
            <div className="success">
              <h3>Prática concluída ✓</h3>
              <p>
                {result.ai_mode === "demo"
                  ? "Demonstração concluída, sem XP real."
                  : `+${xp} XP por competências demonstradas.`}
              </p>
              <Link className="button" href="/progresso">
                Ver progresso
              </Link>
              <Link className="button" href="/revisao">
                Minha revisão
              </Link>
              {missionSlug === "phishing-incident-communication" && (
                <Link className="button primary" href="/academy-companion">
                  Continuar no English Readiness →
                </Link>
              )}
              <button className="button" onClick={onCompleted}>
                Iniciar nova produção
              </button>
              <p>
                Você recuperou a estrutura sem a resposta visível. Retome o
                conceito amanhã.
              </p>
            </div>
          )}
          <label htmlFor="confidence">{f.confidence_prompt}</label>
          <select
            id="confidence"
            value={confidence}
            disabled={done || busy}
            onChange={(e) => setConfidence(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
                {n === 1
                  ? " — pouca confiança"
                  : n === 5
                    ? " — muita confiança"
                    : ""}
              </option>
            ))}
          </select>
          <p className="muted">
            A confiança orienta o intervalo da próxima revisão. Escolha antes de
            verificar.
          </p>
          <button className="text-link" onClick={() => setRecall(false)}>
            Consultar explicação novamente
          </button>
        </>
      )}
      <p className="request-meta">
        {result.prompt_version} · requisição {result.request_id}
      </p>
    </section>
  );
}
