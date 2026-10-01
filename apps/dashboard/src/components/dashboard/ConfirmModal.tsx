"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import ModalShell from "./ModalShell";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  /** Acepta JSX: hay descripciones que citan una fecha con <strong>. */
  description: ReactNode;
  confirmLabel: string;
  loadingText: string;
  icon: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmPhrase?: string;
  /**
   * `danger` (default) pinta el botón rojo, para acciones destructivas como
   * cerrar sesión. `neutral` usa el azul de marca para lo que es positivo:
   * renovar un cliente NO es destruir algo y no debe verse como peligroso.
   */
  tone?: "danger" | "neutral";
}

export default function ConfirmModal({ open, title, description, confirmLabel, loadingText, icon, onClose, onConfirm, confirmPhrase, tone = "danger" }: ConfirmModalProps) {
  const [pending, setPending] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const phraseOk = !confirmPhrase || typed === confirmPhrase;

  const handleConfirm = async () => {
    if (pending || !phraseOk) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  return (
    <ModalShell open={open} onClose={pending ? () => {} : onClose} ariaLabel={title} dismissOnBackdrop={!pending}>
      <div className="logout-modal-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {confirmPhrase && (
        <>
          <label className="logout-modal-phrase" htmlFor="confirm-phrase-input">
            Escribe <strong>{confirmPhrase}</strong> para confirmar
          </label>
          <input
            id="confirm-phrase-input"
            className="form-input logout-modal-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
            autoFocus
            disabled={pending}
          />
        </>
      )}
      <div className="logout-modal-actions">
        <button type="button" onClick={onClose} disabled={pending}>
          Cancelar
        </button>
        <button
          type="button"
          className={`logout-confirm${tone === "neutral" ? " is-neutral" : ""}`}
          onClick={handleConfirm}
          disabled={pending || !phraseOk}
          aria-busy={pending}
        >
          {pending ? <span className="logout-spinner" role="status" aria-label={loadingText} /> : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
