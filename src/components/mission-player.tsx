"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  api,
  ApiError,
  missionSchema,
  profileSchema,
  requestFeedback,
  type Mission,
  type Profile,
  type Envelope,
} from "@/lib/api";
import { messages } from "@/messages/pt-BR";
import { RequireSession, useSession } from "./session";
import { Minigame } from "./minigame";
import { FeedbackPanel } from "./feedback-panel";
function Player({ slug }: { slug: string }) {
  const { mode } = useSession();
  const [mission, setMission] = useState<Mission>(),
    [profile, setProfile] = useState<Profile>(),
    [stage, setStage] = useState(0),
    [games, setGames] = useState<Record<string, string[]>>({}),
    [attemptId, setAttemptId] = useState<string>(),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false),
    [result, setResult] = useState<Envelope>(),
    [loadError, setLoadError] = useState(""),
    [reload, setReload] = useState(0);
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      api(`missions/${slug}`),
      api<{ profile: Profile | null }>("profile"),
    ])
      .then(([m, p]) => {
        if (!active) return;
        setMission(missionSchema.parse(m));
        if (p.profile) setProfile(profileSchema.parse(p.profile));
      })
      .catch((e) => {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : "Não foi possível carregar.",
          );
      });
    return () => {
      active = false;
    };
  }, [slug, reload]);
  useEffect(() => {
    if (stage > 0) heading.current?.focus();
  }, [stage]);
  async function submit(useDemo = false) {
    setBusy(true);
    setError("");
    setDemo(false);
    setResult(undefined);
    try {
      let id = attemptId;
      if (!id) {
        const started = await api<{ attempt_id: string }>("attempts", {
          mission_slug: slug,
          games,
        });
        id = started.attempt_id;
        setAttemptId(id);
      }
      setResult(
        await requestFeedback(answer, profile!.cefr, useDemo, slug, id),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.unavailable);
      setDemo(e instanceof ApiError && e.demoAvailable);
    } finally {
      setBusy(false);
    }
  }
  if (loadError)
    return (
      <div className="notice" role="alert">
        <p>{loadError}</p>
        <button
          className="button"
          onClick={() => {
            setLoadError("");
            setReload((n) => n + 1);
          }}
        >
          Tentar carregar novamente
        </button>
        <Link href="/login">Entrar novamente</Link>
      </div>
    );
  if (!mission) return <p role="status">Preparando sua missão…</p>;
  if (!profile)
    return (
      <div className="callout">
        <h1>Prepare seu perfil.</h1>
        <p>Escolha seu nível e objetivo antes de começar.</p>
        <Link className="button primary" href="/onboarding">
          Concluir onboarding
        </Link>
      </div>
    );
  const production = stage === mission.games.length + 1;
  const steps = [
    "Prepare-se",
    ...mission.games.map((g) => g.title),
    "Escreva e aprenda",
  ];
  return (
    <div className="mission-layout">
      <aside className="mission-sidebar">
        <p className="eyebrow">MISSION / 0{mission.position}</p>
        <h2>
          Sua comunicação
          <br />
          faz a diferença.
        </h2>
        <ol className="step-list">
          {steps.map((s, i) => (
            <li
              key={`${s}-${i}`}
              aria-current={stage === i ? "step" : undefined}
            >
              <span>{i < stage ? "✓" : `0${i + 1}`}</span>
              {s}
            </li>
          ))}
        </ol>
        <label htmlFor="mission-progress">
          Etapa {stage + 1} de {steps.length}
        </label>
        <progress id="mission-progress" value={stage + 1} max={steps.length} />
        <p className="muted">
          Cenário fictício · Sem cronômetro
          <br />
          Seu ritmo, sua próxima tentativa.
        </p>
        <Link href="/trilhas" className="text-link">
          ← Voltar à trilha
        </Link>
      </aside>
      <div className="mission-content" ref={heading} tabIndex={-1}>
        <span
          className={`badge ${mode === "demo" || result?.ai_mode === "demo" ? "demo" : ""}`}
        >
          {result
            ? result.ai_mode === "live"
              ? messages.live
              : messages.demo
            : mode === "demo"
              ? messages.demo
              : messages.pending}
        </span>
        {stage === 0 ? (
          <section>
            <p className="eyebrow">BRIEFING / TECH ENGLISH STARTER PATH</p>
            <h1>{mission.title}</h1>
            <p className="lead">{mission.scenario}</p>
            <div className="callout">
              <strong>Sua missão</strong>
              <p>{mission.briefing}</p>
            </div>
            <details>
              <summary>Antes de começar: o que você precisa comunicar?</summary>
              <p>{mission.professional_objective}</p>
            </details>
            <h3>Seu kit de linguagem</h3>
            <div className="vocabulary">
              {mission.vocabulary.map(([a, b]) => (
                <div key={a}>
                  <strong lang="en">{a}</strong>
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <h3>Observe a estrutura</h3>
            <blockquote lang="en">{mission.worked_example}</blockquote>
            <p>
              <code>{mission.grammar}</code>
            </p>
            <p>{mission.base_explanation}</p>
            <p>
              Nível do seu perfil: {profile.cefr} ·{" "}
              <Link className="text-link" href="/onboarding">
                Ajustar perfil
              </Link>
            </p>
            <button className="button primary" onClick={() => setStage(1)}>
              Começar {mission.games[0].title} →
            </button>
          </section>
        ) : production ? (
          <section>
            <p className="eyebrow">PRODUCE / SUA VEZ DE COMUNICAR</p>
            <h1>
              {slug === "phishing-incident-communication"
                ? "Help Alex take the next step."
                : "Your message makes a difference."}
            </h1>
            <p>{mission.scenario}</p>
            <p>{mission.briefing}</p>
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
                placeholder="Write your message…"
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
                {mode === "demo"
                  ? "Modo demo: a escrita não é avaliada por IA. Você verá um exemplo curado."
                  : messages.privacy}
              </p>
              <button
                className="button primary"
                disabled={busy || answer.trim().length < 10}
              >
                {busy
                  ? messages.loading
                  : mode === "demo"
                    ? "Ver exemplo demo"
                    : messages.send}
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
            {result && attemptId && (
              <FeedbackPanel
                key={result.request_id}
                result={result}
                attemptId={attemptId}
                missionSlug={slug}
                onCompleted={() => setAttemptId(undefined)}
              />
            )}
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                setStage(0);
                setResult(undefined);
                setAttemptId(undefined);
              }}
            >
              Rever briefing
            </button>
          </section>
        ) : (
          <Minigame
            key={mission.games[stage - 1].id}
            game={mission.games[stage - 1]}
            slug={slug}
            onComplete={(answers) => {
              setGames({ ...games, [mission.games[stage - 1].id]: answers });
              setStage(stage + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}
export function MissionPlayer({
  slug = "phishing-incident-communication",
}: {
  slug?: string;
}) {
  return (
    <RequireSession>
      <Player slug={slug} />
    </RequireSession>
  );
}
