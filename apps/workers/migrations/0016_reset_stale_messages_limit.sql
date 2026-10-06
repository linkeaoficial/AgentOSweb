-- 0016_reset_stale_messages_limit.sql
--
-- Limpieza del default viejo de messages_limit (=1500) que quedó grabado en dos
-- cuentas al crearse cuando el schema decia DEFAULT 1500. Un valor guardado
-- pisa al default del plan (effectiveMessagesLimit), asi que esos usuarios se
-- saltaban el cupo real de su plan (free 20 / starter 200).
--
-- NULL = "sigue el plan": pasa a valer PLAN_DEFAULTS del plan vigente y el panel
-- puede volver a guardar un override manual cuando el dueño lo pida.
UPDATE users SET messages_limit = NULL WHERE messages_limit = 1500;
