-- Reintroduces the incompatible wildcard projection for exact rollback only.
-- Applying this rollback will restore the production failure while the inner
-- adaptive selector continues to return its ninth map column.

begin;

create or replace function public.obs_get_next_ot_assessment_question(
  p_attempt_id uuid
)
returns table(
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  attempt_row record;
  question_row record;
  answered_total integer;
begin
  select
    attempt.id,
    attempt.user_id,
    attempt.assessment_kind,
    attempt.target_question_count as original_target,
    context.unit_key,
    context.book_code,
    context.start_chapter,
    context.end_chapter,
    context.dimension_key
  into attempt_row
  from public.assessment_attempts attempt
  left join public.obs_ot_attempt_context context
    on context.attempt_id = attempt.id
   and context.user_id = attempt.user_id
  where attempt.id = p_attempt_id
    and attempt.user_id = auth.uid()
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null;

  if not found then
    return;
  end if;

  if attempt_row.assessment_kind = 'ot_adaptive' then
    return query
    select adaptive.*
    from public.get_next_assessment_question(
      attempt_row.id,
      attempt_row.user_id
    ) adaptive
    limit 1;
    return;
  end if;

  select focused.*
  into question_row
  from public.obs_get_next_focused_question_v2(
    attempt_row.user_id,
    attempt_row.id,
    attempt_row.unit_key,
    attempt_row.book_code,
    attempt_row.start_chapter,
    attempt_row.end_chapter,
    attempt_row.dimension_key
  ) focused
  limit 1;

  if found then
    return query
    select
      question_row.out_generated_question_id::uuid,
      question_row.prompt::text,
      question_row.question_type::text,
      question_row.choices::jsonb,
      question_row.event_title::text,
      question_row.book_code::text,
      question_row.importance_tier::integer,
      question_row.section::text;
    return;
  end if;

  select count(*)::integer
  into answered_total
  from public.assessment_answers answer
  where answer.attempt_id = attempt_row.id
    and answer.user_id = attempt_row.user_id;

  if answered_total > 0 then
    update public.assessment_attempts
    set
      question_target = answered_total,
      target_question_count = answered_total,
      total_count = answered_total,
      answered_count = answered_total,
      is_complete = true,
      completed_at = coalesce(completed_at, now())
    where id = attempt_row.id;

    insert into public.obs_study_plan_events (
      user_id,
      unit_key,
      event_type,
      attempt_id,
      metadata
    )
    select
      attempt_row.user_id,
      attempt_row.unit_key,
      'retest_completed',
      attempt_row.id,
      jsonb_build_object(
        'source', 'focused_assessment_stage_exhaustion',
        'answered_count', answered_total,
        'original_target', attempt_row.original_target
      )
    where not exists (
      select 1
      from public.obs_study_plan_events event
      where event.user_id = attempt_row.user_id
        and event.attempt_id = attempt_row.id
        and event.event_type = 'retest_completed'
    );
  end if;

  return;
end;
$function$;

commit;
