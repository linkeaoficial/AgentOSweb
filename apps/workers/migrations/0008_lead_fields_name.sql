-- 0008: el nombre entra por defecto en la captura de prospectos.
--
-- `lead_fields` arrancaba en 'email,phone', asi que el chip "Nombre" salia
-- desmarcado y el regex de nombre de `captureLead` se saltaba (devuelve null si
-- "name" no esta en la lista): escribir "me llamo Juan" no creaba lead.
--
-- El default de la columna no se puede tocar con ALTER en SQLite sin reconstruir
-- la tabla, asi que el default nuevo vive en dos sitios que si mandan para las
-- filas nuevas: `DEFAULT_LEAD_FIELDS` en index.ts (fallbacks y INSERT explicito
-- de `ensureDefaultAgent` / `handleAgentCreate`) y el DEFAULT de schema.sql.
-- Aqui solo se corrigen las filas existentes; es idempotente.

UPDATE agents SET lead_fields = 'name,email,phone' WHERE lead_fields = 'email,phone';
