-- Migration 014 : Grants explicites pour service_role sur la table receipts
--
-- La migration 010 ajoutait GRANT à authenticated, mais pas à service_role.
-- En pratique, les routes API Next.js et la Edge Function utilisent la clé
-- service_role pour insérer dans receipts. Dans certaines configurations Supabase,
-- service_role n'hérite pas automatiquement des privileges sur les tables créées
-- via des migrations SQL — ce qui provoque l'erreur :
--   "permission denied for table receipts"
--
-- Ce correctif est idempotent : GRANT sur un rôle qui a déjà le droit ne cause pas d'erreur.

GRANT ALL ON TABLE receipts TO service_role;
GRANT ALL ON TABLE receipts TO postgres;

-- Réaffirme également les grants authenticated pour garantir la cohérence
-- (idempotent avec la migration 010)
GRANT SELECT, INSERT, UPDATE ON TABLE receipts TO authenticated;
