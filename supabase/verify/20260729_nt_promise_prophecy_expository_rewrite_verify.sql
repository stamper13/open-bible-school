-- Verify the NT Promise & Prophecy expository rewrite.

do $$
declare
  active_nt_count integer;
  reviewed_count integer;
  approved_count integer;
  provisional_count integer;
  excluded_count integer;
  new_approved_count integer;
  retired_count integer;
  invalid_new_count integer;
  new_answer_count integer;
  old_answer_count integer;
  promise_routable_count integer;
  reclassified_count integer;
  disputed_key_count integer;
begin
  select count(*)
  into active_nt_count
  from public.v_nt_question_bank;

  select
    count(*),
    count(*) filter (where review_status = 'approved'),
    count(*) filter (where review_status = 'provisional'),
    count(*) filter (where review_status = 'excluded')
  into
    reviewed_count,
    approved_count,
    provisional_count,
    excluded_count
  from public.obs_nt_expository_item_reviews;

  select count(*)
  into new_approved_count
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'source_batch' =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into retired_count
  from public.obs_nt_expository_item_reviews review
  where review.reviewed_by =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and review.review_status = 'excluded'
    and review.routing_priority = 0
    and review.scoring_weight = 0.0;

  select count(*)
  into invalid_new_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and (
      not public.obs_q_correct_resolves(question.payload)
      or public.obs_q_choice_count(question.payload) <> 4
      or public.obs_q_distinct_choice_count(question.payload) <> 4
      or question.payload->>'interpretation_policy' <>
           'explicit_local_context'
      or question.payload->>'dimension_key' not in (
        'events_timeline',
        'promise_prophecy'
      )
    );

  select count(*)
  into new_answer_count
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_promise_prophecy_expository_rewrite';

  select count(*)
  into old_answer_count
  from public.assessment_answers answer
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = answer.generated_question_id
  where review.reviewed_by =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and review.review_status = 'excluded';

  select count(*)
  into promise_routable_count
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'dimension_key' = 'promise_prophecy'
    and review.review_status in ('approved', 'provisional')
    and review.scoring_weight > 0.0;

  select count(*)
  into reclassified_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and question.payload->>'dimension_key' = 'events_timeline'
    and upper(question.payload->>'book_code') in ('3JN', 'PHM');

  -- These phrases signal that an answer key may be forcing a debated system
  -- rather than asking for an explicit textual claim.
  select count(*)
  into disputed_key_count
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'source_batch' =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and review.review_status = 'approved'
    and (
      lower(question.payload->>'correct_answer') like
        '%before the tribulation%'
      or lower(question.payload->>'correct_answer') like
        '%after the tribulation%'
      or lower(question.payload->>'correct_answer') like
        '%literal thousand%'
      or lower(question.payload->>'correct_answer') like
        '%symbolic thousand%'
      or lower(question.payload->>'correct_answer') like
        '%one person is both god and savior%'
      or lower(question.payload->>'correct_answer') like
        '%two different persons%'
    );

  if active_nt_count <> 206
     or reviewed_count <> 206
     or approved_count <> 135
     or provisional_count <> 34
     or excluded_count <> 37
     or new_approved_count <> 25
     or retired_count <> 25
     or invalid_new_count <> 0
     or new_answer_count <> 0
     or old_answer_count <> 2
     or promise_routable_count <> 24
     or reclassified_count <> 2
     or disputed_key_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Promise verify failed: active=%s reviewed=%s approved=%s provisional=%s excluded=%s new=%s retired=%s invalid=%s new_answers=%s old_answers=%s promise_routable=%s reclassified=%s disputed=%s.',
        active_nt_count,
        reviewed_count,
        approved_count,
        provisional_count,
        excluded_count,
        new_approved_count,
        retired_count,
        invalid_new_count,
        new_answer_count,
        old_answer_count,
        promise_routable_count,
        reclassified_count,
        disputed_key_count
      );
  end if;
end
$$;

select
  upper(question.payload->>'book_code') as book_code,
  question.payload->>'dimension_key' as dimension,
  question.payload->>'prompt' as prompt,
  question.payload->>'correct_answer' as correct_answer,
  question.payload->>'reference' as reference,
  review.expository_target
from public.ot_generated_questions question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.id
where question.payload->>'source_batch' =
        '20260729_nt_promise_prophecy_expository_rewrite'
order by upper(question.payload->>'book_code'), question.id;
