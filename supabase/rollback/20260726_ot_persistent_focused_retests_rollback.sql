-- Roll back persistent OT assessment and focused-retest objects.
--
-- Existing assessment attempts and answers are preserved. The context rows and
-- additive RPCs are removed.

begin;

drop function if exists public.obs_submit_ot_assessment_answer(uuid, uuid, text);
drop function if exists public.obs_get_next_ot_assessment_question(uuid);
drop function if exists public.obs_get_ot_assessment_status(uuid);
drop function if exists public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
);
drop table if exists public.obs_ot_attempt_context;

notify pgrst, 'reload schema';

commit;
