-- 0004_leads_updated_at.sql
--
-- `leads` solo tenia `created_at`. El panel de Prospectos no tenia forma de
-- saber si un prospecto habia cambiado desde la ultima lectura, asi que para
-- "en vivo" habia que releer la lista COMPLETA cada 30 s. Con `updated_at` el
-- sondeo delta lee solo lo que se creo o cambio despues del cursor.
--
-- Formato identico al de `created_at` (CURRENT_TIMESTAMP -> 'YYYY-MM-DD HH:MM:SS'
-- en UTC) para que la comparacion de strings del cursor sea correcta.
--
-- D1 registra las migraciones por nombre de archivo (d1_migrations), asi que esto
-- corre una sola vez. NO es idempotente: SQLite no tiene "ADD COLUMN IF NOT
-- EXISTS"; para reaplicar hace falta un 0005, no editar este archivo.
--
-- Los prospectos existentes reciben created_at como updated_at. Si no, al primer
-- sondeo delta posterior al deploy el cursor arrancaria en NULL y habria que
-- traer toda la tabla una vez; el backfill lo evita.
--
-- SQLite RECHAZA este default en un ALTER: "Cannot add a column with
-- non-constant default" (verificado contra SQLite 3.x, no es suposicion). Por eso
-- la columna va sin DEFAULT y son los INSERT del worker los que escriben
-- CURRENT_TIMESTAMP explicito. Son dos, y el sondeo delta depende de que no queden
-- filas con la columna en NULL.
--
-- INVARIANTE: `leads.updated_at` nunca es NULL. La sostienen (a) este backfill,
-- (b) los dos INSERT INTO leads del worker y (c) los dos UPDATE sobre leads.
-- Importa porque el sondeo en vivo compara contra `updated_at` a secas, que es
-- lo unico que hace que el indice entregue un rango en vez de leer los leads del
-- agente enteros. Un INSERT futuro que se olvide la columna haria que ese
-- prospecto no aparezca en el sondeo en vivo (si en el listado normal, que no
-- usa cursor).
ALTER TABLE leads ADD COLUMN updated_at DATETIME;

UPDATE leads SET updated_at = created_at WHERE updated_at IS NULL;

-- Indices del camino caliente del panel. D1 factura por filas LEIDAS, no por
-- filas devueltas, asi que sin estos indices cada filtro por estado y cada
-- sondeo delta recorren todos los leads del agente.
--   - (agent_id, status):    WHERE agent_id = ? AND status = ? (pastilla + KPI).
--   - (agent_id, name):      ORDER BY name de la tabla.
--   - (agent_id, updated_at): sondeo delta acotado, salta directo al cursor.
-- Se dejan como tres indices simples y no uno compuesto de (agent_id, status,
-- updated_at): cada consulta usa una columna distinta y los indices compuestos
-- solo se aprovechan cuando se incluyen TODAS las columnas a la izquierda.
CREATE INDEX IF NOT EXISTS idx_leads_agent_status  ON leads(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_agent_name    ON leads(agent_id, name);
CREATE INDEX IF NOT EXISTS idx_leads_agent_updated ON leads(agent_id, updated_at);
