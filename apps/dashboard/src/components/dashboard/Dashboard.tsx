"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { OverviewView, UnderConstructionView, getScript, type OverviewData } from "./Views";
import { AnalyticsView } from "./AnalyticsView";
import AgentsView from "./AgentsView";
import BillingView, { type PlanDefault } from "./BillingView";
import AdminView from "./AdminView";
import LeadsView from "./LeadsView";
import AgentSwitcher, { type DashboardAgent } from "./AgentSwitcher";
import DashboardFooter from "./Footer";
import ConfirmModal from "./ConfirmModal";
import RenewalModal from "./RenewalModal";
import SettingsView, { type ThemePref } from "./SettingsView";
import SupportModal from "./SupportModal";
import { useToast } from "./notifications";
import { IconOverview } from "./icons";
import { API_BASE } from "./config";

const TITLE_MAP: Record<string, string> = {
  "view-overview": "Dashboard",
  "view-agents": "Mis Agentes",
  "view-leads": "Prospectos Capturados",
  "view-analytics": "Analíticas",
  "view-billing": "Planes & Facturación",
  "view-admin": "Clientes",
  "view-settings": "Configuración",
};

export interface AgentOwner {
  // El propio id de la cuenta: va con el payload para poder pedir el historial
  // de plan propio sin adivinarlo.
  id: string;
  name: string | null;
  email: string | null;
  plan: string | null;
  role?: string;
  agent_limit: number;
  messages_limit: number;
  messages_used: number;
  plan_expires_at?: string | null;
  // Plan del que cayo la cuenta por vencimiento (ya quedo en free).
  downgraded_from?: string | null;
  // El worker ya resuelve si toca avisar: vencido + bajado + no visto aun.
  show_expiry_notice?: boolean;
  support_whatsapp?: string | null;
  // Últimos meses con uso (snapshot del cron), mes más reciente primero.
  usage_history?: { month: string; messages: number }[];
}

