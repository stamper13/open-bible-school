-- Verify the completed NT Law & Commands review.

do $$
declare
  reviewed_by_batch integer;
  approved_by_batch integer;
  excluded_by_batch integer;
  provisional_remaining integer;
  law_routable integer;
  law_approved integer;
  invalid_replacement integer;
begin
  select
    count(*),
    count(*) filter (where review_status = 'approved'),
    count(*) filter (where review_status = 'excluded')
  into reviewed_by_batch, approved_by_batch, excluded_by_batch
  from public.obs_nt_expository_item_reviews
  where reviewed_by = '20260729_nt_law_commands_expository_review';

  select count(*)
  into provisional_remaining
  from public.obs_nt_expository_item_reviews
  where review_status = 'provisional';

  select
    count(*),
    count(*) filter (where review.review_status = 'approved')
  into law_routable, law_approved
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'dimension_key' = 'law_commands'
    and review.review_status in ('approved', 'provisional')
    and review.scoring_weight > 0.0;

  select count(*)
  into invalid_replacement
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_law_commands_expository_review'
    and (
      not public.obs_q_correct_resolves(question.payload)
      or public.obs_q_choice_count(question.payload) <> 4
      or public.obs_q_distinct_choice_count(question.payload) <> 4
      or question.payload->>'dimension_key' <> 'law_commands'
      or question.payload->>'interpretation_policy' <>
           'explicit_local_context_no_systematic_inference'
    );

  if reviewed_by_batch <> 11
     or approved_by_batch <> 10
     or excluded_by_batch <> 1
     or provisional_remaining <> 3
     or law_routable <> 16
     or law_approved <> 16
     or invalid_replacement <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Law & Commands verify failed: reviewed=%s/11 approved=%s/10 excluded=%s/1 provisional=%s/3 routable=%s/16 law_approved=%s/16 invalid=%s/0.',
        reviewed_by_batch,
        approved_by_batch,
        excluded_by_batch,
        provisional_remaining,
        law_routable,
        law_approved,
        invalid_replacement
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
where review.reviewed_by = '20260729_nt_law_commands_expository_review'
  and review.review_status = 'approved'
order by upper(question.payload->>'book_code'), question.id;
