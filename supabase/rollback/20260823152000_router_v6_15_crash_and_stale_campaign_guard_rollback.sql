-- Rollback note:
-- This migration patches live function bodies by transforming their current
-- definitions. A reliable rollback is the previous known-good function bodies
-- from:
--   supabase/migrations/20260821125302_diversify_ot_baseline_fast_selector.sql
--   supabase/migrations/20260823143000_router_v6_10_dashboard_foundation_gap_lane.sql
--   supabase/migrations/20260822140300_router_v6_04_mode_and_campaign.sql
--
-- Reapply those function definitions if this guard needs to be reverted.
select 1;
