"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCheck, IconX, IconBolt, IconWhatsApp } from "./icons";
import { useToast } from "./notifications";
import ModalShell from "./ModalShell";
import PlanHistoryModal from "./PlanHistoryModal";

export interface PlanDefault {
  agents: number;
  messages: number;
}

export interface BillingOwner {
  id: string;
  email: string | null;
  name: string | null;
  role?: string | null;
  plan: string | null;
  agent_limit: number;
  messages_limit: number;
  messages_used: number;
  plan_expires_at?: string | null;
  // Plan del que cayó la cuenta por vencimiento (ya quedó en free).
  downgraded_from?: string | null;
  support_whatsapp?: string | null;
}

interface BillingViewProps {
  owner: BillingOwner | null;
  planDefaults: Record<string, PlanDefault>;
  agentsCount: number;
  onSaved: () => void;
}

const PLAN_INFO: { id: string; name: string; byok: number | null; managed: number; accent: string }[] = [
  { id: "free", name: "Free", byok: null, managed: 0, accent: "#94a3b8" },
  { id: "starter", name: "Starter", byok: 19, managed: 39, accent: "#60a5fa" },
  { id: "pro", name: "Pro", byok: 49, managed: 89, accent: "#a78bfa" },
  { id: "agency", name: "Agency", byok: 149, managed: 249, accent: "#fbbf24" },
];

// Filas comparables: la MISMA lista en las 4 tarjetas, con ✓ o ✗ según el plan.
// Verificado contra el código (01-oct-2026): gates por plan en el worker =
// `bubble_logo_url` (Agency), BYOK (Starter+, 403 al guardar en plan Free) y
// el cupo de agentes (402 al superar `agent_limit`, que en Starter es 1), por
// eso "Varios agentes" recién desde Pro y "Marca blanca" solo en Agency.
const FEATURE_ROWS: { label: string; plans: string[] }[] = [
  { label: "Widget embebible con chat 24/7", plans: ["free", "starter", "pro", "agency"] },
  { label: "IA administrada (Workers AI)", plans: ["free", "starter", "pro", "agency"] },
  { label: "Tu propia API key (BYOK, sin consumir cupo)", plans: ["starter", "pro", "agency"] },
  { label: "Captura de prospectos y formularios", plans: ["free", "starter", "pro", "agency"] },
  { label: "Varios agentes en la cuenta", plans: ["pro", "agency"] },
  { label: "Marca blanca (logo propio en la burbuja)", plans: ["agency"] },
];

// Semáforo de las barras, igual al de Clientes (AdminView): verde ≤70%,
// ámbar <90%, rojo ≥90%.
const barColor = (p: number) => (p >= 90 ? "#dc2626" : p >= 70 ? "#d97706" : "#16a34a");

