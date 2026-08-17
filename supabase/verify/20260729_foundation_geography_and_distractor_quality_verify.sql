do $$
declare
  seeded_count integer;
  stage_one_count integer;
  geography_count integer;
  minor_books_with_two_stage_one integer;
  repaired_count integer;
  new_question_flags integer;
  all_review_flags integer;
begin
  select
    count(*),
    count(*) filter (
      where public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          null::double precision
        )
      ) = 1
    ),
    count(*) filter (
      where question.payload->>'dimension_key'
        = 'geography_nations'
    )
  into seeded_count, stage_one_count, geography_count
  from public.ot_generated_questions question
  where question.question_type = 'foundation_mcq_v1'
    and question.dedupe_key like 'foundation_v1|%';

  with minor_books(book_code) as (
    values
      ('HOS'), ('JOL'), ('AMO'), ('OBA'),
      ('JON'), ('MIC'), ('NAM'), ('HAB'),
      ('ZEP'), ('HAG'), ('ZEC'), ('MAL')
  ),
  coverage as (
    select
      minor.book_code,
      count(*) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 1
      ) as stage_one
    from minor_books minor
    left join public.obs_question_bank_with_dimensions question
      on question.book_code = minor.book_code
    left join public.bible_events event
      on event.id = question.event_id
    group by minor.book_code
  )
  select count(*) filter (where stage_one >= 2)
  into minor_books_with_two_stage_one
  from coverage;

  select count(*)
  into repaired_count
  from public.ot_generated_questions
  where id in (
    'de9bf7df-e1ff-47cd-acc1-7eb61e665a21'::uuid,
    '75c06208-9252-49bd-903d-aafc86cbcd7f'::uuid,
    '3edc4423-6d92-47be-9417-91493ad34766'::uuid
  )
    and payload->>'distractor_review' = 'same_category_manual';

  select count(*)
  into new_question_flags
  from public.obs_question_distractor_quality_audit audit
  join public.ot_generated_questions question
    on question.id = audit.generated_question_id
  where question.question_type = 'foundation_mcq_v1'
    and question.dedupe_key like 'foundation_v1|%'
    and audit.requires_review;

  select count(*)
  into all_review_flags
  from public.obs_question_distractor_quality_audit
  where requires_review;

  if seeded_count <> 26
     or stage_one_count <> 26
     or geography_count <> 21
     or minor_books_with_two_stage_one <> 12
     or repaired_count <> 3
     or new_question_flags <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Question quality verification failed: seeded=%s stage1=%s geography=%s minor_books=%s repaired=%s new_flags=%s.',
        seeded_count,
        stage_one_count,
        geography_count,
        minor_books_with_two_stage_one,
        repaired_count,
        new_question_flags
      );
  end if;

  raise notice
    'PASS: 26 foundation questions installed, including 21 geography items; all 12 Minor Prophets have at least two Stage 1 items; 3 distractor sets repaired; % pre-existing measurable flags remain for review.',
    all_review_flags;
end
$$;

select
  book_code,
  dimension_key,
  prompt,
  correct_answer_long_flag,
  correct_answer_short_flag,
  numeric_type_mismatch_flag
from public.obs_question_distractor_quality_audit
where requires_review
order by
  numeric_type_mismatch_flag desc,
  greatest(
    correct_choice_length - distractor_average_length,
    distractor_average_length - correct_choice_length
  ) desc
limit 25;
