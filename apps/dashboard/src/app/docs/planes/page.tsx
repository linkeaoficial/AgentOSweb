import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Planes y cuenta - Documentacion - AgentOSweb",
  description:
    "Planes Free, Starter, Pro y Agency de AgentOSweb: límites, precios, IA administrada vs tu propia API key, roles y facturación.",
};

const PLANES = [
  ["Free", "US$ 0", "1 agente · 20 mensajes/mes", "Probar el producto sin tarjeta. IA administrada incluida (Llama 3.1 8B)."],
  ["Starter", "US$ 19/mes", "1 agente · 1.500 mensajes/mes", "Primer plan de producción: activás Analíticas y tu propia API key (BYOK)."],
  ["Pro", "US$ 49/mes", "3 agentes · 6.000 mensajes/mes", "Para agencias chicas o varios proyectos en paralelo."],
  ["Agency", "US$ 149/mes", "10 agentes · 25.000 mensajes/mes", "Marca blanca (logo en la burbuja) y cupos altos."],
];

export default function DocsPlansPage() {
  return (
    <DocsShell
      title="Planes y cuenta"
      lead="Cuatro planes con límites claros. Podés cambiar de plan cuando quieras; el consumo se mide por mes calendario."
      active="/docs/planes"
    >
      <h2>Comparativa de planes</h2>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Precio</th>
            <th>Límites</th>
            <th>Enfoque</th>
          </tr>
        </thead>
        <tbody>
          {PLANES.map((p) => (
            <tr key={p[0]}>
              <td>
                <strong>{p[0]}</strong>
              </td>
              <td>{p[1]}</td>
              <td>{p[2]}</td>
              <td>{p[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="doc-note">
        <p>
          Los cupos incluyen <strong>mensajes de IA administrada</strong>. Las preguntas frecuentes
          respondidas por matcheo <strong>no consumen</strong> el cupo. Si usás tu propia API key (BYOK),
          tampoco consumen el cupo.
        </p>
      </div>

      <h2>IA administrada vs tu propia API key</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>IA administrada</th>
            <th>Tu API key (BYOK)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Setup</td>
            <td>Cero configuración</td>
            <td>Colgás tu clave (cifrada)</td>
          </tr>
          <tr>
            <td>Costo IA</td>
            <td>Incluido en el plan</td>
            <td>Lo pagás directo al proveedor</td>
          </tr>
          <tr>
            <td>Cupo mensual</td>
            <td>Se consume con cada respuesta</td>
            <td>No se consume</td>
          </tr>
          <tr>
            <td>Disponible en</td>
            <td>Todos los planes</td>
            <td>Starter en adelante</td>
          </tr>
        </tbody>
      </table>
      <p>
        La clave se guarda cifrada en el servidor y <strong>nunca se devuelve al navegador</strong>. En
        modo administrada, la clave queda guardada pero inactiva hasta que vuelvas a BYOK.
      </p>

      <h2>Panel de Planes &amp; Facturación</h2>
      <ul>
        <li>
          <strong>Tu plan actual</strong> con badge de estado y fecha de vencimiento.
        </li>
        <li>
          <strong>Consumo vs cupo</strong> con barra de progreso y fecha de reinicio del ciclo.
        </li>
        <li>
          <strong>Renovación:</strong> si el plan vence, el agente pasa a Free (no se borran datos); los
          contactos y configuraciones quedan intactos.
        </li>
        <li>
          <strong>Historial de facturación</strong> con descarga.
        </li>
      </ul>
      <div className="doc-note is-warn">
        <p>
          <strong>Facturación manual:</strong> por el momento los upgrades se coordinan por WhatsApp
          desde la sección de Planes. No se guarda tarjeta en la plataforma.
        </p>
      </div>

      <h2>Roles y cuentas</h2>
      <table>
        <thead>
          <tr>
            <th>Rol</th>
            <th>Puede</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cliente</td>
            <td>Ver solo su cuenta, sus agentes y sus datos.</td>
          </tr>
          <tr>
            <td>Admin</td>
            <td>Ver clientes, usuarios y métricas globales (sección Clientes, admin-only).</td>
          </tr>
        </tbody>
      </table>

      <h2>Seguridad de la cuenta</h2>
      <ul>
        <li>
          Cambio de contraseña con validación de fuerza y cierre de las demás sesiones.
        </li>
        <li>
          <strong>Sesiones activas</strong> con dispositivo, IP y última actividad; opción de cerrar todo
          o por sesión.
        </li>
        <li>
          <strong>Eliminar cuenta</strong> (zona de peligro): elimina la cuenta, agentes, conversaciones y
          prospectos — sin posibilidad de recuperación.
        </li>
      </ul>
    </DocsShell>
  );
}
