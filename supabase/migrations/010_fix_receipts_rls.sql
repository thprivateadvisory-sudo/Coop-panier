-- Recrée les politiques RLS sur la table receipts pour s'assurer qu'elles existent
-- et sont correctes. La politique INSERT était absente en production.

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contributeur voit ses propres tickets" ON receipts;
DROP POLICY IF EXISTS "Contributeur crée ses tickets" ON receipts;
DROP POLICY IF EXISTS "Contributeur met à jour ses tickets" ON receipts;

CREATE POLICY "Contributeur voit ses propres tickets"
  ON receipts FOR SELECT
  USING (auth.uid() = contributor_id);

CREATE POLICY "Contributeur crée ses tickets"
  ON receipts FOR INSERT
  WITH CHECK (auth.uid() = contributor_id);

CREATE POLICY "Contributeur met à jour ses tickets"
  ON receipts FOR UPDATE
  USING (auth.uid() = contributor_id)
  WITH CHECK (auth.uid() = contributor_id);
