-- ==========================================================
-- 👤 1. USUARIOS (Clientes del SaaS)
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'starter',               -- 'free', 'starter', 'pro', 'agency'
  messages_limit INTEGER DEFAULT 20,       -- Cupo mensual contratado
  agent_limit INTEGER,                       -- Override de agentes (NULL = sigue el plan)
  messages_used INTEGER DEFAULT 0,           -- Contador mensual de consumo
  plan_expires_at TEXT,                      -- Vencimiento del plan 'YYYY-MM-DD' (NULL = sin vencimiento)
  downgraded_from TEXT,                      -- Plan del que vino el downgrade automatico (NULL = nunca bajo solo)
  expiry_notice_at TEXT,                     -- Cuando el cliente cerro el aviso de renovacion (NULL = no lo vio)
  telegram_chat_id TEXT,                     -- Para alertas instantáneas
  webhook_url TEXT,                          -- Webhook externo (Make / WhatsApp)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 📜 HISTORIAL DE PLAN (quién cambió qué, y cuándo)
-- ==========================================================
-- Respaldo de cada cambio de plan, renovación, cupo o vencimiento automático.
-- Sin esto, un reclamo ("yo pagué 3 meses") no se podía verificar.
CREATE TABLE IF NOT EXISTS plan_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,                      -- 'plan' | 'renew' | 'quota' | 'expiry' | 'downgrade'
  field TEXT,                                -- Campo cambiado (NULL en acciones sin uno solo)
  from_value TEXT,
  to_value TEXT,
    actor TEXT DEFAULT 'admin',                -- 'admin' | 'system' | 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- El historial se lee siempre por cuenta y de más nuevo a más viejo; sin
    -- este índice es un scan de la tabla entera por cada apertura del modal.
    CREATE INDEX IF NOT EXISTS idx_plan_events_user ON plan_events(user_id, created_at DESC);
    
-- ==========================================================
-- ⏱️ 1.5 USO MENSUAL (snapshot del contador antes del reinicio)
-- ==========================================================
-- El cron del día 1 guarda cuántos mensajes se usaron en el mes que cerró
-- antes de poner messages_used = 0; es lo que el panel muestra como "Uso de
-- meses anteriores". Sin esto el mes quedaba borrado al reiniciar.
CREATE TABLE IF NOT EXISTS usage_history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                        -- 'YYYY-MM' en UTC (el mes que cerró el cron)
  messages INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
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
  byok_provider TEXT,                        -- Memoria BYOK: proveedor elegido (se conserva al volver a Administrada)
  byok_model TEXT,                           -- Memoria BYOK: modelo elegido (se conserva al volver a Administrada)
  faqs TEXT,                                 -- Preguntas frecuentes (JSON: label, msg, answer)
  max_tokens INTEGER DEFAULT 500,

  -- 🛡️ Seguridad y Control de Abuso
  allowed_domains TEXT DEFAULT '*',          -- Dominios autorizados separados por coma
  rate_limit_per_minute INTEGER DEFAULT 20,
  lead_capture INTEGER DEFAULT 1,            -- 1 = captura prospectos (email/tel/nombre), 0 = solo responde
  lead_fields TEXT NOT NULL DEFAULT 'name,email,phone', -- Campos a capturar: 'name', 'email', 'phone' (coma)

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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Última edición (migración 0004)
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

-- Para la serie diaria/horaria de Analiticas (rango global de fechas, migracion 0011):
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at ASC);


-- Para exportar prospectos ordenados por fecha en <5ms:
CREATE INDEX IF NOT EXISTS idx_leads_dashboard ON leads(agent_id, created_at DESC);

-- Dedupe puntual de leads en el hot path (por mensaje de chat y por formulario:
-- `WHERE agent_id = ? AND email = ?`, `AND phone = ?`, `AND session_id = ?`).
-- Sin estos, cada mensaje con contacto escanea todas las leads del agente.
CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(agent_id, email);
CREATE INDEX IF NOT EXISTS idx_leads_phone   ON leads(agent_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_session ON leads(agent_id, session_id);
-- ==========================================================
-- ⚡️ CONTADORES O(1) MANTENIDOS POR TRIGGERS (migraciones 0005 y 0007)
-- ==========================================================
-- D1 factura `rows_read` (filas ESCANEADAS), no consultas. Un COUNT(*) no
-- cuesta "una consulta": cuesta una fila leida por cada mensaje del agente.
-- Estas dos tablas sustituyen los escaneos lineales del panel por una lectura de
-- clave primaria, y viven en la base a proposito para que ningun camino futuro
-- pueda desviarse por olvidar contarlo.

-- Contadores de prospectos por estado (reemplaza el GROUP BY status del listado).
CREATE TABLE IF NOT EXISTS lead_stats (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, status)
) WITHOUT ROWID;

