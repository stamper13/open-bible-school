-- Internal question-quality console backend.
--
-- This migration creates service-role-only review and analytics contracts.
-- It deliberately does not grant answer-key or quality-console access to
-- anonymous or ordinary authenticated clients.

begin;

create table if not exists public.obs_question_review_status (
  generated_question_id uuid primary key
    references public.ot_generated_questions(id) on delete cascade,
  review_status text not null default 'pending',
  review_notes text,
  original_question_type text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint obs_question_review_status_value_ck check (
    review_status in ('pending', 'approved', 'revise', 'quarantined')
  )
);

create index if not exists obs_question_review_status_queue_idx
  on public.obs_question_review_status (review_status, updated_at desc);

alter table public.obs_question_review_status enable row level security;

create or replace view public.obs_admin_question_quality as
with answer_totals as (
  select
    answer.generated_question_id,
    count(*)::integer as answer_count,
    count(*) filter (where answer.is_correct)::integer as correct_count,
    count(*) filter (where coalesce(answer.is_idk, false))::integer as idk_count,
    max(answer.answered_at) as last_answered_at
  from public.assessment_answers answer
  group by answer.generated_question_id
),
choice_totals as (
  select
    answer.generated_question_id,
    coalesce(
      jsonb_object_agg(answer.selected_choice_id, answer.choice_count),
      '{}'::jsonb
    ) as choice_distribution
  from (
    select
      response.generated_question_id,
      coalesce(response.selected_choice_id, '<null>') as selected_choice_id,
      count(*)::integer as choice_count
    from public.assessment_answers response
    group by
      response.generated_question_id,
      coalesce(response.selected_choice_id, '<null>')
  ) answer
  group by answer.generated_question_id
),
report_totals as (
  select
    report.generated_question_id,
    count(*)::integer as report_count,
    jsonb_object_agg(report.report_category, report.category_count)
      as report_categories,
    max(report.last_reported_at) as last_reported_at
  from (
    select
      question_report.generated_question_id,
      coalesce(question_report.report_category, 'other') as report_category,
      count(*)::integer as category_count,
      max(question_report.created_at) as last_reported_at
    from public.question_reports question_report
    group by
      question_report.generated_question_id,
      coalesce(question_report.report_category, 'other')
  ) report
  group by report.generated_question_id
)
select
  question.id as generated_question_id,
  question.event_id,
  question.question_type,
  question.created_at,
  coalesce(question.payload->>'prompt', question.question_id::text) as prompt,
  upper(coalesce(
    bank.book_code,
    event.book_code,
    question.payload->>'book_code'
  )) as book_code,
  coalesce(
    dimension_override.dimension_key,
    public.obs_infer_question_dimension(
      question.question_type,
      question.payload,
      question.payload->>'prompt'
    )
  ) as dimension_key,
  public.obs_infer_question_chapter(
    upper(coalesce(
      bank.book_code,
      event.book_code,
      question.payload->>'book_code'
    )),
    coalesce(question.payload->>'prompt', question.question_id::text),
    question.payload,
    question.dedupe_key
  ) as inferred_chapter,
  question.payload->>'stem_family' as stem_family,
  public.obs_normalize_distractor_distance(
    question.payload->>'distractor_distance'
  ) as distractor_distance,
  public.obs_effective_item_irt_a(
    question.payload,
    event.irt_a::double precision
  ) as effective_irt_a,
  public.obs_effective_item_irt_b(
    question.payload,
    event.irt_b::double precision
  ) as effective_irt_b,
  case
    when question.question_type like 'quarantined%' then 'quarantined'
    when question.payload ? 'distractor_distance'
      and public.obs_normalize_distractor_distance(
        question.payload->>'distractor_distance'
      ) is null then 'invalid_distance'
    when public.obs_normalize_distractor_distance(
      question.payload->>'distractor_distance'
    ) is not null
      and nullif(question.payload->>'stem_family', '') is null
      then 'missing_stem_family'
    when not (question.payload ? 'choices')
      or jsonb_typeof(question.payload->'choices') <> 'array'
      then 'invalid_choices'
    when jsonb_array_length(question.payload->'choices') < 2
      then 'too_few_choices'
    when coalesce(
      question.payload->>'correct_choice_id',
      question.payload->>'answer_id',
      question.payload->>'correctAnswerId'
    ) is null then 'missing_answer_key'
    else 'ready'
  end as metadata_status,
  coalesce(review.review_status, 'pending') as review_status,
  review.review_notes,
  review.reviewed_by,
  review.reviewed_at,
  coalesce(answers.answer_count, 0) as answer_count,
  coalesce(answers.correct_count, 0) as correct_count,
  coalesce(answers.idk_count, 0) as idk_count,
  case
    when coalesce(answers.answer_count, 0) = 0 then null
    else round(
      answers.correct_count::numeric / answers.answer_count * 100,
      1
    )
  end as percent_correct,
  coalesce(choices.choice_distribution, '{}'::jsonb) as choice_distribution,
  coalesce(reports.report_count, 0) as report_count,
  coalesce(reports.report_categories, '{}'::jsonb) as report_categories,
  reports.last_reported_at,
  answers.last_answered_at,
  (
    coalesce(reports.report_count, 0) > 0
    or (
      coalesce(answers.answer_count, 0) >= 10
      and (
        answers.correct_count::numeric / nullif(answers.answer_count, 0) < 0.15
        or answers.correct_count::numeric / nullif(answers.answer_count, 0) > 0.95
      )
    )
    or (
      coalesce(answers.answer_count, 0) >= 10
      and answers.idk_count::numeric / nullif(answers.answer_count, 0) > 0.50
    )
    or case
      when question.question_type like 'quarantined%' then true
      when question.payload ? 'distractor_distance'
        and public.obs_normalize_distractor_distance(
          question.payload->>'distractor_distance'
        ) is null then true
      when public.obs_normalize_distractor_distance(
        question.payload->>'distractor_distance'
      ) is not null
        and nullif(question.payload->>'stem_family', '') is null then true
      when not (question.payload ? 'choices') then true
      when jsonb_typeof(question.payload->'choices') <> 'array' then true
      when jsonb_array_length(question.payload->'choices') < 2 then true
      when coalesce(
        question.payload->>'correct_choice_id',
        question.payload->>'answer_id',
        question.payload->>'correctAnswerId'
      ) is null then true
      else false
    end
  ) as needs_attention
