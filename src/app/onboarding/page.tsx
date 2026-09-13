"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireSession } from "@/components/session";
import { api, profileSchema, type Profile } from "@/lib/api";
const initial: Profile = {
  source_locale: "pt-BR",
  target_locale: "en",
  cefr: "A2",
  area: "development",
  role: "Estudante de tecnologia",
  goal: "Comunicar meu trabalho em inglês",
  daily_minutes: 10,
};
function Form() {
  const router = useRouter();
  const [profile, setProfile] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api<{ profile: Profile | null }>("profile")
      .then((d) => {
        if (active && d.profile) setProfile(profileSchema.parse(d.profile));
      })
      .catch(() => {
        if (active)
          setMessage(
            "Não foi possível carregar o perfil. Você pode tentar salvar novamente.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("onboarding", profile);
      router.push("/trilhas");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>
        Seu inglês.
        <br />
        Seu próximo passo.
      </h1>
      <p>
        Apoio em português brasileiro, prática em inglês. Você pode ajustar este
        perfil depois.
      </p>
      <form onSubmit={save}>
        <label htmlFor="level">Nível de inglês</label>
        <select
          id="level"
          value={profile.cefr}
          onChange={(e) =>
            setProfile({ ...profile, cefr: e.target.value as Profile["cefr"] })
          }
        >
          {["A1", "A2", "B1"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <label htmlFor="area">Área</label>
        <select
          id="area"
          value={profile.area}
          onChange={(e) =>
            setProfile({ ...profile, area: e.target.value as Profile["area"] })
          }
        >
          <option value="development">Desenvolvimento</option>
          <option value="security">Segurança</option>
          <option value="support">Suporte</option>
          <option value="other">Outra área</option>
        </select>
        <label htmlFor="role">Função ou interesse profissional</label>
        <input
          id="role"
          required
          minLength={2}
          maxLength={80}
          value={profile.role}
          onChange={(e) => setProfile({ ...profile, role: e.target.value })}
        />
        <label htmlFor="goal">Objetivo de aprendizagem</label>
        <input
          id="goal"
          required
          minLength={5}
          maxLength={200}
          value={profile.goal}
          onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
        />
        <label htmlFor="minutes">Tempo por dia</label>
        <select
          id="minutes"
          value={profile.daily_minutes}
          onChange={(e) =>
            setProfile({
              ...profile,
              daily_minutes: Number(e.target.value) as Profile["daily_minutes"],
            })
          }
        >
          {[5, 10, 15, 20, 30].map((n) => (
            <option key={n} value={n}>
              {n} minutos
            </option>
          ))}
        </select>
        <button className="button primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar e abrir trilha"}
        </button>
      </form>
      <p role="status">{message}</p>
    </>
  );
}
export default function Onboarding() {
  return (
    <main id="main" className="account-page">
      <RequireSession>
        <Form />
      </RequireSession>
    </main>
  );
}
