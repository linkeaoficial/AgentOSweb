import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Terminos de Servicio - AgentOSweb",
  description:
    "Terminos y condiciones de uso de la plataforma AgentOSweb: cuentas, planes, contenido, responsabilidades y legislacion aplicable.",
};

export default function TermsPage() {
  return (
    <DocsShell
      title="Términos de Servicio"
      lead="Estos términos regulan el uso de la plataforma AgentOSweb. Al crear una cuenta aceptás estas condiciones."
      active="/terminos"
    >
      <div className="doc-note is-warn">
        <p>
          <strong>Última actualización:</strong> 4 de octubre de 2026. Este documento es un borrador
          pendiente de <strong>revisión legal profesional</strong> antes de su entrada en vigencia. No
          constituye asesoramiento jurídico. El identificador del operador está pendiente de confirmar:{" "}
          <code>[Nombre del Operador]</code> (<code>[País de constitución]</code>), contacto:{" "}
          <code>[email de contacto legal]</code>.
        </p>
      </div>

      <h2>1. Identificación del operador</h2>
      <p>
        La plataforma AgentOSweb (en adelante, “la Plataforma”, “nosotros”) es operada por{" "}
        <code>[Nombre del Operador]</code>, con domicilio en <code>[País / ciudad]</code> y contacto en{" "}
        <code>[email de contacto legal]</code>. “Usuario” o “vos” es cualquier persona que se registra o
        utiliza la Plataforma.
      </p>

      <h2>2. Objeto</h2>
      <p>
        La Plataforma ofrece herramientas para crear, alojar y publicar agentes de conversación basados en
        inteligencia artificial en sitios web de terceros (el “Servicio”), incluyendo: widget embebible,
        panel de administración, captura de prospectos, analíticas y acceso a una API pública.
      </p>

      <h2>3. Cuenta y elegibilidad</h2>
      <ul>
        <li>Debés ser mayor de edad y tener capacidad legal para contratar.</li>
        <li>
          La cuenta es personal e intransferible. Sos responsable de mantener la confidencialidad de tus
          credenciales y de toda actividad realizada desde tu cuenta.
        </li>
        <li>
          Debés proporcionar información veraz y mantenerla actualizada. Podemos suspender cuentas con
          datos falsos o fraudulentos.
        </li>
        <li>
          Los roles “cliente” y “administrador” otorgan distintos niveles de acceso; el acceso administrador
          se asigna internamente y no es solicitable por el público general.
        </li>
      </ul>

      <h2>4. Planes, precios y facturación</h2>
      <ul>
        <li>
          La Plataforma opera con planes Free y de pago (Starter, Pro, Agency) con límites de agentes y de
          mensajes de IA por mes calendario, publicados en el panel.
        </li>
        <li>
          Los precios se expresan en dólares (US$) y pueden modificarse con aviso razonable; los cambios
          se aplican al siguiente ciclo de facturación.
        </li>
        <li>
          Las altas de plan se coordinan por el canal de soporte habilitado en el panel. No se almacenan
          datos de tarjetas en la Plataforma.
        </li>
        <li>
          Al vencer un plan de pago, la cuenta pasa al plan Free. Los datos del usuario (agentes,
          contactos, configuración) se conservan, salvo que el usuario elimine su cuenta.
        </li>
        <li>
          Salvo obligación legal, los montos pagados no son reembolsables; las facturas se emiten según la
          normativa aplicable al país del usuario.
        </li>
      </ul>

      <h2>5. Uso aceptable</h2>
      <p>Te comprometés a no utilizar la Plataforma para:</p>
      <ul>
        <li>Actividades ilegales, fraudulentas o que violen derechos de terceros.</li>
        <li>
          Generar contenido engañoso, suplantación de identidad (phishing), spam o acoso.
        </li>
        <li>
          Recopilar datos personales de visitantes sin una base legal válida (ver{" "}
          <a href="/privacidad">Política de Privacidad</a>).
        </li>
        <li>
          Intentar vulnerar, hacer ingeniería inversa o sobrecargar la infraestructura (incluidos rate
          limits y límites de cupo).
        </li>
        <li>Revender el Servicio o reutilizarlo para ofrecer un servicio competitivo.</li>
      </ul>

      <h2>6. Contenido del usuario</h2>
      <ul>
        <li>
          Sos el responsable de tus prompts, bases de conocimiento, FAQ, agentes y de los datos de
          prospectos que captures.
        </li>
        <li>
          Nos otorgás la licencia técnica mínima para alojar, reproducir y transmitir ese contenido
          exclusivamente para prestarte el Servicio.
        </li>
        <li>
          Garantizás que tenés derecho a cargar ese contenido y que no infringe derechos de terceros ni
          estas condiciones.
        </li>
      </ul>

      <h2>7. Servicios de IA y responsabilidad sobre las respuestas</h2>
      <div className="doc-note is-danger">
        <p>
          <strong>Las respuestas de los agentes son generadas automáticamente por modelos de inteligencia
          artificial</strong> (propios o de terceros, incluida Cloudflare Workers AI, o proveedores elegidos
          por el usuario). Pueden ser imprecisas u obsoletas. La información no constituye asesoramiento
          profesional (médico, legal, financiero). <strong>El usuario es responsable de supervisar los
          agentes que publica</strong> y de las decisiones que tome en base a sus respuestas.
        </p>
      </div>

      <h2>8. Disponibilidad</h2>
      <ul>
        <li>
          Prestamos el Servicio con diligencia razonable, sin garantizar disponibilidad ininterrumpida.
        </li>
        <li>
          Podemos realizar mantenimiento, interrupciones breves o cambios, avisando cuando sea razonable
          hacerlo.
        </li>
        <li>
          No respondemos por interrupciones causadas por proveedores de infraestructura (p. ej.
          Cloudflare) fuera de nuestro control razonable.
        </li>
      </ul>

      <h2>9. Propiedad intelectual</h2>
      <ul>
        <li>
          La Plataforma (código, diseño, marca, documentación) es de nuestra propiedad o de nuestros
          licenciantes.
        </li>
        <li>
          Al usuario se le concede una licencia limitada, no exclusiva e intransferible para usar la
          Plataforma conforme a estos términos.
        </li>
        <li>Las sugerencias de mejora pueden usarse para mejorar el Servicio sin obligación de pago.</li>
      </ul>

      <h2>10. Limitación de responsabilidad</h2>
      <div className="doc-note is-danger">
        <p>
          En la máxima medida permitida por la ley aplicable, no seremos responsables por daños
          indirectos, lucro cesante, pérdida de datos o beneficios, ni por fallos derivados del contenido
          del usuario, de proveedores de IA de terceros, del uso indebido de los agentes o de la falta de
          supervisión. Nuestra responsabilidad total se limita a los importes efectivamente pagados por el
          usuario en los 12 meses anteriores al hecho que lo origine, o al monto mínimo que la ley
          imperativa no permita excluir.
        </p>
      </div>

      <h2>11. Suspensión y terminación</h2>
      <ul>
        <li>
          Podemos suspender o terminar cuentas que violen estos términos, previo aviso cuando sea posible,
          sin perjuicio de las acciones legales pertinentes.
        </li>
        <li>
          El usuario puede eliminar su cuenta en cualquier momento desde <em>Configuración → Zona de
          peligro</em>; la eliminación es definitiva e irreversible.
        </li>
      </ul>

      <h2>12. Legislación aplicable y resolución de disputas</h2>
      <p>
        Estos términos se rigen por la legislación de <code>[País del operador]</code>, sin perjuicio de
        los derechos irrenunciables que los consumidores tengan en su país de residencia (incluidos los
        consumidores de la Unión Europea, Reino Unido, Argentina, Brasil o Estados Unidos, según
        corresponda). Las controversias se someterán a los tribunales competentes de{" "}
        <code>[jurisdicción]</code>, salvo fuero imperativo distinto.
      </p>

      <h2>13. Cambios en los términos</h2>
      <p>
        Podemos actualizar estos términos; la fecha de actualización se indica al inicio. Los cambios
        sustanciales se notificarán por la Plataforma o por email con antelación razonable. El uso
        continuado tras la vigencia implica aceptación.
      </p>

      <h2>14. Contacto</h2>
      <p>
        Consultas sobre estos términos: <code>[email de contacto legal]</code> o por el canal de soporte
        del panel.
      </p>
    </DocsShell>
  );
}
