-- Rollback for the 20260723 backend feature migrations.
--
-- This removes learner snapshots, study events, admin review metadata, and the
-- persistent NT RPCs. It preserves the additive assessment_attempt columns
-- because testament and scope_key predate this package and the other columns
-- may contain attempt history after deployment.

begin;

drop function if exists public.obs_get_nt_assessment_status(uuid);
drop function if exists public.obs_submit_nt_assessment_answer(uuid, uuid, text);
drop function if exists public.obs_get_next_nt_assessment_question(uuid);
drop function if exists public.obs_start_nt_assessment(text, text, integer);
drop function if exists public.obs_nt_question_matches_scope(text, text, text);
drop function if exists public.obs_nt_scope_key(text, text);

drop index if exists public.assessment_attempts_user_testament_idx;

update public.ot_generated_questions question
set question_type = review.original_question_type
from public.obs_question_review_status review
where review.generated_question_id = question.id
  and question.question_type like 'quarantined_review|%'
  and review.original_question_type is not null;

drop function if exists public.obs_admin_get_question_quality_queue(
  text, boolean, text, text, integer, integer
);
drop function if exists public.obs_admin_set_question_review_status(uuid, text, text);
drop view if exists public.obs_admin_coverage_quality;
drop view if exists public.obs_admin_question_quality;
drop table if exists public.obs_question_review_status;

drop trigger if exists obs_capture_snapshot_after_answer
  on public.assessment_answers;
drop function if exists public.obs_snapshot_answer_trigger();
drop function if exists public.obs_record_study_event(
  uuid, text, text, uuid, jsonb
);
drop function if exists public.obs_get_scope_summary(uuid, text, text);
drop function if exists public.obs_get_bli_uncertainty(uuid, text);
drop function if exists public.obs_get_attempt_review(uuid, uuid);
drop function if exists public.obs_get_attempt_summary(uuid, uuid);
drop function if exists public.obs_get_progress_history(uuid, text, integer);
drop function if exists public.obs_backfill_assessment_snapshots(uuid);
drop function if exists public.obs_capture_assessment_snapshot(uuid);
drop function if exists public.obs_compute_scoped_bli(
  uuid, text, timestamp with time zone
);
drop view if exists public.obs_answer_evidence;
drop function if exists public.obs_display_bli_level(integer);
drop function if exists public.obs_book_section(text);
drop function if exists public.obs_book_testament(text);
drop function if exists public.obs_is_authorized_user(uuid);

drop table if exists public.obs_study_plan_events;
drop table if exists public.obs_assessment_snapshots;

notify pgrst, 'reload schema';

commit;
