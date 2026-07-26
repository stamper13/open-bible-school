-- Fail-loud verification for durable answer delivery snapshots.

do $$
declare
  missing_columns integer;
  missing_snapshot_count integer;
  grading_mismatch_count integer;
  snapshot_text_mismatch_count integer;
  inferred_snapshot_count integer;
  wording_unavailable integer;
  review_definition text;
  submit_definition text;
begin
  select count(*)
  into missing_columns
  from (
    values
      ('delivered_choices_snapshot'),
      ('selected_choice_text_snapshot'),
      ('correct_choice_id_snapshot'),
      ('correct_choice_text_snapshot'),
      ('question_prompt_snapshot'),
      ('delivery_contract')
  ) expected(column_name)
  where not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'assessment_answers'
      and column_info.column_name = expected.column_name
  );

  select count(*)
  into missing_snapshot_count
  from public.assessment_answers answer
  where answer.delivery_contract = 'client_confirmed_v2'
    and (
      answer.delivered_choices_snapshot is null
      or answer.correct_choice_id_snapshot is null
      or answer.correct_choice_text_snapshot is null
      or answer.question_prompt_snapshot is null
      or answer.delivery_contract is null
      or (
        not coalesce(answer.is_idk, false)
        and answer.selected_choice_text_snapshot is null
      )
    );

  select count(*)
  into grading_mismatch_count
  from public.assessment_answers answer
  where answer.delivery_contract = 'client_confirmed_v2'
    and not coalesce(answer.is_idk, false)
    and answer.is_correct is distinct from (
      answer.selected_choice_text_snapshot =
        answer.correct_choice_text_snapshot
    );

  select count(*)
  into snapshot_text_mismatch_count
  from public.assessment_answers answer
  where answer.delivery_contract = 'client_confirmed_v2'
    and left(coalesce(answer.selected_choice_id, ''), 10)
      <> '__ORDER__:'
    and not coalesce(answer.is_idk, false)
    and answer.selected_choice_text_snapshot is distinct from
      public.obs_choice_text(
        answer.delivered_choices_snapshot,
        answer.selected_choice_id
      );

  select count(*)
  into inferred_snapshot_count
  from public.assessment_answers answer
  where answer.delivery_contract = 'backfill_server_raw_v1';

  select count(*)
  into wording_unavailable
  from public.assessment_answers answer
  join public.assessment_attempts attempt
    on attempt.id = answer.attempt_id
  where upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and answer.delivered_choices_snapshot is null;

  select pg_get_functiondef(
    'public.obs_get_attempt_review(uuid,uuid)'::regprocedure
  )
  into review_definition;

  select pg_get_functiondef(
    'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure
  )
  into submit_definition;

  if missing_columns <> 0
     or missing_snapshot_count <> 0
     or grading_mismatch_count <> 0
     or snapshot_text_mismatch_count <> 0
     or inferred_snapshot_count <> 0
     or review_definition not like '%selected_choice_text_snapshot%'
     or review_definition like
       '%else public.obs_choice_text(%review.review_choices%review.selected_choice_id%'
     or submit_definition not like
       '%Displayed choices do not match the server question%'
     or submit_definition not like '%client_confirmed_v2%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Snapshot VERIFY FAILED: columns=%s missing_confirmed=%s grading=%s text=%s inferred=%s review=%s submit=%s.',
        missing_columns,
        missing_snapshot_count,
        grading_mismatch_count,
        snapshot_text_mismatch_count,
        inferred_snapshot_count,
        review_definition like '%selected_choice_text_snapshot%',
        submit_definition like '%client_confirmed_v2%'
      );
  end if;

  raise notice
    'PASS: confirmed OT snapshots complete; grading and text aligned; % older answers intentionally retain no guessed wording.',
    wording_unavailable;
end
$$;

select
  coalesce(attempt.assessment_kind, 'LEGACY') as assessment_kind,
  count(*)::integer as answers,
  count(*) filter (
    where answer.delivered_choices_snapshot is not null
  )::integer as snapshotted,
  count(*) filter (
    where answer.delivered_choices_snapshot is null
  )::integer as wording_unavailable
from public.assessment_answers answer
join public.assessment_attempts attempt
  on attempt.id = answer.attempt_id
where upper(coalesce(attempt.testament, 'OT')) = 'OT'
group by attempt.assessment_kind
order by attempt.assessment_kind nulls first;
