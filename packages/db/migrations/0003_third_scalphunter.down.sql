-- Reversible companion for 0003_third_scalphunter.sql (Phase 1 quality bar).
-- Read-model tables only; dropping them destroys no source-of-truth data, since
-- every value is recomputable from the canonical tables by the snapshot job.
DROP TABLE IF EXISTS "segment_snapshots";
--> statement-breakpoint
DROP TABLE IF EXISTS "analytics_snapshots";
