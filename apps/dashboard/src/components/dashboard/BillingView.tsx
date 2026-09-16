"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconBolt } from "./icons";
import { useToast } from "./notifications";

export interface PlanDefault {
  agents: number;
  messages: number;
}

export interface BillingOwner {
  name: string | null;
  plan: string | null;
  agent_limit: number;
  messages_limit: number;
  messages_used: number;
}

interface BillingViewProps {
  owner: BillingOwner | null;
  planDefaults: Record<string, PlanDefault>;
  agentsCount: number;
  onSaved: () => void;
}

const PLAN_INFO: { id: string; name: string; byok: number | null; managed: number; accent: string; features: string[] }[] = [
  { id: "free", name: "Free", byok: null, managed: 0, accent: "#94a3b8", features: ["IA administrada de prueba", "Branding AgentOSweb", "Sin BYOK ni marca blanca"] },
  { id: "starter", name: "Starter", byok: 19, managed: 39, accent: "#60a5fa", features: ["IA administrada o tu API Key", "BYOK ilimitado", "Ideal para empezar"] },
  { id: "pro", name: "Pro", byok: 49, managed: 89, accent: "#a78bfa", features: ["Sin marca de agua", "Modo BYOK", "Alertas a Telegram"] },
  { id: "agency", name: "Agency", byok: 149, managed: 249, accent: "#fbbf24", features: ["Marca blanca total", "Dominios ilimitados", "Soporte prioritario"] },
];

export default function BillingView({ owner, planDefaults, agentsCount, onSaved }: BillingViewProps) {
  const toast = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>("free");
  const [agentLimit, setAgentLimit] = useState<number>(1);
  const [messagesLimit, setMessagesLimit] = useState<number>(20);
  const [saving, setSaving] = useState(false);

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

  const used = owner?.messages_used ?? 0;
  const limit = owner?.messages_limit ?? planDefaults[owner?.plan ?? ""]?.messages ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const agentPct = owner && owner.agent_limit > 0 ? Math.min(100, Math.round((agentsCount / owner.agent_limit) * 100)) : 0;

  return (
    <section className="view-section active" id="view-billing">
      <div className="agents-header">
        <div className="agents-heading">
          <h2>Planes &amp; Facturación</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Asigná el plan de la cuenta y ajustá los cupos de agentes y mensajes. Los valores del plan se aplican
            solos, pero podés personalizarlos por cliente.
          </p>
        </div>
      </div>

      <div className="plan-cards">
        {PLAN_INFO.map((p) => {
          const d = planDefaults[p.id] ?? { agents: 1, messages: 0 };
          const isCurrent = owner?.plan === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`plan-card ${selectedPlan === p.id ? "selected" : ""}`}
              onClick={() => applyPlan(p.id)}
            >
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
                {p.features.map((f) => (
                  <li key={f}>
                    <IconCheck />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="plan-editor">
        <div className="panel-card">
          <h3>Cupos de la cuenta</h3>
          <p className="subtitle">Elegí un plan arriba para rellenar los valores, o editá los cupos a mano.</p>

          <div className="plan-form">
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

            <div className="plan-usage">
              <div className="plan-usage-row">
                <span>Mensajes administrados este mes</span>
                <strong>
                  {used.toLocaleString()} / {limit.toLocaleString()}
                </strong>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="plan-usage-row" style={{ marginTop: 10 }}>
                <span>Agentes creados</span>
                <strong>
                  {agentsCount} / {owner?.agent_limit ?? 0}
                </strong>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${agentPct}%` }} />
              </div>
            </div>

            <div className="plan-actions">
              <button className="btn-primary" onClick={save} disabled={saving || !dirty} aria-busy={saving}>
                {saving ? (
                  <>
                    <span className="btn-spinner" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <IconBolt />
                    Guardar plan y cupos
                  </>
                )}
              </button>
              {!dirty && <span className="plan-saved-hint">Sin cambios pendientes</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}