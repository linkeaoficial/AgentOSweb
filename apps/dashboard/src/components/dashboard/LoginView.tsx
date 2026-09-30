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
    if (mode === "register") {
      if (password.length < 8) return false;
      if (!name.trim()) return false;
      return true;
    }
    return true;
  }, [email, password, mode, name]);

  const [placeholder, setPlaceholder] = useState("Escribe tu mensaje...");

  useEffect(() => {
    const phrases = ["Escribe tu mensaje...", "Haz una pregunta...", "¿Tienes alguna duda?", "¿En qué podemos ayudarte?"];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const type = () => {
      const current = phrases[phraseIndex];
      setPlaceholder(current.substring(0, charIndex) + "|");
      if (isDeleting) {
        charIndex--;
      } else {
        charIndex++;
      }
      let next = isDeleting ? 30 : 70;
      if (!isDeleting && charIndex > current.length) {
        isDeleting = true;
        charIndex = current.length;
        next = 1500;
      } else if (isDeleting && charIndex < 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        charIndex = 0;
        next = 500;
      }
      timer = setTimeout(type, next);
    };
    timer = setTimeout(type, 500);
    return () => clearTimeout(timer);
  }, []);

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
      if (mode === "register") {
        window.location.replace("/?nuevo=1");
      } else {
        window.location.replace("/");
      }
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
          <div className="auth-brand-top">
            <Image src="/imagen/Logo_AgentOSweb_chat.png" alt="AgentOSweb Logo" width={36} height={36} />
            <h1>AgentOSweb</h1>
          </div>
          <div className="auth-brand-badge">
            <span>Plataforma Chatbot Builder IA</span>
          </div>
          <h2>
            Convierte visitantes en clientes
            <br />
            en 2 minutos.
          </h2>
          <p className="auth-brand-sub">
            Tu asistente IA responde al instante, entiende tu negocio y captura prospectos
            mientras vos te ocupás de lo importante.
          </p>
          <div className="auth-brand-split">
            <div className="auth-chatmock" aria-hidden="true">
            <div className="auth-chatmock-head">
              <div className="auth-chatmock-avatar">
                <img src="/imagen/Logo_AgentOSweb_chat.png" alt="" width={34} height={34} />
              </div>
              <div>
                <strong>AgentOSweb</strong>
                <span>
                  <i className="auth-status-dot" /> Asistente IA · En línea 24/7
                </span>
              </div>
            </div>
            <div className="auth-chatmock-body">
              <div className="auth-chatmock-welcome">
                <h4>¡Hola! 👋 Bienvenido</h4>
                <p>
                  Soy el asistente inteligente de <strong>AgentOSweb</strong>. Respondo tus
                  dudas sobre precios, instalación y funcionamiento 24/7.
                </p>
              </div>
              <div className="auth-chatmock-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Iniciar conversación
              </div>
              <div className="auth-chatmock-prompt">
                <span>¿Qué es el modelo BYOK?</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
              <div className="auth-chatmock-prompt">
                <span>¿Cuáles son los planes y precios?</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
            <div className="auth-chatmock-input">
              <div className="auth-chatmock-inputbar">
                <span className="auth-chatmock-mic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </span>
                <span className="auth-chatmock-ph">{placeholder}</span>
                <span className="auth-chatmock-send">
                  <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
          <div className="auth-brand-badges">
            <span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Respuesta en segundos
            </span>
            <span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              BYOK (Bring Your Own Key)
            </span>
            <span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Instalación en 1-Clic
            </span>
            <span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Prospectos con nombre y correo
            </span>
            <span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Soporte 24/7
            </span>
            <span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Comienza en minutos
            </span>
          </div>
          </div>
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
              <span className="auth-social-label">Continuar con Google</span>
            </button>
            <button type="button" className="auth-social-btn" onClick={() => void openSocial("apple")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M16.36 12.76c-.02-2.17 1.77-3.21 1.85-3.26-1-.48-2.27-1.05-3.92-1.05-1.68 0-2.86.89-3.65.89-.82 0-1.98-.87-3.32-.87-1.7-.02-3.35 1-4.2 2.68-1.8 3.1-.47 7.66 1.28 10.18.85 1.23 1.86 2.6 3.2 2.55 1.28-.05 1.73-.82 3.3-.82 1.5 0 1.98.82 3.3.79 1.42-.03 2.32-1.3 3.14-2.56.99-1.48 1.39-2.92 1.42-3-.03-.01-2.72-1.02-2.72-4.53ZM14.2 4.4c.65-.8 1.08-1.9.95-3-.92.05-2.04.62-2.7 1.4-.6.7-1.11 1.82-.98 2.9 1.03.08 2.08-.5 2.73-1.3Z" />
              </svg>
              <span className="auth-social-label">Continuar con Apple</span>
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
        <p className="auth-copyright">© 2026 AgentOSweb. Todos los derechos reservados.</p>
      </section>

      {busy && (
        <div className="auth-loading" role="status" aria-live="polite">
          <div className="auth-loading-overlay" />
          <div className="auth-loading-card">
            <div className="auth-loading-logo">
              <Image src="/imagen/Logo_AgentOSweb_chat.png" alt="" width={76} height={76} />
              <span className="auth-loading-spinner" />
            </div>
            <p>Bienvenido a AgentOSweb</p>
            <span>{mode === "register" ? "Creando tu cuenta y agente…" : "Verificando acceso…"}</span>
          </div>
        </div>
      )}
    </main>
  );
}