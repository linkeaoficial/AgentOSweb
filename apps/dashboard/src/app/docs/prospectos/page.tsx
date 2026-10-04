import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Prospectos - Documentacion - AgentOSweb",
  description:
    "Captura automática de contactos desde el chat, formulario embebido, estados, bandeja, exportación CSV y alertas de Prospectos en AgentOSweb.",
};

export default function DocsLeadsPage() {
  return (
    <DocsShell
      title="Prospectos"
      lead="Cada conversación con interés se convierte en un contacto: nombre, email, teléfono y el mensaje exacto con el que escribieron."
      active="/docs/prospectos"
    >
      <h2>Cómo se capturan (2 vías)</h2>
      <h3>1. Automática desde el chat</h3>
      <p>
        Con la captura activada (<em>Mi Agente → Capturar prospectos</em>), el agente detecta por
        expresiones regulares, dentro de la conversación:
      </p>
      <ul>
        <li>
          <strong>Email</strong> (<code>nombre@dominio.com</code>)
        </li>
        <li>
          <strong>Teléfono</strong> (6+ dígitos, con o sin <code>+</code>)
        </li>
        <li>
          <strong>Nombre</strong> (“me llamo…”, “mi nombre es…”, “soy…”) — el nombre solo no alcanza para
          guardar un lead sin email ni teléfono.
        </li>
      </ul>
      <p>
        Si el visitante escribe varios contactos, se deduplica por email (o teléfono) dentro del mismo
        agente. El “mensaje de interés” guarda el texto real que motivó la captura.
      </p>
      <h3>2. Formulario embebido en el chat</h3>
      <p>
        Cuando el mensaje muestra <strong>interés de compra</strong> (precio, comprar, cotizar,
        presupuesto, “cuánto cuesta”, “@”…) y aún no hay lead para esa sesión, el servidor devuelve una
        tarjeta de contacto dentro del chat:
      </p>
      <ul>
        <li>
          Campos según tu configuración: <strong>Nombre</strong>, <strong>Email</strong>,{" "}
          <strong>Teléfono</strong> + una casilla opcional “¿Sobre qué te gustaría hablar?”.
        </li>
        <li>
          Se muestra <strong>una sola vez por sesión</strong>.
        </li>
        <li>
          Validación en dos capas: el widget valida formato de email y teléfono (≥6 dígitos) antes de
          enviar; el servidor vuelve a validar.
        </li>
        <li>
          Requiere email o teléfono. Duplicados se aceptan sin romper (el visitante ve “¡Gracias!”).
        </li>
      </ul>
      <div className="doc-note">
        <p>
          El formulario va a <code>POST /api/leads</code> con rate limit de 10 envíos por minuto por IP.
          Ver <a href="/docs/api">API pública</a>.
        </p>
      </div>

      <h2>La bandeja</h2>
      <p>En <strong>Prospectos</strong> (panel) tenés:</p>
      <ul>
        <li>
          <strong>4 tarjetas de resumen:</strong> Total capturados, Tasa de conversión (% convertido),
          Sin responder (% en estado Nuevo) y En espera (% Contactado + Calificado).
        </li>
        <li>
          <strong>Búsqueda</strong> por email, teléfono, interés o estado (server-side, debounce 300 ms) y{" "}
          <strong>filtros por estado</strong> con contador.
        </li>
        <li>
          <strong>Orden</strong> por nombre, estado o fecha; <strong>paginación</strong> de 10 en 10; se
          actualiza solo cada 30 segundos.
        </li>
        <li>
          <strong>Acciones por fila:</strong> detalle, ver conversación, WhatsApp (<code>wa.me</code>),
          email y eliminar.
        </li>
        <li>
          <strong>Selección múltiple</strong> con acciones en lote: cambiar estado o eliminar.
        </li>
        <li>
          <strong>Exportar CSV</strong> respetando el filtro activo (hasta 5.000 filas, con BOM para Excel).
        </li>
      </ul>

      <h3>Estados</h3>
      <table>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Cuándo usarlo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nuevo</td>
            <td>Recién capturado, sin respuesta.</td>
          </tr>
          <tr>
            <td>Contactado</td>
            <td>Ya le escribiste o le hablaste.</td>
          </tr>
          <tr>
            <td>Calificado</td>
            <td>Le interesa y califica como cliente potencial.</td>
          </tr>
          <tr>
            <td>Convertido</td>
            <td>Compró / cerraste el trato.</td>
          </tr>
          <tr>
            <td>Archivado</td>
            <td>Sin interés o fuera de foco.</td>
          </tr>
        </tbody>
      </table>

      <h3>Detalle del prospecto (drawer)</h3>
      <p>Al hacer clic en una fila se abre el detalle con:</p>
      <ul>
        <li>
          <strong>Información de contacto</strong> + botones de WhatsApp, email y “copiar todos los
          datos”.
        </li>
        <li>
          <strong>Mensaje de interés</strong> — el texto real del visitante.
        </li>
        <li>
          <strong>Nota interna</strong> — tu seguimiento (se guarda en el servidor, no la ve el visitante).
        </li>
        <li>
          <strong>Historial de conversación</strong> — la charla renderizada como el widget real, con
          exportación a <code>.txt</code> y opción de borrar la conversación.
        </li>
        <li>
          <strong>Información técnica</strong> — sesión, fechas y estado.
        </li>
      </ul>

      <h2>Alertas</h2>
      <p>
        Si tu cuenta tiene configurado <strong>Telegram</strong> o un <strong>webhook</strong> (se setean
        en el servidor), recibís avisos cuando:
      </p>
      <ul>
        <li>Un visitante muestra intención de compra o contacto en el chat.</li>
        <li>Alguien envía el formulario embebido (“📋 Nuevo contacto por formulario”).</li>
      </ul>

      <div className="doc-note is-warn">
        <p>
          <strong>Privacidad:</strong> los prospectos son datos personales de tus visitantes. Sos
          responsable de tratarlos según la ley aplicable — revisá nuestra{" "}
          <a href="/privacidad">Política de Privacidad</a>.
        </p>
      </div>
    </DocsShell>
  );
}
