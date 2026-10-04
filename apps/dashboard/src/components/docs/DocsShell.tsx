import type { ReactNode } from "react";

export const DOC_SECTIONS = [
  { href: "/docs", label: "Inicio rápido" },
  { href: "/docs/widget", label: "Widget" },
  { href: "/docs/agentes", label: "Agentes" },
  { href: "/docs/prospectos", label: "Prospectos" },
  { href: "/docs/analiticas", label: "Analíticas" },
  { href: "/docs/planes", label: "Planes y cuenta" },
  { href: "/docs/api", label: "API pública" },
];

const LEGAL_LINKS = [
  { href: "/terminos", label: "Términos" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/cookies", label: "Cookies" },
];

interface Props {
  title: string;
  lead?: string;
  active: string;
  children: ReactNode;
}

export default function DocsShell({ title, lead, active, children }: Props) {
  return (
    <main className="doc-page">
      <header className="doc-topbar">
        <a className="doc-brand" href="/docs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/imagen/Logo_AgentOSweb_chat.png" alt="" width={32} height={32} />
          <span>
            AgentOSweb <span className="doc-brand-sub">Documentación</span>
          </span>
        </a>
        <nav className="doc-topnav" aria-label="Enlaces legales">
          {LEGAL_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={active === l.href ? "active" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="doc-layout">
        <aside className="doc-sidebar">
          <nav className="doc-nav" aria-label="Secciones de documentación">
            {DOC_SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className={active === s.href ? "active" : undefined}>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <details className="doc-sidebar-m">
          <summary>Secciones de la documentación</summary>
          <nav className="doc-nav" aria-label="Secciones de documentación">
            {DOC_SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className={active === s.href ? "active" : undefined}>
                {s.label}
              </a>
            ))}
          </nav>
        </details>

        <article className="doc-content">
          <h1>{title}</h1>
          {lead && <p className="doc-lead">{lead}</p>}
          {children}
        </article>
      </div>

      <footer className="doc-footer">
        <span>
          &copy; {new Date().getFullYear()} <strong>AgentOSweb</strong>. Todos los derechos reservados.
        </span>
        <span className="doc-footer-links">
          {LEGAL_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <a href="/docs">Documentación</a>
        </span>
      </footer>
    </main>
  );
}
