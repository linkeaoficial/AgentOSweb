import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Agentes - Documentacion - AgentOSweb",
  description:
    "Crear y configurar tu agente de IA: identidad, prompt, preguntas frecuentes, base de conocimiento, dominios y motor de IA (administrada o tu API key).",
};

export default function DocsAgentesPage() {
  return (
    <DocsShell
      title="Agentes"
      lead="El editor de tu agente es el corazón del producto. Todo lo que publicás queda listo en menos de un minuto."
      active="/docs/agentes"
    >
      <h2>Crear un agente</h2>
      <p>
        Desde el panel: <strong>Crear agente</strong> (selector de agentes en la barra superior). El agente
        nuevo nace <strong>activo</strong>, en modo <strong>administrado</strong> (IA incluida en tu plan) y
        con una bienvenida personalizada. No se permiten nombres duplicados. El panel te lleva
        automáticamente al editor.
      </p>
      <p>
        El <strong>nombre del cabecero</strong> que ves en el editor es la etiqueta interna (para vos). La
        marca que ve el visitante es el <strong>Título del widget</strong>.
      </p>

      <h2>Identidad y apariencia</h2>
      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Límite</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Título del widget</td>
            <td>120 caracteres</td>
            <td>Lo que lee el visitante en el header y en cada respuesta del bot.</td>
          </tr>
          <tr>
            <td>Subtítulo</td>
            <td>200 caracteres</td>
            <td>Aparece bajo el título en la portada.</td>
          </tr>
          <tr>
            <td>Mensaje de bienvenida</td>
            <td>1000 caracteres</td>
            <td>Recomendado hasta 120. Es el primer mensaje del chat.</td>
          </tr>
          <tr>
            <td>Color principal</td>
            <td>—</td>
            <td>Un color → paleta completa (burbujas, botones, degradados, brillos).</td>
          </tr>
          <tr>
            <td>Posición</td>
            <td>—</td>
            <td>Derecha (default) o izquierda.</td>
          </tr>
          <tr>
            <td>Tema inicial</td>
            <td>—</td>
            <td>Claro, Oscuro o Auto (sigue el sistema del visitante).</td>
          </tr>
          <tr>
            <td>URL del avatar</td>
            <td>—</td>
            <td>Vacío = logo de AgentOSweb por defecto.</td>
          </tr>
          <tr>
            <td>Logo de la burbuja</td>
            <td>—</td>
            <td>
              <strong>Solo plan Agency</strong> (marca blanca).
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Personalidad (prompt)</h2>
      <p>
        El prompt de sistema define el tono, rol y límites de tu asistente (hasta 10.000 caracteres). Si lo
        dejás vacío, el worker usa automáticamente un tono neutro y amable basado en el título del widget.
        Consejo: definí rol, tono, idioma y qué <em>no</em> debe responder.
      </p>

      <h2>Base de conocimiento</h2>
      <p>
        Un text area de hasta <strong>20.000 caracteres</strong> con la info de tu negocio (productos,
        precios, horarios, políticas). <strong>No se usa búsqueda vectorial:</strong> el contenido se inyecta
        en cada petición como contexto para el modelo. Es simple y predecible — usá texto bien organizado y
        actualizado.
      </p>

      <h2>Preguntas frecuentes</h2>
      <p>
        Hasta <strong>50 preguntas</strong> (label 120 car., respuesta 5000 car.). Se responden
        automáticamente <strong>sin gastar IA y sin consumir tu cupo</strong>. El emparejador es tolerante:
      </p>
      <ul>
        <li>
          FAQ de <strong>1–3 keywords</strong>: matcheo exacto (evita falsos positivos).
        </li>
        <li>
          FAQ de <strong>4+ keywords</strong>: puede fallar una keyword y aun así matchear (la gente no
          repite frases).
        </li>
        <li>
          Si el matcheo literal no encuentra nada, intenta uno <strong>semántico</strong> con embeddings
          (sinónimos y paráfrasis): responde si la similitud es ≥ 0.72 y gana por margen; si dos quedan casi
          empatadas, cae a la IA.
        </li>
      </ul>
      <div className="doc-note">
        <p>
          Las FAQs no consumen cupo ni tokens: si tu mensaje matchea una FAQ, se responde sin tocar la IA.
        </p>
      </div>

      <h2>Motor de IA: administrada vs tu API key</h2>
      <h3>Administrada (sin key)</h3>
      <p>
        Modelos de Cloudflare Workers AI incluidos en tu plan — <strong>consumen los mensajes del cupo
        mensual</strong>. Modelos disponibles:
      </p>
      <ul>
        <li>
          <strong>Llama 3.1 8B Flash</strong> (<code>@cf/meta/llama-3.1-8b-instruct-fast</code>) — rápido y
          económico. Por defecto.
        </li>
        <li>
          <strong>Llama 3.3 70B FP8</strong> (<code>@cf/meta/llama-3.3-70b-instruct-fp8-fast</code>) — mayor
          calidad.
        </li>
      </ul>
      <h3>Tu API Key (BYOK)</h3>
      <p>
        Pagás la IA directo al proveedor y <strong>no consumís el cupo mensual</strong> de tu plan.
        Disponible <strong>desde el plan Starter</strong>. La clave se guarda cifrada en el agente y{" "}
        <strong>nunca se devuelve al navegador</strong>; se usa solo servidor a servidor.
      </p>
      <p>Proveedores del catálogo (en orden):</p>
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Modelos</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>DeepSeek</td>
            <td>1</td>
            <td>—</td>
          </tr>
          <tr>
            <td>OpenAI</td>
            <td>7</td>
            <td>GPT-5.5 → GPT-4o mini</td>
          </tr>
          <tr>
            <td>Groq</td>
            <td>7</td>
            <td>6 gratuitos (Llama 3.3/3.1, GPT-OSS, Llama 4)</td>
          </tr>
          <tr>
            <td>NVIDIA NIM</td>
            <td>11</td>
            <td>Todos con tier gratuito</td>
          </tr>
          <tr>
            <td>Gemini</td>
            <td>7</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Mistral</td>
            <td>5</td>
            <td>4 gratuitos</td>
          </tr>
          <tr>
            <td>Qwen</td>
            <td>9</td>
            <td>—</td>
          </tr>
          <tr>
            <td>OpenRouter</td>
            <td>41</td>
            <td>11 con sufijo <code>:free</code></td>
          </tr>
          <tr>
            <td>OnniRouter</td>
            <td>23</td>
            <td>Agregador de pago por token</td>
          </tr>
          <tr>
            <td>UnoRouter</td>
            <td>18</td>
            <td>7 <code>:free</code> con 1M de contexto</td>
          </tr>
          <tr>
            <td>Cerebras</td>
            <td>2</td>
            <td>Solo pago (tier gratis discontinuado)</td>
          </tr>
          <tr>
            <td>Otro (URL personalizada)</td>
            <td>—</td>
            <td>Endpoint compatible con Chat Completions de OpenAI</td>
          </tr>
        </tbody>
      </table>
      <div className="doc-note is-warn">
        <p>
          Si estás en modo Administrada con una key guardada, la key <strong>queda guardada pero
          inactiva</strong> hasta que vuelvas a BYOK. En plan Free, BYOK está bloqueado (el agente se
          atiende como administrado).
        </p>
      </div>

      <h2>Configuración avanzada</h2>
      <ul>
        <li>
          <strong>Máximo de tokens por respuesta:</strong> 1–5000. Menos tokens = respuestas más cortas y
          económicas.
        </li>
        <li>
          <strong>Mensajes por minuto:</strong> 1–120 (rate limit por visitante; default 20).
        </li>
        <li>
          <strong>Dominios autorizados:</strong> lista separada por comas (<code>mistienda.com,
          blog.mistienda.com</code>) o <code>*</code> para cualquier sitio. Fuera de la lista →{" "}
          <code>403</code>.
        </li>
        <li>
          <strong>Agente activo:</strong> al pausar, el widget deja de responder al instante (muestra
          “pausa”). Ojo: los cambios se cachean hasta 60 s.
        </li>
        <li>
          <strong>Capturar prospectos:</strong> activa la extracción automática de contactos y el formulario
          embebido. Campos disponibles: Nombre, Email, Teléfono. No hace falta escribir nada en el prompt —
          la detección es automática.
        </li>
      </ul>

      <h2>Vista previa y publicación</h2>
      <p>
        El editor trae una <strong>vista previa en vivo</strong> (probá tu agente sin guardar) y un chat de
        prueba. Al publicar: botón <strong>Publicar cambios</strong> → el widget se actualiza en{" "}
        <strong>menos de 1 minuto</strong>. Cambiar de modo (administrada/BYOK) no borra tu key guardada.
      </p>
      <p>
        <strong>Eliminar agente:</strong> pide confirmación escribiendo el nombre exacto. Borra el agente y
        sus conversaciones, prospectos y FAQs; el script de instalación deja de funcionar. No se puede
        eliminar el último agente.
      </p>
    </DocsShell>
  );
}