from public.ot_generated_questions question
left join public.v_question_bank bank
  on bank.generated_question_id = question.id
left join public.bible_events event
  on event.id = question.event_id
left join public.obs_question_dimension_overrides dimension_override
  on dimension_override.generated_question_id = question.id
left join public.obs_question_review_status review
  on review.generated_question_id = question.id
left join answer_totals answers
  on answers.generated_question_id = question.id
left join choice_totals choices
  on choices.generated_question_id = question.id
left join report_totals reports
  on reports.generated_question_id = question.id;

create or replace view public.obs_admin_coverage_quality as
with active_counts as (
  select
    question.book_code,
    question.dimension_key,
    count(*)::integer as active_questions,
    count(*) filter (
      where question.payload ? 'distractor_distance'
        and public.obs_normalize_distractor_distance(
          question.payload->>'distractor_distance'
        ) is not null
    )::integer as calibrated_questions,
    count(distinct nullif(question.payload->>'stem_family', ''))::integer
      as stem_families
  from public.obs_question_bank_with_dimensions question
  group by question.book_code, question.dimension_key
),
response_counts as (
  select
    evidence.book_code,
    evidence.dimension_key,
    count(*)::integer as answer_count
  from public.obs_answer_evidence evidence
  group by evidence.book_code, evidence.dimension_key
)
select
  target.book_code,
  target.dimension_key,
  target.target_active_questions,
  coalesce(active.active_questions, 0) as active_questions,
  greatest(
    target.target_active_questions - coalesce(active.active_questions, 0),
    0
  ) as question_gap,
  coalesce(active.calibrated_questions, 0) as calibrated_questions,
  coalesce(active.stem_families, 0) as stem_families,
  coalesce(responses.answer_count, 0) as answer_count,
  case
    when coalesce(active.active_questions, 0) = 0 then 'empty'
    when active.active_questions < target.target_active_questions then 'under_target'
    when coalesce(active.stem_families, 0) < greatest(2, target.target_active_questions / 3)
      then 'low_variety'
    else 'healthy'
  end as coverage_status
