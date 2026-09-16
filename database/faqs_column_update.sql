-- Migración: agrega la columna `faqs` a `agents`.
-- ⚠️ SOLO para D1 donde la columna aún no exista.
-- Si tu base ya tiene `faqs` (creada a mano), NO ejecutes este archivo: daría "duplicate column".
-- Para instalaciones nuevas, `schema.sql` ya la incluye.
ALTER TABLE agents ADD COLUMN faqs TEXT;