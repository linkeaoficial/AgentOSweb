-- Migración: límite de agentes por usuario (override del plan).
-- NULL = usa el valor por defecto del plan (PLAN_DEFAULTS en el worker).
-- Ejecutar: npx wrangler d1 execute agentosweb-db --remote --file=../database/agent_limit_column_update.sql
ALTER TABLE users ADD COLUMN agent_limit INTEGER;
