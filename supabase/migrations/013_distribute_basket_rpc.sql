-- Distribution atomique d'un panier — élimine la race condition
-- Remplace le SELECT + UPDATE séparés côté client

CREATE OR REPLACE FUNCTION distribute_basket(
  p_beneficiary_profile_id UUID,
  p_distributor_profile_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_basket_id UUID;
  v_baskets_received INTEGER;
BEGIN
  -- Verrou row-level : un seul agent peut prendre ce panier
  SELECT id INTO v_basket_id
  FROM baskets
  WHERE beneficiary_profile_id = p_beneficiary_profile_id
    AND status = 'assigned'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_basket_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NO_BASKET_ASSIGNED');
  END IF;

  UPDATE baskets
  SET status = 'distributed',
      distributed_at = NOW()
  WHERE id = v_basket_id;

  -- Incrément atomique côté DB
  UPDATE beneficiary_profiles
  SET baskets_received = baskets_received + 1
  WHERE profile_id = p_beneficiary_profile_id
  RETURNING baskets_received INTO v_baskets_received;

  RETURN jsonb_build_object(
    'basket_id', v_basket_id,
    'baskets_received', v_baskets_received
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION distribute_basket(UUID, UUID) TO authenticated;
