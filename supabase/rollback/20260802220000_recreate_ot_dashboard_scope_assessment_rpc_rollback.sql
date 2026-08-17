-- Rollback for 20260802220000_recreate_ot_dashboard_scope_assessment_rpc.sql.
--
-- This migration only creates a function (plus grants/comment); it never
-- writes to assessment_attempts, assessment_answers, obs_ot_attempt_context,
-- or any other data table. Rollback is therefore a plain function drop with
-- no data-safety guard needed -- unlike the 34-book scope-repair rollback,
-- there are no rows to check for references before removing.
--
-- Before running this in an incident: disable/feature-gate the frontend's
-- book/section review cards (web/app/page.tsx assessmentHrefForScore,
-- web/app/knowledge-map/page.tsx sectionAssessmentHref/bookAssessmentHref)
-- first, or users clicking them will immediately return to the pre-fix
-- PostgREST function-not-found failure this migration closed.
--
-- Any assessment_attempts rows already created via this RPC while it was
-- live (assessment_kind = 'ot_adaptive' with a scope_key other than 'OT')
-- are left completely untouched by this rollback -- they remain valid,
-- resolvable attempts (their scope_key still has a live assessment_scopes
-- row) and are not deleted, updated, or otherwise affected. Only the
-- function used to start/resume such attempts is removed; existing attempts
-- can still be resumed by whatever other path reaches them, if any, or
-- simply remain as historical records.

begin;

set local lock_timeout = '5s';

drop function if exists public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
);

notify pgrst, 'reload schema';

commit;

-- Rollback reopens the production defect (every OT book/section review card
-- click on the deployed frontend will fail again) and is not a release-ready
-- steady state. Re-deploy the forward migration once the incident is
-- resolved, or ship a frontend change that stops generating mode=scope
-- links if the product decision changes.
