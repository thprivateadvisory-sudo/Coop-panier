-- Contrainte DB anti-fraude : montant ticket entre 0.01 € et 300 €
-- À appliquer dans Supabase SQL Editor

ALTER TABLE receipts
  ADD CONSTRAINT receipts_amount_range
  CHECK (total_amount > 0 AND total_amount <= 300);