-- Busqueda substring indexada. UNA sola columna con todo el texto buscable: el OR
-- de varias columnas obliga al indice a evaluar cada una por separado. `lead_id`
-- va UNINDEXED porque es la clave del JOIN contra leads, no un termino buscado.
-- El tokenizer trigram es el unico que conserva la semantica de `LIKE '%x%'`.
CREATE VIRTUAL TABLE IF NOT EXISTS leads_fts USING fts5(
  lead_id UNINDEXED,
  all_text,
  tokenize = 'trigram'
);

-- Contadores de conversaciones y mensajes por agente (reemplaza dos COUNT(*)
-- con JOIN del Overview).
CREATE TABLE IF NOT EXISTS agent_stats (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversations INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id)
) WITHOUT ROWID;

-- ==========================================================
-- 🔁 TRIGGERS DE lead_stats
-- ==========================================================
-- ON CONFLICT DO UPDATE hace el UPSERT en una sola sentencia, y el DELETE limpia
-- la fila cuando llega a 0 para que no se acumulen estados vacios.
CREATE TRIGGER IF NOT EXISTS leads_stats_ai AFTER INSERT ON leads BEGIN
  INSERT INTO lead_stats (agent_id, status, n) VALUES (NEW.agent_id, NEW.status, 1)
  ON CONFLICT(agent_id, status) DO UPDATE SET n = n + 1;
END;

CREATE TRIGGER IF NOT EXISTS leads_stats_ad AFTER DELETE ON leads BEGIN
  UPDATE lead_stats SET n = n - 1 WHERE agent_id = OLD.agent_id AND status = OLD.status;
  DELETE FROM lead_stats WHERE agent_id = OLD.agent_id AND status = OLD.status AND n <= 0;
END;

-- Un solo trigger para los dos campos, y no uno por campo: con dos separados, un
-- UPDATE que cambia `agent_id` Y `status` a la vez dispara los dos, y cada uno
-- resta del viejo e incrementa el nuevo (medido: el viejo acababa en -1 y el
-- nuevo en 2). El WHEN ademas evita escribir cuando el UPDATE toco otros campos
-- (notas, por ejemplo), que es el caso mayoritario en el uso normal.
CREATE TRIGGER IF NOT EXISTS leads_stats_au2 AFTER UPDATE ON leads
WHEN NEW.status <> OLD.status OR NEW.agent_id <> OLD.agent_id BEGIN
  UPDATE lead_stats SET n = n - 1 WHERE agent_id = OLD.agent_id AND status = OLD.status;
  DELETE FROM lead_stats WHERE agent_id = OLD.agent_id AND status = OLD.status AND n <= 0;
  INSERT INTO lead_stats (agent_id, status, n) VALUES (NEW.agent_id, NEW.status, 1)
  ON CONFLICT(agent_id, status) DO UPDATE SET n = n + 1;
END;

-- ==========================================================
-- 🔁 TRIGGERS DE leads_fts
-- ==========================================================
-- El AFTER UPDATE borra y reinserta: es la forma soportada de actualizar una
-- tabla FTS5 externa.
CREATE TRIGGER IF NOT EXISTS leads_fts_ai AFTER INSERT ON leads BEGIN
  INSERT INTO leads_fts (lead_id, all_text)
  VALUES (NEW.id,
          coalesce(NEW.name,'') || ' ' || coalesce(NEW.email,'') || ' ' ||
          coalesce(NEW.phone,'') || ' ' || coalesce(NEW.notes,'') || ' ' ||
          coalesce(NEW.interest,'') || ' ' || coalesce(NEW.status,''));
END;

