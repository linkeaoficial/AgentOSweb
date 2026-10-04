import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "API publica - Documentacion - AgentOSweb",
  description:
    "Referencia de la API publica de AgentOSweb: configuracion del agente, chat con IA y captura de contactos (CORS, rate limits y errores).",
};

export default function DocsApiPage() {
  return (
    <DocsShell
      title="API pública"
      lead="Tres endpoints públicos para desarrolladores: la misma API que usa el widget oficial, disponible para integraciones propias."
      active="/docs/api"
    >
      <div className="doc-note is-warn">
        <p>
          <strong>Basada en lo mismo que el widget oficial.</strong> No necesitás API key para estas tres
          rutas: la protección es por origen (dominio autorizado) y rate limit por IP. Las rutas del panel
          (CRUD de agentes, analíticas, usuarios) usan sesión y <strong>no</strong> están documentadas acá.
        </p>
      </div>

      <h2>Convenciones</h2>
      <ul>
        <li>
          Base: <code>https://agentosweb.com</code> (en local: <code>http://localhost:3000</code>).
        </li>
        <li>Todo es JSON con <code>Content-Type: application/json</code>.</li>
        <li>
          CORS: se responde con el <code>Origin</code> pedido (<code>Access-Control-Allow-Origin</code>) y
          se aceptan <code>POST</code>, <code>GET</code>, <code>PUT</code>, <code>PATCH</code>,{" "}
          <code>OPTIONS</code>.
        </li>
        <li>
          Los errores siempre son <code>{"{ error: string }"}</code> con el código HTTP correspondiente.
        </li>
      </ul>

      <h2>GET /api/agent/:agentId</h2>
      <p>
        Configuración pública del widget: lo que el script descarga al cargar. Sin autenticación.
      </p>
      <p>
        <strong>Caché:</strong> <code>Cache-Control: public, s-maxage=60, stale-while-revalidate=3600</code>{" "}
        — los cambios de diseño tardan hasta 1 minuto en reflejarse.
      </p>
      <p><strong>Respuesta 200:</strong></p>
      <pre>
        <code>{`{
  "header_title": "Mi Asistente",
  "header_subtitle": "Ayuda 24/7",
  "welcome_message": "¡Hola! ¿En qué te ayudo?",
  "avatar_url": null,
  "bubble_logo_url": null,
  "primary_color": "#2563eb",
  "position": "right",
  "default_theme": "auto",
  "prompts": [{ "label": "¿Precios?", "msg": "¿Cuánto cuesta?" }]
}`}</code>
      </pre>
      <p>
        <strong>Errores:</strong> <code>404 {"{ \"error\": \"Agente no existe\" }"}</code> si el ID no
        existe o el agente está pausado.
      </p>

      <h2>POST /api/chat</h2>
      <p>Envía un mensaje del visitante y devuelve la respuesta del agente.</p>
      <pre>
        <code>{`POST /api/chat
{
  "agent_id": "uuid-del-agente",
  "message": "¿Cuánto cuesta el plan Pro?",
  "session_id": "sesion-aleatoria-del-visitante"
}`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Requerido</th>
            <th>Reglas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>agent_id</code>
            </td>
            <td>Sí</td>
            <td>UUID del agente activo.</td>
          </tr>
          <tr>
            <td>
              <code>message</code>
            </td>
            <td>Sí</td>
            <td>String de 1–1500 caracteres.</td>
          </tr>
          <tr>
            <td>
              <code>session_id</code>
            </td>
            <td>No</td>
            <td>Identifica al visitante para contexto y analítica; si falta, se usa <code>“anon”</code>.</td>
          </tr>
        </tbody>
      </table>
      <p><strong>Respuesta 200:</strong></p>
      <pre>
        <code>{`{ "reply": "El plan Pro cuesta US$49/mes…", "form": { "fields": ["name", "email"] } }`}</code>
      </pre>
      <ul>
        <li>
          <code>reply</code> — texto final (FAQ matcheada, respuesta de IA o aviso de cupo/pausa).
        </li>
        <li>
          <code>form</code> — presente <strong>solo una vez por sesión</strong> cuando hay interés y la
          captura está activa: trae los campos del formulario de contacto a insertar.
        </li>
      </ul>
      <p><strong>Errores y límites:</strong></p>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Cuándo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>400</td>
            <td>Falta <code>agent_id</code>/<code>message</code> o mensaje vacío o &gt;1500 car.</td>
          </tr>
          <tr>
            <td>403</td>
            <td>
              <code>Dominio no autorizado</code> — el <code>Origin</code> no está en la lista de dominios
              autorizados del agente.
            </td>
          </tr>
          <tr>
            <td>404</td>
            <td>
              <code>Agente no existe o está inactivo</code>.
            </td>
          </tr>
          <tr>
            <td>429</td>
            <td>
              Rate limit por IP y agente: <strong>
                {`rate_limit_por_minuto`}
              </strong>{" "}
              del agente (default <strong>20/min</strong>, configurable 1–120).
            </td>
          </tr>
        </tbody>
      </table>

      <h2>POST /api/leads</h2>
      <p>Guarda un contacto desde tu propio formulario (o reproduce el formulario embebido).</p>
      <pre>
        <code>{`POST /api/leads
{
  "agent_id": "uuid-del-agente",
  "session_id": "sesion-del-visitante",
  "name": "Ana",
  "email": "ana@empresa.com",
  "phone": "+34600000000",
  "interest": "Quiere una demo"
}`}</code>
      </pre>
      <ul>
        <li>
          <strong>Requeridos:</strong> <code>agent_id</code> y <code>session_id</code>; además{" "}
          <code>email</code> o <code>phone</code>.
        </li>
        <li>
          Solo se guardan los campos habilitados en el agente (<code>lead_fields</code>); los valores se
          recortan a 120 caracteres y el email se normaliza a minúsculas.
        </li>
        <li>
          <code>interest</code> (o <code>message</code>) queda como mensaje de interés, máx. 300
          caracteres.
        </li>
      </ul>
      <p><strong>Respuestas:</strong></p>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Body</th>
            <th>Cuándo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>201</td>
            <td>
              <code>{"{ \"ok\": true }"}</code>
            </td>
            <td>Contacto guardado.</td>
          </tr>
          <tr>
            <td>200</td>
            <td>
              <code>{"{ \"ok\": true, \"duplicate\": true }"}</code>
            </td>
            <td>Ya existía un lead con ese email/teléfono en el agente.</td>
          </tr>
        </tbody>
      </table>
      <p><strong>Errores y límites:</strong></p>
      <ul>
        <li>
          <code>400</code> — faltan campos, <code>Email inválido</code> o{" "}
          <code>Teléfono inválido</code> (&lt;6 dígitos).
        </li>
        <li>
          <code>403</code> — <code>Dominio no autorizado</code>.
        </li>
        <li>
          <code>404</code> — <code>Agente no existe</code>.
        </li>
        <li>
          <code>409</code> — <code>Captura desactivada</code> (el agente tiene{" "}
          <code>lead_capture</code> apagado).
        </li>
        <li>
          <code>429</code> — <strong>10 envíos por minuto</strong> por IP y agente.
        </li>
      </ul>

      <h2>Ejemplo mínimo</h2>
      <pre>
        <code>{`const r = await fetch("https://agentosweb.com/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agent_id: "MI-AGENTE-UUID",
    message: "Hola, ¿qué horarios tienen?",
    session_id: crypto.randomUUID()
  })
});
const { reply } = await r.json();`}</code>
      </pre>

      <div className="doc-note">
        <p>
          Si necesitás endpoints adicionales (webhooks salientes, métricas, multi-tenant), escribinos por
          el canal de soporte.
        </p>
      </div>
    </DocsShell>
  );
}
