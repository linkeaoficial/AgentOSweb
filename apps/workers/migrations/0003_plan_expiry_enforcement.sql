-- 0003_plan_expiry_enforcement.sql
--
-- Cierra el ciclo de la vigencia del plan (0002 solo la guardaba y la mostraba):
-- historial de cambios, y marca para que el cliente vea UNA vez el aviso de
-- renovacion cuando su plan pagado vence.
--
-- `plan_events` responde a la pregunta que antes no se podia contestar: "yo
-- pague 3 meses". Sin registro, un reclamo era la palabra del cliente contra la
-- del dueño. Se escribe desde un solo lugar del worker (logPlanEvent), asi que
-- todo cambio de plan, renovacion o cupo queda anotado por el mismo codigo que
-- los aplica.
--
-- D1 registra las migraciones por nombre de archivo, asi que este archivo corre
-- una sola vez por base. NO es idempotente: volver a ejecutarlo a mano da
-- "duplicate column name". Para repetir hace falta 0004_..., no editar este.

CREATE TABLE IF NOT EXISTS plan_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- 'plan' | 'renew' | 'quota' | 'expiry' | 'downgrade'
  action TEXT NOT NULL,
  -- Que campo cambio ('plan', 'plan_expires_at', 'messages_limit', 'agent_limit').
  -- NULL para acciones sin un unico campo (downgrade).
  field TEXT,
  from_value TEXT,
  to_value TEXT,
  -- Quien lo hizo: 'admin' (el dueño desde el panel), 'system' (el cron),
  -- 'user' (el propio cliente). Sirve para distinguir un renewal cobrado de uno
  -- automático.
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL
);

-- El historial se lee siempre por cuenta y del mas nuevo al mas viejo.
CREATE INDEX IF NOT EXISTS idx_plan_events_user ON plan_events(user_id, created_at DESC);

-- Cuando el cron baja la cuenta a free guarda de que plan vino, para que el
-- modal pueda decir "vencio tu plan Pro" y no un generico "tu plan vencio".
ALTER TABLE users ADD COLUMN downgraded_from TEXT;

-- Momento en que el cliente cerro el aviso de renovacion. El cron lo vuelve a
-- poner en NULL cuando vence un plan, asi el aviso reaparece una vez por
-- vencimiento en vez de una vez por sesion.
ALTER TABLE users ADD COLUMN expiry_notice_at TEXT;