CREATE TRIGGER IF NOT EXISTS leads_fts_ad AFTER DELETE ON leads BEGIN
  DELETE FROM leads_fts WHERE lead_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS leads_fts_au AFTER UPDATE ON leads BEGIN
  DELETE FROM leads_fts WHERE lead_id = OLD.id;
  INSERT INTO leads_fts (lead_id, all_text)
  VALUES (NEW.id,
          coalesce(NEW.name,'') || ' ' || coalesce(NEW.email,'') || ' ' ||
          coalesce(NEW.phone,'') || ' ' || coalesce(NEW.notes,'') || ' ' ||
          coalesce(NEW.interest,'') || ' ' || coalesce(NEW.status,''));
END;

-- ==========================================================
-- 🔁 TRIGGERS DE agent_stats
-- ==========================================================
CREATE TRIGGER IF NOT EXISTS agent_stats_conv_ai AFTER INSERT ON conversations BEGIN
  INSERT INTO agent_stats (agent_id, conversations, messages) VALUES (NEW.agent_id, 1, 0)
  ON CONFLICT(agent_id) DO UPDATE SET conversations = conversations + 1;
END;

-- BEFORE, no AFTER, y resta tambien los mensajes de la conversacion.
-- Al borrar una conversacion, el CASCADE de la FK borra sus mensajes pero ese
-- borrado en cascada NO dispara `agent_stats_msg_ad`; con AFTER DELETE el
-- contador de mensajes quedaria desfasado para siempre. En BEFORE los mensajes
-- siguen existiendo y el COUNT es exacto. No hay doble resta: si el codigo ya
-- borro los mensajes uno a uno antes, el COUNT da 0.
CREATE TRIGGER IF NOT EXISTS agent_stats_conv_ad BEFORE DELETE ON conversations BEGIN
  UPDATE agent_stats
     SET conversations = conversations - 1,
         messages = messages - (SELECT COUNT(*) FROM messages WHERE conversation_id = OLD.id)
   WHERE agent_id = OLD.agent_id;
END;

CREATE TRIGGER IF NOT EXISTS agent_stats_conv_au AFTER UPDATE OF agent_id ON conversations
WHEN NEW.agent_id <> OLD.agent_id BEGIN
  UPDATE agent_stats
     SET conversations = conversations - 1,
         messages = messages - (SELECT COUNT(*) FROM messages WHERE conversation_id = OLD.id)
   WHERE agent_id = OLD.agent_id;
  INSERT INTO agent_stats (agent_id, conversations, messages)
  VALUES (NEW.agent_id, 1, (SELECT COUNT(*) FROM messages WHERE conversation_id = OLD.id))
  ON CONFLICT(agent_id) DO UPDATE SET
    conversations = conversations + 1,
    messages = messages + excluded.messages;
END;

CREATE TRIGGER IF NOT EXISTS agent_stats_msg_ai AFTER INSERT ON messages BEGIN
  INSERT INTO agent_stats (agent_id, conversations, messages)
  VALUES ((SELECT agent_id FROM conversations WHERE id = NEW.conversation_id), 0, 1)
  ON CONFLICT(agent_id) DO UPDATE SET messages = messages + 1;
END;

CREATE TRIGGER IF NOT EXISTS agent_stats_msg_ad AFTER DELETE ON messages BEGIN
  UPDATE agent_stats SET messages = messages - 1
   WHERE agent_id = (SELECT agent_id FROM conversations WHERE id = OLD.conversation_id);
END;

-- ==========================================================
-- ⚡️ ÍNDICES DEL LISTADO Y DEL PANEL DE CLIENTES (migraciones 0004 y 0006)
-- ==========================================================
-- Filtros del listado de prospectos (agente + estado, nombre, orden por edicion).
CREATE INDEX IF NOT EXISTS idx_leads_agent_status   ON leads(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_agent_name     ON leads(agent_id, name);
CREATE INDEX IF NOT EXISTS idx_leads_agent_updated  ON leads(agent_id, updated_at DESC);

-- Clientes: filtrado por plan/vencimiento sin escanear la tabla.
-- Ojo: `idx_user_created ON user(created_at)` (migración 0006) NO va aqui a
-- proposito. `user` en singular es la tabla de Better Auth, que la crea la
-- libreria al arrancar, no este bootstrap; indexarla aqui fallaria con
-- "no such table". Ese indice lo crea la migracion 0006, que si corre cuando la
-- tabla ya existe.
CREATE INDEX IF NOT EXISTS idx_users_plan   ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_plan_expires ON users(plan, plan_expires_at);
