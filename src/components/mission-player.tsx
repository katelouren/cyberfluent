"use client";
import { useState } from "react";
import { ApiError, requestFeedback, type Envelope } from "@/lib/api";
import { messages } from "@/messages/pt-BR";
import { FeedbackPanel } from "./feedback-panel";
const clues = [
  {
    text: "From: IT Support <help@northstar-security.example>",
    risk: true,
    why: "O domínio difere do domínio oficial northstar.example. O nome exibido não garante a origem.",
  },
  {
    text: "Subject: Your account will be closed in 10 minutes",
    risk: true,
    why: "A urgência pressiona você a agir sem verificar.",
  },
  {
    text: "Please enter your password at northstar-verify.example",
    risk: true,
    why: "O pedido de senha leva a outro domínio. Acesse o site oficial independentemente.",
  },
  {
    text: "Hello Alex,",
    risk: false,
    why: "Uma saudação com nome, sozinha, não comprova risco nem legitimidade.",
  },
];
export function MissionPlayer() {
  const [stage, setStage] = useState(0),
    [selected, setSelected] = useState<number[]>([]),
    [checked, setChecked] = useState(false),
    [answer, setAnswer] = useState(""),
    [cefr, setCefr] = useState("A2"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false),
    [result, setResult] = useState<Envelope>();
  const correct =
    selected.length === 3 && [0, 1, 2].every((n) => selected.includes(n));
  async function submit(useDemo = false) {
    setBusy(true);
    setError("");
    setResult(undefined);
    setDemo(false);
    try {
      setResult(await requestFeedback(answer, cefr, useDemo));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : messages.unavailable);
      setDemo(e instanceof ApiError && e.demoAvailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mission-layout">
      <aside className="mission-sidebar">
        <p className="eyebrow">MISSION / 01</p>
        <h2>
          Sua comunicação
          <br />
          faz a diferença.
        </h2>
        <ol className="step-list">
          {["Prepare-se", "Spot the Risk", "Escreva e aprenda"].map((s, i) => (
            <li key={s} aria-current={stage === i ? "step" : undefined}>
              <span>{i < stage ? "✓" : `0${i + 1}`}</span>
              {s}
            </li>
          ))}
        </ol>
        <label htmlFor="mission-progress">Etapa {stage + 1} de 3</label>
        <progress id="mission-progress" value={stage + 1} max={3} />
        <p className="muted">
          Cenário fictício · Sem cronômetro
          <br />
          Seu ritmo, sua próxima tentativa.
        </p>
      </aside>
      <div className="mission-content">
        <span className="badge">
          {result
            ? result.ai_mode === "live"
              ? messages.live
              : messages.demo
            : messages.pending}
        </span>
        {stage === 0 ? (
          <section>
            <p className="eyebrow">BRIEFING / TECH ENGLISH STARTER PATH</p>
            <h1>Phishing Incident Communication</h1>
            <p className="lead">
              Alex precisa de uma orientação. Você é a pessoa de suporte.
            </p>
            <p>
              Na empresa fictícia Northstar, Alex recebeu um e-mail suspeito e
              inseriu a senha no site indicado. O domínio oficial é{" "}
              <code>northstar.example</code>.
            </p>
            <div className="callout">
              <strong>Sua missão</strong>
              <p>
                Encontre três pistas no e-mail. Depois, escreva de 2 a 4 frases
                em inglês para orientar Alex com clareza e sem culpa.
              </p>
            </div>
            <details>
              <summary>
                Antes de começar: o que você verificaria no e-mail?
              </summary>
              <p>
                Compare remetente e domínio com um canal conhecido. Urgência e
                pedidos de credenciais merecem atenção.
              </p>
            </details>
            <h3>Seu kit de linguagem</h3>
            <div className="vocabulary">
              {[
                ["suspicious", "suspeito"],
                ["report", "reportar"],
                ["credentials", "credenciais"],
                ["trusted channel", "canal confiável"],
              ].map(([a, b]) => (
                <div key={a}>
                  <strong lang="en">{a}</strong>
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <h3>Observe a estrutura</h3>
            <blockquote lang="en">
              You need to contact the support team.
            </blockquote>
            <p>
              <code>pessoa + need/needs + to + verbo base</code>
            </p>
            <p>
              <em>Need</em> expressa necessidade; <em>to</em> conecta à ação.
              Com <em>must</em>, não usamos <em>to</em>:{" "}
              <span lang="en">You must contact support.</span>
            </p>
            <label htmlFor="cefr">Nível de inglês para o feedback</label>
            <select
              id="cefr"
              value={cefr}
              onChange={(e) => setCefr(e.target.value)}
            >
              <option>A1</option>
              <option>A2</option>
              <option>B1</option>
            </select>
            <button className="button primary" onClick={() => setStage(1)}>
              Começar Spot the Risk →
            </button>
          </section>
        ) : stage === 1 ? (
          <section>
            <p className="eyebrow">PLAY / DEFENSIVE THINKING</p>
            <h1>Spot the Risk</h1>
            <p>
              Selecione as três pistas suspeitas. Estes endereços são fictícios
              e não são links.
            </p>
            <fieldset className="email">
              <legend>E-mail recebido por Alex · simulação</legend>
              {clues.map((c, i) => (
                <label
                  className={`email-line ${selected.includes(i) ? "selected" : ""}`}
                  key={c.text}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(i)}
                    onChange={() => {
                      setChecked(false);
                      setSelected((s) =>
                        s.includes(i) ? s.filter((n) => n !== i) : [...s, i],
                      );
                    }}
                  />
                  <span lang="en">{c.text}</span>
                </label>
              ))}
            </fieldset>
            <button className="button primary" onClick={() => setChecked(true)}>
              Verificar pistas
            </button>
            {checked && (
              <div
                aria-live="polite"
                className={correct ? "success" : "notice"}
              >
                <h3>
                  {correct
                    ? "✓ Três pistas identificadas"
                    : "↺ Revise sua seleção"}
                </h3>
                {clues
                  .filter((c, i) => selected.includes(i) || c.risk)
                  .map((c) => (
                    <p key={c.text}>{c.why}</p>
                  ))}
              </div>
            )}
            {checked && correct && (
              <button className="button primary" onClick={() => setStage(2)}>
                Orientar Alex em inglês →
              </button>
            )}
            <button className="text-link" onClick={() => setStage(0)}>
              Voltar ao briefing
            </button>
          </section>
        ) : (
          <section>
            <p className="eyebrow">PRODUCE / SUA VEZ DE COMUNICAR</p>
            <h1>
              Help Alex take
              <br />
              the next step.
            </h1>
            <p>
              Alex inseriu a senha no site suspeito. Oriente a troca pelo site
              oficial e o reporte ao time de segurança por um canal conhecido.
              Explique o que evitar.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label htmlFor="answer">Sua orientação em inglês</label>
              <textarea
                id="answer"
                lang="en"
                placeholder="Hi Alex, …"
                minLength={10}
                maxLength={2000}
                required
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setResult(undefined);
                  setError("");
                  setDemo(false);
                }}
                disabled={busy}
                aria-describedby="privacy count"
              />
              <div id="count" className="count">
                {answer.length} / 2000 caracteres
              </div>
              <p id="privacy" className="muted">
                {messages.privacy}
              </p>
              <button
                className="button primary"
                disabled={busy || answer.trim().length < 10}
              >
                {busy ? messages.loading : messages.send}
              </button>
            </form>
            <div aria-live="polite">
              {busy && <p>{messages.loading}</p>}
              {error && (
                <div className="notice" role="alert">
                  <p>{error}</p>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => submit()}
                  >
                    {messages.retry}
                  </button>
                  {demo && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => submit(true)}
                    >
                      {messages.fallback}
                    </button>
                  )}
                </div>
              )}
            </div>
            {result && (
              <FeedbackPanel key={result.request_id} result={result} />
            )}
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                setStage(1);
                setResult(undefined);
              }}
            >
              Voltar ao minigame
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
