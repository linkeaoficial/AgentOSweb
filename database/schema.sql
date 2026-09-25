-- ==========================================================
-- 👤 1. USUARIOS (Clientes del SaaS)
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'starter',               -- 'free', 'starter', 'pro', 'agency'
  messages_limit INTEGER DEFAULT 1500,       -- Cupo mensual contratado
  agent_limit INTEGER,                       -- Override de agentes (NULL = sigue el plan)
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
  bubble_logo_url TEXT,                        -- Logo propio de la burbuja flotante. Marca blanca (solo plan Agency). NULL = Icono_Chat de AgentOSweb
  header_title TEXT DEFAULT 'AgentOSweb',
  header_subtitle TEXT DEFAULT 'Asistente IA • En línea 24/7',
  welcome_message TEXT DEFAULT 'Soy tu asistente virtual de AgentOSweb. ¿En qué te puedo colaborar hoy?',

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
  chat_base_url TEXT,                        -- URL base custom (proveedor "otro")
  faqs TEXT,                                 -- Preguntas frecuentes (JSON: label, msg, answer)
  max_tokens INTEGER DEFAULT 500,

  -- 🛡️ Seguridad y Control de Abuso
  allowed_domains TEXT DEFAULT '*',          -- Dominios autorizados separados por coma
  rate_limit_per_minute INTEGER DEFAULT 20,
  lead_capture INTEGER DEFAULT 1,            -- 1 = captura prospectos (email/tel/nombre), 0 = solo responde
  lead_fields TEXT NOT NULL DEFAULT 'email,phone', -- Campos a capturar: 'email', 'phone', 'name' (coma)

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
  notes TEXT,                                -- Nota interna del dueño (la edita en el panel)
  interest TEXT,                             -- Mensaje de interés real del visitante (captura automática o form
  session_id TEXT,                           -- Sesión donde se capturó (para vincular la conversación)
  status TEXT NOT NULL DEFAULT 'Nuevo',      -- Nuevo > Contactado > Calificado > Convertido > Archivado
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
-- 📊 6. CONTADOR DE FAQ (veces que se responde cada pregunta)
-- ==========================================================
CREATE TABLE IF NOT EXISTS faq_hits (
  agent_id TEXT NOT NULL,
  faq_label TEXT NOT NULL,
  hits INTEGER DEFAULT 0,
  PRIMARY KEY (agent_id, faq_label),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
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

-- Dedupe puntual de leads en el hot path (por mensaje de chat y por formulario:
-- `WHERE agent_id = ? AND email = ?`, `AND phone = ?`, `AND session_id = ?`).
-- Sin estos, cada mensaje con contacto escanea todas las leads del agente.
CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(agent_id, email);
CREATE INDEX IF NOT EXISTS idx_leads_phone   ON leads(agent_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_session ON leads(agent_id, session_id);