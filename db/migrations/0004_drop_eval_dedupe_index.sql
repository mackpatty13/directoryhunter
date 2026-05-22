-- Drop the unique index on (lower(niche), lower(metro)) so the UI re-run
-- button can create multiple evaluations for the same niche+metro over
-- time. The app-level dedupe check in createEvaluation() still prevents
-- accidental duplicates from the main "Evaluate" flow; the new force flag
-- on createEvaluation() is what the explicit re-run path uses, and it
-- needs this DB constraint gone to actually insert.

drop index if exists dh_evaluations_niche_metro_idx;
