-- Verify the NT Theological Reasoning expository rewrite.

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
  theology_routable_count integer;
  theology_approved_count integer;
  forbidden_inference_count integer;
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
          '20260729_nt_theological_reasoning_expository_rewrite'
    and review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0
    and review.confessional_sensitivity = 'low';

  select count(*)
  into retired_count
  from public.obs_nt_expository_item_reviews review
  where review.reviewed_by =
          '20260729_nt_theological_reasoning_expository_rewrite'
    and review.review_status = 'excluded'
    and review.routing_priority = 0
    and review.scoring_weight = 0.0;

  select count(*)
  into invalid_new_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_theological_reasoning_expository_rewrite'
    and (
      not public.obs_q_correct_resolves(question.payload)
      or public.obs_q_choice_count(question.payload) <> 4
      or public.obs_q_distinct_choice_count(question.payload) <> 4
      or question.payload->>'dimension_key' <>
           'theological_reasoning'
      or question.payload->>'interpretation_policy' <>
           'explicit_local_context_no_systematic_inference'
    );

  select count(*)
  into new_answer_count
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_theological_reasoning_expository_rewrite';

  select count(*)
  into old_answer_count
  from public.assessment_answers answer
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = answer.generated_question_id
  where review.reviewed_by =
          '20260729_nt_theological_reasoning_expository_rewrite'
    and review.review_status = 'excluded';

  select
    count(*),
    count(*) filter (where review.review_status = 'approved')
  into theology_routable_count, theology_approved_count
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'dimension_key' =
          'theological_reasoning'
    and review.review_status in ('approved', 'provisional')
    and review.scoring_weight > 0.0;

  -- These phrases would signal that the keyed answer has crossed from the
  -- passage's wording into a disputed systematic conclusion.
  select count(*)
  into forbidden_inference_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_theological_reasoning_expository_rewrite'
    and (
      lower(question.payload->>'correct_answer') like
        '%faith alone means%'
      or lower(question.payload->>'correct_answer') like
        '%works contribute to justification%'
      or lower(question.payload->>'correct_answer') like
        '%mosaic law is abolished%'
      or lower(question.payload->>'correct_answer') like
        '%mosaic law remains binding in every respect%'
      or lower(question.payload->>'correct_answer') like
        '%first created being%'
      or lower(question.payload->>'correct_answer') like
        '%genitive means christ''s faithfulness%'
      or lower(question.payload->>'correct_answer') like
        '%genitive means faith in christ%'
    );

  if active_nt_count <> 227
     or reviewed_count <> 227
     or approved_count <> 156
     or provisional_count <> 13
     or excluded_count <> 58
     or new_approved_count <> 21
     or retired_count <> 21
     or invalid_new_count <> 0
     or new_answer_count <> 0
     or old_answer_count <> 4
     or theology_routable_count <> 43
     or theology_approved_count <> 43
     or forbidden_inference_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT theology verify failed: active=%s reviewed=%s approved=%s provisional=%s excluded=%s new=%s retired=%s invalid=%s new_answers=%s old_answers=%s theology_routable=%s theology_approved=%s forbidden=%s.',
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
        theology_routable_count,
        theology_approved_count,
        forbidden_inference_count
      );
  end if;
end
$$;

select
  upper(question.payload->>'book_code') as book_code,
  question.payload->>'prompt' as prompt,
  question.payload->>'correct_answer' as correct_answer,
  question.payload->>'reference' as reference,
  review.expository_target
from public.ot_generated_questions question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.id
where question.payload->>'source_batch' =
        '20260729_nt_theological_reasoning_expository_rewrite'
order by upper(question.payload->>'book_code'), question.id;
