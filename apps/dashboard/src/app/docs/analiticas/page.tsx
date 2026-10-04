import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Analiticas - Documentacion - AgentOSweb",
  description:
    "KPIs, actividad diaria, mapa de calor, embudo de conversión y top de preguntas del panel de Analíticas de AgentOSweb.",
};

export default function DocsAnalyticsPage() {
  return (
    <DocsShell
      title="Analíticas"
      lead="Métricas de uso y conversión de tus agentes, con períodos comparables y exportación de datos."
      active="/docs/analiticas"
    >
      <div className="doc-note is-warn">
        <p>
          <strong>Disponibilidad:</strong> la sección Analíticas está incluida{" "}
          <strong>desde el plan Starter</strong>. En Free no aparece en el menú.
        </p>
      </div>

      <h2>Selector de período</h2>
      <p>
        Elegís la ventana arriba a la derecha: <strong>7 días</strong>, <strong>30 días</strong>,{" "}
        <strong>este mes</strong>, <strong>mes pasado</strong> o un rango personalizado. Los KPIs y los
        gráficos se recalculan con ese rango y se comparan con el período anterior (por eso cada tarjeta
        muestra una variación con signo).
      </p>

      <h2>KPIs principales</h2>
      <div className="doc-cards">
        {[
          ["Sesiones", "Visitas únicas al widget en el período (cookie de sesión)."],
          ["Mensajes", "Mensajes de los visitantes (IA + FAQ)."],
          ["Sesiones con IA", "Sesiones donde se usó el modelo de lenguaje."],
          ["Tasa de conversión", "% de sesiones que terminaron en contacto o formulario."],
          ["Promedio por sesión", "Mensajes ÷ sesiones."],
          ["Tiempo de respuesta", "Latencia media de la IA (ms)."],
        ].map(([t, d]) => (
          <span key={t} className="doc-card">
            <span className="doc-card-title">{t}</span>
            <p>{d}</p>
          </span>
        ))}
      </div>
      <p>
        Debajo de los KPIs se muestra una nota de comparación contra el período anterior
        (<em>+12% vs período anterior</em>, o <em>primer período</em> cuando no hay datos previos).
      </p>

      <h2>Actividad diaria</h2>
      <p>
        Gráfico de líneas por día con <strong>sesiones</strong> y <strong>mensajes</strong> en el mismo
        eje, con tooltips por fecha. Si elegiste un rango &gt; 90 días, se agrupa por semana para que el
        gráfico no se sature.
      </p>

      <h2>Mapa de calor (día × hora)</h2>
      <p>
        Matriz 7×24 de <strong>sesiones por hora del día</strong>, de lunes a domingo. Es la mejor forma de
        ver <em>cuándo</em> tu público escribe: publicá avisos de mantenimiento o campañas en las franjas
        frías y priorizá soporte en las cálidas.
      </p>

      <h2>Embudo de conversión</h2>
      <p>Del visitante al cliente, en cuatro pasos:</p>
      <table>
        <thead>
          <tr>
            <th>Paso</th>
            <th>Qué mide</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Sesión iniciada</td>
            <td>Abrió el widget.</td>
          </tr>
          <tr>
            <td>Primer mensaje</td>
            <td>Escribió algo.</td>
          </tr>
          <tr>
            <td>IA respondida</td>
            <td>El modelo contestó.</td>
          </tr>
          <tr>
            <td>Contacto convertido</td>
            <td>Dejó datos (formulario o captura automática).</td>
          </tr>
        </tbody>
      </table>
      <p>
        Cada paso muestra su % sobre el paso anterior y su % sobre el total de sesiones.
      </p>

      <h2>Top de preguntas</h2>
      <p>
        Las consultas más frecuentes de tus visitantes, ordenadas por volumen. Es tu mejor fuente de
        “qué tengo que mejorar en el agente”: si una pregunta se repite y la IA la responde mal,
        convertila en <a href="/docs/agentes">FAQ</a> con la respuesta correcta (y gratis, sin IA).
      </p>

      <h2>Origen del tráfico y subagentes</h2>
      <ul>
        <li>
          <strong>Traffic sources:</strong> de dónde llegan (orgánico, directo, referido, campaña), cuando
          el sitio envía referrer.
        </li>
        <li>
          <strong>Subagentes:</strong> si delegás en sub-agentes anidados, se cuenta cuántas veces se
          delegó a cada uno (0 = no se usan).
        </li>
      </ul>

      <h2>Exportación</h2>
      <p>
        Botón <strong>Exportar CSV</strong>: descarga las filas de la tabla que estés viendo, con los
        headers y el filtro activo.
      </p>

      <div className="doc-note">
        <p>
          <strong>Cómo se cuenta:</strong> cada sesión genera un <code>session_id</code> anónimo (cookie) y
          el widget manda eventos de sesión y de mensajes. No guardamos identidad del visitante salvo que
          <em> él </em> la deje en un prospecto.
        </p>
      </div>
    </DocsShell>
  );
}
