export const metadata = { title: "Previsualización del Widget" };

export default function PreviewPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f7f9fc",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 20,
          padding: "40px 48px",
          maxWidth: 560,
          textAlign: "center",
        }}
      >
        <h1 style={{ marginTop: 0 }}>AgentOSweb</h1>
        <p>Vista previa del widget embebible en un entorno React/Next.js local.</p>
        <p style={{ fontSize: 13 }}>
          Abre el widget flotante abajo a la derecha. Chat con IA real 24/7.
        </p>
      </div>
      {/* widget.js se sirve desde apps/dashboard/public (copiado por el build del widget) */}
      <script
        src="/widget.js"
        data-agent-id="agent-demo"
        data-api-url="https://agentosweb-api.linkeaoficial2025.workers.dev/api"
        defer
      />
    </main>
  );
}