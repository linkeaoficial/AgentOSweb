import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Politica de Cookies - AgentOSweb",
  description:
    "Cookies y tecnologias similares que usa AgentOSweb: sesiones, preferencias del widget y analiticas.",
};

export default function CookiesPage() {
  return (
    <DocsShell
      title="Política de Cookies"
      lead="Qué cookies usamos en el panel y en el widget, con qué finalidad y cómo controlarlas desde tu navegador."
      active="/cookies"
    >
      <div className="doc-note is-warn">
        <p>
          <strong>Última actualización:</strong> 4 de octubre de 2026. Operador:{" "}
          <strong>Alvaro Bastardo</strong> (Cariaco, estado Sucre, Venezuela) ·{" "}
          <code>[email de contacto legal]</code> (a crear antes del lanzamiento). Pendiente de revisión
          legal antes de entrar en vigencia.
        </p>
      </div>

      <h2>1. Qué son las cookies</h2>
      <p>
        Las cookies (y tecnologías similares como el almacenamiento local) son pequeños archivos que el
        navegador guarda en tu dispositivo para recordar información entre visitas: tu sesión, tus
        preferencias o un identificador de visita.
      </p>

      <h2>2. Cookies que usamos</h2>
      <table>
        <thead>
          <tr>
            <th>Cookie / clave</th>
            <th>Ámbito</th>
            <th>Finalidad</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>agentosweb_session</code>
            </td>
            <td>Panel (agentosweb.com)</td>
            <td>Mantener tu sesión iniciada y autenticar las peticiones del panel.</td>
            <td>Sesión (caduca al cerrar sesión o expirar)</td>
          </tr>
          <tr>
            <td>
              <code>session_id</code> (cookie de sesión del widget)
            </td>
            <td>Sitios con el widget</td>
            <td>
              Identificar al visitante de forma anónima para continuar la conversación, limitar el rate
              limit y contar sesiones/mensajes en analíticas.
            </td>
            <td>Sesión</td>
          </tr>
          <tr>
            <td>
              <code>aos_theme</code>
            </td>
            <td>Sitios con el widget</td>
            <td>Recordar la preferencia claro/oscuro del visitante (solo si la cambia).</td>
            <td>Persistente</td>
          </tr>
        </tbody>
      </table>
      <div className="doc-note">
        <p>
          <strong>No usamos cookies de publicidad ni de terceros para rastrearte</strong> en otros sitios,
          ni cookies de perfilado comercial. Los datos de analíticas se agregan sin vincularlos a tu
          identidad salvo que tú dejes tus datos en un formulario.
        </p>
      </div>

      <h2>3. Cookies de terceros</h2>
      <ul>
        <li>
          La infraestructura corre en <strong>Cloudflare</strong>: este proveedor puede establecer
          cookies/técnicas de seguridad y balanceo (por ejemplo, identificadores de protección DDoS o{" "}
          <code>__cf_bm</code>) bajo su propia política.
        </li>
        <li>
          Si usás un <strong>proveedor de IA con tu propia clave (BYOK)</strong>, ese proveedor ve solo los
          mensajes enviados al modelo, no cookies en tu navegador.
        </li>
      </ul>

      <h2>4. Cómo controlar las cookies</h2>
      <p>Tenés control total desde tu navegador:</p>
      <ul>
        <li>
          <strong>Chrome / Edge / Brave:</strong> Configuración → Privacidad y seguridad → Cookies y otros
          datos de sitios.
        </li>
        <li>
          <strong>Firefox:</strong> Ajustes → Privacidad y seguridad → Cookies y datos del sitio.
        </li>
        <li>
          <strong>Safari:</strong> Preferencias → Privacidad → Gestionar datos de sitios web.
        </li>
        <li>
          <strong>Móvil:</strong> ajustes del navegador o del sistema → privacidad.
        </li>
      </ul>
      <p>
        Podés borrar las cookies existentes o bloquearlas. <strong>Si bloqueás las cookies técnicas, el
        widget no podrá mantener la conversación y tu sesión del panel podría no persistir.</strong>
      </p>

      <h2>5. “Do Not Track” y señales de privacidad</h2>
      <p>
        Respetamos las señales de privacidad del navegador en la medida en que sea técnicamente aplicable
        (por ejemplo, no vendemos datos y no profilamos para publicidad). Para más detalle, ver la{" "}
        <a href="/privacidad">Política de Privacidad</a>.
      </p>

      <h2>6. Cambios y contacto</h2>
      <p>
        Si cambiamos las cookies que usamos, actualizaremos esta política con su fecha. Contacto:{" "}
        <code>[email de contacto legal]</code>.
      </p>
    </DocsShell>
  );
}
