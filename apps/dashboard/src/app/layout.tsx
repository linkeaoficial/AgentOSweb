import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentOSweb - Panel de Control",
  description: "Panel administrativo de AgentOSweb: gestiona tus agentes de IA, prospectos y analíticas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      {/* suppressHydrationWarning: el script antibrillo de abajo mete dark-mode en
          el body antes de que hidrate, y el servidor no puede saberlo, asi que
          React siempre marca diferencia. Es el caso exacto para este atributo:
          silencia el aviso esperado, no oculta desajustes reales. */}
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{if(localStorage.getItem("agentosweb-dashboard-theme")==="dark"){document.body.classList.add("dark-mode");}}catch(e){}})();',
          }}
        />
        {children}
      </body>
    </html>
  );
}