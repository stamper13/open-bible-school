-- Verification for the 20260723 backend feature migrations.
--
-- Run after:
--   20260723_assessment_insights_backend.sql
--   20260723_question_quality_console.sql
--   20260723_nt_persistent_adaptive.sql

do $$
declare
  required_object text;
begin
  foreach required_object in array array[
    'public.obs_assessment_snapshots',
    'public.obs_study_plan_events',
    'public.obs_answer_evidence',
    'public.obs_question_review_status',
    'public.obs_admin_question_quality',
    'public.obs_admin_coverage_quality'
  ]
  loop
    if to_regclass(required_object) is null then
      raise exception 'Missing required relation: %', required_object;
    end if;
  end loop;
end;
$$;

do $$
declare
  required_function text;
begin
  foreach required_function in array array[
    'public.obs_compute_scoped_bli(uuid,text,timestamp with time zone)',
    'public.obs_backfill_assessment_snapshots(uuid)',
    'public.obs_get_progress_history(uuid,text,integer)',
    'public.obs_get_attempt_summary(uuid,uuid)',
    'public.obs_get_attempt_review(uuid,uuid)',
    'public.obs_get_bli_uncertainty(uuid,text)',
    'public.obs_get_scope_summary(uuid,text,text)',
    'public.obs_record_study_event(uuid,text,text,uuid,jsonb)',
    'public.obs_admin_set_question_review_status(uuid,text,text)',
    'public.obs_admin_get_question_quality_queue(text,boolean,text,text,integer,integer)',
    'public.obs_start_nt_assessment(text,text,integer)',
    'public.obs_get_next_nt_assessment_question(uuid)',
    'public.obs_submit_nt_assessment_answer(uuid,uuid,text)',
    'public.obs_get_nt_assessment_status(uuid)'
  ]
  loop
    if to_regprocedure(required_function) is null then
      raise exception 'Missing required function: %', required_function;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.obs_get_attempt_review(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute obs_get_attempt_review';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.obs_admin_get_question_quality_queue(text,boolean,text,text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute the admin quality queue';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.obs_admin_question_quality',
    'SELECT'
  ) then
    raise exception 'authenticated must not select the admin quality view';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.obs_start_nt_assessment(text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must execute obs_start_nt_assessment';
  end if;
end;
$$;

select
  count(*) as total_questions,
  count(*) filter (where needs_attention) as needs_attention,
  count(*) filter (where metadata_status = 'ready') as metadata_ready,
  count(*) filter (where review_status = 'quarantined') as quarantined
from public.obs_admin_question_quality;

select
  coverage_status,
  count(*) as scope_count,
  sum(question_gap) as total_question_gap
from public.obs_admin_coverage_quality
group by coverage_status
order by coverage_status;

select
  distance,
  distance_key,
  label,
  default_irt_b
from public.obs_distractor_distance_calibration
order by distance;

select
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'assessment_answers'
  and trigger_name = 'obs_capture_snapshot_after_answer';

select
  'PASS: backend feature objects, privileges, and dependencies are present'
    as verification_result;
