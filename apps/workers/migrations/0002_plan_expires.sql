-- 0002_plan_expires.sql
--
-- Vencimiento del plan por cuenta. La tabla `users` solo tenia `created_at`
-- (fecha de alta); la facturacion es manual, asi que no habia forma de saber
-- cuando se vence el plan de un cliente. El panel lo muestra en el detalle de
-- cuenta y lo permite editar.
--
-- TEXT (ISO 'YYYY-MM-DD') y no DATE a proposito: se escribe y se lee como
-- string desde el panel sin conversiones, y NULL = "sin vencimiento" (cuentas
-- legacy o planes Vitalicios) en vez de inventar una fecha.
--
-- D1 registra las migraciones aplicadas por nombre de archivo (tabla
-- d1_migrations), asi que este archivo corre una sola vez por base. NO es
-- idempotente: SQLite no tiene "ADD COLUMN IF NOT EXISTS", y volver a
-- ejecutarlo a mano da error "duplicate column name". Para volver a correrlo
-- hace falta un archivo nuevo (0003_...), no editar este.

ALTER TABLE users ADD COLUMN plan_expires_at TEXT;

-- Backfill: las cuentas que ya existian quedan con la columna en NULL, que la
-- UI lee como "Sin vencimiento". Eso dejaria al cliente de sempre sin fecha
-- hasta que el dueño la escribiera a mano, que es justo el trabajo manual que
-- esto viene a sacar. Se les da un mes desde hoy, igual que una cuenta nueva.
-- No toca las que ya tienen fecha (la columna es nueva, pero el archivo puede
-- reaplicarse sobre una base restaurada).
--
-- date('now','+1 month') es aritmetica de calendario SIN clamp (31-ene daria
-- 3-mar), a diferencia de periodEnd() en el worker. Aqui es inocuo: corre una
-- sola vez y hoy es dia 29. Si alguna vez se reusa en otro mes, cambiarlo por la
-- version con clamp.
UPDATE users SET plan_expires_at = date('now', '+1 month') WHERE plan_expires_at IS NULL;
