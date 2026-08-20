-- =============================================================
-- Coop'Panier — Schéma initial Supabase
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================
-- PROFILES — table centrale, liée à auth.users
-- =============================================================
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('contributor', 'beneficiary', 'association')),
  avatar_url   TEXT,
  phone        TEXT,
  city         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chaque utilisateur voit son propre profil"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Chaque utilisateur modifie son propre profil"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- =============================================================
-- CONTRIBUTOR_PROFILES
-- =============================================================
CREATE TABLE contributor_profiles (
  profile_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  points_total         INTEGER NOT NULL DEFAULT 0,
  points_available     INTEGER NOT NULL DEFAULT 0,
  subscription_tier    TEXT NOT NULL DEFAULT 'free'
                         CHECK (subscription_tier IN ('free', 'essentiel', 'engagement')),
  subscription_expires_at TIMESTAMPTZ,
  stripe_customer_id   TEXT UNIQUE,
  tickets_scanned      INTEGER NOT NULL DEFAULT 0,
  baskets_funded       INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE contributor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contributeur voit son propre profil"
  ON contributor_profiles FOR SELECT USING (auth.uid() = profile_id);

-- =============================================================
-- BENEFICIARY_PROFILES
-- =============================================================
CREATE TABLE beneficiary_profiles (
  profile_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  qr_code          TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  pickup_point_id  UUID,
  status           TEXT NOT NULL DEFAULT 'waitlist'
                     CHECK (status IN ('waitlist', 'active', 'suspended')),
  baskets_received INTEGER NOT NULL DEFAULT 0,
  next_pickup_date TIMESTAMPTZ
);

ALTER TABLE beneficiary_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bénéficiaire voit sa propre carte"
  ON beneficiary_profiles FOR SELECT USING (auth.uid() = profile_id);

-- =============================================================
-- ASSOCIATION_PROFILES
-- =============================================================
CREATE TABLE association_profiles (
  profile_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  association_name   TEXT NOT NULL,
  siret              TEXT,
  address            TEXT NOT NULL,
  city               TEXT NOT NULL,
  postal_code        TEXT NOT NULL,
  validated          BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE association_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Association voit son propre profil"
  ON association_profiles FOR SELECT USING (auth.uid() = profile_id);

-- =============================================================
-- PICKUP_POINTS — points de retrait gérés par les associations
-- =============================================================
CREATE TABLE pickup_points (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_profile_id UUID NOT NULL REFERENCES association_profiles(profile_id),
  name                  TEXT NOT NULL,
  address               TEXT NOT NULL,
  city                  TEXT NOT NULL,
  postal_code           TEXT NOT NULL,
  latitude              NUMERIC(9, 6),
  longitude             NUMERIC(9, 6),
  opening_hours         JSONB NOT NULL DEFAULT '{}',
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pickup_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tout utilisateur connecté voit les points de retrait actifs"
  ON pickup_points FOR SELECT
  USING (active = TRUE AND auth.uid() IS NOT NULL);

-- =============================================================
-- RECEIPTS — tickets de caisse scannés
-- =============================================================
CREATE TABLE receipts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contributor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url        TEXT NOT NULL,
  store_name       TEXT,
  total_amount     NUMERIC(10, 2),
  purchase_date    DATE,
  points_earned    INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'validated', 'rejected')),
  ocr_confidence   NUMERIC(4, 3),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contributeur voit ses propres tickets"
  ON receipts FOR SELECT USING (auth.uid() = contributor_id);
CREATE POLICY "Contributeur crée ses tickets"
  ON receipts FOR INSERT WITH CHECK (auth.uid() = contributor_id);

-- =============================================================
-- BASKETS — paniers alimentaires
-- =============================================================
CREATE TABLE baskets (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  value_eur               NUMERIC(6, 2) NOT NULL DEFAULT 25.00,
  points_required         INTEGER NOT NULL DEFAULT 500,
  funded_by_profile_id    UUID REFERENCES profiles(id),
  beneficiary_profile_id  UUID REFERENCES profiles(id),
  pickup_point_id         UUID REFERENCES pickup_points(id),
  status                  TEXT NOT NULL DEFAULT 'funding'
                            CHECK (status IN ('funding', 'funded', 'assigned', 'distributed')),
  funded_at               TIMESTAMPTZ,
  distributed_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE baskets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tout utilisateur connecté voit les paniers"
  ON baskets FOR SELECT USING (auth.uid() IS NOT NULL);

-- =============================================================
-- POINT_TRANSACTIONS — journal de tous les mouvements de points
-- =============================================================
CREATE TABLE point_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  type         TEXT NOT NULL
                 CHECK (type IN ('earn_scan', 'earn_purchase', 'earn_bonus', 'spend_basket', 'expire')),
  reference_id UUID,
  description  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Utilisateur voit ses propres transactions"
  ON point_transactions FOR SELECT USING (auth.uid() = profile_id);

-- =============================================================
-- IMPACT_STATS — compteurs globaux temps réel (1 seule ligne)
-- =============================================================
CREATE TABLE impact_stats (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baskets_distributed  INTEGER NOT NULL DEFAULT 0,
  families_helped      INTEGER NOT NULL DEFAULT 0,
  cities_covered       INTEGER NOT NULL DEFAULT 0,
  total_contributors   INTEGER NOT NULL DEFAULT 0,
  total_beneficiaries  INTEGER NOT NULL DEFAULT 0,
  total_points_issued  BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pas de RLS sur impact_stats — lecture publique
INSERT INTO impact_stats DEFAULT VALUES;

-- =============================================================
-- WAITLIST — liste d'attente landing page
-- =============================================================
CREATE TABLE waitlist (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('contributor', 'beneficiary', 'association')),
  city       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accès public en écriture pour la landing page (avec contrainte UNIQUE sur email)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tout le monde peut rejoindre la liste d'attente"
  ON waitlist FOR INSERT WITH CHECK (TRUE);

-- =============================================================
-- FONCTIONS — mise à jour automatique de impact_stats
-- =============================================================

-- Appelé après validation d'un ticket → met à jour les compteurs
CREATE OR REPLACE FUNCTION update_impact_on_receipt_validate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'validated' AND OLD.status = 'pending' THEN
    UPDATE impact_stats
    SET total_points_issued = total_points_issued + NEW.points_earned,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_receipt_validate
  AFTER UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_impact_on_receipt_validate();

-- Appelé après distribution d'un panier
CREATE OR REPLACE FUNCTION update_impact_on_basket_distribute()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'distributed' AND OLD.status != 'distributed' THEN
    UPDATE impact_stats
    SET baskets_distributed = baskets_distributed + 1,
        families_helped = families_helped + 1,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_basket_distribute
  AFTER UPDATE ON baskets
  FOR EACH ROW EXECUTE FUNCTION update_impact_on_basket_distribute();

-- Appelé à la création d'un profil → met à jour les compteurs d'inscrits
CREATE OR REPLACE FUNCTION update_impact_on_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'contributor' THEN
    UPDATE impact_stats SET total_contributors = total_contributors + 1, updated_at = NOW();
  ELSIF NEW.role = 'beneficiary' THEN
    UPDATE impact_stats SET total_beneficiaries = total_beneficiaries + 1, updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_new_profile
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_impact_on_new_profile();

-- =============================================================
-- REALTIME — activer les publications temps réel
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE impact_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE contributor_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE beneficiary_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE baskets;
