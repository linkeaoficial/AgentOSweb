"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconUser, IconMoon, IconSun, IconBilling, IconSettings } from "./icons";

interface UserMenuProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (viewId: string) => void;
  onOpenLogout: () => void;
  ownerName: string;
  ownerPlan: string;
}

export default function UserMenu({ isDark, onToggleTheme, onNavigate, onOpenLogout, ownerName, ownerPlan }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  const go = (viewId: string) => {
    onNavigate(viewId);
    close();
  };

  return (
    <div className="user-menu-wrap" ref={wrapRef}>
      <button className="topbar-btn" id="avatar-btn" aria-label="Perfil de usuario" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconUser />
      </button>

      <div className={`user-menu ${open ? "open" : ""}`} role="menu">
        <div className="user-menu-header">
          <div className="user-menu-avatar">{ownerName.charAt(0).toUpperCase()}</div>
          <div className="user-menu-name">
            <h4>{ownerName}</h4>
            <p>{ownerPlan}</p>
          </div>
        </div>

        <button className="user-menu-item" role="menuitem" onClick={() => go("view-billing")}>
          <IconBilling />
          Planes &amp; Facturación
        </button>
        <button className="user-menu-item" role="menuitem" onClick={() => go("view-settings")}>
          <IconSettings />
          Configuración
        </button>

        <div className="user-menu-divider" />

        <button className="user-menu-item" role="menuitem" onClick={() => { onToggleTheme(); }}>
          {isDark ? <IconSun /> : <IconMoon />}
          {isDark ? "Modo Claro" : "Modo Oscuro"}
        </button>
        <button className="user-menu-item user-menu-signout" role="menuitem" onClick={() => { setOpen(false); onOpenLogout(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}