"use client";
import { useState } from "react";
import { api, type Game } from "@/lib/api";
export function Minigame({
  game,
  slug,
  onComplete,
}: {
  game: Game;
  slug: string;
  onComplete: (answers: string[]) => void;
}) {
  const [answers, setAnswers] = useState<string[]>([]),
    [result, setResult] = useState<{ correct: boolean; explanation: string }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function update(next: string[]) {
    setAnswers(next);
    setResult(undefined);
  }
  async function check() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ correct: boolean; explanation: string }>(
        "games/answer",
        { mission_slug: slug, game_id: game.id, answers },
      );
      setResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível verificar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <p className="eyebrow">PLAY / DECIDA E COMUNIQUE</p>
      <h2>{game.title}</h2>
      <p>{game.prompt}</p>
      {game.type === "order" ? (
        <>
          <ol className="message-order" aria-label="Sua sequência">
            {answers.map((id, i) => (
              <li key={id}>
                <span lang="en">
                  {game.options.find((o) => o.id === id)?.text}
                </span>
                <button
                  className="text-link"
                  aria-label={`Remover trecho ${i + 1}`}
                  disabled={busy}
                  onClick={() => update(answers.filter((x) => x !== id))}
                >
                  Remover
                </button>
              </li>
            ))}
          </ol>
          <div className="game-options">
            {game.options.map((o) => (
              <button
                className="choice"
                key={o.id}
                disabled={busy || answers.includes(o.id)}
                onClick={() => update([...answers, o.id])}
                lang="en"
              >
                {o.text}
              </button>
            ))}
          </div>
        </>
      ) : game.type === "classify" ? (
        <div>
          {game.options.map((o, i) => (
            <div key={o.id}>
              <label htmlFor={`class-${o.id}`} lang="en">
                {o.text}
              </label>
              <select
                id={`class-${o.id}`}
                value={answers[i] || ""}
                disabled={busy}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  update(next);
                }}
              >
                <option value="">Escolha a categoria</option>
                {game.labels?.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : (
        <fieldset className="email">
          <legend>
            Escolha {game.type === "single" ? "uma opção" : "as pistas"}
          </legend>
          {game.options.map((o) => (
            <label
              className={`email-line ${answers.includes(o.id) ? "selected" : ""}`}
              key={o.id}
            >
              <input
                type={game.type === "single" ? "radio" : "checkbox"}
                name={game.id}
                checked={answers.includes(o.id)}
                disabled={busy}
                onChange={() =>
                  update(
                    game.type === "single"
                      ? [o.id]
                      : answers.includes(o.id)
                        ? answers.filter((a) => a !== o.id)
                        : [...answers, o.id],
                  )
                }
              />
              <span lang="en">{o.text}</span>
            </label>
          ))}
        </fieldset>
      )}
      <button
        className="button primary"
        disabled={busy || answers.length === 0}
        onClick={check}
      >
        {busy ? "Verificando…" : "Verificar resposta da atividade"}
      </button>
      <div aria-live="polite">
        {error && <p className="notice">{error}</p>}
        {result && (
          <div className={result.correct ? "success" : "notice"}>
            <strong>
              {result.correct ? "✓ Boa decisão" : "↺ Revise sua resposta"}
            </strong>
            <p>{result.explanation}</p>
          </div>
        )}
      </div>
      {result?.correct && (
        <button className="button primary" onClick={() => onComplete(answers)}>
          Continuar missão →
        </button>
      )}
    </section>
  );
}
