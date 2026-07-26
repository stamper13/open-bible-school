begin;

drop view if exists public.obs_admin_question_bank_audit_summary;
drop view if exists public.obs_admin_assessment_readiness;
drop view if exists public.obs_admin_distractor_audit;
drop view if exists public.obs_admin_difficulty_audit;
drop view if exists public.obs_admin_repetition_audit;
drop view if exists public.obs_admin_coverage_audit;
drop view if exists public.obs_admin_question_bank_audit;

notify pgrst, 'reload schema';

commit;
