-- 24-sep-2026: separar el mensaje de interés (interest) de la nota interna del dueño (notes)
ALTER TABLE leads ADD COLUMN interest TEXT;