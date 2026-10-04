export default function DashboardFooter({ planLabel, agentsLabel }: { planLabel: string; agentsLabel: string }) {
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
        <a href="#soporte" className="footer-link">Soporte</a>
      </div>
    </footer>
  );
}