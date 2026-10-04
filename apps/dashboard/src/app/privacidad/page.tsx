import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Politica de Privacidad - AgentOSweb",
  description:
    "Como AgentOSweb trata datos personales: roles de controlador y procesador, sub-procesadores, retencion, seguridad y derechos del usuario (GDPR, CCPA, LGPD).",
};

export default function PrivacyPage() {
  return (
    <DocsShell
      title="Política de Privacidad"
      lead="Qué datos tratamos, con qué finalidad, durante cuánto tiempo y cómo podés ejercer tus derechos."
      active="/privacidad"
    >
      <div className="doc-note is-warn">
        <p>
          <strong>Última actualización:</strong> 4 de octubre de 2026. Borrador pendiente de{" "}
          <strong>revisión legal profesional</strong>. Operador: <code>[Nombre del Operador]</code>{" "}
          (<code>[País]</code>) · contacto: <code>[email de contacto legal]</code>. Baseline de cumplimiento
          elegido: <strong>RGPD (UE/EEE)</strong>, con menciones a la <strong>CCPA/CPRA (California)</strong>{" "}
          y la <strong>LGPD (Brasil)</strong> por ser plataforma de alcance internacional.
        </p>
      </div>

      <h2>1. Responsable y roles</h2>
      <ul>
        <li>
          <strong>Operador de la Plataforma</strong> (<code>[Nombre del Operador]</code>): responsable del
          tratamiento de los datos de las <em>cuentas de usuario</em> (quienes se registran en el panel).
        </li>
        <li>
          <strong>Cliente (usuario de la Plataforma)</strong>: responsable (controlador) de los datos de
          sus <em>visitantes y prospectos</em> capturados con sus agentes. En esa relación,{" "}
          <strong>AgentOSweb actúa como encargado/procesador</strong> y tratará esos datos únicamente
          según las instrucciones del cliente (prestar el Servicio).
        </li>
        <li>
          Si sos visitante de una web con nuestro widget, el responsable de tus datos es generalmente el
          dueño de esa web; contactalo para ejercer tus derechos sobre los prospectos.
        </li>
      </ul>

      <h2>2. Qué datos tratamos</h2>
      <h3>Datos de cuenta (usuario del panel)</h3>
      <ul>
        <li>Nombre, email y contraseña (guardada hasheada).</li>
        <li>
          Datos de uso del panel: sesión, IP, dispositivo y última actividad (sesiones activas y seguridad).
        </li>
        <li>
          Configuración de cuenta (plan, consumo, notificaciones, claves API cifradas que el usuario
          provea en modo BYOK).
        </li>
      </ul>
      <h3>Datos del Servicio (del cliente / visitante)</h3>
      <ul>
        <li>
          <strong>Conversaciones:</strong> mensajes del visitante y respuestas del agente, vinculados a un{" "}
          <code>session_id</code> anónimo (cookie de sesión del navegador).
        </li>
        <li>
          <strong>Prospectos:</strong> nombre, email y/o teléfono y mensaje de interés, cuando el visitante
          los deja voluntariamente (formulario o escritos en el chat).
        </li>
        <li>
          <strong>Analíticas agregadas:</strong> sesiones, mensajes, tasas de conversación, heatmap día×
          hora, origen del tráfico (referrer), user-agent y país/IP derivados de Cloudflare.
        </li>
        <li>
          <strong>Contenido del cliente:</strong> prompts, bases de conocimiento y FAQ que el cliente
          configura.
        </li>
      </ul>

      <h2>3. Finalidades y bases jurídicas (RGPD)</h2>
      <table>
        <thead>
          <tr>
            <th>Tratamiento</th>
            <th>Base jurídica</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Prestar el Servicio (chat, panel, API)</td>
            <td>Ejecución de contrato</td>
          </tr>
          <tr>
            <td>Seguridad, prevención de fraude y rate limits</td>
            <td>Interés legítimo</td>
          </tr>
          <tr>
            <td>Facturación y soporte</td>
            <td>Obligación legal / contrato</td>
          </tr>
          <tr>
            <td>Mensajes operativos (aviso de cupo, cambios)</td>
            <td>Interés legítimo / contrato</td>
          </tr>
          <tr>
            <td>Marketing propio y mejora del producto con datos agregados</td>
            <td>Consentimiento (dónde sea exigible)</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Sub-procesadores</h2>
      <p>Para operar la Plataforma usamos proveedores de infraestructura:</p>
      <ul>
        <li>
          <strong>Cloudflare, Inc.</strong> — hosting (Workers, D1, KV), CDN, protección y derivación de
          país/IP. Principal proveedor de infraestructura.
        </li>
        <li>
          <strong>Cloudflare Workers AI</strong> — modelos de IA administrada que generan las respuestas
          cuando el cliente no usa proveedor propio.
        </li>
        <li>
          <strong>Proveedores de IA elegidos por el cliente (BYOK)</strong> — OpenAI, DeepSeek, Groq,
          NVIDIA, Gemini, Mistral, Qwen, OpenRouter y afines. En este caso el cliente contrata
          directamente con ese proveedor y su clave viaja cifrada, usándose solo servidor a servidor.
        </li>
        <li>
          <strong>Notificaciones</strong> — Telegram o webhook propio, si el cliente los configura.
        </li>
      </ul>
      <p>
        Actualizamos esta lista cuando incorporamos sub-procesadores; los clientes serán avisados de
        cambios relevantes conforme al RGPD (art. 28).
      </p>

      <h2>5. Transferencias internacionales</h2>
      <p>
        Los datos se almacenan y procesan en infraestructura de Cloudflare (posible tratamiento fuera de tu
        país, incluido Estados Unidos). Cuando el origen es el Espacio Económico Europeo, aplicamos las
        garantías previstas por el RGPD: cláusulas contractuales tipo (SCC) y medidas suplementarias, o
        decisiones de adecuación vigentes.
      </p>

      <h2>6. Conservación</h2>
      <table>
        <thead>
          <tr>
            <th>Dato</th>
            <th>Conservación</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cuenta</td>
            <td>Mientras la cuenta exista + plazos legales de facturación.</td>
          </tr>
          <tr>
            <td>Conversaciones y prospectos</td>
            <td>Mientras exista el agente/cuenta del cliente; se borran al eliminar la cuenta.</td>
          </tr>
          <tr>
            <td>Analíticas</td>
            <td>Período mostrado en el panel (agregados históricos); sin datos de contacto.</td>
          </tr>
          <tr>
            <td>Logs de seguridad / IP</td>
            <td>Plazo corto operativo (rate limit es en memoria; logs mínimos).</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Importante:</strong> la eliminación de la cuenta es irreversible y elimina agentes,
        conversaciones y prospectos.
      </p>

      <h2>7. Seguridad</h2>
      <ul>
        <li>Contraseñas guardadas con hash (bcrypt) — nunca en texto plano.</li>
        <li>Claves API (BYOK) cifradas en reposo y nunca expuestas al navegador.</li>
        <li>Comunicaciones cifradas (HTTPS/TLS).</li>
        <li>Rate limits, validación de dominios autorizados y control de acceso por sesión/rol.</li>
        <li>Eliminación de cuenta desde el panel con confirmación explícita.</li>
      </ul>

      <h2>8. Derechos de las personas</h2>
      <p>
        Según tu lugar de residencia podés ejercer derechos de <strong>acceso, rectificación,
        supresión, oposición, limitación y portabilidad</strong> (RGPD), <strong>“conocer / eliminar /
        no vender”</strong> (CCPA/CPRA) o equivalentes de la <strong>LGPD</strong> (art. 18):
      </p>
      <ul>
        <li>
          Si sos <strong>visitante</strong>: contactá primero al sitio web que te atendió (es el
          responsable). Podés borrar cookies y datos de sesión en tu navegador.
        </li>
        <li>
          Si sos <strong>usuario del panel</strong>: escribinos a <code>[email de contacto legal]</code>{" "}
          con tu cuenta verificable. Responderemos dentro de los plazos legales (30 días en RGPD).
        </li>
      </ul>
      <div className="doc-note">
        <p>
          <strong>No vendemos datos personales</strong> ni los cedemos para publicidad de terceros.
        </p>
      </div>

      <h2>9. Cookies</h2>
      <p>
        Usamos cookies/necesarias técnicas (sesión, sesión de visitante del widget) y las de preferencias
        del widget (tema). Detalle completo en la <a href="/cookies">Política de Cookies</a>.
      </p>

      <h2>10. Datos de menores</h2>
      <p>
        El Servicio no está dirigido a menores de 16 años y no los tratamos a sabiendas. Si detectamos un
        registro indebido, lo eliminaremos.
      </p>

      <h2>11. Cambios y contacto</h2>
      <p>
        Publicaremos cualquier cambio en esta página con fecha actualizada. Contacto de privacidad:{" "}
        <code>[email de contacto legal]</code>.
      </p>
    </DocsShell>
  );
}
