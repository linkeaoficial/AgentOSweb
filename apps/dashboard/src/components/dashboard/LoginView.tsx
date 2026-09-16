"use client";

import { useState } from "react";

export default function LoginView() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error || "No se pudo iniciar sesión");
        setBusy(false);
        return;
      }
      window.location.replace("/");
    } catch {
      setError("Error de red al iniciar sesión");
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="panel-card login-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo de marca */}
        <img className="login-logo" src="/imagen/Logo_AgentOSweb_chat.png" alt="AgentOSweb" />
        <h3>Panel de control</h3>
        <p className="subtitle">Ingresa tu contraseña para continuar.</p>
        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label" htmlFor="login-pass">
            Contraseña
          </label>
          <input
            id="login-pass"
            className="form-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="••••••••••"
          />
          {error && (
            <span className="form-hint" style={{ color: "#e5484d" }}>
              {error}
            </span>
          )}
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => void submit()}
          disabled={busy || !password}
          style={{ width: "100%", marginTop: 8 }}
        >
          {busy ? "Ingresando…" : "Iniciar sesión"}
        </button>
      </div>
    </main>
  );
}