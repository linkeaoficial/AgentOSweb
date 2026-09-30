"use client";

import { useEffect, type ReactNode } from "react";

// Cáscara comun de los modales del panel. Existe para que ConfirmModal y
// RenewalModal no repitan el backdrop, el Escape y el bloqueo de scroll.
//
// DELIBERADAMENTE SIN createPortal: con el backdrop colgado del <body>, el
// `backdrop-filter` del `.modal-backdrop` deja de estar dentro de la "backdrop
// root" que crea el ancestro con `transform`/`filter` del layout, y pasa a
// difuminar la pagina COMPLETA en vez de solo el subarbol del panel. El vidrio
// se ve mucho mas fuerte que antes. Como ningun modal vive dentro de un
// contenedor con `overflow` que lo recorte, el portal no compra nada aqui.
//
// Si algun dia hace falta portalar (un modal desde adentro del drawer), hay que
// revisar el vidrio antes de subirlo: el recorte automatico del ancestro es lo
// que hoy lo mantiene con su aspecto original.
interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /** Texto del aria-label del dialog. */
  ariaLabel: string;
  /** Contenido del dialog. */
  children: ReactNode;
  /** Clase del contenedor interno; por defecto el estilo de los modales del panel. */
  innerClassName?: string;
  /** Si es false, el backdrop no cierra al hacer click (operación en curso). */
  dismissOnBackdrop?: boolean;
}

export default function ModalShell({
  open,
  onClose,
  ariaLabel,
  children,
  innerClassName = "logout-modal",
  dismissOnBackdrop = true,
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    // Evita que la pagina de fondo siga haciendo scroll con el modal abierto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      className={`modal-backdrop ${open ? "open" : ""}`}
      onClick={dismissOnBackdrop ? onClose : undefined}
      aria-hidden={!open}
    >
      <div
        className={innerClassName}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
