"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconLeads, IconMessage, IconClock, IconCheck } from "./icons";
import { useToast } from "./notifications";
import ConfirmModal from "./ConfirmModal";
import { shadeColor } from "./AgentsView";

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  interest: string | null;
  session_id: string | null;
  status: string;
  created_at: string;
  last_activity: string | null;
}

interface LeadsViewProps {
  agentId: string;
}

const STATUSES = ["Nuevo", "Contactado", "Calificado", "Convertido", "Archivado"] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function formatRelTime(a: string, b: string): string {
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return formatDateTime(b);
  if (da.toDateString() === db.toDateString()) return formatTime(b);
  return formatDate(b) + " · " + formatTime(b);
}

function pageNumbers(current: number, total: number): number[] {
  const window = 1;
  const pages: number[] = [];
  for (let p = Math.max(2, current - window); p <= Math.min(total - 1, current + window); p++) pages.push(p);
  return pages;
}

const statusTone = (status: string): string => {
  switch (status) {
    case "Nuevo":
      return "tones-blue";
    case "Contactado":
      return "tones-cyan";
    case "Calificado":
      return "tones-violet";
    case "Convertido":
      return "tones-green";
    case "Archivado":
      return "tones-gray";
    default:
      return "tones-gray";
  }
};

// ---- cache de la tabla (SWR leve) ----
interface LeadListData {
  leads?: Lead[];
  total?: number;
  stats?: { nuevo?: number; contactado?: number; calificado?: number; convertido?: number; archivado?: number };
}
const LEAD_TTL = 30_000;
const leadListCache = new Map<string, { at: number; data: LeadListData }>();

interface LeadCtx {
  setLeads: (f: (prev: Lead[]) => Lead[]) => void;
  setTotal: (t: number) => void;
  setLeadsStats: (s: { nuevo: number; contactado: number; calificado: number; convertido: number; archivado: number }) => void;
  setLoadError: (b: boolean) => void;
}

function applyLeadData(d: LeadListData, ctx: LeadCtx) {
  ctx.setLeads(() => d.leads ?? []);
  ctx.setTotal(d.total ?? 0);
  if (d.stats)
    ctx.setLeadsStats({
      nuevo: d.stats.nuevo ?? 0,
      contactado: d.stats.contactado ?? 0,
      calificado: d.stats.calificado ?? 0,
      convertido: d.stats.convertido ?? 0,
      archivado: d.stats.archivado ?? 0,
    });
  ctx.setLoadError(false);
}

function ContactChip({ lead }: { lead: Lead }) {
  const chips: { label: string; onClick: () => void; children: ReactNode }[] = [];
  if (lead.email) {
    chips.push({
      label: lead.email,
      onClick: () => navigator.clipboard?.writeText(lead.email!),
      children: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      ),
    });
  }
  if (lead.phone) {
    chips.push({
      label: lead.phone,
      onClick: () => navigator.clipboard?.writeText(lead.phone!),
      children: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
    });
  }
  if (chips.length === 0) return <span className="count">Sin contacto capturado</span>;
  return (
    <div className="leads-contact-stack">
      {chips.map((c) => (
        <button type="button" className="contact-chip" onClick={c.onClick} key={c.label}>
          {c.children}
          {c.label}
        </button>
      ))}
    </div>
  );
}

