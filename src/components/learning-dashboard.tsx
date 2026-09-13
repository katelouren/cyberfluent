"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  missionSchema,
  progressSchema,
  queueSchema,
  type Mission,
} from "@/lib/api";
import { RequireSession } from "./session";
import { z } from "zod";
function Navigation() {
  return (
    <nav className="learning-nav" aria-label="Aprendizado">
      <Link href="/trilhas">Trilha</Link>
      <Link href="/progresso">Competências</Link>
      <Link href="/revisao">Revisão</Link>
      <Link href="/onboarding">Meu perfil</Link>
    </nav>
  );
}
function Dashboard({ view }: { view: "path" | "progress" | "review" }) {
  const [missions, setMissions] = useState<Mission[]>([]),
    [progress, setProgress] = useState<z.infer<typeof progressSchema>>(),
    [queue, setQueue] = useState<z.infer<typeof queueSchema>>([]),
    [error, setError] = useState(""),
    [missingProfile, setMissingProfile] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      api("missions"),
      api("progress"),
      api("review/queue"),
      api<{ profile: unknown }>("profile"),
    ])
      .then(([m, p, q, profile]) => {
        if (!active) return;
        setMissions(z.array(missionSchema).parse(m));
        setProgress(progressSchema.parse(p));
        setQueue(queueSchema.parse(q));
        setMissingProfile(!profile.profile);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Não foi possível carregar.",
          );
      });
    return () => {
      active = false;
    };
  }, [reload]);
  if (error)
    return (
      <div className="notice" role="alert">
        <p>{error}</p>
        <button
          className="button"
          onClick={() => {
            setError("");
            setReload((n) => n + 1);
          }}
        >
          Tentar novamente
        </button>
        <Link href="/login">Entrar novamente</Link>
      </div>
    );
  if (!progress) return <p role="status">Carregando seu aprendizado…</p>;
  if (missingProfile)
    return (
      <div className="callout">
        <h1>Vamos preparar sua trilha.</h1>
        <Link href="/onboarding" className="button primary">
          Concluir onboarding
        </Link>
      </div>
    );
  const completed = new Set(progress.missions.map((m) => m.mission_slug));
  return (
    <>
      <Navigation />
      <p className="eyebrow">TECH ENGLISH STARTER PATH</p>
      <h1>
        {view === "path"
          ? "Seu mapa de missões."
          : view === "progress"
            ? "Cada competência conta."
            : "O que você consegue lembrar?"}
      </h1>
      {view === "path" ? (
        <>
          <p>
            Três situações profissionais. Siga a ordem sugerida ou escolha a
            missão que mais precisa praticar.
          </p>
          <label htmlFor="path-progress">
            {completed.size} de 3 missões praticadas
          </label>
          <progress id="path-progress" value={completed.size} max={3} />
          <div className="path-map">
            {missions.map((m) => (
              <article className="mission-card" key={m.slug}>
                <div className="card-top">
                  <span className="step-number">0{m.position}</span>
                  <span className="badge">
                    {completed.has(m.slug) ? "PRATICADA ✓" : "DISPONÍVEL"}
                  </span>
                </div>
                <h2>{m.title}</h2>
                <p>{m.language_objective}</p>
                <div className="tags">
                  {m.games.map((g) => (
                    <span key={g.id}>{g.title}</span>
                  ))}
                </div>
                <Link className="button primary" href={`/missoes/${m.slug}`}>
                  {completed.has(m.slug)
                    ? "Praticar novamente"
                    : "Iniciar missão"}{" "}
                  →
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : view === "progress" ? (
        <>
          <p>
            English Tech Readiness · {progress.readiness}. Indicador de prática
            linguística, sem equivalência com certificação técnica ou nível
            CEFR.
          </p>
          <div className="competency-grid">
            {[
              ["Contexto profissional", progress.competencies.context_xp],
              ["Estrutura linguística", progress.competencies.language_xp],
              ["Comunicação", progress.competencies.communication_xp],
            ].map(([label, xp]) => (
              <article className="callout" key={label}>
                <h2>{xp} XP</h2>
                <p>{label}</p>
              </article>
            ))}
          </div>
          <p>
            Total: <strong>{progress.total_xp} XP</strong> · {completed.size}{" "}
            missões praticadas.
          </p>
          <details>
            <summary>Como o XP é calculado?</summary>
            <p>
              Cada missão pode conceder 20 XP pelos minigames verificados, 20
              pela recuperação ativa e 20 por comunicação avaliada como adequada
              e tecnicamente correta, sem pedido de revisão humana. Repetir
              requisições não duplica XP. O demo não concede XP real.
            </p>
          </details>
          <Link href="/trilhas" className="button primary">
            Continuar praticando →
          </Link>
        </>
      ) : (
        <>
          <p>
            Recupere o conceito antes de consultar o feedback. Os intervalos
            dependem do acerto e da sua confiança.
          </p>
          {queue.length === 0 ? (
            <div className="callout">
              <p>
                Sua fila está vazia. Conclua a recuperação de uma missão para
                agendar a primeira revisão.
              </p>
              <Link href="/trilhas" className="button primary">
                Abrir trilha
              </Link>
            </div>
          ) : (
            queue.map((row) => (
              <article className="callout" key={row.id}>
                <h2>
                  {missions.find((m) => m.slug === row.mission_slug)?.title}
                </h2>
                <p>{row.reason}</p>
                <p>
                  {row.due
                    ? "Disponível agora"
                    : `Próxima prática: ${new Date(row.due_at).toLocaleString("pt-BR")}`}{" "}
                  · intervalo de {row.interval_days} dia(s)
                </p>
                {row.due && (
                  <ReviewForm
                    row={row}
                    onDone={() => setReload((n) => n + 1)}
                  />
                )}
              </article>
            ))
          )}
        </>
      )}
    </>
  );
}
function ReviewForm({
  row,
  onDone,
}: {
  row: z.infer<typeof queueSchema>[number];
  onDone: () => void;
}) {
  const [answer, setAnswer] = useState(""),
    [confidence, setConfidence] = useState(3),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{
        correct: boolean;
        explanation: string;
        interval_days: number;
      }>("review/answer", {
        review_id: row.id,
        question_id: row.question.id,
        answer,
        confidence,
      });
      setMessage(
        `${r.explanation} Próxima revisão em ${r.interval_days} dia(s).`,
      );
      setDone(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p lang="en">{row.question.prompt}</p>
      <label htmlFor={`answer-${row.id}`}>Sua resposta</label>
      <input
        id={`answer-${row.id}`}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        required
        maxLength={200}
        disabled={done}
      />
      <label htmlFor={`confidence-${row.id}`}>
        Confiança antes da verificação
      </label>
      <select
        id={`confidence-${row.id}`}
        value={confidence}
        onChange={(e) => setConfidence(Number(e.target.value))}
        disabled={done}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} / 5
          </option>
        ))}
      </select>
      <button className="button primary" disabled={busy || done}>
        Verificar e agendar
      </button>
      <p role="status">{message}</p>
      {done && (
        <button type="button" className="button" onClick={onDone}>
          Atualizar fila
        </button>
      )}
    </form>
  );
}
export function LearningDashboard({
  view,
}: {
  view: "path" | "progress" | "review";
}) {
  return (
    <main id="main" className="dashboard-page">
      <RequireSession>
        <Dashboard view={view} />
      </RequireSession>
    </main>
  );
}
