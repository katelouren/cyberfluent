import type { Metadata } from "next";
import Link from "next/link";
import { brand, missionUrl } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.description,
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#main">
          Pular para conteúdo
        </a>
        <header className="header">
          <Link className="brand" href="/" aria-label={`${brand.name} início`}>
            <span className="brand-icon" aria-hidden="true">
              c/f
            </span>
            {brand.name}
          </Link>
          <nav aria-label="Principal">
            <Link href="/#trilha">A missão</Link>
            <Link href="/#metodo">Como funciona</Link>
            <Link className="nav-cta" href={missionUrl}>
              Entrar na missão <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </header>
        {children}
        <footer>
          <div>
            <strong>{brand.name}</strong>
            <span>{brand.tagline}</span>
          </div>
          <p>{brand.disclaimer}</p>
          <small>
            Fase 1 · Experiência local · Conteúdo com revisão humana pendente
          </small>
        </footer>
      </body>
    </html>
  );
}