// Vencimiento: la base devuelve 'YYYY-MM-DD' y Date lo leería como UTC, asi que
// se parsea a medianoche local para que no corra un día para atrás.
function formatExpiry(raw: string): string {
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Días que faltan para el vencimiento (0 = hoy, negativo = vencido).
function daysUntil(raw: string): number | null {
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default function BillingView({ owner, planDefaults, agentsCount, onSaved }: BillingViewProps) {
  const toast = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>("free");
  const [agentLimit, setAgentLimit] = useState<number>(1);
  const [messagesLimit, setMessagesLimit] = useState<number>(20);
  const [saving, setSaving] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // El cliente ve su facturación en solo lectura: los cupos los ajusta el
  // dueño desde Clientes. Fallo cerrado: sin owner (cargando) queda en lectura.
  const canEdit = owner?.role === "admin";

  useEffect(() => {
    if (!owner) return;
    setSelectedPlan(owner.plan ?? "free");
    setAgentLimit(owner.agent_limit);
    setMessagesLimit(owner.messages_limit ?? planDefaults[owner.plan ?? "free"]?.messages ?? 20);
  }, [owner]);

  const planDefault = planDefaults[selectedPlan];

  const applyPlan = useCallback(
    (plan: string) => {
      setSelectedPlan(plan);
      const d = planDefaults[plan];
      if (d) {
        setAgentLimit(d.agents);
        setMessagesLimit(d.messages);
      }
    },
    [planDefaults]
  );

  const openContact = useCallback((plan: string) => {
    setSelectedPlan(plan);
    setPayModalOpen(true);
  }, []);

  const ownerLimit = owner?.messages_limit ?? planDefaults[owner?.plan ?? ""]?.messages ?? 0;
  const dirty = Boolean(
    owner &&
      (selectedPlan !== (owner.plan ?? "free") ||
        agentLimit !== owner.agent_limit ||
        messagesLimit !== ownerLimit)
  );

  const save = useCallback(async () => {
    if (!Number.isInteger(agentLimit) || agentLimit < 1) {
      toast.error("El límite de agentes debe ser 1 o más");
      return;
    }
    if (!Number.isInteger(messagesLimit) || messagesLimit < 1) {
      toast.error("Los mensajes por mes deben ser 1 o más");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, agent_limit: agentLimit, messages_limit: messagesLimit }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar el plan");
      toast.success("Plan y cupos actualizados");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }, [selectedPlan, agentLimit, messagesLimit, toast, onSaved]);

  const handleSaveClick = useCallback(() => {
    const isPaid = (PLAN_INFO.find((p) => p.id === selectedPlan)?.managed ?? 0) > 0;
    if (isPaid) {
      setPayModalOpen(true);
      return;
    }
    void save();
  }, [selectedPlan, save]);

  const selected = PLAN_INFO.find((p) => p.id === selectedPlan);
  // El número vive en el worker (secret SUPPORT_WHATSAPP): con el de constantes
  // un cambio de número obligaba a redesplegar el panel.
  const whatsapp = owner?.support_whatsapp ?? "";
  const whatsappText = encodeURIComponent(
    `Hola! Quiero ${owner?.plan === selectedPlan ? "renovar" : "pasar al"} plan ${selected?.name ?? selectedPlan} de AgentOSweb ($${selected?.managed ?? 0}/mes, IA administrada). ¿Cómo coordinamos el pago?`
  );

  const used = owner?.messages_used ?? 0;
  const limit = owner?.messages_limit ?? planDefaults[owner?.plan ?? ""]?.messages ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const agentPct = owner && owner.agent_limit > 0 ? Math.min(100, Math.round((agentsCount / owner.agent_limit) * 100)) : 0;

  // Vencimiento: cuenta caída (downgraded_from) o por vencer (chip de días).
  const currentInfo = PLAN_INFO.find((p) => p.id === (owner?.plan ?? "free"));
  const down = owner?.downgraded_from ?? null;
  const downgradeLabel = down ? PLAN_INFO.find((p) => p.id === down)?.name ?? null : null;
  const expiryDays = owner?.plan_expires_at ? daysUntil(owner.plan_expires_at) : null;
  const expired = expiryDays !== null && expiryDays < 0;

  // Identidad estable: PlanHistoryModal relee cuando cambia `load`, y un objeto
  // literal por render dispararía un fetch en bucle con el modal abierto.
  const historyAccount = useMemo(
    () => (owner ? { id: owner.id, email: owner.email, name: owner.name } : null),
    [owner]
  );

  return (
    <section className="view-section active" id="view-billing">
      <div className="agents-header">
        <div className="agents-heading">
          <h2>Planes &amp; Facturación</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            {canEdit
              ? "Asigná el plan de la cuenta y ajustá los cupos de agentes y mensajes. Los valores del plan se aplican solos, pero podés personalizarlos por cliente."
              : "Tu plan, tu consumo de este mes y el historial de cambios. Para modificar cupos o contratar un plan, coordiná el pago y lo aplicamos."}
          </p>
        </div>
      </div>

      {(down || expired) && currentInfo && (
        <div className="plan-expired-banner" role="status">
          <div className="plan-expired-text">
            <strong>
              {down
                ? `Tu plan ${downgradeLabel ?? currentInfo.name} venció y la cuenta pasó a Free.`
                : `Tu plan ${currentInfo.name} venció${owner?.plan_expires_at ? ` el ${formatExpiry(owner.plan_expires_at)}` : ""}.`}
            </strong>{" "}
            {canEdit
              ? "Elegí el plan arriba y aplicá para reactivarlo."
              : "Reactivalo y recuperás tus cupos de agentes y mensajes."}
          </div>
          {!canEdit && whatsapp && (
            <a
              className="plan-expired-btn"
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                `Hola! Quiero reactivar mi plan ${downgradeLabel ?? currentInfo.name} de AgentOSweb. ¿Cómo coordinamos?`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <IconWhatsApp />
              Reactivar
            </a>
          )}
        </div>
      )}

      <div className="plan-cards">
        {PLAN_INFO.map((p) => {
          const d = planDefaults[p.id] ?? { agents: 1, messages: 0 };
          const isCurrent = owner?.plan === p.id;
          const curPlan = owner?.plan ?? "free";
          const evaluating = p.id === selectedPlan && !isCurrent;
          return (
            <button
              key={p.id}
              type="button"
              className={`plan-card ${selectedPlan === p.id ? "selected" : ""}`}
              onClick={() => {
                if (canEdit) applyPlan(p.id);
                else if (!isCurrent) openContact(p.id);
              }}
            >
              {p.id === "starter" && <span className="plan-popular">Popular</span>}
              <div className="plan-card-head">
                <span className="plan-dot" style={{ background: p.accent }} />
                <h3>{p.name}</h3>
                {isCurrent && <span className="plan-current-badge">Plan actual</span>}
              </div>
              <div className="plan-price">
                {p.managed === 0 ? (
                  <strong>Gratis</strong>
                ) : (
                  <>
                    <strong>${p.managed}</strong>
                    <span>/mes · IA administrada</span>
                  </>
                )}
              </div>
              {p.byok !== null && <div className="plan-price-alt">o ${p.byok}/mes con tu API (BYOK)</div>}
              <div className="plan-caps">
                <span>
                  <strong>{d.agents}</strong> agente{d.agents !== 1 ? "s" : ""}
                </span>
                <span>
                  <strong>{d.messages.toLocaleString()}</strong> msgs/mes
                </span>
              </div>
              <ul className="plan-features">
                {FEATURE_ROWS.map((row) => {
                  const has = row.plans.includes(p.id);
                  const changed = has !== row.plans.includes(curPlan);
                  const cls = [!has && "is-off", evaluating && changed && "is-change"]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li key={row.label} className={cls || undefined}>
                      {has ? <IconCheck /> : <IconX />}
                      {row.label}
                    </li>
                  );
                })}
              </ul>
              <span
                className={`plan-cta${
                  canEdit
                    ? selectedPlan === p.id
                      ? " is-selected"
                      : ""
                    : isCurrent
                      ? " is-muted"
                      : ""
                }`}
              >
                {canEdit
                  ? selectedPlan === p.id
                    ? "Seleccionado"
                    : "Elegir plan"
                  : isCurrent
                    ? "Plan actual"
                    : "Coordinar cambio"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="plan-editor">
        <div className="panel-card">
          <h3>{canEdit ? "Cupos de la cuenta" : "Tu plan"}</h3>
          <p className="subtitle">
            {canEdit
              ? "Elegí un plan arriba para rellenar los valores, o editá los cupos a mano."
              : "Consumo del mes en curso y vencimiento de tu plan."}
          </p>

          <div className="plan-form">
            {canEdit && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="plan-select">
                    Plan
                  </label>
                  <select
                    id="plan-select"
                    className="form-select"
                    value={selectedPlan}
                    onChange={(e) => applyPlan(e.target.value)}
                  >
                    {PLAN_INFO.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="plan-form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="plan-agents">
                      Límite de agentes
                    </label>
                    <input
                      id="plan-agents"
                      className="form-input"
                      type="number"
                      min={1}
                      max={100}
                      value={agentLimit}
                      onChange={(e) => setAgentLimit(Number(e.target.value))}
                    />
                    <span className="plan-field-hint">
                      {planDefault ? `Plan ${PLAN_INFO.find((p) => p.id === selectedPlan)?.name}: ${planDefault.agents}` : ""}
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="plan-messages">
                      Mensajes por mes
                    </label>
                    <input
                      id="plan-messages"
                      className="form-input"
                      type="number"
                      min={1}
                      max={1000000}
                      value={messagesLimit}
                      onChange={(e) => setMessagesLimit(Number(e.target.value))}
                    />
                    <span className="plan-field-hint">
                      {planDefault ? `Plan ${PLAN_INFO.find((p) => p.id === selectedPlan)?.name}: ${planDefault.messages.toLocaleString()}` : ""}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="plan-usage">
              <div className="plan-usage-row">
                <span>Mensajes administrados este mes</span>
                <strong>
                  {used.toLocaleString()} / {limit.toLocaleString()}
                </strong>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor(pct) }} />
              </div>
              <div className="plan-usage-row" style={{ marginTop: 10 }}>
                <span>Agentes creados</span>
                <strong>
                  {agentsCount} / {owner?.agent_limit ?? 0}
                </strong>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${agentPct}%`, background: barColor(agentPct) }} />
              </div>
              {owner?.plan_expires_at && (
                <div className="plan-usage-row" style={{ marginTop: 10 }}>
                  <span>Vencimiento del plan</span>
                  <strong>
                    {formatExpiry(owner.plan_expires_at)}
                    {expiryDays !== null && expiryDays >= 0 && (
                      <span className={`plan-expiry-days${expiryDays <= 7 ? " is-soon" : ""}`}>
                        {expiryDays === 0 ? "vence hoy" : `en ${expiryDays} día${expiryDays === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </strong>
                </div>
              )}
            </div>

            <div className="plan-actions">
              {canEdit ? (
                <button className="btn-primary" onClick={handleSaveClick} disabled={saving || !dirty} aria-busy={saving}>
                  {saving ? (
                    <>
                      <span className="btn-spinner" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <IconBolt />
                      {(PLAN_INFO.find((p) => p.id === selectedPlan)?.managed ?? 0) > 0
                        ? `Contratar plan ${PLAN_INFO.find((p) => p.id === selectedPlan)?.name}`
                        : "Guardar plan y cupos"}
                    </>
                  )}
                </button>
              ) : null}
              <button className="btn-ghost" type="button" onClick={() => setHistoryOpen(true)}>
                Ver historial
              </button>
              {canEdit && !dirty && <span className="plan-saved-hint">Sin cambios pendientes</span>}
            </div>
          </div>
        </div>
      </div>

      {historyAccount && (
        <PlanHistoryModal open={historyOpen} account={historyAccount} onClose={() => setHistoryOpen(false)} />
      )}

      {/* Montado siempre (como PlanHistoryModal) y abierto por estado: si se
          montara ya con `.open` el navegador no pinta el estado inicial y la
          transición de entrada no corre. */}
      {selected && (
        <ModalShell
          open={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          ariaLabel={`Coordinar pago del plan ${selected.name}`}
          innerClassName="pay-modal"
        >
          <div className="pay-modal-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 8h20" />
            </svg>
          </div>
          <h2>Coordinar pago</h2>
          <p>
            El plan <strong>{selected.name}</strong> requiere una coordinación de pago. Enviás la solicitud por
            WhatsApp y te la confirmamos a la brevedad.
          </p>
          <div className="pay-summary">
            <div className="pay-summary-row">
              <span>Plan</span>
              <strong>{selected.name}</strong>
            </div>
            <div className="pay-summary-row">
              <span>Costo</span>
              <strong>${selected.managed}/mes</strong>
            </div>
            <div className="pay-summary-row">
              <span>Cupos</span>
              <strong>{planDefaults[selected.id]?.agents ?? 1} agentes · {(planDefaults[selected.id]?.messages ?? 0).toLocaleString()} msgs/mes</strong>
            </div>
            {currentInfo && currentInfo.id !== selected.id && (
              <div className="pay-summary-row pay-change">
                <span>Cambio</span>
                <strong>
                  {currentInfo.name} → {selected.name} · {planDefaults[currentInfo.id]?.agents ?? 1}→
                  {planDefaults[selected.id]?.agents ?? 1} agentes ·{" "}
                  {(planDefaults[currentInfo.id]?.messages ?? 0).toLocaleString()}→
                  {(planDefaults[selected.id]?.messages ?? 0).toLocaleString()} msgs
                </strong>
              </div>
            )}
          </div>
          {whatsapp && (
            <a
              className="pay-whatsapp-btn"
              href={`https://wa.me/${whatsapp}?text=${whatsappText}`}
              target="_blank"
              rel="noreferrer"
            >
              <IconWhatsApp />
              Coordinar por WhatsApp
            </a>
          )}
          {canEdit && (
            <button type="button" className="pay-apply-btn" onClick={() => { setPayModalOpen(false); void save(); }} disabled={saving}>
              Ya coordiné · Aplicar plan ahora
            </button>
          )}
          {!canEdit && (
            <p className="subtitle" style={{ textAlign: "center", marginBottom: 0 }}>
              Aplicamos el cambio apenas confirmemos el pago. Tus cupos actuales se mantienen hasta entonces.
            </p>
          )}
        </ModalShell>
      )}
    </section>
  );
}
