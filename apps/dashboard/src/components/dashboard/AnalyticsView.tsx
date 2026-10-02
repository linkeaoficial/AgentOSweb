import { useCallback, useEffect, useState } from "react";
import { IconAnalytics, IconBolt } from "./icons";

interface Kpi {
  value: number;
  delta: number | null;
}

interface AnalyticsData {
  days: string[];
  since: string;
  daily: { day: string; messages: number; conversations: number; leads: number }[];
  hourly: number[];
  heat: number[][];
  kpis: {
    sessions: Kpi;
    messages: Kpi;
    per_session: Kpi;
    leads: Kpi;
    conversion: Kpi;
    faq_auto: Kpi;
  };
  lead_statuses: { status: string; n: number }[];
  top_faqs: { label: string; hits: number }[];
}

type Status = "loading" | "ready" | "wall" | "error";

const RANGES = [7, 30, 90];
// heat[0] = domingo (getUTCDay), se muestra de lunes a domingo.
const HEAT_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Mismo vocabulario que LEAD_STATUSES del worker y LeadsView.
const LEAD_ORDER = ["Nuevo", "Contactado", "Calificado", "Convertido", "Archivado"];

function AnaKpi({ label, value, delta, suffix = "%" }: { label: string; value: string; delta: number | null; suffix?: string }) {
  const up = (delta ?? 0) >= 0;
  const text =
    delta === null
      ? "Nuevo"
      : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}${suffix} vs. período anterior`;
  return (
    <div className="ana-kpi">
      <span className="ana-kpi-label">{label}</span>
      <strong className="ana-kpi-value">{value}</strong>
      <span className={`ana-kpi-delta ${up ? "up" : "down"}`}>{text}</span>
    </div>
  );
}

function AnalyticsWall({ onNavigate }: { onNavigate: (v: string) => void }) {
  return (
    <section className="view-section active" id="view-analytics">
      <div className="ana-wall">
        <div className="ana-wall-icon">
          <IconAnalytics />
        </div>
        <h3>Analíticas disponible desde el plan Starter</h3>
        <p>
          Dejá de operar a ciegas: mirá cuándo te escriben, en qué horarios picos,
          qué porcentaje de sesiones se convierte en prospecto y qué preguntas
          resuelve solo tu agente.
        </p>
        <ul className="ana-wall-list">
          <li>Sesiones, mensajes y conversión a prospecto con tendencia</li>
          <li>Mapa de calor día × hora de la actividad</li>
          <li>Embudo: sesiones → mensajes → prospectos</li>
          <li>Top FAQs sin IA y prospectos por estado</li>
        </ul>
        <button type="button" className="btn-shimmer" onClick={() => onNavigate("view-billing")}>
          <IconBolt /> Mejorar plan
        </button>
      </div>
    </section>
  );
}

export function AnalyticsView({ agentId, onNavigate }: { agentId: string; onNavigate: (v: string) => void }) {
  const [range, setRange] = useState(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/analytics/${encodeURIComponent(agentId)}?days=${range}`);
      const body = await res.json().catch(() => null);
      if (res.status === 403 && body?.code === "plan_required") {
        setStatus("wall");
        return;
      }
      if (!res.ok || !Array.isArray(body?.daily)) {
        setStatus("error");
        return;
      }
      setData(body as AnalyticsData);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [agentId, range]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "wall") return <AnalyticsWall onNavigate={onNavigate} />;

  const k = data?.kpis;
  const maxMsg = Math.max(1, ...(data?.daily ?? []).map((d) => d.messages));
  const maxCon = Math.max(1, ...(data?.daily ?? []).map((d) => d.conversations));
  const maxHeat = Math.max(1, ...(data?.heat ?? []).flat());
  const totalLeads = k?.leads.value ?? 0;
  const statusMap = new Map((data?.lead_statuses ?? []).map((s) => [s.status, Number(s.n) || 0]));
  const maxStatus = Math.max(1, ...LEAD_ORDER.map((s) => statusMap.get(s) ?? 0));
  const maxFaq = Math.max(1, ...(data?.top_faqs ?? []).map((f) => Number(f.hits) || 0));
  const funnel = k
    ? [
        { label: "Sesiones", value: k.sessions.value, note: `últimos ${range} días` },
        { label: "Mensajes", value: k.messages.value, note: `${k.per_session.value} por sesión` },
        { label: "Prospectos", value: k.leads.value, note: `${k.conversion.value}% de las sesiones` },
      ]
    : [];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <section className="view-section active" id="view-analytics">
      <div className="ana-header">
        <div>
          <h2>Analíticas</h2>
          <p className="ana-sub">
            {data ? `${range} días · desde el ${data.since}` : "Cargando…"}
          </p>
        </div>
        <div className="ana-ranges" role="tablist" aria-label="Rango de fechas">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={range === d}
              className={`ana-range ${range === d ? "active" : ""}`}
              onClick={() => setRange(d)}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {status === "loading" && (
        <div className="content-loading">
          <span className="btn-spinner" />
          Cargando analíticas…
        </div>
      )}

      {status === "error" && (
        <div className="ana-error">
          No pudimos cargar las analíticas de este agente.{" "}
          <button type="button" onClick={load}>
            Reintentar
          </button>
        </div>
      )}

      {status === "ready" && k && data && (
        <div className="ana-body">
          <div className="ana-kpis">
            <AnaKpi label="Sesiones" value={k.sessions.value.toLocaleString()} delta={k.sessions.delta} />
            <AnaKpi label="Mensajes" value={k.messages.value.toLocaleString()} delta={k.messages.delta} />
            <AnaKpi label="Mensajes por sesión" value={String(k.per_session.value)} delta={k.per_session.delta} />
            <AnaKpi label="Prospectos" value={k.leads.value.toLocaleString()} delta={k.leads.delta} />
            <AnaKpi label="Conversión a prospecto" value={`${k.conversion.value}%`} delta={k.conversion.delta} suffix=" pts" />
            <AnaKpi label="FAQs sin IA (histórico)" value={k.faq_auto.value.toLocaleString()} delta={k.faq_auto.delta} />
          </div>

          <div className="ana-grid-2">
            <div className="ana-card">
              <div className="ana-card-head">
                <h4>Actividad diaria</h4>
                <span className="ana-legend">
                  <i className="dot msg" /> Mensajes
                  <i className="dot con" /> Sesiones
                </span>
              </div>
              <div className="ana-daily">
                {data.daily.map((d) => (
                  <div
                    key={d.day}
                    className="ana-day"
                    title={`${d.day} · ${d.messages} mensajes · ${d.conversations} sesiones · ${d.leads} prospectos`}
                  >
                    <span className="bar msg" style={{ height: `${(d.messages / maxMsg) * 100}%` }} />
                    <span className="bar con" style={{ height: `${(d.conversations / maxCon) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="ana-card">
              <div className="ana-card-head">
                <h4>Embudo de conversión</h4>
              </div>
              <div className="ana-funnel">
                {funnel.map((f) => (
                  <div className="ana-funnel-row" key={f.label}>
                    <div className="ana-funnel-meta">
                      <span className="ana-funnel-label">{f.label}</span>
                      <span className="ana-funnel-value">{f.value.toLocaleString()}</span>
                    </div>
                    <div className="ana-funnel-track">
                      <span style={{ width: `${(f.value / maxFunnel) * 100}%` }} />
                    </div>
                    <span className="ana-funnel-note">{f.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ana-card">
            <div className="ana-card-head">
              <h4>Mapa de calor · día × hora</h4>
              <span className="ana-hint">más oscuro = más mensajes</span>
            </div>
            <div className="ana-heat">
              {HEAT_ORDER.map((wd) => (
                <div className="ana-heat-row" key={wd}>
                  <span className="ana-heat-day">{DAY_LABELS[wd]}</span>
                  {data.heat[wd].map((n, h) => (
                    <span
                      key={h}
                      className="ana-heat-cell"
                      title={`${DAY_LABELS[wd]} ${h}:00 — ${n} mensajes`}
                      style={
                        n
                          ? {
                              background: `color-mix(in srgb, var(--primary-color) ${Math.round(15 + 85 * (n / maxHeat))}%, transparent)`,
                            }
                          : undefined
                      }
                    />
                  ))}
                  <span className="ana-heat-max">{Math.max(...data.heat[wd]) || ""}</span>
                </div>
              ))}
              <div className="ana-heat-hours">
                <span />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h}>{h % 6 === 0 ? `${h}h` : ""}</span>
                ))}
                <span />
              </div>
            </div>
          </div>

          <div className="ana-grid-2">
            <div className="ana-card">
              <div className="ana-card-head">
                <h4>Top FAQs sin IA</h4>
                <span className="ana-hint">lo que más resuelve solo</span>
              </div>
              {data.top_faqs.length === 0 ? (
                <p className="ana-empty">Todavía no hay respuestas por FAQ registradas.</p>
              ) : (
                <div className="ana-rows">
                  {data.top_faqs.map((f) => (
                    <div className="ana-row" key={f.label}>
                      <span className="ana-row-label" title={f.label}>
                        {f.label}
                      </span>
                      <span className="ana-row-track">
                        <span style={{ width: `${(Number(f.hits) / maxFaq) * 100}%` }} />
                      </span>
                      <span className="ana-row-value">{Number(f.hits).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ana-card">
              <div className="ana-card-head">
                <h4>Prospectos por estado</h4>
                <span className="ana-hint">{totalLeads.toLocaleString()} en {range} días</span>
              </div>
              <div className="ana-rows">
                {LEAD_ORDER.map((s) => {
                  const n = statusMap.get(s) ?? 0;
                  return (
                    <div className="ana-row" key={s}>
                      <span className="ana-row-label">{s}</span>
                      <span className="ana-row-track">
                        <span style={{ width: `${(n / maxStatus) * 100}%` }} />
                      </span>
                      <span className="ana-row-value">{n.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
