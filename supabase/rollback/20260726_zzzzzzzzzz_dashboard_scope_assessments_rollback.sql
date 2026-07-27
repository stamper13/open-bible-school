begin;

drop function if exists public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
);

notify pgrst, 'reload schema';

commit;
