-- Colonne pour stocker le hash de l'image du ticket
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS image_hash TEXT;

-- Index unique : un même hash ne peut pas être soumis deux fois par le même contributeur
CREATE UNIQUE INDEX IF NOT EXISTS receipts_contributor_hash_unique
  ON receipts (contributor_id, image_hash)
  WHERE image_hash IS NOT NULL;
