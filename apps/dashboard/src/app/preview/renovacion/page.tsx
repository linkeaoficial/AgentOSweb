"use client";

// Entorno de prueba del RenewalModal. Sirve para ajustar el texto y el diseño
// sin esperar a que una cuenta real venza, y sin tener que bajar una a mano
// para poder ver el aviso.
//
// Vive bajo /preview, que el middleware exige con sesion: no es una pagina
// publica, es una herramienta del dueno. No toca la base ni la lista de
// clientes.

import { useEffect, useState } from "react";
import RenewalModal from "@/components/dashboard/RenewalModal";

const CASES = [
  { label: "Pro (caso tipico)", downgradedFrom: "pro", expiredAt: "2026-09-29" },
  { label: "Agency, hace 12 dias", downgradedFrom: "agency", expiredAt: "2026-09-17" },
  { label: "Starter", downgradedFrom: "starter", expiredAt: "2026-10-01" },
  { label: "Sin plan conocido (legacy)", downgradedFrom: null, expiredAt: null },
] as const;

const WA = "584161356896";

function prettyDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

export default function PreviewRenovacion() {
  const [i, setI] = useState(0);
  const [wa, setWa] = useState(true);
  const [open, setOpen] = useState(true);
  const [dark, setDark] = useState(false);

  // Mismo interruptor que usa la app real (Dashboard.tsx), asi el modo oscuro
  // del preview es exactamente el mismo y no una aproximacion.
  useEffect(() => {
    document.body.classList.toggle("dark-mode", dark);
    return () => document.body.classList.remove("dark-mode");
  }, [dark]);

  const c = CASES[i];
  const when = prettyDate(c.expiredAt);
  const sampleText = `Hola! Vencio${when ? ` el ${when}` : ""} mi plan ${
    c.downgradedFrom ?? "de pago"
  } en AgentOSweb y quiero renovarlo.`;

  return (
    <main style={{ padding: 28, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Preview del modal de renovacion</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 0 }}>
        Es el mismo componente que ve el cliente, con datos falsos. No toca la base.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", margin: "18px 0" }}>
        <label style={{ fontSize: 13 }}>
          Caso{" "}
          <select value={i} onChange={(e) => setI(Number(e.target.value))} style={{ marginLeft: 6 }}>
            {CASES.map((x, n) => (
              <option key={x.label} value={n}>
                {x.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} style={{ marginRight: 6 }} />
          Con WhatsApp
        </label>

        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} style={{ marginRight: 6 }} />
          Modo oscuro
        </label>

        <button className="btn-ghost" type="button" onClick={() => setOpen(true)}>
          Mostrar
        </button>
        <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>
          Ocultar
        </button>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>
        {wa ? <>Mensaje de WhatsApp: <code>wa.me/{WA}?text={encodeURIComponent(sampleText)}</code></> : "Sin numero configurado el modal avisa pero no ofrece salida: ese es el peor caso, asi que conviene verlo una vez."}
      </p>

      <div
        style={{
          minHeight: 320,
          border: "1px dashed var(--border-color)",
          borderRadius: 14,
          padding: 20,
          overflow: "hidden",
        }}
      >
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 0 }}>
          Fondo de pagina simulado, para ver cuanto difumina el vidrio el modal.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, opacity: 0.55 }}>
          {["#c7d2fe", "#a7f3d0", "#fde68a", "#fecaca"].map((c2) => (
            <div key={c2} style={{ height: 60, borderRadius: 10, background: c2 }} />
          ))}
        </div>
      </div>

      <RenewalModal
        open={open}
        downgradedFrom={c.downgradedFrom}
        expiredAt={c.expiredAt}
        whatsapp={wa ? WA : null}
        onDismiss={() => setOpen(false)}
      />
    </main>
  );
}
