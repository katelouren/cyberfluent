import Link from "next/link";
import { brand, missionUrl } from "@/config/brand";
import { messages } from "@/messages/pt-BR";
import { IncidentPreview } from "@/components/incident-preview";
export default function Home() {
  return (
    <main id="main">
      <section className="hero">
        <div>
          <p className="eyebrow">
            <span className="status-dot" /> INGLÊS PARA QUEM CONSTRÓI O FUTURO
          </p>
          <h1 lang="en">
            {brand.heroLines[0]}
            <br />
            {brand.heroLines[1]}
            <br />
            <span>{brand.heroLines[2]}</span>
          </h1>
          <p className="hero-copy">{brand.description}</p>
          <div className="actions">
            <Link className="button primary" href={missionUrl}>
              {messages.start} <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" href="#trilha">
              {messages.explore} ↓
            </Link>
          </div>
          <p className="hero-caption">
            Cenários reais de trabalho. Um ambiente seguro para aprender.
          </p>
        </div>
        <IncidentPreview />
      </section>
      <section className="skills-strip" aria-label="Competências praticadas">
        <span>APRENDA FAZENDO</span>
        <p>
          Reconheça riscos <b>↗</b>
        </p>
        <p>
          Comunique com clareza <b>↗</b>
        </p>
        <p>
          Entenda o porquê <b>↗</b>
        </p>
      </section>
      <section className="path-section" id="trilha">
        <div>
          <p className="eyebrow">SEU PRÓXIMO PASSO</p>
          <h2>
            Uma missão.
            <br />
            Inglês com propósito.
          </h2>
          <p>Tech English Starter Path</p>
          <p className="muted">
            A primeira missão está disponível nesta fase.
            <br />
            Apoio em português · prática em inglês · A1–B1
          </p>
        </div>
        <Link className="mission-card" href={missionUrl}>
          <div className="card-top">
            <span className="mission-symbol" aria-hidden="true">
              ⌁
            </span>
            <span className="badge">DISPONÍVEL · FASE 1</span>
          </div>
          <h3>
            Phishing Incident
            <br />
            Communication
          </h3>
          <p>
            Um e-mail suspeito. Uma pessoa precisando de ajuda. Encontre as
            pistas e escreva a próxima orientação.
          </p>
          <div className="tags">
            <span>Spot the Risk</span>
            <span>Escrita livre</span>
            <span>Tutora IA</span>
          </div>
          <div className="card-bottom">
            Iniciar missão <span aria-hidden="true">↗</span>
          </div>
        </Link>
      </section>
      <section id="metodo" className="method">
        <p className="eyebrow">PLAY. LEARN. APPLY.</p>
        <h2>
          Você aprende. Você decide.
          <br />
          Você encontra as palavras.
        </h2>
        <div className="method-grid">
          {[
            [
              "01",
              "Entre no cenário",
              "Aprenda os termos e observe um exemplo antes do desafio.",
            ],
            [
              "02",
              "Assuma a missão",
              "Identifique sinais de risco e produza sua própria orientação em inglês.",
            ],
            [
              "03",
              "Entenda e pratique",
              "Receba feedback em camadas e recupere o conceito sem consultar a resposta.",
            ],
          ].map(([n, t, d]) => (
            <article key={n}>
              <span className="step-number">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