const PLAN_LABELS: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", agency: "Agency" };

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(true);
  const [activeView, setActiveView] = useState("view-overview");
  const [theme, setTheme] = useState<ThemePref>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const v = localStorage.getItem("agentosweb-dashboard-theme");
      return v === "dark" || v === "light" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(false);
  const isDark = theme === "system" ? systemDark : theme === "dark";
  const [isMobile, setIsMobile] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [owner, setOwner] = useState<AgentOwner | null>(null);
  const [planDefaults, setPlanDefaults] = useState<Record<string, PlanDefault>>({});
  const [currentAgentId, setCurrentAgentId] = useState("");
  const [agentsReady, setAgentsReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  // Un solo modal para los dos puntos de entrada (Configuración y pie de
  // página): si cada uno montara el suyo, el formulario estaría duplicado y
  // los dos podrían quedar desincronizados.
  const [showSupport, setShowSupport] = useState(false);

  const toast = useToast();
  const AGENT_CACHE_KEY = "agentosweb:current_agent";
  // No se traga el error: un 403 de sesión expirada debe distinguishse de una
  // cuenta sin agentes, si no caemos al id demo inexistente y rompen las 3 vistas.
  const loadAgents = useCallback(() => {
    return fetch("/api/agents")
      .then(async (r) => {
        // 401/403 = sesión vencida. La cookie es httpOnly (no se borra desde JS),
        // el login la sobreescribe: solo hay que sacar al usuario de acá.
        if (r.status === 401 || r.status === 403) {
          window.location.replace("/login");
          throw new Error("Sesión expirada");
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json().catch(() => {
          throw new Error("Respuesta no-JSON (HTTP " + r.status + ")");
        });
      })
      .then((d: { agents?: DashboardAgent[]; owner?: AgentOwner; plan_defaults?: Record<string, PlanDefault> }) => {
        setAgents(d.agents ?? []);
        setOwner(d.owner ?? null);
        setPlanDefaults(d.plan_defaults ?? {});
        return d.agents ?? [];
      });
  }, []);

  // El cliente cerro el aviso. Se cierra primero en local (no hacerlo esperar un
  // round trip: el modal tapa la pantalla y cualquier latencia se siente como
  // que el boton no responde) y despues se avisa al worker, que es quien decide
  // si vuelve a aparecer en el proximo vencimiento.
  const dismissExpiryNotice = useCallback(async () => {
    setOwner((o) => (o ? { ...o, show_expiry_notice: false } : o));
    await fetch("/api/user/notice", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    loadAgents()
      .then((list) => {
        if (!alive) return;
        if (list.length > 0) {
          const saved = localStorage.getItem(AGENT_CACHE_KEY);
          const target = list.find((a) => a.id === saved) ? saved! : list[0].id;
          localStorage.setItem(AGENT_CACHE_KEY, target);
          setCurrentAgentId(target);
          setAgentsReady(true);
          return;
        }
        // Cuenta sin agentes: creamos el primero para que las vistas tengan un ID real.
        return fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Mi Agente" }),
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
          .then((d) => {
            if (!d?.ok || !d?.id) throw new Error("no id");
            return d.id as string;
          })
          .then((id) => {
            if (!alive) return;
            localStorage.setItem(AGENT_CACHE_KEY, id);
            setCurrentAgentId(id);
            setAgentsReady(true);
          });
      })
      .catch((e) => {
        if (!alive) return;
        if (String(e?.message) === "Sesión expirada") return;
        toast.error("No se pudo conectar con el servidor. " + (e instanceof Error ? e.message : ""));
        setAgentsReady(true);
      });
    return () => {
      alive = false;
    };
  }, [loadAgents, toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nuevo") === "1") {
      setShowWelcome(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
          setOverviewError(false);
          return;
        }
      }
    } catch {
      // Cache corrupto: ignorar y volver a buscar
    }

    // Sin agentId real no hay nada que pedir: esperar al bootstrap de loadAgents.
    if (!currentAgentId) return;

    fetch(`/api/overview/${currentAgentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((d: OverviewData) => {
        if (!alive) return;
        setOverview(d);
        setOverviewError(false);
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
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("agentosweb-dashboard-theme", theme);
  }, [isDark, theme]);

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
    loadAgents().catch(() => {});
  }, [loadAgents]);

  const handleAgentDeleted = useCallback(
    (deletedId: string) => {
      loadAgents()
        .then((list) => {
          const next = list.find((a) => a.id !== deletedId);
          if (next) handleSelectAgent(next.id);
        })
        .catch(() => {});
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
        isAdmin={owner?.role === "admin"}
        ownerName={owner?.name ?? "Cuenta"}
        ownerEmail={owner?.email ?? null}
        onToggle={() => setCollapsed((c) => !c)}
        onNavigate={handleNavigate}
        onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
        onOpenLogout={openLogout}
        currentAgentId={currentAgentId}
        onSelectAgent={handleSelectAgent}
        onCreateAgent={handleCreateAgent}
      />

      <main className="content-wrapper">
        <Topbar
          pageTitle={pageTitle}
          isDark={isDark}
          onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
          onNavigate={handleNavigate}
          onOpenLogout={openLogout}
          ownerName={owner?.name ?? "Cuenta"}
          ownerEmail={owner?.email ?? null}
          planLabel={owner ? PLAN_LABELS[owner.plan ?? "free"] ?? "Free" : null}
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
          ) : activeView === "view-admin" && owner?.role === "admin" ? (
            <AdminView planDefaults={planDefaults} />
          ) : activeView === "view-leads" ? (
            <LeadsView key={currentAgentId} agentId={currentAgentId} />
          ) : activeView === "view-settings" ? (
            <SettingsView owner={owner} theme={theme} setTheme={setTheme} onNavigate={handleNavigate} onOpenSupport={() => setShowSupport(true)} />
          ) : activeView === "view-analytics" ? (
            <AnalyticsView agentId={currentAgentId} onNavigate={handleNavigate} />
          ) : (
            <UnderConstructionView
              id={activeView}
              icon={<IconOverview />}
              title="Próximamente"
              description="Esta sección todavía está en construcción."
            />
          )
        ) : (
          <div className="content-loading">
            <span className="btn-spinner" />
            Cargando agente…
          </div>
        )}

        {/* El footer va al final del contenido. Durante la carga se oculta: si
            aparecía después del spinner luego saltaba al fondo al cargar el
            agente, y en móvil eso se veía como un parpadeo. */}
        {agentsReady && (
          <DashboardFooter
            planLabel={owner?.plan ? PLAN_LABELS[owner.plan] ?? owner.plan : "Free"}
            agentsLabel={`${agents.length} de ${owner?.agent_limit ?? "—"} agentes`}
            onSupport={() => setShowSupport(true)}
          />
        )}
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
    onConfirm={async () => { await new Promise((r) => setTimeout(r, 400)); await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {}); window.location.replace("/login"); }}
    />

      <SupportModal
        open={showSupport}
        onClose={() => setShowSupport(false)}
        email={owner?.email}
        planLabel={owner?.plan ? PLAN_LABELS[owner.plan] ?? owner.plan : "Free"}
      />

      {/* Aviso de plan vencido. No tiene estado propio: se abre con el flag que
          manda el worker (vencido + bajado + no visto aun), asi que el panel no
          repite la regla y no puede mostrarse cuando no corresponde. */}
      <RenewalModal
        open={Boolean(owner?.show_expiry_notice)}
        downgradedFrom={owner?.downgraded_from ?? null}
        expiredAt={owner?.plan_expires_at ?? null}
        whatsapp={owner?.support_whatsapp ?? null}
        onDismiss={dismissExpiryNotice}
      />


      <div className={`modal-backdrop ${showWelcome ? "open" : ""}`} aria-hidden={!showWelcome} onClick={() => setShowWelcome(false)}>
        <div className="welcome-modal" role="dialog" aria-modal="true" aria-label="Bienvenida" onClick={(e) => e.stopPropagation()}>
          <div className="welcome-logo">
            <Image src="/imagen/Logo_AgentOSweb_chat.png" alt="AgentOSweb" width={76} height={76} />
            <span className="welcome-logo-ping" />
          </div>
          <h3>¡Tu cuenta esta lista!</h3>
          <p className="welcome-sub">En 3 pasos tenes tu asistente atendiendo a tus visitantes.</p>

          <ol className="welcome-steps">
            <li>
              <span className="welcome-step-num">1</span>
              <div>
                <h5>Crea tu primer asistente</h5>
                <p>Editalo a tu gusto en la vista de agentes.</p>
              </div>
              <button type="button" className="welcome-step-cta" onClick={() => { setShowWelcome(false); handleNavigate("view-agents"); }}>
                Ir a agentes
              </button>
            </li>
            <li>
              <span className="welcome-step-num">2</span>
              <div>
                <h5>Copiá el script de instalacion</h5>
                <p>Se genera automaticamente en el panel principal.</p>
              </div>
              <button type="button" className="welcome-step-cta" onClick={() => { setShowWelcome(false); handleNavigate("view-overview"); handleCopy(); }}>
                Ver mi script
              </button>
            </li>
            <li>
              <span className="welcome-step-num">3</span>
              <div>
                <h5>Pegalo en tu web</h5>
                <p>Antes de &lt;/body&gt;, recarga y listo. Funciona en cualquier sitio.</p>
              </div>
            </li>
          </ol>

          <button type="button" className="auth-submit welcome-primary" onClick={() => setShowWelcome(false)}>
            Empezar
          </button>
        </div>
      </div>
    </>
  );
}