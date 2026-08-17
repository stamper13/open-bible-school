do $$
declare
  audited_mcqs integer;
  review_queue integer;
  option_count_failures integer;
  duplicate_failures integer;
  answer_key_failures integer;
  numeric_mismatches integer;
  meta_choices integer;
  batch_2_rows integer;
  batch_3_rows integer;
begin
  select
    count(*),
    count(*) filter (where requires_review),
    count(*) filter (where option_count_flag),
    count(*) filter (where duplicate_choice_flag),
    count(*) filter (where answer_key_flag),
    count(*) filter (where numeric_type_mismatch_flag),
    count(*) filter (where meta_choice_flag)
  into
    audited_mcqs,
    review_queue,
    option_count_failures,
    duplicate_failures,
    answer_key_failures,
    numeric_mismatches,
    meta_choices
  from public.obs_question_distractor_quality_audit;

  select
    count(*) filter (
      where payload->>'distractor_review'
        = 'same_category_length_balanced_v2'
    ),
    count(*) filter (
      where payload->>'distractor_review'
        = 'same_category_length_balanced_v3'
    )
  into batch_2_rows, batch_3_rows
  from public.ot_generated_questions
  where payload->>'distractor_review' in (
    'same_category_length_balanced_v2',
    'same_category_length_balanced_v3'
  );

  if audited_mcqs <> 1215
     or review_queue <> 0
     or option_count_failures <> 0
     or duplicate_failures <> 0
     or answer_key_failures <> 0
     or numeric_mismatches <> 0
     or meta_choices <> 0
     or batch_2_rows <> 25
     or batch_3_rows <> 25
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Complete distractor verification failed: audited=%s queue=%s option=%s duplicate=%s key=%s numeric=%s meta=%s batch2=%s batch3=%s.',
        audited_mcqs,
        review_queue,
        option_count_failures,
        duplicate_failures,
        answer_key_failures,
        numeric_mismatches,
        meta_choices,
        batch_2_rows,
        batch_3_rows
      );
  end if;
end
$$;

select
  count(*) as audited_mcqs,
  count(*) filter (where requires_review) as remaining_review_queue,
  count(*) filter (where correct_answer_long_flag)
    as correct_answer_too_long,
  count(*) filter (where correct_answer_short_flag)
    as correct_answer_too_short
from public.obs_question_distractor_quality_audit;