function StatusSelect({
  lead,
  onStatus,
  busy,
}: {
  lead: Lead;
  onStatus: (id: string, status: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="status-select" ref={ref}>
      <button type="button" className={`status-pill ${statusTone(lead.status)}`} onClick={() => setOpen((o) => !o)} disabled={busy}>
        {lead.status}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="status-menu">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={s === lead.status ? "is-active" : ""}
              onClick={() => {
                setOpen(false);
                onStatus(lead.id, s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function TrashIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ActionIcons({ lead, onView, onViewHistory, onRequestDelete }: { lead: Lead; onView: (lead: Lead) => void; onViewHistory: (lead: Lead) => void; onRequestDelete: (lead: Lead) => void }) {
  const toast = useToast();
  return (
    <div className="leads-actions-cell">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onView(lead)}
        title="Ver detalle del prospecto"
        aria-label="Ver detalle"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onViewHistory(lead)}
        title="Ver conversación"
        aria-label="Ver conversación"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      {lead.phone ? (
        <a
          className="icon-btn is-whatsapp"
          href={`https://wa.me/${phoneDigits(lead.phone)}`}
          target="_blank"
          rel="noreferrer"
          title="Abrir WhatsApp con este contacto"
          aria-label="Abrir WhatsApp"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
          </svg>
        </a>
      ) : (
        <button
          type="button"
          className="icon-btn is-disabled"
          onClick={() => toast.info("⚠️ No se capturó un teléfono para este prospecto")}
          title="No se capturó teléfono"
          aria-label="Teléfono no capturado"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>
      )}
      {lead.email ? (
        <a
          className="icon-btn is-email"
          href={`mailto:${lead.email}`}
          target="_blank"
          title="Enviar email a este contacto"
          aria-label="Enviar email"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-10 6L2 7" />
          </svg>
        </a>
      ) : (
        <button
          type="button"
          className="icon-btn is-disabled"
          onClick={() => toast.info("⚠️ No se capturó un email para este prospecto")}
          title="No se capturó email"
          aria-label="Email no capturado"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-10 6L2 7" />
          </svg>
        </button>
      )}
      <button
        type="button"
        className="icon-btn is-danger"
        onClick={() => onRequestDelete(lead)}
        title="Eliminar prospecto"
        aria-label="Eliminar"
      >
        <TrashIcon size={15} />
      </button>
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onStatus,
  onRequestDelete,
  onViewHistory,
  onNotesUpdated,
}: {
  lead: Lead;
  onClose: () => void;
  onStatus: (id: string, status: string) => void;
  onRequestDelete: (lead: Lead) => void;
  onViewHistory: (lead: Lead) => void;
  onNotesUpdated: (id: string, notes: string | null) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(lead.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteChanged, setNoteChanged] = useState(false);

  useEffect(() => {
    setDraft(lead.notes ?? "");
    setNoteChanged(false);
  }, [lead.id, lead.notes]);

  const saveNote = async () => {
    if (!noteChanged || savingNote) return;
    setSavingNote(true);
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft.trim() || null }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo guardar la nota");
      onNotesUpdated(lead.id, draft.trim() || null);
      setNoteChanged(false);
      toast.success("Nota guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar la nota");
    } finally {
      setSavingNote(false);
    }
  };

  const copyAll = async () => {
    const parts = [
      lead.name ? `Nombre: ${lead.name}` : "",
      lead.email ? `Email: ${lead.email}` : "",
      lead.phone ? `Teléfono: ${lead.phone}` : "",
      lead.interest ? `Interés: ${lead.interest}` : "",
      `Estado: ${lead.status}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      toast.success("Datos copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="lead-drawer-overlay" onClick={onClose}>
      <aside className="lead-drawer" role="dialog" aria-modal="true" aria-label="Detalle del prospecto" onClick={(e) => e.stopPropagation()}>
        <header className="lead-drawer-header">
          <div className="lead-drawer-avatar">{initials(lead)}</div>
          <div className="lead-drawer-title">
            <h2>{lead.name || "Prospecto sin nombre"}</h2>
            <span>
              {formatDate(lead.created_at)} · {formatTime(lead.created_at)}
              {lead.last_activity ? ` · últ. act. ${formatRelTime(lead.created_at, lead.last_activity)}` : ""}
            </span>
          </div>
          <button type="button" className="lead-drawer-close" onClick={onClose} aria-label="Cerrar detalle" title="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="lead-drawer-body">
          <div className="lead-drawer-row">
            <StatusSelect lead={lead} onStatus={onStatus} busy={false} />
          </div>

          <section className="lead-drawer-sec">
            <h3>Información de contacto</h3>
            <div className="lead-drawer-contact">
              {lead.email ? (
                <button type="button" className="lead-drawer-contact-item" onClick={() => navigator.clipboard?.writeText(lead.email!)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-10 6L2 7" />
                  </svg>
                  <span>
                    <small>Email</small>
                    <strong>{lead.email}</strong>
                  </span>
                </button>
              ) : null}
              {lead.phone ? (
                <button type="button" className="lead-drawer-contact-item" onClick={() => navigator.clipboard?.writeText(lead.phone!)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>
                    <small>Teléfono</small>
                    <strong>{lead.phone}</strong>
                  </span>
                </button>
              ) : null}
              {!lead.email && !lead.phone ? <p className="lead-drawer-empty">Sin contacto capturado.</p> : null}
            </div>
            <div className="lead-drawer-actions">
              <button type="button" className="icon-btn" onClick={() => onViewHistory(lead)} title="Ver conversación" aria-label="Ver conversación">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              <button type="button" className="icon-btn" onClick={copyAll} title="Copiar todos los datos" aria-label="Copiar todos los datos">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              {lead.phone && (
                <a className="icon-btn is-whatsapp" href={`https://wa.me/${phoneDigits(lead.phone)}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" aria-label="Abrir WhatsApp">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
                  </svg>
                </a>
              )}
              {lead.email && (
                <a className="icon-btn is-email" href={`mailto:${lead.email}`} target="_blank" title="Enviar email" aria-label="Enviar email">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-10 6L2 7" />
                  </svg>
                </a>
              )}
            </div>
          </section>

          <section className="lead-drawer-sec">
            <h3>Mensaje de interés</h3>
            {lead.interest ? (
              <p className="lead-drawer-quote">{lead.interest}</p>
            ) : (
              <p className="lead-drawer-empty">Sin mensaje registrado.</p>
            )}
          </section>

          <section className="lead-drawer-sec">
            <h3>Nota interna</h3>
            <textarea
              className="lead-drawer-note"
              placeholder="Escribí una nota sobre este prospecto (seguimiento, contexto, acuerdos…) y presioná guardar."
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setNoteChanged(e.target.value !== (lead.notes ?? ""));
              }}
              rows={3}
            />
            <button
              type="button"
              className="lead-drawer-save"
              onClick={saveNote}
              disabled={!noteChanged || savingNote}
            >
              {savingNote ? "Guardando…" : noteChanged ? "Guardar nota" : "Nota guardada ✓"}
            </button>
          </section>

          {lead.session_id && (
            <section className="lead-drawer-sec">
              <h3>Información técnica</h3>
              <div className="lead-drawer-session-full">
                <small>ID de sesión</small>
                <code>{lead.session_id}</code>
              </div>
            </section>
          )}

          <button
            type="button"
            className="lead-drawer-delete"
            onClick={() => onRequestDelete(lead)}
          >
            <TrashIcon size={14} />
            Eliminar prospecto
          </button>
        </div>
      </aside>
    </div>
  );
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface WidgetConf {
  header_title: string;
  header_subtitle: string;
  avatar_url: string | null;
  primary_color: string;
  default_theme: "light" | "dark" | "auto";
}

// el config del agente no cambia a cada rato: cache de sesión para que reabrir el
// historial sea instantáneo (solo se re-fetchea en background para refrescarlo).
const agentConfCache = new Map<string, WidgetConf>();
// mensajes por lead (agentId:session): stale-while-revalidate. Reabrir el historial
// entra al instante con lo guardado y se refresca en background.
const histCache = new Map<string, { at: number; messages: ChatMsg[] }>();
const HIST_TTL = 60_000;

function ConversationOverlay({ agentId, lead, onClose }: { agentId: string; lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMsg[] | null>(null);
  const [conf, setConf] = useState<WidgetConf | null>(agentConfCache.get(agentId) ?? null);
  const [failed, setFailed] = useState(false);
  const [sysDark, setSysDark] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    const histKey = `${agentId}:${lead.session_id || "anon"}`;
    const cached = histCache.get(histKey);
    if (cached && Date.now() - cached.at < HIST_TTL) setMessages(cached.messages);
    const cachedConf = agentConfCache.get(agentId);
    if (cachedConf) setConf(cachedConf);
    Promise.all([
      fetch(`/api/agent/${agentId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((c: WidgetConf) => {
          agentConfCache.set(agentId, c);
          return c;
        }),
      fetch(`/api/leads/${agentId}/history?session_id=${encodeURIComponent(lead.session_id || "anon")}`).then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
    ])
      .then(([conf, data]: [WidgetConf, { messages?: ChatMsg[] }]) => {
        if (!alive) return;
        setConf(conf);
        setMessages(data.messages ?? []);
        histCache.set(histKey, { at: Date.now(), messages: data.messages ?? [] });
      })
      .catch(() => {
        if (!alive) return;
        // si hay cache previa, la mostramos aunque el refresco falle
        if (!messages && !histCache.has(histKey)) {
          toast.error("No se pudo cargar la conversación");
          setMessages([]);
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, lead.session_id, toast]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSysDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, conf]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [messages, onClose]);

  const exportHistory = () => {
    if (!messages || messages.length === 0) return;
    const lines = messages.map((m) => `${m.role === "user" ? (lead.name || "Visitante") : (conf?.header_title || "Asistente")}: ${m.content}`);
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversacion-${(lead.name || lead.session_id || "anon").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversación exportada");
  };

  const dark = conf ? conf.default_theme === "dark" || (conf.default_theme === "auto" && sysDark) : false;
  const start = conf?.primary_color ?? "#3559ff";
  const end = start.toLowerCase() === "#3559ff" ? "#13a0ff" : shadeColor(start, 28);
  const gradVertical = `linear-gradient(to bottom, ${start}, ${end})`;
  const containerBgc = dark ? "#18181b" : "#ffffff";
  const inputBgc = dark ? "#202024" : "#f1f5f9";
  const textMain = dark ? "#f4f4f5" : "#0f172a";
  const chatText = dark ? "#e4e4e7" : "#333333";
  const borderColor = dark ? "#2e2e33" : "#dddddd";

  return (
    <div className="conv-history-overlay" onClick={onClose}>
      {!conf ? (
        <div className="conv-history-skeleton conv-history-wv" role="status" aria-label="Cargando conversación">
          <div className="conv-history-skeleton-header">
            <span className="conv-history-skeleton-avatar" />
            <span className="conv-history-skeleton-lines">
              <span className="conv-history-skeleton-line w50" />
              <span className="conv-history-skeleton-line w30" />
            </span>
          </div>
          <div className="conv-history-skeleton-body">
            <div className="conv-history-skeleton-bubble left" />
            <div className="conv-history-skeleton-bubble left wide" />
            <div className="conv-history-skeleton-bubble right" />
            <div className="conv-history-skeleton-bubble left" />
            <div className="conv-history-skeleton-bubble right wide" />
          </div>
          {failed && <span className="conv-history-skeleton-error">No se pudo cargar la conversación</span>}
        </div>
      ) : (
      <div className={`conv-history conv-history-wv ${dark ? "is-dark" : "is-light"}`} onClick={(e) => e.stopPropagation()}>
        <div className="wv-header" style={{ background: gradVertical }}>
          <button
            type="button"
            className="conv-history-close"
            onClick={onClose}
            aria-label="Cerrar conversación"
            title="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {messages && messages.length > 0 && (
            <button
              type="button"
              className="conv-history-close conv-history-export"
              onClick={exportHistory}
              aria-label="Exportar conversación"
              title="Exportar conversación (txt)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          <div className="wv-header-content">
            <div className="wv-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo de marca en el historial */}
              <img src={conf?.avatar_url || "/imagen/Logo_AgentOSweb_chat.png"} alt="" />
            </div>
            <span className="wv-title">{conf?.header_title || "Asistente"}</span>
            <span className="wv-subtitle">{conf?.header_subtitle || ""}</span>
            <span className="conv-history-lead">Conversación con {lead.name || "prospecto"}</span>
          </div>
        </div>
        <div className="wv-content">
          <div className="wv-chat" ref={listRef} style={{ background: containerBgc }}>
            {messages === null ? (
              <div className="conv-msg-skeleton" aria-label="Cargando conversación">
                <div className="conv-history-skeleton-bubble left" />
                <div className="conv-history-skeleton-bubble left wide" />
                <div className="conv-history-skeleton-bubble right" />
                <div className="conv-history-skeleton-bubble left" />
                <div className="conv-history-skeleton-bubble right wide" />
              </div>
            ) : messages.length === 0 ? (
              <div className="conv-history-empty">No hay mensajes registrados para esta sesión.</div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`wv-chat-message ${m.role === "user" ? "user" : "bot"}`}>
                  {m.role !== "user" && (
                    <span className="wv-message-icon" style={{ background: inputBgc }}>
                      <span className="wv-avatar-container">
                        <span className="wv-avatar-head" style={{ background: `radial-gradient(circle at 35% 35%, ${start}, ${end})`, ["--wv-shadow" as string]: `rgba(0,0,0,0.08)` }} />
                        <span className="wv-eyes">
                          <span className="wv-eye" />
                          <span className="wv-eye" />
                        </span>
                      </span>
                    </span>
                  )}
                  <span className="wv-message-content">
                    {m.role !== "user" && (
                      <span className="wv-message-sender" style={{ color: chatText }}>
                        {conf?.header_title || "Asistente"}
                      </span>
                    )}
                    <span
                      className="wv-message-bubble"
                      style={
                        m.role === "user"
                          ? { background: start, color: "#ffffff" }
                          : { background: inputBgc, borderColor, color: textMain }
                      }
                    >
                      {m.content}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return (
      <svg className="lead-th-sort-arrow is-muted" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7 15 5 5 5-5" />
        <path d="m7 9 5-5 5 5" />
      </svg>
    );
  }
  return (
    <svg className="lead-th-sort-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {dir === "asc" ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

function initials(lead: Lead): string {
  return (lead.name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function LeadsView({ agentId }: LeadsViewProps) {
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [leadsStats, setLeadsStats] = useState({ nuevo: 0, contactado: 0, calificado: 0, convertido: 0, archivado: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"created_at" | "name" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Lead | null>(null);
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bulkMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setBulkMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [bulkMenuOpen]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (statusFilter) qs.set("status", statusFilter);
    qs.set("sort_by", sortBy);
    qs.set("sort_dir", sortDir);
    qs.set("page", String(page));
    qs.set("page_size", String(PAGE_SIZE));
    const cacheKey = `${agentId}|${query.trim()}|${statusFilter}|${sortBy}|${sortDir}|${page}`;
    const ctx: LeadCtx = { setLeads, setTotal, setLeadsStats, setLoadError };
    const cached = leadListCache.get(cacheKey);
    if (cached && Date.now() - cached.at < LEAD_TTL) {
      applyLeadData(cached.data, ctx);
      setLoading(false);
      return;
    }
    fetch(`/api/leads/${agentId}?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((d: LeadListData) => {
        leadListCache.set(cacheKey, { at: Date.now(), data: d });
        applyLeadData(d, ctx);
      })
      .catch((e) => {
        // ante error de red, si la página ya estaba en cache se deja servida en vez de error
        const stale = leadListCache.get(cacheKey);
        if (stale) applyLeadData(stale.data, ctx);
        else setLoadError(true);
        if (e instanceof Error) console.warn("leads fetch:", e.message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, query, statusFilter, sortBy, sortDir, page]);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    const t = setTimeout(load, query.trim() ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, sortBy, sortDir, page, agentId]);

  const toggleSort = (col: "created_at" | "name" | "status") => {
    setPage(1);
    setSortBy(col);
    setSortDir((dir) => (sortBy === col && dir === "desc" ? "asc" : "desc"));
  };

  const handleStatusFilter = (s: string) => {
    setPage(1);
    setStatusFilter(s);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumber = Math.min(page, totalPages);
  const pageLeads = leads;
  const stats = leadsStats;

  const projected =
      totalPages > 5
        ? [1, ...(pageNumber > 3 ? [0] : []), ...pageNumbers(pageNumber, totalPages), ...(pageNumber < totalPages - 2 ? [0] : []), totalPages]
        : Array.from({ length: totalPages }, (_, i) => i + 1);

  const pageButton = (p: number, i: number) =>
    p === 0 ? (
      <span key={`e${i}`} className="leads-pager-ellipsis">…</span>
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
    );

  const handleStatus = (id: string, status: string) => {
    setBusyStatus(id);
    fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo actualizar el estado");
        leadListCache.clear();
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
        toast.success(`Lead marcado como ${status}`);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error al actualizar"))
      .finally(() => setBusyStatus(null));
  };

  const toggleOne = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelection((prev) => {
      const next = new Set(prev);
      const allChecked = pageLeads.length > 0 && pageLeads.every((l) => next.has(l.id));
      pageLeads.forEach((l) => (allChecked ? next.delete(l.id) : next.add(l.id)));
      return next;
    });
  };

  const runBulk = (action: "delete" | "status", status?: string) => {
    if (selection.size === 0) return;
    if (action === "delete") {
      setBulkDeleteOpen(true);
      return;
    }
    setBulkBusy(true);
    fetch("/api/leads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selection], action: "status", status }),
    })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo completar la acción");
        leadListCache.clear();
        setLeads((prev) => prev.map((l) => (selection.has(l.id) ? { ...l, status: status! } : l)));
        toast.success(`Selección marcada como ${status}`);
        setSelection(new Set());
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error en la acción masiva"))
      .finally(() => setBulkBusy(false));
  };

  const confirmDeleteLead = async () => {
    if (!pendingDelete) return;
    try {
      const r = await fetch(`/api/leads/${pendingDelete.id}`, { method: "DELETE" });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo eliminar");
      leadListCache.clear();
      setLeads((prev) => prev.filter((l) => l.id !== pendingDelete.id));
      setPendingDelete(null);
      toast.success("Prospecto eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const confirmBulkDelete = async () => {
    const ids = [...selection];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const r = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "delete" }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudieron eliminar");
      leadListCache.clear();
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
      toast.success(`${ids.length} prospecto${ids.length === 1 ? "" : "s"} eliminado${ids.length === 1 ? "" : "s"}`);
      setSelection(new Set());
      setBulkDeleteOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar masivamente");
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCsv = () => {
    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    qs.set("page_size", "100000");
    fetch(`/api/leads/${agentId}?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((d: { leads?: Lead[] }) => {
        const header = ["Fecha", "Nombre", "Email", "Teléfono", "Estado", "Mensaje", "Nota"];
        const rows = (d.leads ?? []).map((l) => [
          formatDate(l.created_at),
          l.name ?? "",
          l.email ?? "",
          l.phone ?? "",
          l.status,
          l.interest ?? "",
          l.notes ?? "",
        ]);
        const csv = [header, ...rows]
          .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
          .join("\n");
        const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `prospectos-${agentId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exportado");
      })
      .catch(() => toast.error("No se pudo exportar el CSV"));
  };

  let content: ReactNode;
  if (loading) {
    content = (
      <div className="faq-skeleton" aria-label="Cargando prospectos">
        <div className="faq-skeleton-row" />
        <div className="faq-skeleton-row" />
        <div className="faq-skeleton-row" />
      </div>
    );
  } else if (loadError) {
    content = <span className="count">No se pudo cargar la bandeja de prospectos</span>;
  } else if (total === 0) {
    content = (
      <div className="faq-empty">
        <IconLeads />
        <span>{query.trim() ? `No hay prospectos que coincidan con “${query}”` : "Aún no hay prospectos capturados"}</span>
      </div>
    );
  } else if (leads.length === 0) {
    content = (
      <div className="faq-empty">
        <IconLeads />
        <span>Página fuera de rango</span>
      </div>
    );
  } else {
    content = (
      <div className="leads-table-wrap">
        <table className="leads-table">
          <thead>
            <tr>
              <th className="leads-check-col">
                <input
                  type="checkbox"
                  className="leads-check"
                  checked={pageLeads.length > 0 && pageLeads.every((l) => selection.has(l.id))}
                  onChange={togglePage}
                  aria-label="Seleccionar todos los de esta página"
                />
              </th>
              <th>
                <button type="button" className="lead-th-sort" onClick={() => toggleSort("name")} aria-label="Ordenar por nombre">
                  Nombre
                  <SortArrow active={sortBy === "name"} dir={sortDir} />
                </button>
              </th>
              <th>Contacto</th>
              <th>Mensaje</th>
              <th>
                <button type="button" className="lead-th-sort" onClick={() => toggleSort("status")} aria-label="Ordenar por estado">
                  Estado
                  <SortArrow active={sortBy === "status"} dir={sortDir} />
                </button>
              </th>
              <th className="leads-actions-col">
                <button type="button" className="lead-th-sort" onClick={() => toggleSort("created_at")} aria-label="Ordenar por fecha">
                  Capturado
                  <SortArrow active={sortBy === "created_at"} dir={sortDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageLeads.map((l) => (
              <tr
                key={l.id}
                className={`leads-row${selection.has(l.id) ? " is-selected" : ""}`}
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("button, a, input, select")) return;
                  setViewLead(l);
                }}
              >
                <td className="leads-check-col">
                  <input
                    type="checkbox"
                    className="leads-check"
                    checked={selection.has(l.id)}
                    onChange={() => toggleOne(l.id)}
                    aria-label={`Seleccionar ${l.name || "prospecto"}`}
                  />
                </td>
                <td>
                  <div className="leads-name-cell">
                    <span className="leads-avatar">{initials(l)}</span>
                    <div className="leads-name-info">
                      {l.name && <span className="leads-name">{l.name}</span>}
                      <span className="leads-date">{formatDate(l.created_at)}</span>
                    </div>
                  </div>
                </td>
                <td className="leads-contact-cell"><ContactChip lead={l} /></td>
                <td className="leads-notes">
                  {(l.interest || l.notes) ? <span title={(l.interest || l.notes) ?? undefined}>{l.interest || l.notes}</span> : <span className="count">—</span>}
                </td>
                <td>
                  <StatusSelect lead={l} onStatus={handleStatus} busy={busyStatus === l.id} />
                </td>
                <td className="leads-actions-col"><ActionIcons lead={l} onView={setViewLead} onViewHistory={setHistoryLead} onRequestDelete={setPendingDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="view-section active" id="view-leads">
      <div className="panel-card">
        <div className="leads-header">
          <div>
            <h3>Bandeja de Prospectos</h3>
            <p className="subtitle">
              Capturados automáticamente cuando tu agente detecta un email o teléfono en el chat, o desde el formulario del widget.
            </p>
          </div>
          <div className="leads-actions">
            <input
              type="search"
              className="leads-search"
              placeholder="Buscar por email, teléfono, interés o estado…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Buscar prospectos"
            />
            <button type="button" className="btn-shimmer" onClick={exportCsv} disabled={total === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="btn-shimmer-label">Exportar CSV</span>
            </button>
          </div>
        </div>
        <div className="leads-status-filter" role="tablist" aria-label="Filtrar por estado">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === ""}
            className={`lead-filter-pill${statusFilter === "" ? " is-active" : ""}`}
            onClick={() => handleStatusFilter("")}
          >
            Todos
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={statusFilter === s}
              className={`lead-filter-pill${statusFilter === s ? " is-active" : ""}`}
              onClick={() => handleStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {!loading && !loadError && (
          <div className="leads-kpis">
            <div className="leads-kpi">
              <div className="leads-kpi-head">
                <span>Total capturados</span>
                <span className="leads-kpi-icon"><IconLeads /></span>
              </div>
              <span className="leads-kpi-value">{total}</span>
            </div>
            <div className="leads-kpi">
              <div className="leads-kpi-head">
                <span>Pendientes (Nuevo)</span>
                <span className="leads-kpi-icon"><IconMessage /></span>
              </div>
              <span className="leads-kpi-value leads-kpi-accent">{stats.nuevo}</span>
            </div>
            <div className="leads-kpi">
              <div className="leads-kpi-head">
                <span>Contactados</span>
                <span className="leads-kpi-icon"><IconClock /></span>
              </div>
              <span className="leads-kpi-value">{stats.contactado}</span>
            </div>
            <div className="leads-kpi">
              <div className="leads-kpi-head">
                <span>Convertidos</span>
                <span className="leads-kpi-icon"><IconCheck /></span>
              </div>
              <span className="leads-kpi-value leads-kpi-good">{stats.convertido}</span>
            </div>
          </div>
        )}
        {content}
        {!loading && !loadError && total > 0 && (
          <div className="leads-footer">
            <span className="leads-pager-info">
              Mostrando <strong>{(pageNumber - 1) * PAGE_SIZE + 1}–{Math.min(pageNumber * PAGE_SIZE, total)}</strong> de{" "}
              <strong>{total}</strong> prospecto{total === 1 ? "" : "s"}
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
              {projected.map(pageButton)}
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
{selection.size > 0 &&
          createPortal(
            <div className="leads-fab" ref={bulkMenuRef}>
              <span className="leads-fab-count">
                {selection.size} seleccionado{selection.size === 1 ? "" : "s"}
              </span>
              <div className="leads-fab-menu-wrap">
                <button
                  type="button"
                  className="leads-fab-menu-btn"
                  onClick={() => setBulkMenuOpen((o) => !o)}
                  disabled={bulkBusy}
                >
                  Cambiar estado
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {bulkMenuOpen && (
                  <div className="leads-fab-menu">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setBulkMenuOpen(false);
                          runBulk("status", s);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="leads-fab-trash"
                onClick={() => runBulk("delete")}
                disabled={bulkBusy}
                aria-label="Eliminar seleccionados"
                title="Eliminar seleccionados"
              >
                <TrashIcon size={15} />
              </button>
              <button
                type="button"
                className="leads-fab-clear"
                onClick={() => setSelection(new Set())}
                disabled={bulkBusy}
                aria-label="Quitar selección"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>,
            document.body
          )}
      </div>
      <ConfirmModal
        open={pendingDelete !== null}
        title="¿Eliminar prospecto?"
        description={`Se eliminará "${pendingDelete?.name || "Prospecto sin nombre"}" de tu bandeja. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loadingText="Eliminando prospecto"
        icon={<TrashIcon />}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteLead}
      />
      <ConfirmModal
        open={bulkDeleteOpen}
        title="¿Eliminar prospectos seleccionados?"
        description={`Se eliminarán ${selection.size} prospecto${selection.size === 1 ? "" : "s"} de tu bandeja. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loadingText="Eliminando prospectos"
        icon={<TrashIcon />}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
      />
      {viewLead && (
        <LeadDrawer
          lead={leads.find((l) => l.id === viewLead.id) ?? viewLead}
          onClose={() => setViewLead(null)}
          onStatus={handleStatus}
          onRequestDelete={(lead) => {
            setPendingDelete(lead);
            setViewLead(null);
          }}
          onViewHistory={(lead) => {
            setHistoryLead(lead);
            setViewLead(null);
          }}
          onNotesUpdated={(id, notes) => {
            leadListCache.clear();
            setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, notes } : l)));
          }}
        />
      )}
      {historyLead && (
        <ConversationOverlay agentId={agentId} lead={historyLead} onClose={() => setHistoryLead(null)} />
      )}
    </section>
  );
}