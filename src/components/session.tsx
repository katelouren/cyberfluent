"use client";
import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { demoKey, notifySession, supabase } from "@/lib/supabase";
type SessionState = {
  ready: boolean;
  mode: "live" | "demo" | null;
  identityKey: string | null;
};
const SessionContext = createContext<SessionState>({
  ready: false,
  mode: null,
  identityKey: null,
});
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    ready: false,
    mode: null,
    identityKey: null,
  });
  useEffect(() => {
    let alive = true;
    const auth = supabase();
    function update(userId: string | null) {
      if (alive)
        setState({
          ready: true,
          identityKey: sessionStorage.getItem(demoKey) ? "demo" : userId,
          mode: sessionStorage.getItem(demoKey)
            ? "demo"
            : userId
              ? "live"
              : null,
        });
    }
    async function refresh() {
      const data = await auth?.auth.getSession();
      update(data?.data.session?.user.id ?? null);
    }
    void refresh();
    const subscription = auth?.auth.onAuthStateChange((_event, session) =>
      update(session?.user.id ?? null),
    ).data.subscription;
    window.addEventListener("cyberfluent-session", refresh);
    return () => {
      alive = false;
      subscription?.unsubscribe();
      window.removeEventListener("cyberfluent-session", refresh);
    };
  }, []);
  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}
export const useSession = () => useContext(SessionContext);
export function SessionNavigation() {
  const router = useRouter();
  const { ready, mode } = useSession();
  async function logout() {
    sessionStorage.removeItem(demoKey);
    await supabase()?.auth.signOut();
    notifySession();
    router.push("/");
  }
  if (!ready) return null;
  return mode ? (
    <>
      <Link href="/trilhas">Minha trilha</Link>
      <button className="text-link" onClick={logout}>
        Sair{mode === "demo" ? " do demo" : ""}
      </button>
    </>
  ) : (
    <Link href="/login">Entrar</Link>
  );
}
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { ready, mode, identityKey } = useSession();
  if (!ready) return <p role="status">Verificando sessão…</p>;
  if (!mode)
    return (
      <section className="callout">
        <h1>Continue com sua conta.</h1>
        <p>
          Entre para salvar seu aprendizado e receber feedback personalizado.
        </p>
        <Link className="button primary" href="/login">
          Entrar ou criar conta
        </Link>
      </section>
    );
  return (
    <Fragment key={identityKey}>
      {mode === "demo" && (
        <p className="notice" role="status">
          Modo demo local · exemplos curados, sem IA live e sem XP real. A
          sessão expira em duas horas ou quando o backend reinicia.
        </p>
      )}
      {children}
    </Fragment>
  );
}
