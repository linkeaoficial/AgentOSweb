"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconBell, IconBilling, IconLeads, IconMessage } from "./icons";

interface Notif {
  type: "plan" | "support" | "leads";
  at: string;
  count: number;
}

interface NotificationsBellProps {
  onNavigate: (viewId: string) => void;
  // Clase extra para la campanita de la barra lateral (visible solo en móvil,
  // donde el topbar está oculto).
  className?: string;
}

const POLL_MS = 60000;

// El texto vive en el navegador y no en el worker: la API manda `type` y
// `count`, así que cambiar un enunciado no cuesta un deploy del worker.
const COPY: Record<Notif["type"], { title: (n: number) => string; body: string; view: string; Icon: typeof IconBilling }> = {
  plan: {
    title: () => "Tu plan venció",
    body: "Seguís en el plan gratuito hasta que renueves.",
    view: "view-billing",
    Icon: IconBilling,
  },
  support: {
    title: (n) => (n === 1 ? "Nuevo mensaje de soporte" : `${n} nuevos mensajes de soporte`),
    body: "Alguien escribió desde Ayuda y Soporte.",
    view: "view-admin",
    Icon: IconMessage,
  },
  leads: {
    title: (n) => (n === 1 ? "Prospecto nuevo capturado" : `${n} prospectos nuevos capturados`),
    body: "Llegaron a tus agentes.",
    view: "view-leads",
    Icon: IconLeads,
  },
};

// Los tres formatos que se guardan en la base: 'YYYY-MM-DD HH:MM:SS' (leads y el
// cursor), 'YYYY-MM-DD' (vencimiento del plan) o ISO con T/Z (created_at de
// soporte). Todos UTC.
const toUtc = (at: string) => new Date(at.length === 10 ? `${at}T00:00:00Z` : at.includes("T") ? at : `${at.replace(" ", "T")}Z`);

function hace(at: string): string {
  const s = Math.max(0, (Date.now() - toUtc(at).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
  return toUtc(at).toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
}

export default function NotificationsBell({ onNavigate, className }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  // El menú abierto pausa el sondeo: si no, la respuesta de "marcar todo como
  // leído" vaciaría la lista justo debajo del cursor del usuario.
  const openRef = useRef(false);

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    // Ya se leyeron: se borran acá y el próximo sondeo confirmará con el worker.
    setItems([]);
  }, []);

  // Mismo sondeo que Prospectos: cada 60 s y solo con la pestaña visible; al
  // volver o recuperar foco, de inmediato. Sin SSE: Workers cobra por la
  // duración de la conexión y esto llega antes que el próximo click del usuario.
  //
  // ponytail: hay dos campanitas montadas a la vez (topbar y barra lateral) y
  // cada una sondea sola, así que son 2 GET por minuto y usuario; si el volumen
  // pesa, subir `items` a Dashboard y pasarlos por props.
  useEffect(() => {
    let timer: number | undefined;
    const poll = () => {
      if (openRef.current || document.visibilityState !== "visible") return;
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { items?: Notif[] } | null) => {
          if (d && Array.isArray(d.items)) setItems(d.items);
        })
        .catch(() => {
          // Sin red la campanita queda como estaba: nada de toasts por esto.
        });
    };
    const start = () => {
      if (timer === undefined && document.visibilityState === "visible") {
        timer = window.setInterval(poll, POLL_MS);
      }
    };
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        poll();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    start();
    poll();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) return close();
    openRef.current = true;
    setOpen(true);
    if (items.length > 0) {
      // Abrir ya es marcar como leído: los items son punteros a datos que siguen
      // vivos (el ticket en Clientes, el lead en Prospectos), no hay nada que
      // guardar. Si el POST falla, el próximo sondeo los vuelve a traer.
      fetch("/api/notifications", { method: "POST" }).catch(() => {});
    }
  };

  const unread = items.length;

  return (
    <div className="user-menu-wrap" ref={wrapRef}>
      <button
        className={`topbar-btn notif-btn ${className ?? ""}`}
        aria-label={unread > 0 ? `Notificaciones, ${unread} nuevas` : "Notificaciones"}
        aria-expanded={open}
        onClick={toggle}
      >
        <IconBell />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      <div className={`user-menu notif-menu ${open ? "open" : ""}`} role="menu">
        <div className="notif-head">
          <span>Notificaciones</span>
          {unread > 0 && <span className="notif-count-pill">{unread}</span>}
        </div>
        {items.map((n) => {
          const c = COPY[n.type];
          return (
            <button
              key={n.type}
              className="user-menu-item notif-item"
              role="menuitem"
              onClick={() => {
                onNavigate(c.view);
                close();
              }}
            >
              <span className="notif-item-icon">
                <c.Icon />
              </span>
              <span className="notif-item-text">
                <strong>{c.title(n.count)}</strong>
                <span>{c.body}</span>
              </span>
              <span className="notif-item-time">{hace(n.at)}</span>
            </button>
          );
        })}
        {open && items.length === 0 && <div className="notif-empty">Sin notificaciones nuevas</div>}
      </div>
    </div>
  );
}
