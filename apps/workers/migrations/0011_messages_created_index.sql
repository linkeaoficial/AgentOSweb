-- 0011: indice para la serie diaria de Analiticas.
--
-- Las series de "mensajes por dia" y "por hora" escanean messages filtrando por
-- rango de fechas (ultimos 30 dias). El unico indice de messages es
-- idx_messages_history(conversation_id, created_at): con conversation_id
-- adelante no sirve para un rango global de fechas, y D1 cobra filas leidas.
-- Con este indice el rango del mes lee solo las filas del mes.
--
-- Nota de numeracion: la tabla `rateLimit` pendiente en el backlog pasa a 0012.

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at ASC);
