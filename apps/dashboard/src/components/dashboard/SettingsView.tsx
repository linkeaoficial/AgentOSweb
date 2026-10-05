"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useToast } from "./notifications";
import ConfirmModal from "./ConfirmModal";
import type { AgentOwner } from "./Dashboard";

export type ThemePref = "light" | "dark" | "system";

type SectionId = "cuenta" | "apariencia" | "seguridad" | "peligro";

interface Props {
  owner: AgentOwner | null;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  onNavigate: (viewId: string) => void;
  /** Abre el modal de Ayuda y Soporte (lo maneja Dashboard, que es quien tiene
      al pie de pagina tambien). */
  onOpenSupport: () => void;
}

interface SessionRow {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  userAgent?: string;
  ipAddress?: string;
}

const PLAN_LABELS: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", agency: "Agency" };
const THEME_LABELS: Record<ThemePref, string> = { light: "Claro", dark: "Oscuro", system: "Sistema" };

const SECTIONS: { id: SectionId; label: string; icon: ReactNode }[] = [
  {
    id: "cuenta",
    label: "Cuenta",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "apariencia",
    label: "Apariencia",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    id: "seguridad",
    label: "Seguridad",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "peligro",
    label: "Zona de peligro",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

const CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function describeDevice(ua?: string) {
  if (!ua) return "Dispositivo desconocido";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ios/i.test(ua)
        ? "iOS"
        : /mac os|macintosh/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : null;
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua) && !/chromium/i.test(ua)
      ? "Chrome"
      : /firefox\//i.test(ua)
        ? "Firefox"
        : /safari\//i.test(ua)
          ? "Safari"
          : null;
  if (browser && os) return `${browser} · ${os}`;
  return browser || os || "Dispositivo";
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    : null;

const fmtDateTime = (iso?: string) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
};

const jsonHeaders = { "Content-Type": "application/json" };

export default function SettingsView({ owner, theme, setTheme, onNavigate, onOpenSupport }: Props) {
  const toast = useToast();
  const [active, setActive] = useState<SectionId>("cuenta");
  const [detail, setDetail] = useState<SectionId | null>(null);

  const openSection = (id: SectionId) => {
    setActive(id);
    setDetail(id);
  };

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sessions, setSessions] = useState<{
    loading: boolean;
    rows: SessionRow[];
    currentId: string | null;
    error: boolean;
  }>({ loading: true, rows: [], currentId: null, error: false });

  const [showCloseAll, setShowCloseAll] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessions((s) => ({ ...s, loading: true, error: false }));
    try {
      const [cur, list] = await Promise.all([
        fetch("/api/auth/get-session")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/auth/list-sessions").then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        }),
      ]);
      const raw = Array.isArray(list) ? list : ((list?.sessions ?? []) as SessionRow[]);
      const rows = [...raw].sort((a, b) =>
        String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))
      );
      setSessions({
        loading: false,
        rows,
        currentId: (cur?.session?.id as string | undefined) ?? null,
        error: false,
      });
    } catch {
      setSessions((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (next.length < 8) {
      setError("La nueva contraseña necesita al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ currentPassword: current, newPassword: next, revokeOtherSessions: true }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
        setError(
          d.code === "INVALID_PASSWORD" || /invalid password|current password/i.test(d.message ?? "")
            ? "La contraseña actual no coincide."
            : d.message || "No se pudo cambiar la contraseña"
        );
        return;
      }
      toast.success("Contraseña actualizada. Se cerraron las sesiones en los demás dispositivos.");
      setCurrent("");
      setNext("");
      setConfirm("");
      loadSessions();
    } catch {
      setError("Error de red. Intentalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (id: string) => {
    try {
      const res = await fetch("/api/auth/revoke-session", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sessionId: id }),
      });
      if (!res.ok) throw new Error();
      if (id === sessions.currentId) {
        await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {});
        window.location.replace("/login");
        return;
      }
      toast.success("Sesión cerrada");
      loadSessions();
    } catch {
      toast.error("No se pudo cerrar la sesión");
    }
  };

  const closeAllSessions = async () => {
    try {
      const res = await fetch("/api/auth/revoke-sessions", { method: "POST", headers: jsonHeaders, body: "{}" });
      if (!res.ok) throw new Error();
      await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {});
      window.location.replace("/login");
    } catch {
      toast.error("No se pudieron cerrar las sesiones");
      setShowCloseAll(false);
    }
  };

  const deleteAccount = async () => {
    try {
      const res = await fetch("/api/auth/delete-user", { method: "POST", headers: jsonHeaders, body: "{}" });
      if (res.ok) {
        await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {});
        window.location.replace("/login");
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      toast.error(
        res.status === 404 || d.code === "NOT_FOUND"
          ? "La eliminación de cuenta todavía no está habilitada en el servidor."
          : d.message || "No se pudo eliminar la cuenta"
      );
      setShowDelete(false);
    } catch {
      toast.error("Error de red. Intentalo de nuevo.");
    }
  };

  const planLabel = PLAN_LABELS[owner?.plan ?? "free"] ?? "Free";
  const initial = (owner?.name || owner?.email || "U").trim().charAt(0).toUpperCase();
  const expires = fmtDate(owner?.plan_expires_at);
  const deletePhrase = owner?.email || "ELIMINAR";

  return (
    <section className="view-section active" id="view-settings">
      <div className="agents-header">
        <div className="agents-heading">
          <h2>Configuración</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Tu cuenta, la apariencia del panel y tu seguridad.
          </p>
        </div>
      </div>

      <div className={`set-layout${detail ? " is-detail" : ""}`}>
        <div className="set-menu">
          <button type="button" className="panel-card set-menu-account" onClick={() => openSection("cuenta")}>
            <span className="set-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="set-menu-account-text">
              <span className="set-identity-name">{owner?.name || "Cuenta AgentOSweb"}</span>
              <span className="set-identity-sub">{owner?.email ?? "Sin correo asociado"}</span>
            </span>
            {CHEVRON}
          </button>
          <nav className="panel-card set-menu-list" aria-label="Secciones de configuración">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`set-menu-row${s.id === "peligro" ? " is-danger" : ""}`}
                onClick={() => openSection(s.id)}
              >
                {s.icon}
                <span>{s.label}</span>
                {CHEVRON}
              </button>
            ))}
          </nav>
        </div>

        <nav className="set-nav" aria-label="Secciones de configuración">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`set-nav-btn${active === s.id ? " active" : ""}${s.id === "peligro" ? " is-danger" : ""}`}
              aria-current={active === s.id ? "page" : undefined}
              onClick={() => setActive(s.id)}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="set-content">
          <button type="button" className="set-back" onClick={() => setDetail(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Atrás
          </button>
          {active === "cuenta" && (
            <div className="panel-card">
              <div className="set-identity">
                <div className="set-avatar" aria-hidden="true">
                  {initial}
                </div>
                <div>
                  <div className="set-identity-name">{owner?.name || "Cuenta AgentOSweb"}</div>
                  <div className="set-identity-sub">{owner?.email ?? "Sin correo asociado"}</div>
                </div>
              </div>
              <div className="set-rows">
                <div className="set-row">
                  <span className="set-row-label">Correo electrónico</span>
                  <span>{owner?.email ?? "—"}</span>
                </div>
                <div className="set-row">
                  <span className="set-row-label">Rol</span>
                  <span className="chip">{owner?.role === "admin" ? "Administrador" : "Propietario"}</span>
                </div>
                <div className="set-row">
                  <span className="set-row-label">Plan</span>
                  <span className="set-plan-pill">{planLabel}</span>
                </div>
                {expires && (
                  <div className="set-row">
                    <span className="set-row-label">Vencimiento</span>
                    <span>{expires}</span>
                  </div>
                )}
                <button type="button" className="set-row set-link" onClick={() => onNavigate("view-billing")}>
                  <span>Planes y facturación</span>
                  {CHEVRON}
                </button>
                <button type="button" className="set-row set-link" onClick={() => onNavigate("view-agents")}>
                  <span>Widget, agentes y contenido</span>
                  {CHEVRON}
                </button>
                <button type="button" className="set-row set-link" onClick={onOpenSupport}>
                  <span>
                    Ayuda y soporte
                    <span className="set-row-sub">Escribinos y te respondemos por email</span>
                  </span>
                  {CHEVRON}
                </button>
                {owner?.support_whatsapp && (
                  <a
                    className="set-row set-link"
                    href={`https://wa.me/${owner.support_whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>Ayuda y soporte (WhatsApp)</span>
                    {CHEVRON}
                  </a>
                )}
              </div>
            </div>
          )}

          {active === "apariencia" && (
            <div className="panel-card">
              <div className="set-card-head">
                <h3>Apariencia</h3>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  Tema del panel. «Sistema» sigue la preferencia de tu dispositivo.
                </p>
              </div>
              <div className="segmented set-theme-seg" role="radiogroup" aria-label="Tema del panel">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={theme === t}
                    className={`segmented-btn${theme === t ? " active" : ""}`}
                    onClick={() => setTheme(t)}
                  >
                    {THEME_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {active === "seguridad" && (
            <div className="panel-card">
              <div className="set-card-head">
                <h3>Cambiar contraseña</h3>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  Al cambiarla se cierran las sesiones abiertas en los demás dispositivos.
                </p>
              </div>
              <form onSubmit={submitPassword}>
                <div className="form-group">
                  <label className="form-label" htmlFor="pwd-current">
                    Contraseña actual
                  </label>
                  <input
                    id="pwd-current"
                    className="form-input"
                    type="password"
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row form-row-mini">
                  <div className="form-group">
                    <label className="form-label" htmlFor="pwd-new">
                      Nueva contraseña
                    </label>
                    <input
                      id="pwd-new"
                      className="form-input"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pwd-confirm">
                      Repetir nueva contraseña
                    </label>
                    <input
                      id="pwd-confirm"
                      className="form-input"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && <div className="form-banner-error">{error}</div>}
                <button className="btn-primary" type="submit" disabled={busy} aria-busy={busy}>
                  {busy ? "Guardando…" : "Cambiar contraseña"}
                </button>
              </form>

              <div className="set-block">
                <div className="set-card-head">
                  <h3>Sesiones activas</h3>
                  <p className="subtitle" style={{ marginBottom: 0 }}>
                    Dispositivos con acceso a tu cuenta.
                  </p>
                </div>

                {sessions.loading ? (
                  <div className="faq-skeleton" aria-hidden="true">
                    <div className="faq-skeleton-row" style={{ height: 56 }} />
                    <div className="faq-skeleton-row" style={{ height: 56 }} />
                  </div>
                ) : sessions.error ? (
                  <p className="form-hint">
                    No se pudieron cargar las sesiones desde este dispositivo. Si persiste, cerrá y volvé a
                    iniciar sesión.
                  </p>
                ) : sessions.rows.length === 0 ? (
                  <p className="form-hint">Sin sesiones registradas.</p>
                ) : (
                  <div className="set-sessions">
                    {sessions.rows.map((row) => {
                      const isCurrent = row.id === sessions.currentId;
                      return (
                        <div className="set-session" key={row.id}>
                          <div className="set-session-main">
                            <div className="set-session-name">{describeDevice(row.userAgent)}</div>
                            <div className="set-session-meta">
                              {fmtDateTime(row.updatedAt ?? row.createdAt) || "—"}
                              {row.ipAddress ? ` · ${row.ipAddress}` : ""}
                            </div>
                          </div>
                          {isCurrent ? (
                            <span className="set-session-current">Este dispositivo</span>
                          ) : (
                            <button type="button" className="set-session-close" onClick={() => revokeSession(row.id)}>
                              Cerrar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="set-actions">
                  <button type="button" className="btn-danger" onClick={() => setShowCloseAll(true)}>
                    Cerrar todas las sesiones
                  </button>
                </div>
              </div>
            </div>
          )}

          {active === "peligro" && (
            <div className="panel-card set-danger">
              <div className="set-card-head">
                <h3>Zona de peligro</h3>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  Estas acciones no se pueden deshacer.
                </p>
              </div>
              <div className="set-rows">
                <div className="set-row">
                  <div className="set-danger-text">
                    <div className="switch-label">Eliminar mi cuenta</div>
                    <p className="form-hint" style={{ margin: 0 }}>
                      Borra tu cuenta y todos tus agentes, prospectos y datos.
                    </p>
                  </div>
                  <button type="button" className="btn-danger" onClick={() => setShowDelete(true)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showCloseAll}
        title="¿Cerrar todas las sesiones?"
        description="Se cerrará el acceso en todos los dispositivos, incluido este. Tendrás que iniciar sesión de nuevo."
        confirmLabel="Cerrar todas"
        loadingText="Cerrando sesiones"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        }
        onClose={() => setShowCloseAll(false)}
        onConfirm={closeAllSessions}
      />

      <ConfirmModal
        open={showDelete}
        title="¿Eliminar tu cuenta?"
        description={
          <>
            Se eliminarán tus agentes, conversaciones, prospectos y configuración de forma permanente.
          </>
        }
        confirmPhrase={deletePhrase}
        confirmLabel="Eliminar cuenta"
        loadingText="Eliminando cuenta"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
        onClose={() => setShowDelete(false)}
        onConfirm={deleteAccount}
      />
    </section>
  );
}
