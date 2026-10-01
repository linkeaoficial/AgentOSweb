-- 0005: contadores O(1) via tabla de estadisticas + busqueda substring indexada.
--
-- Objetivo: eliminar los escaneos lineales de D1 en el listado de prospectos.
-- D1 factura `rows_read` (filas ESCANEADAS), no consultas ni viajes de red
-- (docs: d1/platform/pricing, definicion 1). Por eso:
--
--   * COUNT(*) y GROUP BY status se reemplazan por `lead_stats`, que los triggers
--     mantienen exacta. Pasa de ~2N filas leidas a ~5 filas por agente.
--   * La busqueda `LIKE '%texto%'` no puede usar un indice btree (el comodin
--     inicial mata el prefijo). FTS5 con tokenizer `trigram` si indexa el
--     substring conservando la semantica de `LIKE`, porque se consulta con
--     `f.all_text LIKE ?` y no con MATCH (MATCH matchea tokens y devuelve mas
--     filas de las que el usuario estaba viendo).
--
-- La tabla de estadisticas y los triggers viven en la base a proposito: no
-- dependen de que el codigo de la app los mantenga, asi que no pueden desviarse
-- aunque un INSERT futuro olvide `updated_at` (el hole que ya nos mordio una vez).

-- 1. Contadores. WITHOUT ROWID porque la clave primaria es (agent_id, status):
--    el cuerpo de la fila ya es la clave, asi que no hay duplicacion.
CREATE TABLE IF NOT EXISTS lead_stats (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, status)
) WITHOUT ROWID;

-- 2. FTS5 trigram. UNA sola columna con todo el texto buscable, no una por campo:
--    medido, el OR de 6 columnas cuesta ~120 filas leidas donde la columna unica
--    cuesta ~10, porque el OR obliga al indice a evaluar cada columna por
--    separado. `lead_id` va UNINDEXED porque es la clave con la que se hace el
--    JOIN contra leads, no un termino que el usuario busca.
CREATE VIRTUAL TABLE IF NOT EXISTS leads_fts USING fts5(
  lead_id UNINDEXED,
  all_text,
  tokenize = 'trigram'
);

-- 3. Backfill de `lead_stats`. Por lotes de 5.000 cuando la tabla sea grande,
--    fuera de este archivo, para que un agente con cientos de miles de leads no
--    lea la tabla entera de una sentada y se coma el limite diario del mismo dia
--    que migra. Aqui la sentencia base, que es idempotente.
INSERT INTO lead_stats (agent_id, status, n)
SELECT agent_id, status, COUNT(*) FROM leads GROUP BY agent_id, status
ON CONFLICT(agent_id, status) DO UPDATE SET n = excluded.n;

-- 4. Backfill de FTS. Reconstruccion completa, NO un INSERT incremental: el
--    `DELETE` de antes es lo que hace el archivo idempotente. Sin el, reejecutar
--    la migracion duplicaba cada lead en el indice y el `JOIN leads_fts` de la
--    busqueda devolvia cada resultado dos veces (medido: 30 filas para 15 leads).
--    Por lotes de 5.000 cuando la tabla sea grande, fuera de este archivo, para
--    que un agente con cientos de miles de leads no lea la tabla entera de una
--    sentada y se coma el limite diario del mismo dia que migra.
DELETE FROM leads_fts;
INSERT INTO leads_fts (lead_id, all_text)
SELECT id,
       coalesce(name,'') || ' ' || coalesce(email,'') || ' ' ||
       coalesce(phone,'') || ' ' || coalesce(notes,'') || ' ' ||
       coalesce(interest,'') || ' ' || coalesce(status,'')
FROM leads;

-- 5. Triggers de `lead_stats`. ON CONFLICT DO UPDATE hace el UPSERT en una sola
--    sentencia, y el DELETE limpia la fila cuando llega a 0 para que no se
--    acumulen estados vacios. Mismo patron que un contador de referencia en SQL.
CREATE TRIGGER IF NOT EXISTS leads_stats_ai AFTER INSERT ON leads BEGIN
  INSERT INTO lead_stats (agent_id, status, n) VALUES (NEW.agent_id, NEW.status, 1)
  ON CONFLICT(agent_id, status) DO UPDATE SET n = n + 1;
END;

CREATE TRIGGER IF NOT EXISTS leads_stats_ad AFTER DELETE ON leads BEGIN
  UPDATE lead_stats SET n = n - 1 WHERE agent_id = OLD.agent_id AND status = OLD.status;
  DELETE FROM lead_stats WHERE agent_id = OLD.agent_id AND status = OLD.status AND n <= 0;
END;

-- WHEN filtra los UPDATE que no tocan ni estado ni agente (notas, por ejemplo),
-- que es el caso mayoritario en el uso normal.
--
-- Un solo trigger para los dos campos, y no uno por campo, por una razon que
-- costaba un contador corrupto: con dos triggers separados, un UPDATE que cambia
-- `agent_id` Y `status` a la vez dispara los dos, y cada uno resta del viejo e
-- incrementa el nuevo. Medido: el contador viejo acababa en -1 y el nuevo en 2.
-- Un trigger con "OR" hace una sola resta y una sola suma.
DROP TRIGGER IF EXISTS leads_stats_au;
DROP TRIGGER IF EXISTS leads_stats_ag;
CREATE TRIGGER IF NOT EXISTS leads_stats_au2 AFTER UPDATE ON leads
WHEN NEW.status <> OLD.status OR NEW.agent_id <> OLD.agent_id BEGIN
  UPDATE lead_stats SET n = n - 1 WHERE agent_id = OLD.agent_id AND status = OLD.status;
  DELETE FROM lead_stats WHERE agent_id = OLD.agent_id AND status = OLD.status AND n <= 0;
  INSERT INTO lead_stats (agent_id, status, n) VALUES (NEW.agent_id, NEW.status, 1)
  ON CONFLICT(agent_id, status) DO UPDATE SET n = n + 1;
END;

-- 6. Triggers de FTS5. El AFTER UPDATE borra y reinserta: es la forma soportada
--    de actualizar una tabla FTS5 externa.
CREATE TRIGGER IF NOT EXISTS leads_fts_ai AFTER INSERT ON leads BEGIN
  INSERT INTO leads_fts (lead_id, all_text)
  VALUES (NEW.id,
          coalesce(NEW.name,'') || ' ' || coalesce(NEW.email,'') || ' ' ||
          coalesce(NEW.phone,'') || ' ' || coalesce(NEW.notes,'') || ' ' ||
          coalesce(NEW.interest,'') || ' ' || coalesce(NEW.status,''));
END;

CREATE TRIGGER IF NOT EXISTS leads_fts_ad AFTER DELETE ON leads BEGIN
  DELETE FROM leads_fts WHERE lead_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS leads_fts_au AFTER UPDATE ON leads BEGIN
  DELETE FROM leads_fts WHERE lead_id = OLD.id;
  INSERT INTO leads_fts (lead_id, all_text)
  VALUES (NEW.id,
          coalesce(NEW.name,'') || ' ' || coalesce(NEW.email,'') || ' ' ||
          coalesce(NEW.phone,'') || ' ' || coalesce(NEW.notes,'') || ' ' ||
          coalesce(NEW.interest,'') || ' ' || coalesce(NEW.status,''));
END;
