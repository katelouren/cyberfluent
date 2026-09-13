"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { officialLinks, allowedOfficialLink } from "@/config/official-links";
import { brand } from "@/config/brand";
import { RequireSession } from "@/components/session";
function Companion() {
  const [answer, setAnswer] = useState(""),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const r = await api<{ correct: boolean; explanation: string }>(
        "companion/answer",
        { answer },
      );
      setResult(
        `${r.correct ? "✓ Correto." : "↺ Reveja a interpretação."} ${r.explanation}`,
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">ENGLISH READINESS</p>
      <h1>Palo Alto Learning Companion</h1>
      <p>
        Você praticou uma orientação defensiva em inglês. Agora, confira sua
        compreensão de uma expressão antes de explorar os recursos oficiais.
      </p>
      <p className="notice">
        Atividade linguística original. Não é questão oficial, certificação ou
        garantia de aprovação.
      </p>
      <blockquote lang="en">
        Report the suspicious email through a trusted channel.
      </blockquote>
      <fieldset>
        <legend>O que significa trusted channel nesta orientação?</legend>
        {[
          {
            id: "known",
            text: "A known, verified way to contact the security team.",
          },
          {
            id: "sender",
            text: "Any address supplied by the suspicious sender.",
          },
        ].map((o) => (
          <label key={o.id} className="email-line">
            <input
              type="radio"
              name="companion"
              checked={answer === o.id}
              onChange={() => setAnswer(o.id)}
            />
            <span lang="en">{o.text}</span>
          </label>
        ))}
      </fieldset>
      <button
        className="button primary"
        disabled={!answer || busy}
        onClick={check}
      >
        Verificar compreensão
      </button>
      <p role="status">{result}</p>
      {allowedOfficialLink(officialLinks.academy) && (
        <a
          className="button"
          href={officialLinks.academy}
          target="_blank"
          rel="noopener noreferrer"
        >
          Continuar na Academy oficial ↗{" "}
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      )}
      <p className="muted">{brand.disclaimer}</p>
    </>
  );
}
export default function Page() {
  return (
    <main id="main" className="account-page">
      <RequireSession>
        <Companion />
      </RequireSession>
    </main>
  );
}
