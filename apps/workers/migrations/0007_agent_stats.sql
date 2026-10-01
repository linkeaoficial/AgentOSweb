-- 0007: contadores O(1) de conversaciones y mensajes por agente.
--
-- Objetivo: eliminar los dos escaneos lineales que quedan en el Overview.
-- D1 factura `rows_read` (filas ESCANEADAS), no consultas ni viajes de red, asi
-- que un COUNT(*) no cuesta "una consulta": cuesta una fila leida por cada
-- mensaje del agente. Medido hoy: `COUNT conversations` = 39 filas y
-- `COUNT messages JOIN conversations` = 424 filas para 212 mensajes, porque el
-- JOIN obliga a recorrer `messages` y a buscar su conversacion una por una.
-- Con 100.000 mensajes ese endpoint pasaria de ~476 a ~100.400 filas por carga.
--
-- Mismo patron que 0005 (`lead_stats`): la tabla y los triggers viven en la base
-- a proposito. No dependen de que el codigo de la app los mantenga, asi que no
-- pueden desviarse aunque un camino futuro olvide contarlo.
--
-- D1 no ofrece triggers "FOR EACH ROW" sobre joins ni vistas materializadas, y
-- un trigger no puede contar mensajes por agente sin mirar `conversations`,
-- porque `messages` no guarda `agent_id`. De ahi el subselect en vez de una
-- columna desnormalizada: son 1 lectura de indice por mensaje insertado o
-- borrado (PK), y cero por cada carga del Overview.

-- 1. Contadores. WITHOUT ROWID porque la clave primaria es agent_id: el cuerpo
--    de la fila ya es la clave, asi que no hay duplicacion.
CREATE TABLE IF NOT EXISTS agent_stats (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversations INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id)
) WITHOUT ROWID;

-- 2. Backfill idempotente, en DOS sentencias lineales a proposito: una por
--    columna. Un unico SELECT con el COUNT de mensajes como subselect
--    correlacionado repetiria el escaneo de `messages` una vez por cada agente.
--    Aqui cada sentencia recorre `messages` una sola vez y el ON CONFLICT solo
--    toca su propia columna, asi que da igual el orden y reejecutar corrige en
--    vez de duplicar (que es lo que hacia el backfill de 0005 y obliga a
--    reconstruir leads_fts a mano si se repite).
--
--    Los mensajes se atribuyen al agente de su conversacion (JOIN) porque
--    `messages` solo guarda conversation_id.
INSERT INTO agent_stats (agent_id, conversations, messages)
SELECT c.agent_id, COUNT(*), 0 FROM conversations c GROUP BY c.agent_id
ON CONFLICT(agent_id) DO UPDATE SET conversations = excluded.conversations;

INSERT INTO agent_stats (agent_id, conversations, messages)
SELECT c.agent_id, 0, COUNT(*)
FROM messages m JOIN conversations c ON c.id = m.conversation_id
GROUP BY c.agent_id
ON CONFLICT(agent_id) DO UPDATE SET messages = excluded.messages;

-- Agentes sin conversaciones no aparecen todavia: su fila nace en el primer
-- INSERT gracias al UPSERT del trigger, y el Overview usa COALESCE para 0.

-- 3. Triggers de conversaciones.
CREATE TRIGGER IF NOT EXISTS agent_stats_conv_ai AFTER INSERT ON conversations BEGIN
  INSERT INTO agent_stats (agent_id, conversations, messages) VALUES (NEW.agent_id, 1, 0)
  ON CONFLICT(agent_id) DO UPDATE SET conversations = conversations + 1;
END;

-- BEFORE, no AFTER, y resta tambien los mensajes de la conversacion.
--
-- Es el punto delicado del diseño, medido con sqlite real en los dos modos de
-- recursive_triggers (0 y 1): al borrar una conversacion, el CASCADE de la FK
-- `ON DELETE CASCADE` borra sus mensajes, pero ese borrado en cascada NO dispara
-- `messages_ad`. Con un AFTER DELETE el contador de mensajes quedaria
-- permanentemente desfasado por cada conversacion borrada.
--
-- En BEFORE los mensajes siguen existiendo, asi que el COUNT(*) es exacto. Y no
-- hay doble resta: si el codigo ya borro los mensajes uno a uno antes de borrar
-- la conversacion (que es lo que hace el endpoint de borrado), el COUNT da 0 y
-- este trigger solo resta la conversacion.
CREATE TRIGGER IF NOT EXISTS agent_stats_conv_ad BEFORE DELETE ON conversations BEGIN
  UPDATE agent_stats
     SET conversations = conversations - 1,
         messages = messages - (SELECT COUNT(*) FROM messages WHERE conversation_id = OLD.id)
   WHERE agent_id = OLD.agent_id;
END;

-- El agente puede cambiar de dueño (reasignacion): mueve el contador entero.
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

-- 4. Triggers de mensajes. El subselect es una lectura de PK de `conversations`.
CREATE TRIGGER IF NOT EXISTS agent_stats_msg_ai AFTER INSERT ON messages BEGIN
  INSERT INTO agent_stats (agent_id, conversations, messages)
  VALUES ((SELECT agent_id FROM conversations WHERE id = NEW.conversation_id), 0, 1)
  ON CONFLICT(agent_id) DO UPDATE SET messages = messages + 1;
END;

CREATE TRIGGER IF NOT EXISTS agent_stats_msg_ad AFTER DELETE ON messages BEGIN
  UPDATE agent_stats SET messages = messages - 1
   WHERE agent_id = (SELECT agent_id FROM conversations WHERE id = OLD.conversation_id);
END;

-- No hace falta indice nuevo para el borrado: `messages.conversation_id` ya
-- esta cubierto por `idx_messages_history`, que se aplica antes que este archivo.

-- 5. El Overview tambien pide las 5 conversaciones mas recientes. El indice
--    unico (agent_id, session_id) filtra bien por agente, pero no ordena por
--    fecha: SQLite tiene que leer y ordenar TODAS las conversaciones del agente
--    para devolver 5, o sea otra lectura lineal (hoy 29 filas, y a 100.000
--    conversaciones serian 100.000 por cada carga del Overview).
CREATE INDEX IF NOT EXISTS idx_conversations_recent
  ON conversations(agent_id, updated_at DESC);
