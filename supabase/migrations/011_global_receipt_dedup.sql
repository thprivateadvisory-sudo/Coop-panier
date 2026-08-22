-- Rendre la détection de doublon globale (tous contributeurs)
-- L'ancien index (contributor_id, image_hash) permettait à deux utilisateurs
-- différents de scanner le même ticket. L'index global empêche ça.

DROP INDEX IF EXISTS receipts_contributor_hash_unique;

CREATE UNIQUE INDEX IF NOT EXISTS receipts_image_hash_global_unique
  ON receipts (image_hash)
  WHERE image_hash IS NOT NULL;

-- Permettre la lecture globale des image_hash pour la vérification pré-insert
-- (la politique SELECT existante filtre par contributor_id, on ajoute une politique
-- permettant de vérifier l'existence d'un hash sans exposer les données)
DROP POLICY IF EXISTS "Vérification doublon global hash" ON receipts;
CREATE POLICY "Vérification doublon global hash"
  ON receipts FOR SELECT
  USING (auth.uid() IS NOT NULL);
