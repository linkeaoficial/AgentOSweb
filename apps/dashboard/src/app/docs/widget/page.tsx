import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Widget embebible - Documentacion - AgentOSweb",
  description:
    "Instalación del widget de AgentOSweb: snippet de 3 pasos, atributos del script, plataformas compatibles y comportamiento del chat.",
};

const SNIPPET = `<script src="https://agentosweb.com/w/TU-AGENTE-ID/widget.js" defer></script>`;

const ATTRS = [
  ["<code>data-agent-id</code>", "ID (UUID) del agente.", "Se deduce de la URL del script; solo hace falta si cargás <code>widget.js</code> directo."],
  ["<code>data-api-url</code>", "Base de la API.", "<code>https://agentosweb.com/api</code>"],
  ["<code>data-position</code>", "Lado del globo flotante.", "<code>right</code> (acepta <code>left</code>)"],
  ["<code>data-asset-url</code>", "Base de imágenes del widget.", "Directorio del propio <code>script.js</code>"],
];

export default function DocsWidgetPage() {
  return (
    <DocsShell
      title="Widget embebible"
      lead="Un solo fragmento de JavaScript, sin dependencias. Funciona en cualquier web: HTML, WordPress, Shopify, React y más."
      active="/docs/widget"
    >
      <h2>Instalación en 3 pasos</h2>
      <p>
        <span className="doc-kicker">Paso 1</span>
        Copiá el script desde tu panel: <strong>Dashboard → Código de Instalación → Copiar Script</strong>.
      </p>
      <pre>
        <code>{SNIPPET}</code>
      </pre>
      <p>
        <span className="doc-kicker">Paso 2</span>
        Pegalo <strong>justo antes de la etiqueta <code>&lt;/body&gt;</code></strong> de tu página (o del
        tema de tu CMS).
      </p>
      <p>
        <span className="doc-kicker">Paso 3</span>
        Recargá la web. El globo de chat aparece abajo a la derecha y tu agente queda online 24/7.
      </p>

      <div className="doc-note">
        <p>
          El panel genera la URL con tu ID de agente. Si probás en local, el snippet usa{" "}
          <code>localhost</code>; en producción usa <code>https://agentosweb.com</code>. El script es{" "}
          <strong>público por diseño</strong>: cualquier visitante de tu web puede cargarlo, y eso es lo que
          hace que funcione sin login.
        </p>
      </div>

      <h2>Atributos del script</h2>
      <p>
        El snippet de una línea no necesita atributos: el ID se deduce de la URL. Si preferís control
        explícito (por ejemplo, servir <code>widget.js</code> desde tu propio dominio), podés agregar:
      </p>
      <table>
        <thead>
          <tr>
            <th>Atributo</th>
            <th>Qué define</th>
            <th>Valor por defecto</th>
          </tr>
        </thead>
        <tbody>
          {ATTRS.map((a) => (
            <tr key={a[0]}>
              <td dangerouslySetInnerHTML={{ __html: a[0] }} />
              <td dangerouslySetInnerHTML={{ __html: a[1] }} />
              <td dangerouslySetInnerHTML={{ __html: a[2] }} />
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        También se expone <code>window.AgentOSweb = {`{ agentId, apiUrl }`}</code> para inspección desde la
        consola.
      </p>

      <h2>Plataformas compatibles</h2>
      <p>
        Es un script puro sin dependencias: va donde vaya una etiqueta <code>&lt;script&gt;</code>. Chips
        oficiales del panel:
      </p>
      <div className="doc-cards">
        {["HTML", "WordPress", "Shopify", "Wix", "Webflow", "Squarespace", "React", "Next.js", "Vue", "Nuxt", "Astro", "Ghost"].map(
          (p) => (
            <span key={p} className="doc-card">
              <span className="doc-card-title">{p}</span>
            </span>
          )
        )}
      </div>
      <ul>
        <li>
          <strong>WordPress:</strong> pegalo en el editor de código del tema (o en un bloque HTML) antes de
          <code> &lt;/body&gt;</code>.
        </li>
        <li>
          <strong>Shopify / Wix / Webflow:</strong> usá el campo de “código personalizado” o “embed” de la
          plataforma.
        </li>
        <li>
          <strong>React / Next.js / Vue:</strong> renderizá la etiqueta <code>&lt;script&gt;</code> en el
          HTML raíz (por ejemplo, en el <code>&lt;body&gt;</code> del layout o vía{" "}
          <code>next/script</code> con <code>strategy=“afterInteractive”</code>).
        </li>
      </ul>

      <h2>Comportamiento del widget</h2>
      <h3>Vista doble: portada y chat</h3>
      <p>
        Al abrir, el visitante ve una <strong>portada</strong> con tu mensaje de bienvenida y tus preguntas
        frecuentes como botones. Al tocar una pregunta (o “Iniciar conversación”) se cambia a la vista de{" "}
        <strong>chat</strong>.
      </p>
      <h3>Respuestas frecuentes sin IA</h3>
      <p>
        Si el mensaje del visitante matchea una de tus preguntas frecuentes, se responde{" "}
        <strong>al instante y sin consumir tu cupo</strong>. El matcher es tolerante: en preguntas de 4+
        keywords puede fallar una y aun así matchear, y si el matcheo literal no encuentra nada se intenta
        uno semántico con embeddings (sinónimos y paráfrasis).
      </p>
      <h3>Chat con IA</h3>
      <ul>
        <li>
          Contexto: el modelo recibe los <strong>últimos 6 mensajes</strong> de la conversación (cada uno
          truncado a 1500 caracteres).
        </li>
        <li>
          Indicador de escritura con pacing mínimo de 1 segundo para que se sienta natural.
        </li>
        <li>
          Historial visual del visitante vive en la sesión del navegador; el historial analítico completo
          queda en tu panel (sección Prospectos).
        </li>
        <li>
          Microfono para dictar mensajes en navegadores compatibles (Web Speech API).
        </li>
        <li>
          Tema claro/oscuro: respeta la preferencia guardada del visitante o la de su sistema.
        </li>
      </ul>
      <h3>Límites y degradación</h3>
      <ul>
        <li>
          <strong>Rate limit:</strong> 20 mensajes por minuto por visitante (configurable 1–120 desde
          Configuración Avanzada). Al superarlo: <code>429</code>.
        </li>
        <li>
          <strong>Cupo mensual:</strong> si agotás los mensajes de IA administrada, el chat responde con un
          aviso de límite (no es un error; las FAQ siguen funcionando).
        </li>
        <li>
          <strong>Agente pausado:</strong> el widget muestra “⏸️ Este asistente está en pausa”.
        </li>
        <li>
          <strong>Sin conexión:</strong> reintenta una vez y, si falla, muestra un mensaje local de
          contingencia.
        </li>
      </ul>

      <h2>Personalización</h2>
      <p>
        Todo se configura desde <strong>Mi Agente</strong> en el panel y se refleja en menos de 1 minuto:
      </p>
      <ul>
        <li>
          <strong>Título y subtítulo del widget</strong> (la marca que ve el visitante), mensaje de
          bienvenida.
        </li>
        <li>
          <strong>Color principal</strong> — genera automáticamente toda la paleta del chat (burbujas,
          botones, degradados).
        </li>
        <li>
          <strong>Posición</strong> (derecha/izquierda), <strong>tema inicial</strong> (claro/oscuro/auto),
          <strong>avatar</strong> del header y — en plan Agency — logo de la burbuja (marca blanca).
        </li>
        <li>
          <strong>Preguntas frecuentes</strong> que aparecen como botones en la portada.
        </li>
      </ul>

      <div className="doc-note is-warn">
        <p>
          <strong>Importante:</strong> el endpoint de configuración del widget se cachea hasta 60 segundos
          en el borde. Después de guardar cambios, esperá ~1 minuto (o recarguá con <code>Ctrl/Cmd + Shift +
          R</code>).
        </p>
      </div>

      <h2>Solución de problemas</h2>
      <table>
        <thead>
          <tr>
            <th>Síntoma</th>
            <th>Causa y solución</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>No aparece el globo</td>
            <td>
              Revisá que el script esté <em>antes</em> de <code>&lt;/body&gt;</code> y que la URL contenga
              tu ID. Mirá la consola del navegador: si dice “falta data-agent-id”, el snippet está mal
              copiado.
            </td>
          </tr>
          <tr>
            <td>El chat dice “en pausa”</td>
            <td>
              Tu agente está pausado (<em>Mi Agente → Agente activo</em>) o fue eliminado; el script viejo
              queda con el ID de un agente borrado.
            </td>
          </tr>
          <tr>
            <td>Responde con el aviso de límite</td>
            <td>
              Se agotó el cupo mensual de IA administrada. Subí de plan o activá tu propia API key (BYOK).
            </td>
          </tr>
          <tr>
            <td>403 “Dominio no autorizado”</td>
            <td>
              Configuraste dominios autorizados y el sitio no está en la lista. Agregalo (o usá{" "}
              <code>*</code>) en <em>Mi Agente → Configuración Avanzada</em>.
            </td>
          </tr>
          <tr>
            <td>Los cambios no se ven</td>
            <td>Cache de 60 s en el borde: esperá un minuto o forzá recarga con cache.</td>
          </tr>
        </tbody>
      </table>
    </DocsShell>
  );
}
