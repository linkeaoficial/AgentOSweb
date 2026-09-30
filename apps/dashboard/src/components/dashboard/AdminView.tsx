"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "./notifications";
import { Dropdown } from "./AgentsView";
import { pageNumbers } from "./LeadsView";
import PlanHistoryModal from "./PlanHistoryModal";
import type { PlanDefault } from "./BillingView";

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  plan: string | null;
  agent_limit: number | null;
  messages_limit: number | null;
  messages_used: number;
  agents: number;
  created?: string | number | null;
  plan_expires_at?: string | null;
  has_telegram?: boolean;
  has_webhook?: boolean;
  agent_names?: string | null;
  // Plan del que cayo la cuenta por vencimiento automatico.
  downgraded_from?: string | null;
  // El worker ya resuelve si el cliente todavia no vio el aviso de renovacion.
  show_expiry_notice?: boolean;
}

interface AdminViewProps {
  planDefaults: Record<string, PlanDefault>;
}

const PAGE_SIZE = 10;
const PLAN_IDS = ["free", "starter", "pro", "agency"] as const;
const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

// Barra de cuota con semáforo: verde <=70%, ámbar <90%, rojo >=90%.
// El color va inline (y no en clases por porcentaje) porque hay 101 valores
// posibles y una regla CSS por cada uno sería ruido.
function Meter({ label, used, limit }: { label: string; used: number; limit: number | null | undefined }) {
  const p = limit && limit > 0 ? Math.max(0, Math.min(100, Math.round((used / limit) * 100))) : 0;
  const color = p >= 90 ? "#dc2626" : p >= 70 ? "#d97706" : "#16a34a";
  return (
    <div className="acct-meter">
      <div className="acct-meter-head">
        <span>{label}</span>
        <strong>
          {used} / {limit ?? "—"}
        </strong>
      </div>
      <div className="acct-meter-track">
        <div className="acct-meter-fill" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

// Días que faltan para el vencimiento. Negativo = ya venció. El date-only
// "YYYY-MM-DD" se ancla a medianoche UTC para no correrse un día por zona.
function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(`${iso}T00:00:00Z`).getTime();
  if (isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / 86_400_000);
}

// El vencimiento tiene que leerse de un vistazo: cuántos días quedan es la
// información que el dueño busca, no la fecha pelada.
function ExpiryStatus({ iso }: { iso: string | null | undefined }) {
  const d = daysLeft(iso);
  if (d === null) return <span style={{ color: "var(--text-muted)" }}>Sin vencimiento</span>;
  if (d < 0) return <span className="acct-pill" data-level="bad">Vencido hace {-d} días</span>;
  if (d === 0) return <span className="acct-pill" data-level="bad">Vence hoy</span>;
  return (
    <span className="acct-pill" data-level={d <= 7 ? "warn" : "ok"}>
      Vence en {d} {d === 1 ? "día" : "días"}
    </span>
  );
}

// Vencida pero el cron todavía no la bajó: la fila sigue diciendo "Pro" mientras
// el worker ya la trata como Free. `free`/`starter` son perpetuos, así que solo
// tiene sentido para un plan de pago. `downgraded_from` ya cargado = el cron
// corrió, así que no entra en este caso.
function expiredButNotDowngraded(u: AdminUser): boolean {
  const p = u.plan ?? "free";
  if (p === "free" || p === "starter") return false;
  if (u.downgraded_from) return false;
  const d = daysLeft(u.plan_expires_at);
  return d !== null && d < 0;
}

function initials(v: string): string {
  const s = v.trim();
  const parts = s.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Acepta los dos formatos: Better Auth entrega createdAt en ms (numero) y las
// cuentas legacy guardan created_at como texto ISO.
function formatDate(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function AdminSkeleton() {
  return (
    <div className="panel-card" aria-busy="true" aria-label="Cargando cuentas">
      <div className="faq-skeleton-row" style={{ width: "100%", height: 32, marginBottom: 18 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="faq-skeleton-row" style={{ height: 44, marginBottom: 10 }} />
      ))}
    </div>
  );
}

export default function AdminView({ planDefaults }: AdminViewProps) {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);
  // Filtros de la tabla. Los dos son de cliente, no del worker: `users` ya trae
  // `plan` y `plan_expires_at` de todas las cuentas, asi que filtrar aca evita un
  // endpoint nuevo y un viaje de ida y vuelta por cada tecla.
  const [expiryFilter, setExpiryFilter] = useState(false);
  const [planFilter, setPlanFilter] = useState("");
  // Historial: vive en su propio modal (PlanHistoryModal), no en el drawer.
  const [historyFor, setHistoryFor] = useState<AdminUser | null>(null);

  const openDetail = useCallback((u: AdminUser) => {
    setDetail(u);
    setExpiryDraft(u.plan_expires_at ?? "");
  }, []);

  // Cierra con Escape: el overlay y la X ya cubren click afuera.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { users?: AdminUser[]; error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la lista de clientes");
      const list = data.users ?? [];
      setUsers(list);
      setDrafts(Object.fromEntries(list.map((u) => [u.id, u.plan ?? "free"])));
      setLoadError(null);
    } catch (e) {
      // Sin esto, una consulta fallida deja users=[] y la vista muestra
      // "Todavía no hay cuentas registradas", que es una mentira: el error
      // real (columna faltante, sesión vencida, worker caído) se perdía en un
      // toast que desaparece a los 3 segundos.
      setLoadError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (u: AdminUser) => {
      const plan = drafts[u.id];
      if (!plan || plan === (u.plan ?? "free")) return;
      setSaving(u.id);
      try {
        const res = await fetch("/api/user", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: u.id, plan }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar el plan");
        toast.success(`Plan de ${u.email ?? u.name} actualizado a ${PLAN_LABELS[plan] ?? plan}`);
        void load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error de red al guardar");
      } finally {
        setSaving(null);
      }
    },
    [drafts, load, toast]
  );

  // Un solo camino de guardado para las dos formas de tocar la fecha. El
  // worker devuelve la vigencia resultante (la renovación la calcula él), así
  // que acá no se repite la aritmética de meses ni se adivina el resultado.
  const putExpiry = useCallback(
    async (body: Record<string, unknown>) => {
      if (!detail) return;
      setSavingExpiry(true);
      try {
        const res = await fetch("/api/user", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: detail.id, ...body }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          plan_expires_at?: string | null;
        };
        if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar");
        const next = data.plan_expires_at ?? null;
        setDetail((d) => (d ? { ...d, plan_expires_at: next } : d));
        setExpiryDraft(next ?? "");
        toast.success(next ? `Vence el ${formatDate(next)}` : "Vencimiento quitado");
        void load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error de red al guardar");
      } finally {
        setSavingExpiry(false);
      }
    },
    [detail, load, toast]
  );

  // Los dos filtros se combinan (AND), no se pisan: "Pro" + "vence esta semana"
  // es una pregunta real ("¿qué clientes pro se me vencen esta semana?"), y
  // por eso se filtran sobre la misma lista en vez de un switch. El Set evita
  // un O(n²) de `includes` adentro del `filter`.
  const expiringSoon = useMemo(
    () => users.filter((u) => {
      const d = daysLeft(u.plan_expires_at);
      return d !== null && d >= 0 && d <= 7;
    }),
    [users]
  );

  const expiringIds = useMemo(() => new Set(expiringSoon.map((u) => u.id)), [expiringSoon]);

  const byPlan = useMemo(
    () => (planFilter ? users.filter((u) => (u.plan ?? "free") === planFilter) : users),
    [users, planFilter]
  );

  const visible = expiryFilter ? byPlan.filter((u) => expiringIds.has(u.id)) : byPlan;
  const total = visible.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumber = Math.min(page, totalPages);
  const rows = visible.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);
  const projected =
    totalPages > 5
      ? [1, ...(pageNumber > 3 ? [0] : []), ...pageNumbers(pageNumber, totalPages), ...(pageNumber < totalPages - 2 ? [0] : []), totalPages]
      : Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <section className="view-section active" id="view-admin">
      <div className="agents-header">
        <div className="agents-heading">
          <h2>Clientes</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Cambiá el plan de cualquier cuenta. Los cupos de agentes y mensajes se ajustan
            automáticamente al plan nuevo.
          </p>
        </div>
        <div className="admin-toolbar">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              setExpiryFilter((f) => !f);
              setPage(1);
            }}
            aria-pressed={expiryFilter}
          >
            {expiryFilter ? "Ver todas" : "Vence esta semana"}
            {expiringSoon.length > 0 ? <span className="admin-filter-count">{expiringSoon.length}</span> : null}
          </button>
          <button className="btn-ghost" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Mismas clases que la fila de estados de Prospectos (.leads-status-filter
          + .lead-filter-pill): reusadas tal cual en vez de inventar un segundo
          juego de píldoros con otro color y otro radio. */}
      <div className="leads-status-filter" role="tablist" aria-label="Filtrar por plan">
        {["", ...PLAN_IDS].map((p) => {
          // Contar por plan va sobre `users` y no sobre `byPlan`: si no, al
          // elegir "Free" los otros contadores caerían a cero y el filtro
          // parecería roto en vez de mostrar el cruce.
          const n = p ? users.filter((u) => (u.plan ?? "free") === p).length : users.length;
          return (
            <button
              key={p || "all"}
              type="button"
              role="tab"
              aria-selected={planFilter === p}
              className={`lead-filter-pill${planFilter === p ? " is-active" : ""}`}
              onClick={() => {
                setPlanFilter(p);
                setPage(1);
              }}
            >
              {p ? PLAN_LABELS[p] : "Todos"}
              <span className="lead-filter-pill-n">{n}</span>
            </button>
          );
        })}
      </div>

      {loading && users.length === 0 ? (
        <AdminSkeleton />
      ) : loadError ? (
        <div className="panel-card">
          <p className="acct-hint" style={{ marginTop: 0 }}>
            No se pudo cargar la lista de clientes.
          </p>
          <p className="acct-error-detail">{loadError}</p>
          <button className="btn-primary" type="button" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : total === 0 ? (
        <div className="panel-card">
          {/* El mensaje cambia según POR QUÉ no hay filas: con un filtro activo
              decir "todavía no hay cuentas registradas" es mentira (hay, pero
              escondidas detrás del filtro) y deja al dueño pensando que se
              perdió la base. */}
          <p className="subtitle">
            {planFilter || expiryFilter
              ? "Ninguna cuenta coincide con el filtro."
              : "Todavía no hay cuentas registradas."}
          </p>
          {planFilter || expiryFilter ? (
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                setPlanFilter("");
                setExpiryFilter(false);
                setPage(1);
              }}
            >
              Quitar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <div className="panel-card">
          {/* Sin .leads-table-wrap: trae overflow:auto (que recortaría el desplegable
              del plan) y border-radius (que el header cuadrado del spoilearía).
              El marco lo pone el .panel-card de arriba. */}
          <div>
            <table className="leads-table admin-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Rol</th>
                  <th>Agentes</th>
                  <th>Mensajes</th>
                  <th>Plan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const dirty = drafts[u.id] !== (u.plan ?? "free");
                  const plan = drafts[u.id] ?? "free";
                  return (
                    <tr
                      key={u.id}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        const t = e.target as HTMLElement;
                        if (t.closest("button, a, input, select")) return;
                        openDetail(u);
                      }}
                    >
                      <td>
                        <strong>{u.email || u.name || "—"}</strong>
                        {u.name && u.name !== u.email ? (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.name}</div>
                        ) : null}
                      </td>
                      <td data-label="Rol">
                        {u.role === "admin" ? (
                          "Administrador"
                        ) : u.role === "sin login" ? (
                          <span className="leads-pager-ellipsis" style={{ color: "var(--text-muted)" }}>
                            sin login
                          </span>
                        ) : (
                          "Cliente"
                        )}
                      </td>
                      <td data-label="Agentes">
                        {u.agents} / {u.agent_limit ?? planDefaults[u.plan ?? "free"]?.agents ?? "—"}
                      </td>
                      <td data-label="Mensajes">
                        {u.messages_used} / {u.messages_limit ?? planDefaults[u.plan ?? "free"]?.messages ?? "—"}
                      </td>
                      <td data-label="Plan">
                        <Dropdown
                          value={plan}
                          options={PLAN_IDS.map((p) => ({ id: p, name: PLAN_LABELS[p] }))}
                          onChange={(v) => setDrafts((d) => ({ ...d, [u.id]: v }))}
                        />
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="btn-ghost"
                          type="button"
                          title="Ver detalle de la cuenta"
                          aria-label={`Ver detalle de ${u.email ?? u.name ?? u.id}`}
                          onClick={() => openDetail(u)}
                          style={{ marginRight: 8 }}
                        >
                          Detalle
                        </button>
                        <button
                          className="btn-primary"
                          type="button"
                          disabled={!dirty || saving === u.id}
                          onClick={() => void save(u)}
                        >
                          {saving === u.id ? "Guardando…" : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div className="leads-footer">
              <span className="leads-pager-info">
                Mostrando <strong>{(pageNumber - 1) * PAGE_SIZE + 1}</strong>–
                <strong>{Math.min(pageNumber * PAGE_SIZE, total)}</strong> de <strong>{total}</strong> cuenta
                {total === 1 ? "" : "s"}
              </span>
              <div className="leads-pager">
                <button
                  type="button"
                  className="leads-pager-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                >
                  Anterior
                </button>
                {projected.map((p, i) =>
                  p === 0 ? (
                    <span key={`e${i}`} className="leads-pager-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`leads-pager-num${p === pageNumber ? " is-active" : ""}`}
                      onClick={() => setPage(p)}
                      aria-label={`Ir a página ${p}`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="leads-pager-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageNumber >= totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portal a document.body: el .panel-card se anima con transform
          (aow-fade-up, fill-mode both), y eso lo vuelve containing block de
          position:fixed — sin portal el drawer scrollea con la tabla. Mismo
          motivo por el que la barra de lote de Prospectos va portalizada. */}
      {detail &&
        createPortal(
          <div className="lead-drawer-overlay" onClick={() => setDetail(null)}>
            <aside
              className="lead-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`Detalle de ${detail.email ?? detail.name ?? detail.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="lead-drawer-header">
                <div className="lead-drawer-avatar">{initials(detail.name || detail.email || "?")}</div>
                <div className="lead-drawer-title">
                  <h2>{detail.name || detail.email || "Cuenta"}</h2>
                  <span title={detail.email ?? undefined}>{detail.email || "sin email de login"}</span>
                </div>
                <button className="lead-drawer-close" type="button" onClick={() => setDetail(null)} aria-label="Cerrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </header>

              <div className="lead-drawer-body">
                <section className="lead-drawer-sec">
                  <h3>Cuenta</h3>
                  <div className="lead-drawer-row">
                    <span>Rol</span>
                    <strong>
                      {detail.role === "admin" ? "Administrador" : detail.role === "sin login" ? "Nunca inició sesión" : "Cliente"}
                    </strong>
                  </div>
                  <div className="lead-drawer-row">
                    <span>Alta</span>
                    <strong>{formatDate(detail.created)}</strong>
                  </div>
                  <div className="lead-drawer-row">
                    <span>ID</span>
                    <strong className="acct-mono" title={detail.id}>
                      {detail.id.slice(0, 18)}…
                    </strong>
                  </div>
                  <div className="lead-drawer-row">
                    <span>Alertas</span>
                    <strong>
                      {/* undefined = el worker todavía no manda este dato (no
                          desplegado): se muestra "—" en vez de mentir con un
                          "ninguna configurada" que no sabemos. */}
                      {detail.has_telegram === undefined && detail.has_webhook === undefined ? (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      ) : detail.has_telegram || detail.has_webhook ? (
                        [detail.has_telegram ? "Telegram" : null, detail.has_webhook ? "Webhook" : null]
                          .filter(Boolean)
                          .join(" + ")
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>ninguna configurada</span>
                      )}
                    </strong>
                  </div>
                </section>

                <section className="lead-drawer-sec">
                  <h3>Plan y cuotas</h3>
                  <div className="lead-drawer-row">
                    <span>Plan</span>
                    <strong>{PLAN_LABELS[detail.plan ?? "free"] ?? detail.plan}</strong>
                  </div>

                  {/* El worker corta al instante cuando la fecha ya pasó, pero la
                      fila del plan todavía dice "Pro" hasta que pasa el cron (hasta
                      24h). Mostrar 25000 mensajes ahí haría que el dueño le prometa
                      al cliente algo que el sistema ya no le da. */}
                  {expiredButNotDowngraded(detail) ? (
                    <p className="acct-downgrade-note">
                      <strong>Ya venció</strong>, pero el plan todavía figura como{" "}
                      {PLAN_LABELS[detail.plan ?? "free"] ?? detail.plan} hasta que corra el proceso
                      diario. <strong>Desde ya está limitado como el plan gratuito</strong> y el
                      cliente ya está viendo el aviso de renovación.
                    </p>
                  ) : null}

                  <Meter
                    label="Agentes"
                    used={detail.agents}
                    limit={detail.agent_limit ?? planDefaults[detail.plan ?? "free"]?.agents}
                  />
                  <Meter
                    label="Mensajes del mes"
                    used={detail.messages_used}
                    limit={detail.messages_limit ?? planDefaults[detail.plan ?? "free"]?.messages}
                  />
                </section>

                <section className="lead-drawer-sec">
                  <h3>Vencimiento del plan</h3>
                  <div className="acct-expiry-status">
                    <ExpiryStatus iso={detail.plan_expires_at} />
                  </div>
                  <div className="acct-renew">
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={savingExpiry}
                      onClick={() => void putExpiry({ renew_months: 1 })}
                    >
                      {savingExpiry ? "Guardando…" : "Renovar +1 mes"}
                    </button>
                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={savingExpiry}
                      onClick={() => void putExpiry({ renew_months: 3 })}
                    >
                      +3 meses
                    </button>
                  </div>
                  <div className="acct-expiry">
                    <input
                      type="date"
                      className="form-input"
                      value={expiryDraft}
                      onChange={(e) => setExpiryDraft(e.target.value)}
                      aria-label="Fecha de vencimiento exacta"
                    />
                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={savingExpiry || (detail.plan_expires_at ?? "") === expiryDraft}
                      onClick={() => void putExpiry({ plan_expires_at: expiryDraft || null })}
                    >
                      Fijar fecha
                    </button>
                  </div>
                  <p className="acct-hint">
                    El vencimiento corre solo: se puso un mes al crear la cuenta y cada vez que cambia el
                    plan. Cuando el cliente paga, tocá <strong>Renovar</strong> y listo — la fecha la
                    calcula el sistema, no hace falta que la cuentes. Solo usá la fecha exacta para un
                    caso raro (una promoción que termina el 15, por ejemplo).
                  </p>
                  {detail.downgraded_from ? (
                    <p className="acct-downgrade-note">
                      Esta cuenta cayó sola a <strong>Free</strong>: su plan{" "}
                      <strong>{PLAN_LABELS[detail.downgraded_from] ?? detail.downgraded_from}</strong> venció y no se renovó.
                      Sus agentes siguen funcionando con los límites del plan gratuito. Cuando vuelva a
                      pagar, <strong>Renovar</strong> le devuelve el plan que tenía.
                    </p>
                  ) : null}
                </section>

                <section className="lead-drawer-sec">
                  <div className="lead-drawer-row">
                    <span>Historial</span>
                    <button className="btn-ghost" type="button" onClick={() => setHistoryFor(detail)}>
                      Ver historial
                    </button>
                  </div>
                </section>

                <section className="lead-drawer-sec">
                  <h3>Agentes ({detail.agents})</h3>
                  {detail.agent_names ? (
                    <ul className="acct-list">
                      {detail.agent_names.split("|").map((n) => (
                        <li key={n}>{n.trim()}</li>
                      ))}
                    </ul>
                  ) : detail.agents > 0 ? (
                    /* El conteo y el listado vienen del mismo paquete del worker,
                       pero nunca se afirma "no tiene agentes" si el conteo dice
                       que hay: si faltan los nombres, se dice lo que sí sabemos. */
                    <p className="acct-hint">
                      {detail.agents} {detail.agents === 1 ? "agente" : "agentes"} (sin nombres disponibles)
                    </p>
                  ) : (
                    <p className="acct-hint">Esta cuenta todavía no tiene agentes.</p>
                  )}
                </section>
              </div>
            </aside>
          </div>,
          document.body
        )}

      <PlanHistoryModal
        open={Boolean(historyFor)}
        account={historyFor}
        onClose={() => setHistoryFor(null)}
      />
    </section>
  );
}
