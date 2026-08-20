-- Fonction atomique pour créditer des points et mettre à jour le profil contributeur
CREATE OR REPLACE FUNCTION credit_points(
  p_profile_id   UUID,
  p_amount       INTEGER,
  p_type         TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description  TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
  -- Journal de transaction
  INSERT INTO point_transactions (profile_id, amount, type, reference_id, description)
  VALUES (p_profile_id, p_amount, p_type, p_reference_id, p_description);

  -- Mise à jour des totaux (déclenche le realtime vers l'appli)
  UPDATE contributor_profiles
  SET points_total     = points_total + p_amount,
      points_available = points_available + p_amount,
      tickets_scanned  = CASE WHEN p_type = 'earn_scan' THEN tickets_scanned + 1 ELSE tickets_scanned END
  WHERE profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fonction pour dépenser des points (financer un panier)
CREATE OR REPLACE FUNCTION spend_points_for_basket(
  p_contributor_id UUID,
  p_basket_id      UUID
)
RETURNS VOID AS $$
DECLARE
  v_points_required INTEGER;
  v_available       INTEGER;
BEGIN
  SELECT points_required INTO v_points_required FROM baskets WHERE id = p_basket_id;
  SELECT points_available INTO v_available FROM contributor_profiles WHERE profile_id = p_contributor_id;

  IF v_available < v_points_required THEN
    RAISE EXCEPTION 'Points insuffisants';
  END IF;

  -- Débit
  UPDATE contributor_profiles
  SET points_available = points_available - v_points_required,
      baskets_funded   = baskets_funded + 1
  WHERE profile_id = p_contributor_id;

  -- Journal
  INSERT INTO point_transactions (profile_id, amount, type, reference_id, description)
  VALUES (p_contributor_id, -v_points_required, 'spend_basket', p_basket_id, 'Financement d''un panier alimentaire');

  -- Mise à jour du panier
  UPDATE baskets
  SET status            = 'funded',
      funded_by_profile_id = p_contributor_id,
      funded_at         = NOW()
  WHERE id = p_basket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
