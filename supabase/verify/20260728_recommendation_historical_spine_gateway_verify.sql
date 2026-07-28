-- Fail-loud verification for the recommendation historical-spine gateway.

do $$
declare
  gateway_count integer;
  full_range_count integer;
  historical_writings_count integer;
  coverage_books integer;
  coverage_violations integer;
  latest_gateway_order integer;
  first_latter_order integer;
  recommendation_definition text;
begin
  select
    count(*)::integer,
    count(*) filter (
      where (
        book_code = '1KI' and start_chapter = 1 and end_chapter = 22
      ) or (
        book_code = '2KI' and start_chapter = 1 and end_chapter = 25
      ) or (
        book_code = '1CH' and start_chapter = 1 and end_chapter = 29
      ) or (
        book_code = '2CH' and start_chapter = 1 and end_chapter = 36
      ) or (
        book_code = 'EZR' and start_chapter = 1 and end_chapter = 10
      ) or (
        book_code = 'NEH' and start_chapter = 1 and end_chapter = 13
      )
    )::integer,
    count(*) filter (
      where book_code in ('1CH', '2CH', 'EZR', 'NEH')
        and section = 'Writings'
    )::integer,
    max(sequence_order)
  into
    gateway_count,
    full_range_count,
    historical_writings_count,
    latest_gateway_order
  from public.obs_learning_units
  where book_code in ('1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH')
    and is_foundation
    and baseline_display_score_required = 513
    and min_answers_required = 3;

  select min(sequence_order)
  into first_latter_order
  from public.obs_learning_units
  where section = 'Latter Prophets'
    and not is_foundation;

  with coverage as (
    select
      question.book_code,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      ))::integer as distinct_stems,
      count(*) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 1
      )::integer as foundation_items,
      count(*) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 2
      )::integer as core_items
    from public.obs_question_bank_with_dimensions question
    left join public.bible_events event
      on event.id = question.event_id
    where question.book_code in (
      '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH'
    )
    group by question.book_code
  )
  select
    count(*)::integer,
    count(*) filter (
      where distinct_stems < 8
         or foundation_items < 1
         or core_items < 1
    )::integer
  into coverage_books, coverage_violations
  from coverage;

  select pg_get_functiondef(
    'public.obs_get_user_recommendation_v2(uuid)'::regprocedure
  )
  into recommendation_definition;

  if gateway_count <> 6
     or full_range_count <> 6
     or historical_writings_count <> 4
     or coverage_books <> 6
     or coverage_violations <> 0
     or first_latter_order is null
     or latest_gateway_order >= first_latter_order
     or recommendation_definition not like '%foundation_gap%'
     or recommendation_definition not like '%where is_foundation%'
     or recommendation_definition not like
       '%where not exists (select 1 from foundation_gap)%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Historical-spine verification failed: gateway=%s ranges=%s writings=%s coverage=%s/%s order=%s<%s.',
        gateway_count,
        full_range_count,
        historical_writings_count,
        coverage_books,
        coverage_violations,
        latest_gateway_order,
        first_latter_order
      );
  end if;

  raise notice
    'PASS: Torah/Former/Kings/Chronicles/Ezra-Nehemiah foundation gaps precede every Latter Prophets recommendation.';
end
$$;

select
  unit_key,
  label,
  section,
  book_code,
  start_chapter,
  end_chapter,
  sequence_order,
  baseline_display_score_required,
  min_answers_required
from public.obs_learning_units
where book_code in ('1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH')
order by sequence_order;
