"use client";

import { useEffect, useRef, useState } from "react";

export interface DashboardAgent {
  id: string;
  name: string;
  is_active: number;
}

interface AgentSwitcherProps {
  agents: DashboardAgent[];
  current: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}

export default function AgentSwitcher({ agents, current, onSelect, onCreate }: AgentSwitcherProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const currentAgent = agents.find((a) => a.id === current) ?? agents[0];

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const rect = root?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 330 && rect.top > spaceBelow) setUp(true);
      else setUp(false);
    }
    if (creating) inputRef.current?.focus();
    const onDocClick = (e: MouseEvent) => {
      if (!root?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, creating]);

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    if (clean.length > 60) {
      setError("Máximo 60 caracteres");
      return;
    }
    if (agents.some((a) => a.name.trim().toLowerCase() === clean.toLowerCase())) {
      setError("Ya existe un agente con ese nombre");
      return;
    }
    setBusy(true);
    setError("");
    onCreate(clean);
    setName("");
    setCreating(false);
    setOpen(false);
    setBusy(false);
  };

  return (
    <div className="agent-switcher" ref={rootRef}>
      <button
        type="button"
        className="dropdown-trigger asw-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Cambiar de agente"
      >
        <span className={`asw-status-dot ${currentAgent?.is_active ? "" : "off"}`} />
        <span className="dropdown-trigger-label">{currentAgent?.name ?? "Agente"}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 10 6"
          className={`dropdown-chevron ${open ? "open" : ""}`}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className={`dropdown-menu asw-menu ${up ? "up" : ""}`} role="listbox">
          {agents.length === 0 && <div className="asw-empty">Aún no hay agentes</div>}
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={a.id === current}
              className={`dropdown-option ${a.id === current ? "active" : ""}`}
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
            >
              <span className="asw-option-name">{a.name}</span>
              <span className={`asw-status-pill ${a.is_active ? "" : "off"}`}>{a.is_active ? "Activo" : "Pausado"}</span>
            </button>
          ))}
          <div className="asw-divider" />
          {creating ? (
            <div className="asw-create">
              <input
                ref={inputRef}
                className="form-input asw-create-input"
                value={name}
                placeholder="Nombre del nuevo agente"
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              {error && <span className="asw-create-error">{error}</span>}
              <button type="button" className="btn btn-primary asw-create-btn" disabled={busy || !name.trim()} onClick={submit}>
                Crear
              </button>
            </div>
          ) : (
            <button type="button" className="dropdown-option asw-new" onClick={() => setCreating(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nuevo agente
            </button>
          )}
        </div>
      )}
    </div>
  );
}