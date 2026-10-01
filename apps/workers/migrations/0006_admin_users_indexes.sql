-- 0006: indice de orden para la vista de Clientes.
--
-- La consulta de Clientes hace `ORDER BY orphan, created DESC` sobre un
-- `UNION ALL`, y D1 la resolvia con `USE TEMP B-TREE FOR ORDER BY`: un sort en
-- memoria de TODOS los usuarios, en cada visita al panel. Medido en 10.000
-- usuarios: 51.63 ms y las 10.000 filas completas viajando al navegador.
--
-- Este indice NO arregla esa consulta por si sola: con `UNION ALL` + `ORDER BY`
-- global SQLite sigue materializando las dos ramas antes de ordenar (verificado:
-- 51.63 -> 49.80 ms al crear el indice). Lo que permite es que la paginacion por
-- rama, que hace 0006 en el worker, sea un `SEARCH ... ORDER BY created DESC
-- LIMIT ? OFFSET ?` sobre el indice, que si corta donde toca.
--
-- `createdAt` es TEXT (formato ISO de Better Auth) y ordena lexicograficamente
-- igual que cronologicamente, que es lo que hace comparables la fecha con
-- `datetime()` en los filtros de "vence esta semana".

CREATE INDEX IF NOT EXISTS idx_user_created ON "user"(createdAt DESC);

-- El filtro "vence esta semana" compara plan_expires_at contra una ventana de 7
-- dias. Sin este indice es un scan de todos los clientes en cada clic.
CREATE INDEX IF NOT EXISTS idx_users_plan_expires ON users(plan_expires_at);

-- El filtro por plan necesita el indice para no recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
