-- Verify the first NT expository rewrite batch.

do $$
declare
  active_nt_count integer;
  approved_count integer;
  provisional_count integer;
  excluded_count integer;
  rewrite_count integer;
  new_approved_count integer;
  retired_excluded_count integer;
  old_historical_answers integer;
  new_historical_answers integer;
  invalid_payloads integer;
  unreviewed_count integer;
begin
  select count(*)
  into active_nt_count
  from public.v_nt_question_bank;

  select
    count(*) filter (where review_status = 'approved'),
    count(*) filter (where review_status = 'provisional'),
    count(*) filter (where review_status = 'excluded'),
    count(*) filter (where review_status = 'rewrite')
  into
    approved_count,
    provisional_count,
    excluded_count,
    rewrite_count
  from public.obs_nt_expository_item_reviews;

  select count(*)
  into new_approved_count
  from public.obs_nt_expository_item_reviews review
  join public.ot_generated_questions question
    on question.id = review.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_expository_rewrite_batch_1'
    and review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into retired_excluded_count
  from public.obs_nt_expository_item_reviews review
  where review.reviewed_by =
          '20260729_nt_expository_rewrite_batch_1'
    and review.review_status = 'excluded'
    and review.routing_priority = 0
    and review.scoring_weight = 0.0;

  select count(*)
  into old_historical_answers
  from public.assessment_answers answer
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = answer.generated_question_id
  where review.reviewed_by =
          '20260729_nt_expository_rewrite_batch_1'
    and review.review_status = 'excluded';

  select count(*)
  into new_historical_answers
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_expository_rewrite_batch_1';

  select count(*)
  into invalid_payloads
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_expository_rewrite_batch_1'
    and (
      not public.obs_q_correct_resolves(question.payload)
      or public.obs_q_choice_count(question.payload) <> 4
      or public.obs_q_distinct_choice_count(question.payload) <> 4
    );

  select count(*)
  into unreviewed_count
  from public.v_nt_question_bank question
  left join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.generated_question_id is null;

  if active_nt_count <> 151
     or approved_count <> 80
     or provisional_count <> 59
     or excluded_count <> 12
     or rewrite_count <> 0
     or new_approved_count <> 12
     or retired_excluded_count <> 12
     or old_historical_answers <> 8
     or new_historical_answers <> 0
     or invalid_payloads <> 0
     or unreviewed_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT rewrite verify failed: active=%s approved=%s provisional=%s excluded=%s rewrite=%s new=%s retired=%s old_answers=%s new_answers=%s invalid=%s unreviewed=%s.',
        active_nt_count,
        approved_count,
        provisional_count,
        excluded_count,
        rewrite_count,
        new_approved_count,
        retired_excluded_count,
        old_historical_answers,
        new_historical_answers,
        invalid_payloads,
        unreviewed_count
      );
  end if;
end
$$;

select
  upper(question.payload->>'book_code') as book_code,
  question.payload->>'dimension_key' as dimension,
  question.payload->>'prompt' as prompt,
  question.payload->>'correct_answer' as correct_answer,
  review.expository_target,
  review.review_status
from public.ot_generated_questions question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.id
where question.payload->>'source_batch' =
        '20260729_nt_expository_rewrite_batch_1'
order by upper(question.payload->>'book_code'), question.id;

select
  coalesce(
    nullif(question.payload->>'dimension_key', ''),
    nullif(question.payload->>'dimension', ''),
    'unclassified'
  ) as dimension,
  count(*) filter (
    where review.review_status = 'approved'
  ) as approved,
  count(*) filter (
    where review.review_status = 'provisional'
  ) as provisional,
  count(*) filter (
    where review.review_status = 'excluded'
  ) as excluded,
  count(*) as total
from public.v_nt_question_bank question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.generated_question_id
group by 1
order by 1;

select
  question.book_code,
  count(*) filter (
    where review.review_status = 'approved'
  ) as approved,
  count(*) filter (
    where review.review_status = 'provisional'
  ) as provisional,
  count(*) filter (
    where review.review_status = 'excluded'
  ) as excluded,
  count(*) as total
from public.v_nt_question_bank question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.generated_question_id
group by question.book_code
order by question.book_code;
