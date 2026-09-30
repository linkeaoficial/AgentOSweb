import Image from "next/image";
import type { ReactNode } from "react";
import { IconBell, IconMoon, IconSun } from "./icons";
import UserMenu from "./UserMenu";

interface TopbarProps {
  pageTitle: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (viewId: string) => void;
  onOpenLogout: () => void;
  switcher?: ReactNode;
  ownerName: string;
  ownerEmail: string | null;
}

export default function Topbar({ pageTitle, isDark, onToggleTheme, onNavigate, onOpenLogout, switcher, ownerName, ownerEmail }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <Image className="topbar-logo-img" src="/imagen/Logo_AgentOSweb_chat.png" alt="AgentOSweb Logo" width={36} height={36} />
        <h1 id="page-title" className="topbar-page-title">
          {pageTitle}
        </h1>
      </div>
      {switcher && <div className="topbar-switcher">{switcher}</div>}
      <div className="topbar-actions">
        <button className="topbar-btn" id="notif-btn" aria-label="Notificaciones">
          <IconBell />
          <span className="notif-badge" />
        </button>

        <button className="topbar-btn" id="theme-btn" aria-label="Cambiar tema" onClick={onToggleTheme}>
          {isDark ? <IconSun /> : <IconMoon />}
        </button>

        <UserMenu isDark={isDark} onToggleTheme={onToggleTheme} onNavigate={onNavigate} onOpenLogout={onOpenLogout} ownerName={ownerName} ownerEmail={ownerEmail} />
      </div>
    </header>
  );
}