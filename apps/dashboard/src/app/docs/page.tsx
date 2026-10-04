import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Documentación - AgentOSweb",
  description:
    "Guía oficial de AgentOSweb: instalación del widget, agentes de IA, captura de prospectos, analíticas, planes y API pública.",
};

const CARDS = [
  {
    href: "/docs/widget",
    title: "Widget embebible",
    p: "Instalación en 3 pasos, atributos del script, plataformas compatibles y comportamiento del chat.",
  },
  {
    href: "/docs/agentes",
    title: "Agentes",
    p: "Crear y personalizar tu agente: identidad, prompt, preguntas frecuentes, base de conocimiento y motor de IA.",
  },
  {
    href: "/docs/prospectos",
    title: "Prospectos",
    p: "Captura automática desde el chat, formulario embebido, estados, exportación CSV y alertas.",
  },
  {
    href: "/docs/analiticas",
    title: "Analíticas",
    p: "KPIs, actividad diaria, mapa de calor día×hora, embudo de conversión y top de preguntas.",
  },
  {
    href: "/docs/planes",
    title: "Planes y cuenta",
    p: "Cupos, precios, IA administrada vs tu propia API key, ciclo de vida del plan y roles.",
  },
  {
    href: "/docs/api",
    title: "API pública",
    p: "Endpoints para desarrolladores: configuración del agente, chat y captura de contactos.",
  },
];

export default function DocsIndexPage() {
  return (
    <DocsShell
      title="Documentación de AgentOSweb"
      lead="Todo lo que necesitás para poner un agente de IA en tu web: desde pegar el script hasta leer tus analíticas. Guía en español, actualizada con el producto real."
      active="/docs"
    >
      <div className="doc-cards">
        {CARDS.map((c) => (
          <a key={c.href} className="doc-card" href={c.href}>
            <span className="doc-card-title">{c.title}</span>
            <p>{c.p}</p>
          </a>
        ))}
      </div>

      <h2>Inicio rápido</h2>
      <p>
        AgentOSweb es una plataforma para crear <strong>agentes de IA sin código</strong> y publicarlos en
        cualquier sitio web con un solo fragmento de script. Tu agente responde 24/7, captura prospectos y
        mide su rendimiento desde el panel.
      </p>
      <ol>
        <li>
          <strong>Creá tu cuenta</strong> — registrate con email y contraseña en el panel.
        </li>
        <li>
          <strong>Creá tu agente</strong> — desde <em>Mi Agente</em> definí título, personalidad y preguntas
          frecuentes. El agente nace listo para usar con IA administrada.
        </li>
        <li>
          <strong>Pegá el script en tu web</strong> — copiá el snippet de instalación y pegalo antes de
          <code> &lt;/body&gt;</code>. Recargá y tu asistente queda online.
        </li>
      </ol>

      <div className="doc-note">
        <p>
          <strong>Requisitos:</strong> no necesitás servidores, ni APIs de IA, ni conocimientos técnicos. El
          plan <strong>Free</strong> te deja probar con 1 agente y 20 mensajes de IA administrada por mes.
        </p>
      </div>

      <h2>¿Cómo funciona por debajo?</h2>
      <p>
        El widget es un archivo JavaScript autocontenido (<code>widget.js</code>) que corre dentro de un{" "}
        <strong>Shadow DOM</strong>: sus estilos están aislados al 100% y no pueden romper los de tu sitio,
        ni los de tu sitio pueden romperlo a él. Al cargar, el script trae la configuración visual de tu
        agente y abre un chat que conversa con el modelo de IA configurado (IA administrada de Cloudflare o
        tu propia API key).
      </p>
      <ul>
        <li>
          <strong>Respuestas frecuentes sin IA:</strong> las preguntas que definís se contestan al instante
          y gratis, sin consumir tu cupo de mensajes.
        </li>
        <li>
          <strong>Captura de prospectos:</strong> cuando un visitante muestra interés, el agente ofrece un
          formulario de contacto y guardamos el lead en tu bandeja.
        </li>
        <li>
          <strong>Analíticas:</strong> sesiones, mensajes, conversión y mapa de calor de actividad en tu
          panel.
        </li>
      </ul>

      <h2>Mapa del producto</h2>
      <table>
        <thead>
          <tr>
            <th>Sección del panel</th>
            <th>Qué hacés ahí</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dashboard</td>
            <td>Resumen de KPIs, script de instalación y estado de tu agente.</td>
          </tr>
          <tr>
            <td>Mi Agente / Mis Agentes</td>
            <td>Editor completo: identidad, prompt, FAQs, base de conocimiento, motor de IA y vista previa.</td>
          </tr>
          <tr>
            <td>Prospectos</td>
            <td>Bandeja de contactos capturados con estados, historial y exportación.</td>
          </tr>
          <tr>
            <td>Analíticas</td>
            <td>Métricas de uso y conversión por período (disponible desde Starter).</td>
          </tr>
          <tr>
            <td>Planes &amp; Facturación</td>
            <td>Tu plan, consumo, cupos, vencimiento e historial.</td>
          </tr>
          <tr>
            <td>Configuración</td>
            <td>Cuenta, apariencia del panel, contraseña, sesiones y eliminar cuenta.</td>
          </tr>
        </tbody>
      </table>

      <div className="doc-note">
        <p>
          ¿Sos desarrollador y querés integrar por tu cuenta? Revisá la{" "}
          <a href="/docs/api">referencia de la API pública</a>.
        </p>
      </div>
    </DocsShell>
  );
}
