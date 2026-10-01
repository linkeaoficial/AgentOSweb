"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { IconMessage, IconCheck, IconClock, IconUsage, IconCopy, IconBolt } from "./icons";

const PROD_ORIGIN = "https://agentosweb.com";

// Origen real mientras se prueba en local; al desplegar toma el dominio de producción automáticamente.
function useWidgetOrigin(): string {
  const [origin, setOrigin] = useState(PROD_ORIGIN);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

export function getScript(agentId: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : PROD_ORIGIN);
  return `<script src="${base}/w/${agentId}/widget.js" defer></script>`;
}

export interface OverviewData {
  conversations_total: number;
  messages_total: number;
  messages_used: number;
  messages_limit: number;
  recent: { session_id: string; updated_at: string }[];
  faqs: { label: string; hits: number }[];
}

interface OverviewProps {
  onCopy: () => void;
  data: OverviewData | null;
  loadError: boolean;
  agentId: string;
}

function CodeScript({ className, agentId, origin }: { className: string; agentId: string; origin: string }) {
  return (
    <pre className={`code-display ${className}`}>
      <code>
        <span className="code-tag">&lt;script</span>{" "}
        <span className="code-attr">src</span>=<span className="code-string">{`"${origin}/w/${agentId}/widget.js"`}</span>{" "}
        <span className="code-attr">defer</span>
        <span className="code-tag">&gt;&lt;/script&gt;</span>
      </code>
    </pre>
  );
}

const CHIPS = ["WordPress", "Shopify", "Wix", "Webflow", "Squarespace", "React", "Next.js", "Vue", "Nuxt", "Astro", "HTML", "Ghost"];

// Exportada para que Prospectos reutilice la MISMA tarjeta del Overview en vez
// de inventar un segundo estilo de KPI que se vea ajeno al resto del panel.
export function MetricCard({
  label,
  icon,
  value,
  trendLabel,
  trendSuffix,
  progress,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  trendLabel?: string;
  trendSuffix?: string;
  progress?: number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span>{label}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <h3>{value}</h3>
      {progress !== undefined ? (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : trendLabel !== undefined ? (
        <div className="metric-footer">
          <span className="trend-up">{trendLabel}</span> {trendSuffix}
        </div>
      ) : null}
    </div>
  );
}

export function OverviewView({ onCopy, data, loadError, agentId }: OverviewProps) {
  const convos = data?.conversations_total ?? 0;
  const msgs = data?.messages_total ?? 0;
  const used = data?.messages_used ?? 0;
  const limit = data?.messages_limit ?? 1;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const faqs = data?.faqs ?? [];
  const faqTotal = faqs.reduce((a, f) => a + f.hits, 0);
  const origin = useWidgetOrigin();
  const script = getScript(agentId, origin);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="view-section active" id="view-overview">
      <div className="metrics-grid">
        <MetricCard
          label="Conversaciones Totales"
          icon={<IconMessage />}
          value={convos.toLocaleString()}
          trendLabel="Sesiones"
          trendSuffix="reales del agente"
        />
        <MetricCard
          label="Mensajes Procesados"
          icon={<IconCheck />}
          value={msgs.toLocaleString()}
          trendLabel="Usuario"
          trendSuffix="+ asistente"
        />
        <MetricCard
          label="Respuestas Automáticas"
          icon={<IconClock />}
          value={faqTotal.toLocaleString()}
          trendLabel="Resueltas"
          trendSuffix="por FAQ sin IA"
        />
        <MetricCard
          label="Consumo Mensual"
          icon={<IconUsage />}
          value={
            <>
              {used.toLocaleString()}{" "}
              <small style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-muted)" }}>/ {limit.toLocaleString()}</small>
            </>
          }
          trendLabel=""
          trendSuffix=""
          progress={pct}
        />
      </div>

      <div className="dashboard-columns">
        <div className="panel-card">
          <h3>Código de Instalación para tu Sitio Web</h3>
          <p className="subtitle">
  Pégalo antes de <code>&lt;/body&gt;</code> y listo. Funciona en cualquier web.
</p>

          <div className="script-box">
            <span id="script-code" className="sr-only">
              {script}
            </span>

            <CodeScript className="code-pc" agentId={agentId} origin={origin} />
            <CodeScript className="code-mobile" agentId={agentId} origin={origin} />

            <button className={`btn-shimmer ${copied ? "copied" : ""}`} id="copy-btn" onClick={handleCopyClick}>
              <span className="btn-shimmer-ico cico-link">
                <IconCopy />
              </span>
              <span className="btn-shimmer-ico cico-check">
                <IconCheck />
              </span>
              <span className="btn-shimmer-label">{copied ? "¡Copiado!" : "Copiar Script"}</span>
            </button>
          </div>

          <div className="compatibility-row">
            <span className="compatibility-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Funciona en cualquier web
            </span>
            <div className="compatibility-chips">
              {CHIPS.map((chip) => (
                <span key={chip} className="chip">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="panel-card">
          <h3>Preguntas Frecuentes del Agente</h3>
          <p className="subtitle">Las consultas que el agente responde automáticamente, sin gastar IA.</p>
          <div className="faq-list">
            {loadError && <span className="count">No se pudo cargar la API</span>}
            {!loadError && data && faqs.length === 0 && (
              <div className="faq-empty">
                <IconMessage />
                <span>Aún no hay preguntas configuradas</span>
              </div>
            )}
            {!loadError && data && faqs.map((f) => (
              <div key={f.label} className="faq-item">
                <span>{f.label}</span>
                <span className="count">{f.hits} veces</span>
              </div>
            ))}
            {!data && !loadError && (
              <div className="faq-skeleton" aria-label="Cargando preguntas frecuentes">
                <div className="faq-skeleton-row" />
                <div className="faq-skeleton-row" />
                <div className="faq-skeleton-row" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="install-progress-banner">
        <div className="install-progress-header">
          <div className="install-progress-title">
            <div className="install-progress-icon">
              <IconBolt />
            </div>
            <div>
              <h4>Instalación en 3 pasos</h4>
              <span>Solo toma 2 minutos · Sin conocimientos técnicos</span>
            </div>
          </div>
        </div>

        <div className="install-progress-track">
          <div className="install-progress-line" />

          <div className="install-progress-step">
            <div className="install-progress-bullet">
              <span>1</span>
            </div>
            <div className="install-progress-info">
              <h5>Copia el script</h5>
              <p>Pégalo en el portapapeles con un clic</p>
            </div>
          </div>

          <div className="install-progress-step">
            <div className="install-progress-bullet">
              <span>2</span>
            </div>
            <div className="install-progress-info">
              <h5>Pégalo en tu web</h5>
              <p>
                Justo antes de la etiqueta <code>&lt;/body&gt;</code>
              </p>
            </div>
          </div>

          <div className="install-progress-step">
            <div className="install-progress-bullet">
              <span>3</span>
            </div>
            <div className="install-progress-info">
              <h5>Recarga y listo</h5>
              <p>Tu agente IA estará online 24/7</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface UnderConstructionProps {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
}

export function UnderConstructionView({ id, icon, title, description }: UnderConstructionProps) {
  return (
    <section className="view-section" id={id}>
      <div className="under-construction-card">
        <div className="construction-icon-wrap">{icon}</div>
        <span className="construction-badge">Módulo en Construcción</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}