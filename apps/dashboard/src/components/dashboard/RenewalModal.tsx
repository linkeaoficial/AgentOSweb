"use client";

import ModalShell from "./ModalShell";

interface RenewalModalProps {
  open: boolean;
  /** Plan del que se cayó la cuenta ("pro"), o null si no se sabe. */
  downgradedFrom: string | null;
  /** Fecha de vencimiento que se pasó, para poder citarla. */
  expiredAt: string | null;
  /** Numero en formato wa.me (prefijo de pais, sin signos). Vacio = sin boton. */
  whatsapp: string | null;
  /** Cierra el aviso; el servidor deja de volver a mostrarlo. */
  onDismiss: () => void | Promise<void>;
}

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

// El texto del mensaje se arma aca y no en el onclick, para que sea visible en
// el `href` (se puede copiar y ver a donde lleva antes de tocarlo).
function waLink(whatsapp: string, plan: string | null, expiredAt: string | null): string {
  const planName = plan ? PLAN_LABEL[plan] ?? plan : "tu plan";
  // La fecha va formateada ("el 15 de octubre de 2026"). Mandar el `YYYY-MM-DD`
  // crudo se veía como un dato interno de la base en un mensaje de WhatsApp.
  const when = expiredAt ? ` el ${formatDate(expiredAt)}` : "";
  const text = `Hola! Venció${when} mi plan ${planName} en AgentOSweb y quiero renovarlo.`;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
}

// Date-only: se ancla a medianoche local a proposito, sin conversion a UTC. El
// vencimiento es un día del calendario del dueño, no un instante: correrlo a
// UTC lo empujaba al día anterior en Venezuela/Argentina (UTC-4).
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

export default function RenewalModal({ open, downgradedFrom, expiredAt, whatsapp, onDismiss }: RenewalModalProps) {
  const planName = downgradedFrom ? PLAN_LABEL[downgradedFrom] ?? downgradedFrom : null;
  const when = formatDate(expiredAt);

  return (
    <ModalShell open={open} onClose={onDismiss} ariaLabel="Tu plan venció">
      <div className="logout-modal-icon renewal-modal-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
      </div>
      <h2>Tu plan venció</h2>
      <p>
        {planName ? (
          <>
            Tu plan <strong>{planName}</strong> venció{when ? <> el <strong>{when}</strong></> : null} y tu cuenta volvió al plan
            gratuito.
          </>
        ) : (
          <>Tu plan de pago venció{when ? <> el <strong>{when}</strong></> : null} y tu cuenta volvió al plan gratuito.</>
        )}
      </p>
      <p className="renewal-modal-note">
        Tus agentes siguen funcionando, pero con los límites del plan gratuito hasta que renueves.
      </p>
      <div className="logout-modal-actions">
        <button type="button" onClick={onDismiss}>
          Ahora no
        </button>
        {whatsapp ? (
          <a
            className="renewal-whatsapp"
            href={waLink(whatsapp, downgradedFrom, expiredAt)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDismiss}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z" />
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.06h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.37c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.24 8.22Z" />
            </svg>
            Renovar por WhatsApp
          </a>
        ) : null}
      </div>
    </ModalShell>
  );
}
