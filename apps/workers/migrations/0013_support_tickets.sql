-- 0013: solicitudes de Ayuda y Soporte.
--
-- Lo que el cliente escribe desde Configuracion o desde el pie del panel queda
-- aca, y el dueño lo ve en el menu de Clientes (icono de mensaje con la cuenta
-- de pendientes).
--
-- Se guarda una COPIA del email, nombre y plan en el ticket en vez de solo el
-- user_id: el mensaje tiene que seguir siendo legible aunque el cliente borre
-- su cuenta o cambie de correo, y la bandeja del admin asi no depende de un
-- JOIN con Better Auth.
--
-- `created_at`/`updated_at` en ISO con Z (no el `datetime('now')` a secas de
-- otras tablas): `new Date("2026-10-04 09:00:00")` en JavaScript lo interpreta
-- como hora LOCAL y el panel muestra el mensaje corrido.
--
-- Nota de numeracion: 0012 sigue reservada para la tabla `rateLimit` pendiente
-- en el backlog (ver 0011).

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  user_plan TEXT,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierto',
  page TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- El drawer del admin filtra por cliente ordenado por fecha, y el badge cuenta
-- los abiertos: los dos caminos-hot de esta tabla.
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, created_at DESC);