-- 0009: Agency pasa de 10 a 8 agentes (decisión 01-oct-2026, §9 del blueprint).
--
-- `agent_limit` NULL = sigue el plan, asi que las cuentas "al default" ya
-- quedan en 8 solas. Solo se normalizan las filas que guardaron el viejo
-- default 10 a mano (mismo criterio que aplica handleUserUpdate: el valor que
-- coincide con el default se guarda como NULL). Idempotente.
UPDATE users SET agent_limit = NULL WHERE plan = 'agency' AND agent_limit = 10;
