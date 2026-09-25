"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type Mode = "login" | "register";

export default function LoginView() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const isValid = useCallback(() => {
    if (!email || !password) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    if (password.length < 8) return false;
    if (mode === "register" && !name.trim()) return false;
    return true;
  }, [email, password, mode, name]);

  const submit = async () => {
    if (!isValid() || busy) return;
    setBusy(true);
    setError(null);
    setForgotMsg(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email";
      const body = mode === "login" ? { email, password } : { email, password, name: name.trim() };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(
          d.message?.includes("Invalid email") || d.message?.includes("User not found")
            ? "Correo o contraseña incorrectos"
            : d.message?.includes("already exists")
              ? "Ya existe una cuenta con ese correo. Iniciá sesión."
              : d.message || "No se pudo completar la operación"
        );
        setBusy(false);
        return;
      }
      window.location.replace("/");
    } catch {
      setError("Error de red. Intentalo de nuevo.");
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotMsg("Ingresá tu correo primero para poder resetear la contraseña.");
      return;
    }
    setForgotMsg(null);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setForgotMsg("Si el correo existe, vas a recibir un enlace para restablecer tu contraseña.");
      } else {
        setForgotMsg("El restablecimiento de contraseña aún no está disponible: escribinos a soporte@agentosweb.com y lo resolvemos al toque.");
      }
    } catch {
      setForgotMsg("Error de red al solicitar el restablecimiento.");
    }
  };

  const openSocial = async (provider: "google" | "apple") => {
    const url = `/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(window.location.origin + "/")}`;
    try {
      const probe = await fetch(url, { method: "GET", redirect: "manual" });
      if (probe.status >= 300 && probe.status < 400) {
        window.location.href = url;
      } else {
        setError("Ese acceso aún no está disponible. Usá correo y contraseña por ahora.");
      }
    } catch {
      window.location.href = url;
    }
  };

  return (
    <main className="auth-page">
      {/* Izquierda: branding (55%) */}
      <section className="auth-brand" aria-label="Acerca de AgentOSweb">
        <div className="auth-brand-inner">
          <div className="auth-brand-logo">
            <Image src="/imagen/Logo_AgentOSweb_chat.png" alt="AgentOSweb Logo" width={48} height={48} />
            <h1>AgentOSweb</h1>
          </div>
          <h2>Convertí los visitantes de tu web en clientes en 2 minutos.</h2>
          <p>
            Agentes de IA que atienden a tus clientes 24/7, entienden tu negocio y capturan
            prospectos mientras vos te ocupás de lo importante.
          </p>
          <ul className="auth-brand-features">
            <li>Tu agente contesta al instante, todos los días, a cualquier hora.</li>
            <li>Prospectos con nombre, correo y teléfono listos para tu equipo.</li>
            <li>Sin código, sin infraestructura: listo en minutos.</li>
          </ul>
        </div>
      </section>

      {/* Derecha: formulario (45%) */}
      <section className="auth-panel" aria-label="Acceso al panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <h3>{mode === "login" ? "Ingresar" : "Crear cuenta"}</h3>
            <p>
              {mode === "login"
                ? "Bienvenido de nuevo. Accedé a tu panel."
                : "Comenzá con tu agente de IA en minutos."}
            </p>
          </div>

          <div className="auth-social-row">
            <button type="button" className="auth-social-btn" onClick={() => void openSocial("google")}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.97 10.97 0 0 0 12 2 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
              </svg>
              Continuar con Google
            </button>
            <button type="button" className="auth-social-btn" onClick={() => void openSocial("apple")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M16.36 12.76c-.02-2.17 1.77-3.21 1.85-3.26-1-.48-2.27-1.05-3.92-1.05-1.68 0-2.86.89-3.65.89-.82 0-1.98-.87-3.32-.87-1.7-.02-3.35 1-4.2 2.68-1.8 3.1-.47 7.66 1.28 10.18.85 1.23 1.86 2.6 3.2 2.55 1.28-.05 1.73-.82 3.3-.82 1.5 0 1.98.82 3.3.79 1.42-.03 2.32-1.3 3.14-2.56.99-1.48 1.39-2.92 1.42-3-.03-.01-2.72-1.02-2.72-4.53ZM14.2 4.4c.65-.8 1.08-1.9.95-3-.92.05-2.04.62-2.7 1.4-.6.7-1.11 1.82-.98 2.9 1.03.08 2.08-.5 2.73-1.3Z" />
              </svg>
              Continuar con Apple
            </button>
          </div>

          <div className="auth-divider">
            <span>o con tu correo</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">
              Correo electrónico
            </label>
            <input
              id="auth-email"
              className="form-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="vos@tuempresa.com"
            />
          </div>

          {mode === "register" && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">
                Nombre y apellido
              </label>
              <input
                id="auth-name"
                className="form-input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">
              Contraseña
            </label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {mode === "login" && (
            <div className="auth-forgot">
              <button type="button" onClick={() => void forgotPassword()}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
          {forgotMsg && (
            <p className="auth-forgot-msg" role="status">
              {forgotMsg}
            </p>
          )}
          {error && (
            <p className="form-hint" role="alert" style={{ color: "#e5484d" }}>
              {error}
            </p>
          )}

          <button
            className="auth-submit"
            type="button"
            onClick={() => void submit()}
            disabled={busy || !isValid()}
            aria-busy={busy}
          >
            {busy ? "Procesando…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
          </button>

          <div className="auth-switch">
            {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
              {mode === "login" ? "Registrate gratis" : "Ingresá"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}