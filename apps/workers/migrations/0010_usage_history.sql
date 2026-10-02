-- 0010: historial mensual de uso de mensajes.
--
-- El cron del dia 1 (resetMonthlyQuota) guarda el contador del mes que termina
-- ANTES de ponerlo a cero: es lo que el panel muestra como "Uso de meses
-- anteriores". Sin esta tabla no hay historial: el contador volvia a 0 y el mes
-- quedaba borrado. Idempotente (CREATE IF NOT EXISTS + ON CONFLICT re-escribe
-- el snapshot si se re-corre).
--
-- Nota de numeracion: 0008 quedo para `lead_fields` y 0009 para Agency 10->8;
-- la tabla `rateLimit` pendiente en el backlog pasa a ser 0011.

CREATE TABLE IF NOT EXISTS usage_history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- 'YYYY-MM' en UTC (el mes que cerro el cron)
  messages INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
