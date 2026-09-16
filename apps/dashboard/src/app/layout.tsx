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
      <body>
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