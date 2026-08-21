-- Association peut enregistrer une distribution (INSERT dans baskets)
-- uniquement pour ses propres points de retrait
CREATE POLICY "Association enregistre une distribution"
  ON baskets FOR INSERT
  WITH CHECK (
    pickup_point_id IN (
      SELECT id FROM pickup_points
      WHERE association_profile_id = auth.uid()
    )
  );

-- Association peut mettre à jour le statut des paniers de ses points de retrait
CREATE POLICY "Association met à jour ses paniers"
  ON baskets FOR UPDATE
  USING (
    pickup_point_id IN (
      SELECT id FROM pickup_points
      WHERE association_profile_id = auth.uid()
    )
  );
