"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loadingText: string;
  icon: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmPhrase?: string;
}

export default function ConfirmModal({ open, title, description, confirmLabel, loadingText, icon, onClose, onConfirm, confirmPhrase }: ConfirmModalProps) {
  const [pending, setPending] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  useEffect(() => {
    if (!open || pending) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, pending, onClose]);

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
    <div className={`modal-backdrop ${open ? "open" : ""}`} onClick={pending ? undefined : onClose} aria-hidden={!open}>
      <div className="logout-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
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
          <button type="button" className="logout-confirm" onClick={handleConfirm} disabled={pending || !phraseOk} aria-busy={pending}>
            {pending ? <span className="logout-spinner" role="status" aria-label={loadingText} /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}