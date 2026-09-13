import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}
export const demoKey = "cyberfluent-demo-session";
export function notifySession() {
  window.dispatchEvent(new Event("cyberfluent-session"));
}
export async function sessionHeaders(): Promise<Record<string, string>> {
  const demo =
    typeof window !== "undefined" ? sessionStorage.getItem(demoKey) : null;
  if (demo) return { "X-Demo-Session": demo };
  const auth = supabase();
  if (!auth) return {};
  const { data } = await auth.auth.getSession();
  return data.session
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}
