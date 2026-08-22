-- Ajoute la colonne amount si elle n'existe pas dans point_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'point_transactions' AND column_name = 'amount'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN amount INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Recrée la fonction credit_points pour s'assurer qu'elle est à jour
CREATE OR REPLACE FUNCTION credit_points(
  p_profile_id   UUID,
  p_amount       INTEGER,
  p_type         TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description  TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO point_transactions (profile_id, amount, type, reference_id, description)
  VALUES (p_profile_id, p_amount, p_type, p_reference_id, p_description);

  UPDATE contributor_profiles
  SET points_total     = points_total + p_amount,
      points_available = points_available + p_amount,
      tickets_scanned  = CASE WHEN p_type = 'earn_scan' THEN tickets_scanned + 1 ELSE tickets_scanned END
  WHERE profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
