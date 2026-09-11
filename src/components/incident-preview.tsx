"use client";
import { useState } from "react";
export function IncidentPreview() {
  const [choice, setChoice] = useState<string>();
  return (
    <div className="incident-panel">
      <div className="panel-bar">
        <span>
          <i /> INCIDENT ROOM
        </span>
        <span>PRÉVIA JOGÁVEL</span>
      </div>
      <div className="preview-body">
        <div className="eyebrow">NORTHSTAR / SUPPORT CHANNEL</div>
        <div className="person">
          <span className="avatar">AL</span>
          <div>
            <strong>
              Alex <small>· colega de equipe</small>
            </strong>
            <p lang="en">
              “I received an urgent email asking for my password. Should I
              reply?”
            </p>
          </div>
        </div>
        <div className="terminal-note">
          <span aria-hidden="true">↳</span> Sua primeira decisão: qual
          orientação é segura?
        </div>
        {[
          "Reply with your password.",
          "Report it through a trusted channel.",
        ].map((s, i) => (
          <button
            className={`choice ${choice === s ? "selected" : ""}`}
            key={s}
            onClick={() => setChoice(s)}
            lang="en"
          >
            <span>0{i + 1}</span>
            {s}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
        <p className="preview-result" aria-live="polite">
          {choice
            ? choice.startsWith("Report")
              ? "✓ Boa decisão. Report = comunicar ao canal responsável."
              : "↺ Tente outra vez. Nunca envie sua senha por e-mail."
            : "Uma decisão. Uma nova forma de se comunicar."}
        </p>
      </div>
      <div className="panel-bottom">
        <span>AMBIENTE FICTÍCIO E SEGURO</span>
        <span>EN / PT-BR</span>
      </div>
    </div>
  );
}
