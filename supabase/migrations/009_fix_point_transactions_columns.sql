-- Ajoute les colonnes manquantes type et description
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'earn_scan';
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

-- Recrée credit_points avec toutes les colonnes correctes
CREATE OR REPLACE FUNCTION credit_points(
  p_profile_id   UUID,
  p_amount       INTEGER,
  p_type         TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description  TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO point_transactions (profile_id, points_earned, amount_eur, multiplier, type, description)
  VALUES (p_profile_id, p_amount, 0, 1, p_type, p_description);

  UPDATE contributor_profiles
  SET points_total     = points_total + p_amount,
      points_available = points_available + p_amount,
      tickets_scanned  = CASE WHEN p_type = 'earn_scan' THEN tickets_scanned + 1 ELSE tickets_scanned END
  WHERE profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
