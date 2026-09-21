export interface AgentConfig {
  header_title: string;
  header_subtitle: string;
  welcome_message: string;
  avatar_url: string | null;
  bubble_logo_url: string | null;
  primary_color: string;
  prompts: { label: string; msg: string }[];
  position?: string;
  default_theme?: string;
}

export const DEFAULT_CONFIG: AgentConfig = {
  header_title: "AgentOSweb",
  header_subtitle: "Asistente IA • En línea 24/7",
  welcome_message:
    "Soy el asistente virtual de AgentOSweb. ¿En qué te puedo colaborar hoy?",
  avatar_url: null,
  bubble_logo_url: null,
  primary_color: "#3559ff",
  prompts: [
    { label: "¿Cómo instalar AgentOSweb en mi web?", msg: "¿Cómo instalar AgentOSweb en mi web?" },
    { label: "¿Qué es el modelo BYOK (Bring Your Own Key)?", msg: "¿Qué es el modelo BYOK (Bring Your Own Key)?" },
    { label: "¿Cuáles son los planes y precios disponibles?", msg: "¿Cuáles son los planes y precios disponibles?" },
  ],
};

export function localReply(message: string, cfg: AgentConfig = DEFAULT_CONFIG): string {
  const m = message.toLowerCase();
  if (/(instal|script|mi web)/.test(m)) {
    return "⚡️ Para instalar AgentOSweb solo debes pegar una sola línea de código <script> antes del cierre de tu etiqueta </body>. Tu asistente quedará en línea 24/7 al instante.";
  }
  if (m.includes("byok")) {
    return "🔑 BYOK (Bring Your Own Key) te permite usar tu propia API Key de Groq u OpenAI para pagar centavos directamente al proveedor, sin sobrecostos ni límite de mensajes.";
  }
  if (/(plans?|precio|cu[aá]nto cuesta|plan free|gratis)/.test(m)) {
    return "💰 Planes (el plan se paga siempre): Free $0/mes (1 chatbot, 20 msgs/mes de IA administrada) · Starter $39/mes con IA administrada (1 chatbot, 1.500 msgs) o $19/mes BYOK sin límite · Pro $89/mes administrada (3 chatbots, 6.000 msgs) o $49/mes BYOK sin límite, sin marca de agua · Agency $249/mes administrada (10 chatbots, 25.000 msgs) o $149/mes BYOK sin límite, con marca blanca. Con BYOK no hay límite de mensajes: tu propia API Key paga tu IA directo al proveedor.";
  }
  return `El asistente de ${cfg.header_title} tiene problemas de conexión en este momento. Por favor intenta de nuevo en unos segundos.`;
}