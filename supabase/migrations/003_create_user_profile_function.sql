-- Fonction SECURITY DEFINER pour créer un profil utilisateur complet
-- Contourne RLS, gère les doublons via ON CONFLICT DO NOTHING
-- N'utilise pas pgcrypto (md5 est natif PostgreSQL)

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id   UUID,
  p_email     TEXT,
  p_full_name TEXT,
  p_role      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (p_user_id, p_email, p_full_name, p_role)
  ON CONFLICT (id) DO NOTHING;

  IF p_role = 'contributor' THEN
    INSERT INTO contributor_profiles (profile_id, subscription_tier, points_available, points_total, tickets_scanned, baskets_funded)
    VALUES (p_user_id, 'free', 0, 0, 0, 0)
    ON CONFLICT (profile_id) DO NOTHING;

  ELSIF p_role = 'beneficiary' THEN
    -- md5() est natif PostgreSQL, pas besoin de pgcrypto
    INSERT INTO beneficiary_profiles (profile_id, qr_code, status, baskets_received)
    VALUES (p_user_id, md5(p_user_id::text || clock_timestamp()::text), 'waitlist', 0)
    ON CONFLICT (profile_id) DO NOTHING;

  ELSIF p_role = 'association' THEN
    INSERT INTO association_profiles (profile_id, association_name, address, city, postal_code)
    VALUES (p_user_id, p_full_name, '', '', '')
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;
END;
$func$;

-- Corriger le trigger impact_stats qui bloque via PGRST112 :
-- le UPDATE sans WHERE est valide en SQL natif mais PostgREST le rejette
-- quand il remonte via RPC. On ajoute un WHERE id IS NOT NULL.
CREATE OR REPLACE FUNCTION update_impact_on_new_profile()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.role = 'contributor' THEN
    UPDATE impact_stats
    SET total_contributors = total_contributors + 1, updated_at = NOW()
    WHERE id IS NOT NULL;
  ELSIF NEW.role = 'beneficiary' THEN
    UPDATE impact_stats
    SET total_beneficiaries = total_beneficiaries + 1, updated_at = NOW()
    WHERE id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
