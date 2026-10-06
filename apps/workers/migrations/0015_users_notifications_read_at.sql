-- 0015_users_notifications_read_at.sql
--
-- Cursor de lectura de la campanita del panel: una sola columna por cuenta.
-- Se compara contra `created_at` (soporte y prospectos) y contra la fecha de
-- vencimiento del plan, asi que NO es idempotente y su backfill importa:
-- al instalarlo, "marcar como leido" lo que ya existia evita que la campanita
-- se abra con los 15 leads y los 5 tickets que ya estaban en la base como si
-- fueran notificaciones nuevas.
--
-- Formato: datetime('now') -> 'YYYY-MM-DD HH:MM:SS' UTC, identico al
-- CURRENT_TIMESTAMP de `created_at`, asi que la comparacion de strings del
-- cursor es correcta sin conversion de zona (el vencimiento del plan, que es
-- solo 'YYYY-MM-DD', se compara por fecha y se arriba en el codigo).
--
-- D1 registra la migracion por nombre de archivo (d1_migrations), asi que
-- corre una sola vez. NO es idempotente: SQLite no tiene "ADD COLUMN IF NOT
-- EXISTS"; para reaplicar hace falta otra migracion, no editar este archivo.
ALTER TABLE users ADD COLUMN notifications_read_at TEXT;

UPDATE users SET notifications_read_at = datetime('now') WHERE notifications_read_at IS NULL;