from public.question_coverage_targets target
left join active_counts active
  on active.book_code = target.book_code
 and active.dimension_key = target.dimension_key
left join response_counts responses
  on responses.book_code = target.book_code
 and responses.dimension_key = target.dimension_key;

create or replace function public.obs_admin_set_question_review_status(
  p_generated_question_id uuid,
  p_review_status text,
  p_review_notes text default null
)
returns table (
  generated_question_id uuid,
  review_status text,
  question_type text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(btrim(p_review_status));
  v_current_type text;
  v_original_type text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
  then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  if v_status not in ('pending', 'approved', 'revise', 'quarantined') then
    raise exception using
      errcode = '22023',
      message = 'Invalid review status';
  end if;

  select question.question_type
  into v_current_type
  from public.ot_generated_questions question
  where question.id = p_generated_question_id
  for update;

  if v_current_type is null then
    raise exception using errcode = 'P0002', message = 'Question not found';
  end if;

  select review.original_question_type
  into v_original_type
  from public.obs_question_review_status review
  where review.generated_question_id = p_generated_question_id;

  if v_original_type is null and v_current_type not like 'quarantined%' then
    v_original_type := v_current_type;
  end if;

  if v_status = 'quarantined' and v_current_type not like 'quarantined%' then
    update public.ot_generated_questions
    set question_type = 'quarantined_review|' || v_current_type
    where id = p_generated_question_id;
  elsif v_status = 'approved'
    and v_current_type like 'quarantined_review|%'
    and v_original_type is not null
  then
    update public.ot_generated_questions
    set question_type = v_original_type
    where id = p_generated_question_id;
  end if;

  insert into public.obs_question_review_status (
    generated_question_id,
    review_status,
    review_notes,
    original_question_type,
    reviewed_by,
    reviewed_at,
    updated_at
  ) values (
    p_generated_question_id,
    v_status,
    p_review_notes,
    v_original_type,
    auth.uid(),
    now(),
    now()
  )
  on conflict (generated_question_id) do update
  set review_status = excluded.review_status,
      review_notes = excluded.review_notes,
      original_question_type = coalesce(
        public.obs_question_review_status.original_question_type,
        excluded.original_question_type
      ),
      reviewed_by = excluded.reviewed_by,
      reviewed_at = excluded.reviewed_at,
      updated_at = excluded.updated_at;

  return query
  select
    question.id,
    review.review_status,
    question.question_type,
    review.reviewed_at
  from public.ot_generated_questions question
  join public.obs_question_review_status review
    on review.generated_question_id = question.id
  where question.id = p_generated_question_id;
end;
$$;

create or replace function public.obs_admin_get_question_quality_queue(
  p_review_status text default null,
  p_needs_attention boolean default true,
  p_book_code text default null,
  p_dimension_key text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns setof public.obs_admin_question_quality
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
  then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  return query
  select quality.*
  from public.obs_admin_question_quality quality
  where (p_review_status is null or quality.review_status = lower(p_review_status))
    and (not coalesce(p_needs_attention, false) or quality.needs_attention)
    and (p_book_code is null or quality.book_code = upper(p_book_code))
    and (
      p_dimension_key is null
      or quality.dimension_key = public.obs_normalize_dimension_key(p_dimension_key)
    )
  order by
    quality.needs_attention desc,
    quality.report_count desc,
    quality.answer_count desc,
    quality.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on table public.obs_question_review_status
  from public, anon, authenticated;
revoke all on table public.obs_admin_question_quality
  from public, anon, authenticated;
revoke all on table public.obs_admin_coverage_quality
  from public, anon, authenticated;

grant select, insert, update, delete on public.obs_question_review_status
  to service_role;
grant select on public.obs_admin_question_quality
  to service_role;
grant select on public.obs_admin_coverage_quality
  to service_role;

revoke all on function public.obs_admin_set_question_review_status(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.obs_admin_get_question_quality_queue(
  text, boolean, text, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.obs_admin_set_question_review_status(uuid, text, text)
  to service_role;
grant execute on function public.obs_admin_get_question_quality_queue(
  text, boolean, text, text, integer, integer
) to service_role;

comment on view public.obs_admin_question_quality is
  'Service-role question review queue with metadata, response, and report diagnostics. Contains answer-key-adjacent analytics and must remain private.';

notify pgrst, 'reload schema';

commit;
