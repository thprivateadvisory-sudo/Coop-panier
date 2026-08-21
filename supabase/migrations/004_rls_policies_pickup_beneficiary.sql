-- RLS manquantes pour le flux association ↔ bénéficiaire

-- Association peut créer et modifier ses propres points de retrait
CREATE POLICY "Association crée ses points de retrait"
  ON pickup_points FOR INSERT
  WITH CHECK (auth.uid() = association_profile_id);

CREATE POLICY "Association modifie ses points de retrait"
  ON pickup_points FOR UPDATE
  USING (auth.uid() = association_profile_id);

-- Bénéficiaire peut modifier son propre profil (ex: rejoindre un point de retrait)
CREATE POLICY "Bénéficiaire modifie son propre profil"
  ON beneficiary_profiles FOR UPDATE
  USING (auth.uid() = profile_id);

-- Association peut approuver / suspendre les bénéficiaires de ses propres points de retrait
CREATE POLICY "Association gère ses bénéficiaires"
  ON beneficiary_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pickup_points
      WHERE pickup_points.id = beneficiary_profiles.pickup_point_id
        AND pickup_points.association_profile_id = auth.uid()
    )
  );
