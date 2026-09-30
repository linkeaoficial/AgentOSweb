import Image from "next/image";
import AgentSwitcher from "./AgentSwitcher";
import type { ReactNode } from "react";
import {
  IconMenu,
  IconClose,
  IconOverview,
  IconAgent,
  IconLeads,
  IconAnalytics,
  IconBilling,
  IconSettings,
  IconUser,
  IconBell,
  IconMoon,
  IconSun,
} from "./icons";

export interface NavItem {
  id: string;
  label: string;
  tooltip: string;
  badge?: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "view-overview", label: "Dashboard", tooltip: "Dashboard", icon: <IconOverview /> },
  { id: "view-agents", label: "Mis Agentes", tooltip: "Mis Agentes", icon: <IconAgent /> },
  { id: "view-leads", label: "Prospectos", tooltip: "Prospectos Capturados", icon: <IconLeads /> },
  { id: "view-analytics", label: "Analíticas", tooltip: "Analíticas", icon: <IconAnalytics /> },
  { id: "view-billing", label: "Planes & Facturación", tooltip: "Planes & Facturación", icon: <IconBilling /> },
  { id: "view-admin", label: "Clientes", tooltip: "Gestionar clientes", icon: <IconUser />, adminOnly: true },
  { id: "view-settings", label: "Configuración", tooltip: "Configuración", icon: <IconSettings /> },
];

interface SidebarProps {
  collapsed: boolean;
  activeView: string;
  pageTitle: string;
  isDark: boolean;
  isAdmin: boolean;
  agents: { id: string; name: string; is_active: number }[];
  ownerName: string;
  ownerEmail: string | null;
  onToggle: () => void;
  onNavigate: (viewId: string) => void;
  onToggleTheme: () => void;
  onOpenLogout: () => void;
  currentAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onCreateAgent: (name: string) => Promise<boolean>;
}

export default function Sidebar({ collapsed, activeView, pageTitle, isDark, isAdmin, agents, ownerName, ownerEmail, onToggle, onNavigate, onToggleTheme, onOpenLogout, currentAgentId, onSelectAgent, onCreateAgent }: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} id="sidebar">
      <div>
        <div className="brand-header">
          <div className="brand-left">
            <Image className="brand-logo-img" src="/imagen/Logo_AgentOSweb_chat.png" alt="AgentOSweb Logo" width={36} height={36} />
            <div className="brand-title">
              <h2>AgentOSweb</h2>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }} className="brand-subtitle">{pageTitle}</span>
            </div>
          </div>
          <div className="sidebar-header-actions">
            <button className="topbar-btn sidebar-notif" aria-label="Notificaciones">
              <IconBell />
              <span className="notif-badge" />
            </button>
            <button className="sidebar-toggle-btn" id="sidebar-toggle" aria-label="Expandir o colapsar menú" onClick={onToggle}>
              <IconMenu />
              <IconClose />
            </button>
          </div>
        </div>

        <nav className="nav-menu">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
              data-view={item.id}
              data-tooltip={item.id === "view-agents" ? (agents.length === 1 ? "Mi Agente" : "Mis Agentes") : item.tooltip}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              <span>{item.id === "view-agents" ? (agents.length === 1 ? "Mi Agente" : "Mis Agentes") : item.label}</span>
              {item.id === "view-agents" && agents.length > 0 && (
                <span className={`nav-badge ${agents.some((a) => a.is_active) ? "" : "off"}`}>
                  {agents.filter((a) => a.is_active).length} Activo{agents.filter((a) => a.is_active).length !== 1 ? "s" : ""}
                </span>
              )}
              {item.id !== "view-agents" && item.badge && <span className="nav-badge">{item.badge}</span>}
            </div>
          ))}

          <div className="nav-menu-user">
            {/* En desktop el AgentSwitcher vive en el Topbar, que se oculta en móvil
               (header.topbar { display: none }). Sin esto, en el celular no había
               forma de cambiar ni de crear un agente. */}
            <div className="nav-agent-switcher">
              <span className="nav-agent-label">Agente</span>
              <AgentSwitcher
                agents={agents}
                current={currentAgentId ?? ""}
                onSelect={onSelectAgent}
                onCreate={onCreateAgent}
              />
            </div>
            <div className="user-menu-divider" />
            <div className="user-menu-header nav-user-pill">
              <div className="user-menu-avatar">{ownerName.charAt(0).toUpperCase()}</div>
              <div className="user-menu-name">
                <h4>{ownerName}</h4>
                <p title={ownerEmail ?? undefined}>{ownerEmail || "—"}</p>
              </div>
            </div>
            <button className="user-menu-item" onClick={onToggleTheme}>
              {isDark ? <IconSun /> : <IconMoon />}
              {isDark ? "Modo Claro" : "Modo Oscuro"}
            </button>
            <button className="user-menu-item user-menu-signout" onClick={onOpenLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="user-avatar">{ownerName.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <h4>{ownerName}</h4>
            <p title={ownerEmail ?? undefined}>{ownerEmail || "—"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}