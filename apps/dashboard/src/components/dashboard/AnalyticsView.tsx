import { useCallback, useEffect, useRef, useState } from "react";
import { MetricCard } from "./Views";
import { IconAnalytics, IconBolt, IconCheck, IconLeads, IconMessage, IconOverview } from "./icons";

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

function deltaText(delta: number | null, suffix = "%") {
  if (delta === null) return "Sin base previa";
  return `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}${suffix}`;
}
function deltaDir(delta: number | null): "up" | "down" {
  return delta !== null && delta < 0 ? "down" : "up";
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
  // Caché por agente+rango (60 s): cambiar de filtro no vuelve a golpear el worker
  // (el server-side rate limit de analítica es 30/min por usuario).
  const cacheRef = useRef(new Map<string, { t: number; d: AnalyticsData }>());

  const load = useCallback(async () => {
    const key = `${agentId}:${range}`;
    const hit = cacheRef.current.get(key);
    if (hit && Date.now() - hit.t < 60_000) {
      setData(hit.d);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    try {
      // tz = offset local en minutos (getTimezoneOffset negado; Caracas = -240):
      // el worker agrupa día/hora en el horario del dueño, no en UTC.
      const res = await fetch(
        `/api/analytics/${encodeURIComponent(agentId)}?days=${range}&tz=${-new Date().getTimezoneOffset()}`
      );
      const body = await res.json().catch(() => null);
      if (res.status === 403 && body?.code === "plan_required") {
        setStatus("wall");
        return;
      }
      if (!res.ok || !Array.isArray(body?.daily)) {
        setStatus("error");
        return;
      }
      const parsed = body as AnalyticsData;
      cacheRef.current.set(key, { t: Date.now(), d: parsed });
      setData(parsed);
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
          <h3>Analíticas</h3>
          <p className="ana-sub">
            {data ? `Últimos ${range} días · desde el ${data.since}` : "Volumen, picos de atención y conversión a prospecto."}
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
        <div className="faq-skeleton" aria-label="Cargando analíticas">
          <div className="metrics-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="faq-skeleton-row" style={{ height: 118 }} />
            ))}
          </div>
          <div className="ana-grid-2">
            <div className="faq-skeleton-row" style={{ height: 250 }} />
            <div className="faq-skeleton-row" style={{ height: 250 }} />
          </div>
          <div className="faq-skeleton-row" style={{ height: 210 }} />
          <div className="ana-grid-2">
            <div className="faq-skeleton-row" style={{ height: 190 }} />
            <div className="faq-skeleton-row" style={{ height: 190 }} />
          </div>
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
          {/* Mismo MetricCard del Overview/Prospectos, no un estilo propio. */}
          <div className="metrics-grid">
            <MetricCard
              label="Sesiones"
              icon={<IconOverview />}
              value={k.sessions.value.toLocaleString("es-AR")}
              trendLabel={deltaText(k.sessions.delta)}
              trendDir={deltaDir(k.sessions.delta)}
              trendSuffix={k.sessions.delta === null ? "" : "vs. período anterior"}
            />
            <MetricCard
              label="Mensajes"
              icon={<IconMessage />}
              value={k.messages.value.toLocaleString("es-AR")}
              trendLabel={deltaText(k.messages.delta)}
              trendDir={deltaDir(k.messages.delta)}
              trendSuffix={k.messages.delta === null ? "" : "vs. período anterior"}
            />
            <MetricCard
              label="Prospectos"
              icon={<IconLeads />}
              value={k.leads.value.toLocaleString("es-AR")}
              trendLabel={deltaText(k.leads.delta)}
              trendDir={deltaDir(k.leads.delta)}
              trendSuffix={k.leads.delta === null ? "" : "vs. período anterior"}
            />
            <MetricCard
              label="Conversión a prospecto"
              icon={<IconCheck />}
              value={`${k.conversion.value}%`}
              trendLabel={deltaText(k.conversion.delta, " pts")}
              trendDir={deltaDir(k.conversion.delta)}
              trendSuffix={k.conversion.delta === null ? "" : "vs. período anterior"}
            />
          </div>

          <div className="ana-grid-2">
            <div className="panel-card">
              <div className="ana-card-head">
                <div>
                  <h3>Actividad diaria</h3>
                  <p className="subtitle">Mensajes y sesiones de los últimos {range} días</p>
                </div>
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

            <div className="panel-card">
              <div className="ana-card-head">
                <div>
                  <h3>Embudo de conversión</h3>
                  <p className="subtitle">De la visita al prospecto, en {range} días</p>
                </div>
              </div>
              <div className="ana-funnel">
                {funnel.map((f) => (
                  <div className="ana-funnel-row" key={f.label}>
                    <div className="ana-funnel-meta">
                      <span className="ana-funnel-label">{f.label}</span>
                      <span className="ana-funnel-value">{f.value.toLocaleString("es-AR")}</span>
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

          <div className="panel-card">
            <div className="ana-card-head">
              <div>
                <h3>Mapa de calor · día × hora</h3>
                <p className="subtitle">Cuándo te escriben: cuanto más intenso, más mensajes</p>
              </div>
              <span className="ana-hint">actividad del agente</span>
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
            <div className="panel-card">
              <div className="ana-card-head">
                <div>
                  <h3>Top FAQs sin IA</h3>
                  <p className="subtitle">Lo que más resuelve solo tu agente</p>
                </div>
                <span className="ana-hint">{k.faq_auto.value.toLocaleString("es-AR")} en total</span>
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
                      <span className="ana-row-value">{Number(f.hits).toLocaleString("es-AR")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-card">
              <div className="ana-card-head">
                <div>
                  <h3>Prospectos por estado</h3>
                  <p className="subtitle">Dónde están tus {totalLeads.toLocaleString("es-AR")} prospectos</p>
                </div>
                <span className="ana-hint">{range} días</span>
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
                      <span className="ana-row-value">{n.toLocaleString("es-AR")}</span>
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
