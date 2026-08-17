-- Private semantic distractor review workflow.
--
-- Existing audits already cover option count, duplicate choices, answer keys,
-- length imbalance, numeric formatting, and observed choice-selection rates.
-- This layer records the human/AI judgment that all options belong to the same
-- semantic category and exposes a prioritized queue without publishing keys.

begin;

do $$
begin
  if to_regclass('public.obs_question_distractor_quality_audit') is null
     or to_regclass('public.obs_admin_distractor_audit') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Semantic distractor prerequisites are missing; nothing changed.';
  end if;
end
$$;

create table if not exists public.obs_semantic_distractor_reviews (
  generated_question_id uuid primary key
    references public.ot_generated_questions(id) on delete cascade,
  review_status text not null
    check (
      review_status in (
        'pending',
        'pass',
        'repair',
        'quarantined'
      )
    ),
  same_semantic_category boolean,
  obvious_elimination_present boolean,
  expected_category text,
  review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obs_semantic_review_completion_ck check (
    (
      review_status = 'pending'
      and reviewed_at is null
    )
    or (
      review_status <> 'pending'
      and reviewed_at is not null
      and same_semantic_category is not null
      and obvious_elimination_present is not null
    )
  )
);

revoke all on table public.obs_semantic_distractor_reviews
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.obs_semantic_distractor_reviews
  to service_role;

insert into public.obs_semantic_distractor_reviews (
  generated_question_id,
  review_status,
  same_semantic_category,
  obvious_elimination_present,
  expected_category,
  review_notes,
  reviewed_by,
  reviewed_at,
  updated_at
)
select
  question.id,
  'pass',
  true,
  false,
  case bank.dimension_key
    when 'characters_lineage'
      then 'people, relationships, lineage, or identity'
    when 'events_timeline'
      then 'events, actions, chronology, or durations'
    when 'geography_nations'
      then 'places, regions, nations, routes, or geopolitical units'
    when 'law_commands'
      then 'commands, laws, covenant obligations, or legal consequences'
    when 'promise_prophecy'
      then 'promises, warnings, judgments, or prophetic outcomes'
    when 'theological_reasoning'
      then 'claims, themes, arguments, interpretations, or implications'
    when 'structure_cross_ref'
      then 'book structure, genre, quotation, or textual connection'
    else 'same semantic kind as the correct answer'
  end,
  'Imported from the prior same-category manual review tag.',
  '20260729_semantic_audit_import',
  now(),
  now()
from public.ot_generated_questions question
join public.obs_question_bank_with_dimensions bank
  on bank.generated_question_id = question.id
where question.question_type not like 'quarantined%'
  and question.payload->>'distractor_review'
        like 'same_category%'
on conflict (generated_question_id) do nothing;

