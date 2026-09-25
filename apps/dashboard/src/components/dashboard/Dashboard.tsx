"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { OverviewView, UnderConstructionView, getScript, type OverviewData } from "./Views";
import AgentsView from "./AgentsView";
import BillingView, { type PlanDefault } from "./BillingView";
import LeadsView from "./LeadsView";
import AgentSwitcher, { type DashboardAgent } from "./AgentSwitcher";
import DashboardFooter from "./Footer";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./notifications";
import { IconAnalytics, IconSettings } from "./icons";
import { API_BASE, AGENT_ID } from "./config";

const TITLE_MAP: Record<string, string> = {
  "view-overview": "Dashboard",
  "view-agents": "Mis Agentes",
  "view-leads": "Prospectos Capturados",
  "view-analytics": "Analíticas",
  "view-billing": "Planes & Facturación",
  "view-settings": "Configuración",
};

const PLACEHOLDER_VIEWS: Record<string, { icon: ReactNode; title: string; description: string }> = {
  "view-analytics": {
    icon: <IconAnalytics />,
    title: "Analíticas e Insights de Comportamiento",
    description:
      "Estadísticas detalladas sobre volumen de interacciones por hora, temas más consultados y rendimiento general del agente de IA.",
  },
  "view-settings": {
    icon: <IconSettings />,
    title: "Configuración General de la Cuenta",
    description:
      "Aquí gestionarás el nombre del negocio, dominios autorizados contra CORS, webhooks de notificación externa y claves de API privadas.",
  },
};

export interface AgentOwner {
  name: string | null;
  plan: string | null;
  agent_limit: number;
  messages_limit: number;
  messages_used: number;
}

