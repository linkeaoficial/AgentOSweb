-- Índices de la app (AgentOSweb).
--
-- ATENCIÓN: estos índices YA EXISTEN en la D1 de producción (agentosweb-db).
-- Este archivo existe para dejarles versionados: hasta ahora se crearon a mano
-- con `wrangler d1 execute` y no había ni un .sql en el repo. Si la base se
-- restauraba desde un backup o se recreaba, se perdían todos y las lecturas
-- de D1 se disparaban (cada COUNT sobre `messages` pasaba de usar índice a
-- escanear la tabla entera).
--
-- Aplicar de forma incremental:  npx wrangler d1 migrations apply agentosweb-db --remote
-- Es idempotente: si el índice ya está, no hace nada.

-- messages es la tabla grande (206 filas hoy, crece con cada conversación del
-- widget). El índice es compuesto para que además resuelva el ORDER BY created_at
-- sin ordenar: lo usan el historial del chat y el subquery de "última actividad"
-- de cada lead en Prospectos.
CREATE INDEX IF NOT EXISTS idx_messages_history ON messages(conversation_id, created_at ASC);

-- El UNIQUE(agent_id, session_id) de la tabla ya genera un índice, pero este
-- cubre el ORDER BY updated_at DESC de "conversaciones recientes" del overview.
CREATE INDEX IF NOT EXISTS idx_conversations_recent ON conversations(agent_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_lookup ON conversations(agent_id, session_id);

-- Filtrado/listado de agentes por dueño (punto de entrada de /api/agents).
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);

-- Prospectos: listado paginado, deduplicación y "última actividad".
CREATE INDEX IF NOT EXISTS idx_leads_dashboard ON leads(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email     ON leads(agent_id, email);
CREATE INDEX IF NOT EXISTS idx_leads_phone     ON leads(agent_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_session   ON leads(agent_id, session_id);
