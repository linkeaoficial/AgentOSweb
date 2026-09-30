"use client";

import { useCallback, useEffect, useState } from "react";
import ModalShell from "./ModalShell";
import { pageNumbers } from "./LeadsView";

interface PlanEvent {
  id: string;
  action: string;
  field: string | null;
  from_value: string | null;
  to_value: string | null;
  actor: string;
  created_at: string;
}

interface HistoryAccount {
  id: string;
  email: string | null;
  name: string | null;
}

interface PlanHistoryModalProps {
  open: boolean;
  /** Cuenta de la que se mira el historial; null = cerrado. */
  account: HistoryAccount | null;
  onClose: () => void;
}

const PAGE_SIZE = 12;

// Los `action` del worker, en castellano de panel. `expiry` es el dueño fijando
// la fecha a mano; `renew` es el botón de renovar (el cliente pagó).
const EVENT_LABELS: Record<string, string> = {
  plan: "Cambio de plan",
  renew: "Renovación",
  expiry: "Vencimiento fijado",
  quota: "Cambio de cupo",
  downgrade: "Bajó a Free por vencimiento",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

// Nombres de columna -> castellano. El `field` del worker es el nombre de la
// columna en la base, y eso es justo lo que nadie quiere leer en pantalla.
const FIELD_LABELS: Record<string, string> = {
  plan: "Plan",
  agent_limit: "Cupo de agentes",
  messages_limit: "Cupo de mensajes",
  plan_expires_at: "Vencimiento",
};

function formatEventDate(raw: string): string {
  // SQLite devuelve 'YYYY-MM-DD HH:MM:SS' en UTC; Date lo parsea como local y
  // lo corre unas horas, asi que se reemplaza el espacio por una T con Z.
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Los cupos se guardan como texto y los planes en crudo; mostrar 'null' o
// 'pro' pelado a un dueño es ruido.
function fmtValue(field: string | null, v: string | null): string {
  if (v === null || v === "" || v === "null") return "∅";
  if (field === "plan") return PLAN_LABELS[v] ?? v;
  if (field === "plan_expires_at") {
    const d = new Date(`${v}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? v
      : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }
  return v;
}

export default function PlanHistoryModal({ open, account, onClose }: PlanHistoryModalProps) {
  const [events, setEvents] = useState<PlanEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    if (!account) return;
    setEvents(null);
    setError(null);
    setPage(1);
    fetch(`/api/admin/users/${encodeURIComponent(account.id)}/events`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`No se pudo cargar el historial (HTTP ${r.status})`);
        return r.json();
      })
      .then((d: { events?: PlanEvent[] }) => setEvents(d.events ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error de red"));
  }, [account]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Cambiar de cuenta con el modal abierto: `load` ya corre porque depende de
  // `account`, pero la pagina tiene que volver a la 1 (si venia de la 3, la
  // cuenta nueva podia quedar en una pagina vacia).
  useEffect(() => {
    setPage(1);
  }, [account]);

  const total = events?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumber = Math.min(page, totalPages);
  const rows = events?.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE) ?? [];
  const projected =
    totalPages > 5
      ? [
          1,
          ...(pageNumber > 3 ? [0] : []),
          ...pageNumbers(pageNumber, totalPages),
          ...(pageNumber < totalPages - 2 ? [0] : []),
          totalPages,
        ]
      : Array.from({ length: totalPages }, (_, i) => i + 1);

  const who = account?.name || account?.email || "Cuenta";

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel={`Historial de ${who}`} innerClassName="logout-modal history-modal">
      <div className="history-modal-head">
        <div>
          <h2>Historial</h2>
          <p className="history-modal-who" title={account?.email ?? undefined}>
            {account?.email || "sin email de login"}
          </p>
        </div>
        <button className="lead-drawer-close" type="button" onClick={onClose} aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {events === null ? (
        <p className="acct-hint">Cargando…</p>
      ) : error ? (
        <>
          <p className="acct-hint" style={{ marginTop: 0 }}>
            No se pudo cargar el historial.
          </p>
          <p className="acct-error-detail">{error}</p>
          <button className="btn-primary" type="button" onClick={load}>
            Reintentar
          </button>
        </>
      ) : total === 0 ? (
        <p className="acct-hint">
          Sin cambios registrados todavía. A partir de ahora queda anotado cada cambio de plan,
          renovación, cupo o vencimiento.
        </p>
      ) : (
        <>
          <ol className="acct-events">
            {rows.map((ev) => (
              <li key={ev.id} className="acct-event">
                <span className="acct-event-when">{formatEventDate(ev.created_at)}</span>
                <span className="acct-event-what">{EVENT_LABELS[ev.action] ?? ev.action}</span>
                <span className="acct-event-detail">
                  {ev.from_value || ev.to_value ? (
                    <>
                      {ev.field ? <em>{FIELD_LABELS[ev.field] ?? ev.field}</em> : null}
                      {ev.field ? " · " : null}
                      {ev.from_value ? <s>{fmtValue(ev.field, ev.from_value)}</s> : "∅"}
                      {" → "}
                      {fmtValue(ev.field, ev.to_value)}
                    </>
                  ) : null}
                  {ev.actor === "system" ? <span className="acct-event-actor">automático</span> : null}
                </span>
              </li>
            ))}
          </ol>

          {total > PAGE_SIZE && (
            <div className="leads-footer" style={{ marginTop: 14 }}>
              <span className="leads-pager-info">
                <strong>{(pageNumber - 1) * PAGE_SIZE + 1}</strong>–<strong>{Math.min(pageNumber * PAGE_SIZE, total)}</strong> de{" "}
                <strong>{total}</strong> movimiento{total === 1 ? "" : "s"}
              </span>
              <div className="leads-pager">
                <button
                  type="button"
                  className="leads-pager-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                >
                  Anterior
                </button>
                {projected.map((p, i) =>
                  p === 0 ? (
                    <span key={`e${i}`} className="leads-pager-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`leads-pager-num${p === pageNumber ? " is-active" : ""}`}
                      onClick={() => setPage(p)}
                      aria-label={`Ir a página ${p}`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="leads-pager-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageNumber >= totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {total === 100 ? (
            <p className="acct-hint">Se muestran los 100 movimientos más recientes.</p>
          ) : null}
        </>
      )}

      <p className="acct-hint">
        Esto es lo que podés mostrar cuando un cliente dice que pagó: cada cambio queda con su fecha
        y su valor anterior.
      </p>
    </ModalShell>
  );
}
