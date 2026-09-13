import type { NextConfig } from "next";

// Fail before Next.js can inline a mistakenly public server credential.
const publicNames = new Set([
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);
for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
  if (!publicNames.has(name) || /^(sk-|sb_secret_)/.test(value)) {
    throw new Error(
      "Configuração pública inválida. Revise os arquivos locais de ambiente.",
    );
  }
  if (
    name === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" &&
    value.split(".").length === 3
  ) {
    try {
      const claims = JSON.parse(
        Buffer.from(value.split(".")[1], "base64url").toString(),
      );
      if (claims.role !== "anon") throw new Error();
    } catch {
      throw new Error("Use somente uma chave publicável Supabase no frontend.");
    }
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Content-Security-Policy",
          value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
        },
      ],
    },
  ],
};

export default nextConfig;
