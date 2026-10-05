"use client";

import { useState } from "react";
import ModalShell from "./ModalShell";
import { IconMessage } from "./icons";
import { useToast } from "./notifications";

// Categorias: la lista espejo de SUPPORT_CATEGORIES en apps/workers/src/index.ts.
// Si se agrega una alla, hay que agregarla aca.
const CATEGORIES = [
  { id: "bug", label: "Algo no funciona", hint: "Un error o algo que no carga como debería." },
  { id: "pregunta", label: "Tengo una pregunta", hint: "Cómo se usa algo del panel." },
  { id: "facturacion", label: "Planes y facturación", hint: "Cambios de plan, cupos o pagos." },
  { id: "widget", label: "El widget en mi web", hint: "No aparece, no responde o se ve mal." },
  { id: "mejora", label: "Sugerencia", hint: "Algo que te gustaría ver en AgentOSweb." },
];

const jsonHeaders = { "Content-Type": "application/json" };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Datos de la cuenta que ya viajan con el ticket (no hace falta pedirlos). */
  email?: string | null;
  planLabel?: string;
}

export default function SupportModal({ open, onClose, email, planLabel }: Props) {
  const toast = useToast();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCategory("");
    setSubject("");
    setMessage("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          category,
          subject,
          message,
          // La pagina desde la que escriben: aca esta la mitad del problema
          // cuando el cliente reporta algo que "no le carga".
          page: typeof location === "undefined" ? "" : location.pathname,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          res.status === 404
            ? "El servicio de soporte todavía no está activo en el servidor."
            : data.error || "No se pudo enviar el mensaje"
        );
        return;
      }
      toast.success("Mensaje enviado. Te lo contestamos por email.");
      reset();
      onClose();
    } catch {
      toast.error("Error de red. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Ayuda y soporte" innerClassName="support-modal" dismissOnBackdrop={!busy}>
      <header className="support-modal-head">
        <span className="support-modal-icon" aria-hidden="true">
          <IconMessage />
        </span>
        <div>
          <h2>Ayuda y soporte</h2>
          <p className="form-hint" style={{ margin: 0 }}>
            Escribinos y te ayudamos. Lee primero la <a href="/docs" target="_blank" rel="noreferrer">documentación</a>: casi
            todo está ahí.
          </p>
        </div>
      </header>

      <form onSubmit={submit}>
        <fieldset className="sup-cats">
          <legend className="form-label">¿Sobre qué es?</legend>
          {CATEGORIES.map((c) => (
            <label key={c.id} className="sup-cat">
              <input
                type="radio"
                name="sup-category"
                value={c.id}
                checked={category === c.id}
                onChange={() => setCategory(c.id)}
              />
              <span className="sup-cat-label">{c.label}</span>
              <span className="sup-cat-hint">{c.hint}</span>
            </label>
          ))}
        </fieldset>

        <div className="form-group">
          <label className="form-label" htmlFor="sup-subject">
            Asunto
          </label>
          <input
            id="sup-subject"
            className="form-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="El widget no aparece en mi web"
            minLength={4}
            maxLength={140}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="sup-message">
            Mensaje
          </label>
          <textarea
            id="sup-message"
            className="form-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Contanos qué pasó, qué esperabas y si podés, qué hiciste para probarlo."
            minLength={10}
            maxLength={4000}
            rows={5}
            required
          />
          <span className="sup-counter">{message.length}/4000</span>
        </div>

        <p className="sup-attached">
          Ya enviamos con el mensaje
          {email ? <> tu correo <strong>{email}</strong></> : null}
          {email && planLabel ? " y" : null}
          {planLabel ? <> tu plan <strong>{planLabel}</strong></> : null}
          {email || planLabel ? ", y la página desde la que escribiste." : " la página desde la que escribiste."}
        </p>

        <div className="sup-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn-primary" type="submit" disabled={busy || !category} aria-busy={busy}>
            {busy ? "Enviando…" : "Enviar mensaje"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}