-- Numbered biblical book titles are categorical answers, not numeric answers.
-- Refine the private distractor audit so choices such as "1 Kings" and
-- "2 Chronicles" do not create false numeric-mismatch warnings.

begin;

create or replace view public.obs_question_distractor_quality_audit
with (security_invoker = true)
as
with questions as (
  select
    question.generated_question_id,
    question.book_code,
    question.dimension_key,
    question.question_type,
    question.prompt,
    question.payload->>'correct_choice_id' as correct_choice_id,
    question.payload->'choices' as choices
  from public.obs_question_bank_with_dimensions question
  where jsonb_typeof(question.payload->'choices') = 'array'
),
options as (
  select
    question.*,
    choice->>'id' as choice_id,
    btrim(choice->>'text') as choice_text,
    length(btrim(choice->>'text')) as choice_length,
    (
      btrim(choice->>'text') ~ '^[0-9]+([ .,:;-]|$)'
      and lower(btrim(choice->>'text'))
        !~ '^[123] (samuel|kings|chronicles)$'
    ) as begins_numeric
  from questions question
  cross join lateral jsonb_array_elements(question.choices) choice
),
stats as (
  select
    generated_question_id,
    book_code,
    dimension_key,
    question_type,
    prompt,
    correct_choice_id,
    count(*)::integer as option_count,
    count(distinct lower(choice_text))::integer
      as distinct_option_count,
    count(*) filter (
      where choice_id = correct_choice_id
    )::integer as correct_choice_matches,
    max(choice_length) filter (
      where choice_id = correct_choice_id
    )::integer as correct_choice_length,
    avg(choice_length) filter (
      where choice_id <> correct_choice_id
    ) as distractor_average_length,
    bool_or(begins_numeric) filter (
      where choice_id = correct_choice_id
    ) as correct_begins_numeric,
    bool_or(begins_numeric) filter (
      where choice_id <> correct_choice_id
    ) as any_distractor_begins_numeric,
    bool_and(begins_numeric) filter (
      where choice_id <> correct_choice_id
    ) as all_distractors_begin_numeric,
    bool_or(
      lower(choice_text) in (
        'all of the above',
        'none of the above'
      )
    ) as has_meta_choice
  from options
  group by
    generated_question_id,
    book_code,
    dimension_key,
    question_type,
    prompt,
    correct_choice_id
)
select
  stats.*,
  stats.option_count <> 4 as option_count_flag,
  stats.distinct_option_count <> stats.option_count
    as duplicate_choice_flag,
  stats.correct_choice_matches <> 1 as answer_key_flag,
  (
    stats.correct_choice_length
      >= stats.distractor_average_length * 1.8
    and stats.correct_choice_length
      - stats.distractor_average_length >= 12
  ) as correct_answer_long_flag,
  (
    stats.correct_choice_length * 1.8
      <= stats.distractor_average_length
    and stats.distractor_average_length
      - stats.correct_choice_length >= 12
  ) as correct_answer_short_flag,
  (
    (
      stats.correct_begins_numeric
      and not stats.all_distractors_begin_numeric
    )
    or (
      not stats.correct_begins_numeric
      and stats.any_distractor_begins_numeric
    )
  ) as numeric_type_mismatch_flag,
  stats.has_meta_choice as meta_choice_flag,
  (
    stats.option_count <> 4
    or stats.distinct_option_count <> stats.option_count
    or stats.correct_choice_matches <> 1
    or (
      stats.correct_choice_length
        >= stats.distractor_average_length * 1.8
      and stats.correct_choice_length
        - stats.distractor_average_length >= 12
    )
    or (
      stats.correct_choice_length * 1.8
        <= stats.distractor_average_length
      and stats.distractor_average_length
        - stats.correct_choice_length >= 12
    )
    or (
      (
        stats.correct_begins_numeric
        and not stats.all_distractors_begin_numeric
      )
      or (
        not stats.correct_begins_numeric
        and stats.any_distractor_begins_numeric
      )
    )
    or stats.has_meta_choice
  ) as requires_review
from stats;

revoke all on table public.obs_question_distractor_quality_audit
  from public, anon, authenticated;
grant select on table public.obs_question_distractor_quality_audit
  to service_role;

do $$
declare
  numbered_book_false_positives integer;
begin
  select count(*)
  into numbered_book_false_positives
  from public.obs_question_distractor_quality_audit audit
  join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = audit.generated_question_id
  where audit.numeric_type_mismatch_flag
    and exists (
      select 1
      from jsonb_array_elements(question.payload->'choices') choice
      where lower(btrim(choice->>'text'))
        ~ '^[123] (samuel|kings|chronicles)$'
    );

  if numbered_book_false_positives <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Numbered-book numeric false positives remain: %s.',
        numbered_book_false_positives
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
