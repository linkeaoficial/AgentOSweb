# 🚀 PLANIFICACIÓN INTEGRAL & BLUEPRINT TÉCNICO V2.3: AgentOSweb 🌐🤖
*Dominio Oficial:* `agentosweb.com` | *Arquitectura:* 100% Serverless Edge (Cloudflare Stack) + Dashboard en Next.js

---

## 📑 TABLA DE CONTENIDOS 🧭
1. 🎯 [Definición del Producto y Filosofía Lean](#1--definición-del-producto-y-filosofía-lean)
2. 🏷️ [Identidad de Marca y Posicionamiento](#2-️-identidad-de-marca-y-posicionamiento)
3. 🏗️ [Arquitectura 100% Cloudflare & Capas de Seguridad](#3-️-arquitectura-100-cloudflare--capas-de-seguridad)
4. 🗄️ [Esquema de Base de Datos Cloudflare D1 Optimizado](#4-️-esquema-de-base-de-datos-cloudflare-d1-optimizado)
5. 📂 [Estructura del Proyecto (Monorepo Limpio)](#5--estructura-del-proyecto-monorepo-limpio)
6. 💬 [Diseño y Anatomía del Widget (Dual-View UI)](#6--diseño-y-anatomía-del-widget-dual-view-ui)
7. 🧠 [Lógica del Backend, Resiliencia y Webhooks](#7--lógica-del-backend-resiliencia-y-webhooks)
8. 🎨 [Panel de Control en Next.js & Tailwind CSS v4](#8--panel-de-control-en-nextjs--tailwind-css-v4)
9. 💰 [Estrategia de Monetización & Planes SaaS](#9--estrategia-de-monetización--planes-saas)
10. 🗺️ [Roadmap de Ejecución Rápida (4 Semanas)](#10-️-roadmap-de-ejecución-rápida-4-semanas)
11. 🤖 [Prompt Maestro de Ingeniería](#11--prompt-maestro-de-ingeniería)

---

## 1. 🎯 DEFINICIÓN DEL PRODUCTO Y FILOSOFÍA LEAN

### ¿Qué es AgentOSweb exactamente? 🤖💡
**AgentOSweb** es una **Plataforma SaaS No-Code de Construcción de Agentes de IA y Widgets Embebibles para Sitios Web** (*AI Agent Builder & Embeddable Chat Widget*). 

Permite a cualquier negocio transformar su atención web en menos de 2 minutos instalando una sola línea de código `<script>`, implementando un asistente con IA generativa capaz de resolver dudas de clientes, cotizar productos y capturar prospectos (*leads*) 24/7 sin intervención de personal humano.

### 🚫 Pilares de la Filosofía Lean (MVP de Alto Margen):
1. ⚡️ **Cero RAG Pesado / Cero Embeddings Costosos:** Sin bases vectoriales externas; el contexto del negocio se gestiona mediante un **Scratchpad de Conocimiento Directo** inyectado en el *System Prompt* y cacheado en Cloudflare KV (<10 ms).
2. 🗄️ **Cero Dependencias Externas:** Eliminadas las latencias y sobrecostos de servicios externos; todo se ejecuta nativamente en **Cloudflare D1**.
3. ☁️ **Cero Servidores / VPS:** Cómputo serverless en el borde (*Edge*) con **Cloudflare Workers** y modelos ultrarrápidos vía **Groq API** (Llama 3.3) y OpenAI (GPT-4o Mini).
4. 🔄 **Dual-View UX Fluido:** Navegación dividida entre una **Portada de Inicio (Home)** con preguntas interactivas y una **Ventana de Chat** con transición animada deslizante.
5. ⚛️ **Dashboard de Nueva Generación:** Frontend administrativo construido con **Next.js 15 (App Router), React 19 y Tailwind CSS v4**, garantizando carga instantánea en Cloudflare Pages.

---

## 2. 🏷️ IDENTIDAD DE MARCA Y POSICIONAMIENTO

* 📛 **Nombre Oficial:** **AgentOSweb** 🤖✨
* 🌐 **Dominio:** `agentosweb.com`
* 🎯 **Propuesta de Valor:** *"Convierte a los visitantes de tu sitio web en clientes fieles con un agente de IA ultra rápido instalado en 2 minutos."* ⚡️📈

### 🎨 Paleta de Colores & Diseño

#### ☀️ Modo Claro (Lienzo Blanco)
| Token | Valor | Uso |
| :--- | :---: | :--- |
| 🔵 **Azul Primario** | `#3559ff` | Marca / Botón / Usuario |
| 🌊 **Cian Glow** | `#13a0ff` | Acento secundario / Hover |
| ☁️ **Gris Nube (Bot)** | `#f1f5f9` | Burbuja del bot |
| ⚪️ **Borde Suave** | `#e2e8f0` | Bordes y separadores |
| ⚪️ **Lienzo Fondo** | `#ffffff` / `#f8fafc` | Body y superficies |
| 📝 **Texto Principal** | `#0f172a` | Textos y títulos |
| 📝 **Texto Muted** | `#64748b` | Subtítulos y placeholders |

#### 🌙 Modo Oscuro (Grafito Profundo)
| Token | Valor | Uso |
| :--- | :---: | :--- |
| 🔵 **Azul Primario (dark)** | `#3559ff` | Marca / Botón / Usuario (mismo azul que claro) |
| 🌊 **Cian Glow (dark)** | `#13a0ff` | Acento secundario / Hover (mismo cian que claro) |
| 🌑 **Fondo Body** | `#0f172a` | Fondo profundo (slate-900) |
| 🎴 **Superficie/Chat** | `#1c2128` | Contenedor principal del widget |
| 🧭 **Sidebar/Topbar** | `#1c2128` | Barra lateral y superior |
| 🧩 **Inputs/Burbujas** | `#1e293b` | Inputs y burbujas del bot |
| ➖ **Bordes** | `#333942` | Bordes y separadores |
| 📝 **Texto Principal** | `#cdd9e5` | Textos y títulos |
| 📝 **Texto Muted** | `#909dab` | Subtítulos y placeholders |

#### 🎬 Animaciones & Efectos
* ✨ **Botón Hero CTA:** Estilo cápsula con haz de luz diagonal (*shimmer*) y micro-presión táctil.
* 🌈 **Glassmorphic 3D (opcional):** Bisel especular superior + blur de difracción para iconos premium.
* 💫 **Scrollbar custom:** Gradiente azulado con glow en hover (dark mode).
* 🎭 **Micro-interacciones:** `translateY(-2px)` y escala `1.05` en hover de tarjetas.

---

## 3. 🏗️ ARQUITECTURA 100% CLOUDFLARE & CAPAS DE SEGURIDAD

```text
[ Visitante en Web Cliente ]
             │
             ▼  (Carga <script src="[https://agentosweb.com/widget.js](https://agentosweb.com/widget.js)" data-agent-id="UUID"></script>)
   [ Widget Shadow DOM ] ───► UI aislada (Avatar animado, portada FAQ, chat elástico)
             │
             ▼  (POST /api/chat con Origin/Referer)
 [ Cloudflare Workers API ]
             │
             ├─── 1. Validación CORS & allowed_domains (Bloqueo de dominios no autorizados)
             ├─── 2. Cache KV (System Prompt + Knowledge Base cargados en <10ms)
             ├─── 3. Motor IA (Inferencia en Groq Llama 3.3 / OpenAI)
             ├─── 4. Pacing Orgánico (Garantía de 1.000 ms con typing-indicator)
             ├─── 5. ctx.waitUntil() ──┬──► Escritura no bloqueante en D1
                                       └──► Disparo de Webhook (Telegram / WhatsApp)
```

---

## 4. 🗄️ ESQUEMA DE BASE DE DATOS CLOUDFLARE D1 OPTIMIZADO

*Archivo: `database/schema.sql`*

```sql
-- ==========================================================
-- 👤 1. USUARIOS (Clientes del SaaS)
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'starter',               -- 'starter', 'pro', 'agency'
  messages_limit INTEGER DEFAULT 1500,       -- Cupo mensual contratado
  messages_used INTEGER DEFAULT 0,           -- Contador mensual de consumo
  telegram_chat_id TEXT,                     -- Para alertas instantáneas
  webhook_url TEXT,                          -- Webhook externo (Make / WhatsApp)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 🤖 2. AGENTES (Configuración del Chatbot)
-- ==========================================================
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,                       -- UUID expuesto en el script
  user_id TEXT NOT NULL,                     -- Dueño de la cuenta
  name TEXT NOT NULL DEFAULT 'AgentOS Assistant',
  avatar_url TEXT,                             -- Avatar subido por el cliente → objeto en R2 (Bunker). NULL = logo por defecto incluido en el widget
  header_title TEXT DEFAULT 'AgentOSweb',
  header_subtitle TEXT DEFAULT 'Asistente IA • En línea 24/7',
  welcome_message TEXT DEFAULT '¡Hola! 👋 Soy tu asistente inteligente de AgentOSweb. ¿En qué te puedo colaborar hoy?',
  
  -- 🧠 Cerebro del Agente & Base de Conocimiento Rápida
  system_prompt TEXT NOT NULL,               -- Instrucciones maestras de rol y tono
  knowledge_base TEXT,                       -- Texto plano hasta 5.000 palabras sobre el negocio
  
  -- 🎨 Personalización Estética
  primary_color TEXT DEFAULT '#3559ff',
  position TEXT DEFAULT 'right',             -- 'right' o 'left'
  default_theme TEXT DEFAULT 'auto',         -- 'light', 'dark', 'auto'
  
  -- 🤖 Configuración de Inferencia
  mode TEXT CHECK (mode IN ('byok', 'managed')) DEFAULT 'byok',
  chat_provider TEXT DEFAULT 'groq',         -- 'groq' o 'openai'
  chat_model TEXT DEFAULT 'llama-3.3-70b-versatile',
  chat_api_key TEXT,                         -- Clave privada del cliente (BYOK)
  max_tokens INTEGER DEFAULT 500,
  
  -- 🛡️ Seguridad y Control de Abuso
  allowed_domains TEXT DEFAULT '*',          -- Dominios autorizados separados por coma
  rate_limit_per_minute INTEGER DEFAULT 20,
  
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================================
-- 📇 3. LEADS (Contactos calificados capturados)
-- ==========================================================
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,                                -- Resumen de interés extraído por la IA
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- ==========================================================
-- 💬 4. CONVERSACIONES (Sesiones activas con clave única anti-duplicados)
-- ==========================================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, session_id),              -- 👈 Evita duplicar sesiones ante llamadas simultáneas
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- ==========================================================
-- 📨 5. MENSAJES (Historial optimizado para carga cronológica)
-- ==========================================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- ==========================================================
-- ⚡️ ÍNDICES COMPUESTOS DE ALTO RENDIMIENTO (Zero Filesort)
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lookup ON conversations(agent_id, session_id);

-- Para listar chats recientes en el dashboard al instante:
CREATE INDEX IF NOT EXISTS idx_conversations_recent ON conversations(agent_id, updated_at DESC);

-- Para cargar el hilo de chat en orden sin consumir CPU de ordenamiento:
CREATE INDEX IF NOT EXISTS idx_messages_history ON messages(conversation_id, created_at ASC);

-- Para exportar prospectos ordenados por fecha en <5ms:
CREATE INDEX IF NOT EXISTS idx_leads_dashboard ON leads(agent_id, created_at DESC);
```

---

## 5. 📂 ESTRUCTURA DEL PROYECTO (MONOREPO LIMPIO)

```text
agentosweb/
├── 📁 apps/
│   ├── 📁 dashboard/              # Panel administrativo SaaS (Next.js 15 + React 19 + Tailwind CSS v4)
│   │   ├── 📁 src/
│   │   │   ├── 📁 app/            # App Router de Next.js
│   │   │   │   ├── layout.tsx     # Layout raíz con Dark Mode e inyección de branding
│   │   │   │   ├── page.tsx       # Landing page o redirección al Dashboard
│   │   │   │   ├── 📁 dashboard/  # Vistas: Métricas, Agentes, Leads, Facturación
│   │   │   │   └── globals.css    # Tailwind CSS v4 (@import "tailwindcss"; + @theme)
│   │   │   ├── 📁 components/     # UI: LivePreview, MetricsGrid, AgentForm, ScratchpadKB
│   │   │   └── 📁 lib/            # Cliente HTTP contra la API de Cloudflare Workers
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── 📁 landing/                # Landing page pública + vitrina de features (Next.js 15)
│   │   ├── 📁 src/
│   │   │   └── 📁 app/
│   │   │       ├── layout.tsx     # SEO, branding y analytics
│   │   │       └── page.tsx       # Secciones: hero, planes, script embed, FAQ
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── 📁 workers/                # API Edge Serverless (Cloudflare Workers)
│   │   ├── 📁 src/
│   │   │   ├── index.ts           # Enrutador, CORS y control de dominios
│   │   │   ├── chat-handler.ts    # Orquestador: KV -> Inferencia -> Async Hooks
│   │   │   ├── alerts.ts          # Despacho de alertas a Telegram / Webhooks
│   │   │   └── 📁 providers/
│   │   │       ├── groq.ts        # Motor ultrarrápido Groq
│   │   │       └── openai.ts      # Motor OpenAI alternativo
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   └── 📁 widget/                 # Componente embebible para clientes
│       ├── 📁 src/
│       │   ├── index.ts           # Shadow DOM, navegación dual y animaciones
│       │   └── styles.css         # Estilos encapsulados anti-colisiones CSS
│       ├── build.js               # Minificador a un único archivo `widget.js` (<20KB)
│       └── package.json
│
├── 📁 database/
│   └── schema.sql                 # Migración D1
├── package.json
└── README.md
```

---

## 6. 💬 DISEÑO Y ANATOMÍA DEL WIDGET (DUAL-VIEW UI)

El widget utiliza una **arquitectura de doble vista deslizante** dentro de un **Shadow DOM abierto** para aislarlo al 100% de cualquier regla CSS que tenga el sitio web del cliente:

```text
┌─────────────────────────────────────────────────────────┐
│ [☀️/🌙]       [ 🏠 Inicio ]  [ 💬 Chat ]               │ ◄── Navegación superior encapsulada
│                       AgentOSweb                        │ ◄── Header minimalista con avatar
│                 Asistente IA • En línea 24/7            │
├─────────────────────────────────────────────────────────┤
│ [VISTA 1: PORTADA DE INICIO]                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 💡 ¡Hola! 👋 Bienvenido                             │ │ ◄── Welcome Card Glassmorphism
│ │ Soy el asistente inteligente de AgentOSweb...       │ │
│ └─────────────────────────────────────────────────────┘ │
│ [ ⚡️ Iniciar conversación (Shimmer Glow)             ] │ ◄── CTA con haz de luz diagonal
│                                                         │
│ PREGUNTAS FRECUENTES                                    │
│ ┌───────────────────────────────────────────────────┐ │ │
│ │ ⚡️ ¿Cómo instalarlo en mi sitio web?            > │ │ │ ◄── Prompt Items con ancho elástico
│ │ 🔑 ¿Qué es el modelo BYOK?                       > │ │ │
│ │ 💰 ¿Cuáles son los planes y precios?             > │ │ │
│ └───────────────────────────────────────────────────┘ │ │
├─────────────────────────────────────────────────────────┤
│ [VISTA 2: VENTANA DE CHAT]                              │
│ [🤖] ¡Hola! 👋 ¿En qué te puedo colaborar hoy?          │ ◄── Saludo inicial garantizado arriba
│                                                         │
│                               ¿Cuáles son los [👤]      │ ◄── Mensaje usuario azul (#3559ff)
│                               planes y precios?         │
│ [🤖] ⚪ ⚪ ⚪  (Pausa orgánica de 1.000 ms)             │ ◄── Indicador animado fluido
│                                                         │
│ ┌───────────────────────────────────────────────┬─────┐ │
│ │ Escribe tu mensaje... (Carrusel de 4 frases)  │  ➤  │ │ ◄── Input cápsula con margen ergonómico
│ └───────────────────────────────────────────────┴─────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 🧠 LÓGICA DEL BACKEND, RESILIENCIA Y WEBHOOKS

### Flujo del Endpoint `POST /api/chat`:

```typescript
export async function handleChatMessage(request: Request, env: any, ctx: ExecutionContext) {
  const origin = request.headers.get("Origin") || "";
  const { agent_id, message, session_id, history = [] } = await request.json();

  // 1. Obtención de Agente con caché ultra rápida en KV (<10ms)
  let agent = await env.AGENT_CACHE.get(`agent:${agent_id}`, "json");
  if (!agent) {
    agent = await env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agent_id).first();
    if (!agent) return new Response(JSON.stringify({ error: "Agente inactivo o no existe" }), { status: 404 });
    await env.AGENT_CACHE.put(`agent:${agent_id}`, JSON.stringify(agent), { expirationTtl: 3600 });
  }

  // 2. Filtro de Dominios Permitidos (Anti-robo de script)
  if (agent.allowed_domains !== "*") {
    const allowed = agent.allowed_domains.split(",").map((d: string) => d.trim());
    if (!allowed.some((domain: string) => origin.includes(domain))) {
      return new Response(JSON.stringify({ error: "Dominio no autorizado" }), { status: 403 });
    }
  }

  // 3. Montaje del Contexto (System Prompt + Base de Conocimiento Rápida)
  const fullSystemPrompt = `
    ${agent.system_prompt}
    
    BASE DE CONOCIMIENTO DEL NEGOCIO:
    ${agent.knowledge_base || "Sin datos adicionales."}
  `;

  const safeHistory = history.slice(-6).map((m: any) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content).slice(0, 1000)
  }));

  const messagesPayload = [
    { role: "system", content: fullSystemPrompt },
    ...safeHistory,
    { role: "user", content: String(message).slice(0, 1500) }
  ];

  // 4. Inferencia con Temporizador de Cortesía (Mínimo 1.000 ms)
  const minDelayPromise = new Promise(resolve => setTimeout(resolve, 1000));
  const apiKey = agent.mode === "byok" && agent.chat_api_key ? agent.chat_api_key : env.GROQ_MANAGED_KEY;

  let botReply = "";
  try {
    const groqRes = await fetch("[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: agent.chat_model || "llama-3.3-70b-versatile",
        messages: messagesPayload,
        max_tokens: agent.max_tokens || 500,
        temperature: 0.6
      })
    });
    const groqData = await groqRes.json();
    botReply = groqData.choices?.[0]?.message?.content || "Disculpa, no pude procesar la respuesta.";
  } catch {
    // Modo de Resiliencia: Respuesta de emergencia local
    botReply = "Actualmente experimento alta demanda. Por favor, reformula tu consulta o contacta a soporte.";
  }

  await minDelayPromise;

  // 5. Tareas Asíncronas en Segundo Plano (ctx.waitUntil)
  ctx.waitUntil((async () => {
    // 1. Garantizar conversación de forma atómica sin SELECT previo ni carreras
    const convoId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO conversations (id, agent_id, session_id, updated_at) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(agent_id, session_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `).bind(convoId, agent_id, session_id).run();

    // 2. Obtener el id real de la conversación
    const activeConvo = await env.DB.prepare(
      "SELECT id FROM conversations WHERE agent_id = ? AND session_id = ?"
    ).bind(agent_id, session_id).first();

    const finalConvoId = activeConvo?.id || convoId;

    // 3. Batch atómico: Ambos mensajes y consumo en una sola transacción D1
    await env.DB.batch([
      env.DB.prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)").bind(crypto.randomUUID(), finalConvoId, message),
      env.DB.prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)").bind(crypto.randomUUID(), finalConvoId, botReply),
      env.DB.prepare("UPDATE users SET messages_used = messages_used + 1 WHERE id = ?").bind(agent.user_id)
    ]);

    // B) Alerta instantánea si hay intención de contacto o datos
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("@") || lowerMsg.includes("precio") || lowerMsg.includes("comprar")) {
      await sendTelegramAlert(env, agent.user_id, `🚨 Nuevo interés en tu web:\n"${message}"`);
    }
  })());

  return new Response(JSON.stringify({ reply: botReply }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
```

---

## 8. 🎨 PANEL DE CONTROL EN NEXT.JS & TAILWIND CSS V4

El dashboard se despliega en **Cloudflare Pages** mediante el adaptador `@cloudflare/next-on-pages`, combinando **Next.js 15 (App Router)** con el motor de rendimiento ultra rápido de **Tailwind CSS v4 (Rust Oxide)**:

### ⚙️ Configuración Global de Tailwind CSS v4 (`src/app/globals.css`):
```css
@import "tailwindcss";

@theme {
  /* 🔵 Tokens de Identidad AgentOSweb */
  --color-brand-primary: #3559ff;
  --color-brand-cyan: #13a0ff;
  --color-brand-dark: #1c2128;
  --color-brand-surface: #22272e;
  --color-brand-border: #333942;
  --color-brand-cloud: #f1f5f9;

  /* ✨ Sombras Dinámicas y Radios */
  --shadow-glow: 0 0 24px rgba(19, 160, 255, 0.4);
  --shadow-card: 0 4px 20px rgba(15, 23, 42, 0.04);
  --radius-brand: 18px;
}

/* ⚡️ Shimmer Effect para Botones de Acción */
.btn-shimmer {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-brand-primary) 0%, var(--color-brand-cyan) 100%);
  transition: all 0.3s ease;
}

.btn-shimmer::before {
  content: '';
  position: absolute;
  top: 0;
  left: -120%;
  width: 80%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: skewX(-22deg);
  transition: left 0.65s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-shimmer:hover::before {
  left: 140%;
}
```

### 📊 Módulos Funcionales del Dashboard:
1. 📈 **Métricas Clave:** Tasa de resolución sin humanos, Top 5 preguntas frecuentes de visitantes y barra de consumo mensual vs. cupo contratado.
2. 🤖 **Configurador del Agente:** Editor del *System Prompt*, selector BYOK/Managed y área de texto para la **Base de Conocimiento Rápida (Scratchpad KB)**.
3. 👁️ **Live Preview Interactivo:** Panel lateral en tiempo real que renderiza el widget con los colores y logo configurados por el cliente antes de publicar.
4. 📇 **Bandeja de Prospectos (Leads):** Visor con datos capturados y botón de descarga a formato `.csv`.
5. 📋 **Copiado de Script con 1 Clic:**
   ```html
   <script src="[https://agentosweb.com/widget.js](https://agentosweb.com/widget.js)" data-agent-id="tu_id_unico" defer></script>
   ```

---

## 9. 💰 ESTRATEGIA DE MONETIZACIÓN & PLANES SAAS

| Plan | Precio | Agentes | Mensajes / mes | Funcionalidades Destacadas | Margen Est. |
| :--- | :---: | :---: | :---: | :--- | :---: |
| 🆓 **Free** | **$0 / mes** | 1 | 20 msgs administrados | Prueba: IA administrada, branding AgentOSweb. Sin BYOK ni marca blanca | 20% |
| 🥉 **Starter** | **$19** con tu API (BYOK) · **$39** con IA administrada | 1 | 1.500 msgs administrados · BYOK ♾️ | Motor IA administrado o tu propia key | 96% |
| 🥈 **Pro** | **$49** con tu API (BYOK) · **$89** con IA administrada | 3 | 6.000 msgs administrados · BYOK ♾️ | Sin marca de agua, Modo BYOK, alertas a Telegram | 95% |
| 🥇 **Agency** | **$149** con tu API (BYOK) · **$249** con IA administrada | 10 | 25.000 msgs administrados · BYOK ♾️ | Marca blanca total, dominios autorizados ilimitados, soporte prioritario | 92% |

> 💳 **Facturación manual:** el pago se procesa manualmente (sin pasarela automatizada); el equipo activa el plan en la cuenta tras verificar la transferencia.

---

## 10. 🗺️ ROADMAP DE EJECUCIÓN RÁPIDA (4 SEMANAS)

* 🟢 **Semana 1: Infraestructura Perimetral y D1**
  * Desplegar base D1 (`schema.sql`) y configurar bindings de KV.
  * Endpoint `POST /api/chat` con Groq Llama 3.3 y persistencia en `ctx.waitUntil()`.
* 🟡 **Semana 2: Empaquetado del Widget Final**
  * Compilar el widget en TypeScript nativo hacia un solo archivo `widget.js` (<20KB).
  * Integrar la UI final: portada interactiva, animaciones de avatar y carrusel de preguntas en el placeholder.
* 🟠 **Semana 3: Dashboard en Next.js 15 & Tailwind CSS v4**
  * Inicializar el proyecto en `apps/dashboard` con **Next.js 15, React 19 y Tailwind CSS v4**.
  * Construir el editor de agentes, la base de conocimiento y el Live Preview interactivo.
* 🔴 **Semana 4: Facturación Manual y Despliegue**
  * Pago procesado de forma **manual** (transferencia/PayPal “instructivo”): el equipo verifica el pago y activa el plan (Starter/Pro/Agency) desde el dashboard. Sin pasarela de pagos automatizada (Stripe descartado).
  * Pruebas de estrés en el Edge y lanzamiento oficial en `agentosweb.com`.

---

## 11. 🤖 PROMPT MAESTRO DE INGENIERÍA

```text
Actúa como un Arquitecto de Software Fullstack Senior especializado en Cloudflare (Workers, D1 Database, KV Cache, Pages) y Next.js con Tailwind CSS v4.

Proyecto: AgentOSweb (agentosweb.com)
Objetivo: Plataforma SaaS no-code para construir y desplegar agentes de IA en sitios web mediante un snippet embebible <script src="[https://agentosweb.com/widget.js](https://agentosweb.com/widget.js)" data-agent-id="ID"></script>.

Requisitos indispensables:
1. Arquitectura: 100% Serverless Edge en Cloudflare. Cero Supabase, cero VPS y cero bases vectoriales pesadas.
2. Rendimiento API: Cachear configuración y Scratchpad KB en Cloudflare KV (<10ms); registrar mensajes y métricas en D1 mediante ctx.waitUntil() sin bloquear la respuesta al usuario.
3. Resiliencia y UX: Pacing orgánico forzado a 1.000 ms con indicador animado (...); respuestas de emergencia locales si la API externa experimenta caídas.
4. Seguridad: Validación estricta del encabezado Origin contra allowed_domains en cada llamada a /api/chat. Recorte del historial a un máximo de 6 mensajes.
5. Widget: Vanilla TypeScript compilado en un archivo único ligero (<20KB) con Shadow DOM abierto, interfaz dual (portada con preguntas frecuentes y vista de chat deslizante) y soporte de modo oscuro persistente.
6. Dashboard: Aplicación moderna en apps/dashboard construida con Next.js 15 (App Router), React 19 y Tailwind CSS v4 usando @theme en globals.css, preparada para compilar hacia Cloudflare Pages mediante @cloudflare/next-on-pages.
```