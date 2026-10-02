"use client";

import { useState } from "react";
import { useToast } from "./notifications";

// Cambio de contraseña vía Better Auth (`POST /api/auth/change-password`, el
// proxy /api/auth/* del panel lo reenvía con la cookie de sesión).
//
// `revokeOtherSessions: true` es la rotación de la FASE 2E: Better Auth borra
// TODAS las sesiones de la cuenta y emite una cookie nueva para esta (la
// respuesta trae el Set-Cookie y el proxy lo reenvía al navegador). Si alguien
// tenía robada una sesión, al cambiar la contraseña queda sin acceso.
//
// No necesita correo: exige la contraseña actual (el reset por email sí queda
// pendiente de tener transporte de mail).
export default function SettingsView() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
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
        headers: { "Content-Type": "application/json" },
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
    } catch {
      setError("Error de red. Intentalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view-section active" id="view-settings">
      <div className="agents-header">
        <div className="agents-heading">
          <h2>Configuración</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Seguridad de tu cuenta.
          </p>
        </div>
      </div>

      <div className="panel-card" style={{ maxWidth: 480 }}>
        <h3>Cambiar contraseña</h3>
        <p className="subtitle">
          Al cambiarla se cierran las sesiones abiertas en los demás dispositivos.
        </p>
        <form onSubmit={submit}>
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
          {error && <div className="form-banner-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </section>
  );
}
