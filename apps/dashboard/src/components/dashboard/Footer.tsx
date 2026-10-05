export default function DashboardFooter({
  planLabel,
  agentsLabel,
  onSupport,
}: {
  planLabel: string;
  agentsLabel: string;
  onSupport: () => void;
}) {
  return (
    <footer className="dashboard-footer">
      <div className="footer-left">
        <span className="footer-plan">
          Plan <strong>{planLabel}</strong> · {agentsLabel}
        </span>
        <span className="footer-separator">•</span>
        <span>
          &copy; <span id="current-year">{new Date().getFullYear()}</span> <strong>AgentOSweb</strong>. Todos los derechos reservados.
        </span>
      </div>
      <div className="footer-right">
        <a href="/terminos" className="footer-link">Términos de Servicio</a>
        <span className="footer-separator">•</span>
        <a href="/privacidad" className="footer-link">Privacidad</a>
        <span className="footer-separator">•</span>
        <a href="/cookies" className="footer-link">Cookies</a>
        <span className="footer-separator">•</span>
        <a href="/docs" className="footer-link">Documentación</a>
        <span className="footer-separator">•</span>
        {/* Boton y no <a href="#soporte">: el modal vive en Dashboard y el pie no
            esta dentro del arbol que lo maneja, asi que un link directo no
            tendria como abrirlo. */}
        <button type="button" className="footer-link" onClick={onSupport}>
          Soporte
        </button>
      </div>
    </footer>
  );
}