create or replace view public.obs_semantic_distractor_review_queue
with (security_invoker = true)
as
with question_options as (
  select
    question.generated_question_id,
    question.book_code,
    question.dimension_key,
    question.question_type,
    question.prompt,
    question.payload,
    question.event_id,
    coalesce(
      question.payload->>'correct_choice_id',
      question.payload->>'answer_id',
      question.payload->>'correctAnswerId'
    ) as correct_choice_id,
    jsonb_agg(
      jsonb_build_object(
        'id', choice->>'id',
        'text', coalesce(
          choice->>'text',
          choice->>'label',
          choice->>'value'
        )
      )
      order by choice.ordinality
    ) as choices
  from public.obs_question_bank_with_dimensions question
  cross join lateral jsonb_array_elements(
    question.payload->'choices'
  ) with ordinality as choice(choice, ordinality)
  where question.question_type <> 'sequence_order_v1'
    and jsonb_typeof(question.payload->'choices') = 'array'
  group by
    question.generated_question_id,
    question.book_code,
    question.dimension_key,
    question.question_type,
    question.prompt,
    question.payload,
    question.event_id
),
empirical as (
  select
    audit.generated_question_id,
    max(audit.exposure_count)::integer as exposure_count,
    bool_or(
      audit.distractor_status in ('never_selected', 'weak')
    ) as has_empirically_weak_distractor,
    jsonb_agg(
      jsonb_build_object(
        'choice_id', audit.choice_id,
        'choice_text', audit.choice_text,
        'selected_count', audit.selected_count,
        'selection_percent', audit.selection_percent,
        'status', audit.distractor_status
      )
      order by audit.choice_id
    ) as distractor_evidence
  from public.obs_admin_distractor_audit audit
  group by audit.generated_question_id
),
prepared as (
  select
    question.*,
    public.obs_focused_item_stage(
      question.question_type,
      question.payload,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      )
    ) as item_stage,
    case question.dimension_key
      when 'characters_lineage'
        then 'people, relationships, lineage, or identity'
      when 'events_timeline'
        then 'events, actions, chronology, or durations'
      when 'geography_nations'
        then 'places, regions, nations, routes, or geopolitical units'
      when 'law_commands'
        then 'commands, laws, covenant obligations, or legal consequences'
      when 'promise_prophecy'
        then 'promises, warnings, judgments, or prophetic outcomes'
      when 'theological_reasoning'
        then 'claims, themes, arguments, interpretations, or implications'
      when 'structure_cross_ref'
        then 'book structure, genre, quotation, or textual connection'
      else 'same semantic kind as the correct answer'
    end as suggested_expected_category,
    coalesce(empirical.exposure_count, 0) as exposure_count,
    coalesce(
      empirical.has_empirically_weak_distractor,
      false
    ) as has_empirically_weak_distractor,
    empirical.distractor_evidence,
    review.review_status,
    review.same_semantic_category,
    review.obvious_elimination_present,
    review.expected_category,
    review.review_notes,
    review.reviewed_by,
    review.reviewed_at
  from question_options question
  left join public.bible_events event
    on event.id = question.event_id
  left join empirical
    on empirical.generated_question_id =
      question.generated_question_id
  left join public.obs_semantic_distractor_reviews review
    on review.generated_question_id =
      question.generated_question_id
)
select
  prepared.generated_question_id,
  prepared.book_code,
  prepared.dimension_key,
  prepared.question_type,
  prepared.item_stage,
  prepared.prompt,
  prepared.correct_choice_id,
  prepared.choices,
  prepared.suggested_expected_category,
  prepared.exposure_count,
  prepared.has_empirically_weak_distractor,
  prepared.distractor_evidence,
  coalesce(prepared.review_status, 'pending') as review_status,
  prepared.same_semantic_category,
  prepared.obvious_elimination_present,
  prepared.expected_category,
  prepared.review_notes,
  prepared.reviewed_by,
  prepared.reviewed_at,
  case
    when prepared.has_empirically_weak_distractor then 0
    when coalesce(prepared.review_status, 'pending')
      in ('repair', 'quarantined') then 0
    when coalesce(prepared.review_status, 'pending') = 'pending'
      and (
        prepared.question_type = 'book_orientation_mcq_v1'
        or prepared.item_stage = 1
      ) then 1
    when coalesce(prepared.review_status, 'pending') = 'pending'
      then 2
    else 3
  end as semantic_review_priority,
  (
    prepared.has_empirically_weak_distractor
    or coalesce(prepared.review_status, 'pending')
      in ('pending', 'repair', 'quarantined')
  ) as requires_semantic_review
from prepared;

revoke all on table public.obs_semantic_distractor_review_queue
  from public, anon, authenticated;
grant select on table public.obs_semantic_distractor_review_queue
  to service_role;

comment on table public.obs_semantic_distractor_reviews is
  'Private human/AI judgments about semantic plausibility and obvious elimination in MCQ distractor sets.';

comment on view public.obs_semantic_distractor_review_queue is
  'Private answer-bearing semantic distractor queue prioritized by empirical weakness, foundational importance, and missing review.';

commit;
