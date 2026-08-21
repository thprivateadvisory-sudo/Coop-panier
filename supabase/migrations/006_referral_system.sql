-- Système de parrainage : codes de référence + bonus points
-- Parrain reçoit 100 pts, filleul reçoit 50 pts à l'inscription

-- Colonnes sur contributor_profiles
ALTER TABLE contributor_profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   TEXT;

-- Génération automatique d'un code de parrainage à la création du profil contributeur
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $func$
DECLARE
  v_code TEXT;
  v_attempt INTEGER := 0;
BEGIN
  LOOP
    -- 6 caractères alphanumériques majuscules (ex: X3K9PL)
    v_code := upper(substring(md5(NEW.profile_id::text || clock_timestamp()::text || v_attempt::text) FROM 1 FOR 6));
    BEGIN
      UPDATE contributor_profiles SET referral_code = v_code WHERE profile_id = NEW.profile_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 10 THEN RAISE EXCEPTION 'Impossible de générer un code unique'; END IF;
    END;
  END LOOP;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON contributor_profiles;
CREATE TRIGGER trg_generate_referral_code
  AFTER INSERT ON contributor_profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- Traitement du bonus de parrainage lors de la création d'un profil
CREATE OR REPLACE FUNCTION handle_referral_bonus()
RETURNS TRIGGER AS $func$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- Rien à faire si pas de code de parrainage
  IF NEW.referred_by IS NULL OR NEW.referred_by = '' THEN
    RETURN NEW;
  END IF;

  -- Trouver le parrain par son code
  SELECT profile_id INTO v_referrer_id
  FROM contributor_profiles
  WHERE referral_code = upper(trim(NEW.referred_by));

  -- Parrain introuvable : on ignore silencieusement
  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ne pas se parrainer soi-même
  IF v_referrer_id = NEW.profile_id THEN
    RETURN NEW;
  END IF;

  -- Bonus parrain : +100 pts
  PERFORM credit_points(
    v_referrer_id,
    100,
    'earn_bonus',
    NULL,
    'Bonus parrainage — filleul inscrit'
  );

  -- Bonus filleul : +50 pts
  PERFORM credit_points(
    NEW.profile_id,
    50,
    'earn_bonus',
    NULL,
    'Bonus bienvenue — parrainage accepté'
  );

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_referral_bonus ON contributor_profiles;
CREATE TRIGGER trg_referral_bonus
  AFTER INSERT ON contributor_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_referral_bonus();

-- Mise à jour de create_user_profile pour accepter un code de parrainage
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id      UUID,
  p_email        TEXT,
  p_full_name    TEXT,
  p_role         TEXT,
  p_referral_code TEXT DEFAULT NULL
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
    INSERT INTO contributor_profiles (profile_id, subscription_tier, points_available, points_total, tickets_scanned, baskets_funded, referred_by)
    VALUES (p_user_id, 'free', 0, 0, 0, 0, upper(trim(p_referral_code)))
    ON CONFLICT (profile_id) DO NOTHING;

  ELSIF p_role = 'beneficiary' THEN
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

-- Corriger le trigger impact_stats
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