const PLAN_LABELS: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", agency: "Agency" };

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(true);
  const [activeView, setActiveView] = useState("view-overview");
  const [isDark, setIsDark] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("agentosweb-dashboard-theme") === "dark",
  );
  const [isMobile, setIsMobile] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [owner, setOwner] = useState<AgentOwner | null>(null);
  const [planDefaults, setPlanDefaults] = useState<Record<string, PlanDefault>>({});
  const [currentAgentId, setCurrentAgentId] = useState(AGENT_ID);
  const [agentsReady, setAgentsReady] = useState(false);

  const toast = useToast();
  const AGENT_CACHE_KEY = "agentosweb:current_agent";
  const loadAgents = useCallback(() => {
    return fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((d: { agents?: DashboardAgent[]; owner?: AgentOwner; plan_defaults?: Record<string, PlanDefault> }) => {
        setAgents(d.agents ?? []);
        setOwner(d.owner ?? null);
        setPlanDefaults(d.plan_defaults ?? {});
        return d.agents ?? [];
      })
      .catch(() => []);
  }, []);

  useEffect(() => {
    let alive = true;
    loadAgents().then((list) => {
      if (!alive) return;
      if (list.length > 0) {
        const saved = localStorage.getItem(AGENT_CACHE_KEY);
        const target = list.find((a) => a.id === saved) ? saved! : list[0].id;
        setCurrentAgentId(target);
      } else {
        setCurrentAgentId(AGENT_ID);
      }
      setAgentsReady(true);
    });
    return () => {
      alive = false;
    };
  }, [loadAgents]);

  const handleSelectAgent = useCallback(
    (id: string) => {
      localStorage.setItem(AGENT_CACHE_KEY, id);
      setCurrentAgentId(id);
      if (id !== currentAgentId) {
        const name = agents.find((a) => a.id === id)?.name;
        toast.success(name ? `Agente activo: ${name}` : "Agente cambiado");
      }
    },
    [agents, currentAgentId, toast]
  );

  const handleCreateAgent = useCallback(
    (name: string): Promise<boolean> => {
      return fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
        .then(async (r) => {
          const d = (await r.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
          if (!r.ok || !d.ok || !d.id) throw new Error(d.error || "No se pudo crear el agente");
          return d.id;
        })
        .then((id) => {
          toast.success("Agente creado. Ahora edítalo a tu gusto.");
          return loadAgents()
            .then(() => {
              localStorage.setItem(AGENT_CACHE_KEY, id);
              setCurrentAgentId(id);
              setActiveView("view-agents");
            })
            .then(() => true)
            .catch(() => false);
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "Error al crear el agente");
          return false;
        });
    },
    [toast, loadAgents]
  );

  useEffect(() => {
    const TTL_MS = 5 * 60 * 1000;
    const CACHE_KEY = `agentosweb:overview:${currentAgentId}`;
    let alive = true;

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { ts: number; data: OverviewData };
        if (Date.now() - parsed.ts < TTL_MS && parsed.data) {
          setOverview(parsed.data);
          return;
        }
      }
    } catch {
      // Cache corrupto: ignorar y volver a buscar
    }

    fetch(`/api/overview/${currentAgentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((d: OverviewData) => {
        if (!alive) return;
        setOverview(d);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: d }));
        } catch {
          // Almacenamiento no disponible (modo privado): seguir sin cache
        }
      })
      .catch(() => {
        if (alive) {
          setOverviewError(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [currentAgentId]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setCollapsed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("agentosweb-dashboard-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const closeMobileMenu = useCallback(() => {
    if (window.innerWidth <= 768) setCollapsed(true);
  }, []);

  useEffect(() => {
    const main = document.querySelector(".content-wrapper");
    main?.scrollTo({ top: 0 });
    window.scrollTo(0, 0);
  }, [activeView]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closeMobileMenu]);

  const handleNavigate = useCallback(
    (viewId: string) => {
      setActiveView(viewId);
      closeMobileMenu();
    },
    [closeMobileMenu]
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(getScript(currentAgentId)).then(() => {
      toast.success("Script copiado al portapapeles");
    });
  }, [toast, currentAgentId]);

  const handleAgentsChanged = useCallback(() => {
    loadAgents();
  }, [loadAgents]);

  const handleAgentDeleted = useCallback(
    (deletedId: string) => {
      loadAgents().then((list) => {
        const next = list.find((a) => a.id !== deletedId);
        if (next) handleSelectAgent(next.id);
        else setCurrentAgentId(AGENT_ID);
      });
    },
    [loadAgents, handleSelectAgent]
  );

  const openLogout = useCallback(() => {
    closeMobileMenu();
    setShowLogout(true);
  }, [closeMobileMenu]);

  const pageTitle =
    activeView === "view-agents"
      ? agents.length === 1
        ? "Mi Agente"
        : "Mis Agentes"
      : TITLE_MAP[activeView];

  return (
    <>
      <div className={`nav-backdrop ${!collapsed && isMobile ? "show" : ""}`} id="nav-backdrop" aria-hidden="true" onClick={closeMobileMenu} />

      <Sidebar
        collapsed={collapsed}
        activeView={activeView}
        pageTitle={pageTitle}
        isDark={isDark}
        agents={agents}
        ownerName={owner?.name ?? "Cuenta"}
        ownerPlan={owner?.plan ? PLAN_LABELS[owner.plan] ?? owner.plan : "Plan"}
        onToggle={() => setCollapsed((c) => !c)}
        onNavigate={handleNavigate}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenLogout={openLogout}
      />

      <main className="content-wrapper">
        <Topbar
          pageTitle={pageTitle}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onNavigate={handleNavigate}
          onOpenLogout={openLogout}
          ownerName={owner?.name ?? "Cuenta"}
          ownerPlan={owner?.plan ? PLAN_LABELS[owner.plan] ?? owner.plan : "Plan"}
          switcher={<AgentSwitcher agents={agents} current={currentAgentId} onSelect={handleSelectAgent} onCreate={handleCreateAgent} />}
        />

        {agentsReady ? (
          activeView === "view-overview" ? (
            <OverviewView onCopy={handleCopy} data={overview} loadError={overviewError} agentId={currentAgentId} />
          ) : activeView === "view-agents" ? (
            <AgentsView
              key={currentAgentId}
              apiBase={API_BASE}
              agentId={currentAgentId}
              plan={owner?.plan ?? null}
              onChanged={handleAgentsChanged}
              onDeleted={handleAgentDeleted}
            />
          ) : activeView === "view-billing" ? (
            <BillingView owner={owner} planDefaults={planDefaults} agentsCount={agents.length} onSaved={handleAgentsChanged} />
          ) : activeView === "view-leads" ? (
            <LeadsView key={currentAgentId} agentId={currentAgentId} />
          ) : (
            <UnderConstructionView id={activeView} {...PLACEHOLDER_VIEWS[activeView]} />
          )
        ) : (
          <div className="content-loading">
            <span className="btn-spinner" />
            Cargando agente…
          </div>
        )}

        <DashboardFooter />
      </main>

      <ConfirmModal
        open={showLogout}
        title="¿Cerrar sesión?"
        description="Estás a punto de salir de tu cuenta de AgentOSweb. Deberás iniciar sesión nuevamente para acceder a tu dashboard."
        confirmLabel="Cerrar sesión"
        loadingText="Cerrando sesión"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        }
        onClose={() => setShowLogout(false)}
        onConfirm={async () => { await new Promise((r) => setTimeout(r, 400)); await fetch("/api/logout", { method: "POST" }).catch(() => {}); window.location.reload(); }}
      />
    </>
  );
}