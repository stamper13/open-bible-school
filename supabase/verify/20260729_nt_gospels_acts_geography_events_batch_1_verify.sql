-- Verify the first Gospel/Acts geography and events expansion.

do $$
declare
  batch_count integer;
  batch_answers integer;
  invalid_payloads integer;
  invalid_balance integer;
  geography_routable integer;
  events_routable integer;
  unreviewed integer;
begin
  select count(*)
  into batch_count
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_gospels_acts_geography_events_batch_1'
    and review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into batch_answers
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_gospels_acts_geography_events_batch_1';

  select count(*)
  into invalid_payloads
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_gospels_acts_geography_events_batch_1'
    and (
      not public.obs_q_correct_resolves(question.payload)
      or public.obs_q_choice_count(question.payload) <> 4
      or public.obs_q_distinct_choice_count(question.payload) <> 4
    );

  select count(*)
  into invalid_balance
  from (
    select
      question.payload->>'book_code' as book_code,
      count(*) as total,
      count(*) filter (
        where question.payload->>'dimension_key' =
          'geography_nations'
      ) as geography,
      count(*) filter (
        where question.payload->>'dimension_key' =
          'events_timeline'
      ) as events
    from public.ot_generated_questions question
    where question.payload->>'source_batch' =
            '20260729_nt_gospels_acts_geography_events_batch_1'
    group by question.payload->>'book_code'
  ) balance
  where total <> 6 or geography <> 3 or events <> 3;

  select
    count(*) filter (
      where question.payload->>'dimension_key' =
        'geography_nations'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' =
        'events_timeline'
    )
  into geography_routable, events_routable
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.review_status in ('approved', 'provisional');

  select count(*)
  into unreviewed
  from public.v_nt_question_bank question
  left join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.generated_question_id is null;

  if batch_count <> 30
     or batch_answers <> 0
     or invalid_payloads <> 0
     or invalid_balance <> 0
     or geography_routable <> 20
     or events_routable <> 29
     or unreviewed <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT narrative verify failed: batch=%s answers=%s invalid_payloads=%s invalid_balance=%s geography=%s events=%s unreviewed=%s.',
        batch_count,
        batch_answers,
        invalid_payloads,
        invalid_balance,
        geography_routable,
        events_routable,
        unreviewed
      );
  end if;
end
$$;

select
  question.book_code,
  question.payload->>'dimension_key' as dimension,
  count(*) as new_questions,
  round(avg(
    (question.payload->>'difficulty_estimate')::numeric
  )) as mean_difficulty
from public.v_nt_question_bank question
where question.payload->>'source_batch' =
        '20260729_nt_gospels_acts_geography_events_batch_1'
group by question.book_code, question.payload->>'dimension_key'
order by question.book_code, question.payload->>'dimension_key';

select
  question.book_code,
  question.payload->>'dimension_key' as dimension,
  question.prompt,
  question.payload->>'correct_answer' as correct_answer,
  coalesce(
    question.payload->>'reference',
    question.payload->>'source_ref'
  ) as reference
from public.v_nt_question_bank question
where question.payload->>'source_batch' =
        '20260729_nt_gospels_acts_geography_events_batch_1'
order by question.book_code, question.payload->>'dimension_key',
  question.generated_question_id;
