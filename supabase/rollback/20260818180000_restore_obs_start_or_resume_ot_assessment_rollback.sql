-- Rollback for 20260818180000_restore_obs_start_or_resume_ot_assessment.sql
--
-- WARNING: running this re-breaks the ordinary OT assessment start/resume
-- flow (obs_start_or_resume_ot_assessment_v2's non-focused-retest path
-- delegates directly to this function). Only run this if the restored
-- function itself turns out to be the problem -- not as a routine rollback.

drop function if exists public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
);
