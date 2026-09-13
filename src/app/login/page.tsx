"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, demoKey, notifySession } from "@/lib/supabase";
import { api, apiUrl } from "@/lib/api";
import { useSession } from "@/components/session";
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [demoEnabled, setDemoEnabled] = useState(false);
  const { mode } = useSession();
  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then((d) => setDemoEnabled(d.demo_enabled === true))
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const auth = supabase();
    if (!auth) {
      setMessage(
        "A autenticação ainda precisa da configuração Supabase. Consulte o responsável pelo projeto.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = signup
        ? await auth.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${location.origin}/login` },
          })
        : await auth.auth.signInWithPassword({ email, password });
      if (result.error) {
        setMessage(
          "Não foi possível entrar ou cadastrar. Confira os dados, a confirmação do e-mail e tente novamente.",
        );
        return;
      }
      if (!result.data.session) {
        setMessage(
          "Verifique seu e-mail para confirmar o cadastro. Depois, entre com sua senha.",
        );
        return;
      }
      sessionStorage.removeItem(demoKey);
      notifySession();
      router.push("/onboarding");
    } catch {
      setMessage("Autenticação indisponível. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function startDemo() {
    setBusy(true);
    try {
      const data = await api<{ token: string }>("demo/session", {});
      sessionStorage.setItem(demoKey, data.token);
      notifySession();
      router.push("/onboarding");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Demo indisponível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="account-page">
      <p className="eyebrow">SEU PRÓXIMO PASSO</p>
      <h1>{signup ? "Crie sua conta." : "Continue sua missão."}</h1>
      <p>
        Aprenda inglês com situações de trabalho e acompanhe suas competências.
      </p>
      {mode && (
        <Link href="/trilhas" className="text-link">
          Continuar na minha trilha →
        </Link>
      )}
      <form onSubmit={submit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
        />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
        />
        <button className="button primary" disabled={busy}>
          {busy ? "Aguarde…" : signup ? "Criar conta" : "Entrar na conta"}
        </button>
      </form>
      <button
        className="text-link"
        disabled={busy}
        onClick={() => {
          setSignup(!signup);
          setMessage("");
        }}
      >
        {signup ? "Já tenho conta" : "Quero criar uma conta"}
      </button>
      <p role="status">{message}</p>
      {!supabase() && (
        <p className="notice">
          Supabase ainda não configurado. O modo demo, quando habilitado, serve
          apenas para conhecer as atividades.
        </p>
      )}
      {demoEnabled && (
        <details>
          <summary>Plano B: explorar sem conta ou sem IA</summary>
          <p>
            Exemplos curados, sem avaliação personalizada e sem XP real. Seus
            dados demo ficam apenas na sessão local.
          </p>
          <button className="button" disabled={busy} onClick={startDemo}>
            Entrar conscientemente no modo demo
          </button>
        </details>
      )}
    </main>
  );
}
