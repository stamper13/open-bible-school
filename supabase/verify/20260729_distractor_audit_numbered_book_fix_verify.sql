do $$
declare
  audited_mcqs integer;
  structural_failures integer;
  numeric_mismatches integer;
  new_seed_flags integer;
begin
  select
    count(*),
    count(*) filter (
      where option_count_flag
        or duplicate_choice_flag
        or answer_key_flag
        or meta_choice_flag
    ),
    count(*) filter (where numeric_type_mismatch_flag)
  into audited_mcqs, structural_failures, numeric_mismatches
  from public.obs_question_distractor_quality_audit;

  select count(*)
  into new_seed_flags
  from public.obs_question_distractor_quality_audit audit
  join public.ot_generated_questions question
    on question.id = audit.generated_question_id
  where question.question_type = 'foundation_mcq_v1'
    and question.dedupe_key like 'foundation_v1|%'
    and audit.requires_review;

  if audited_mcqs < 1200
     or structural_failures <> 0
     or numeric_mismatches <> 0
     or new_seed_flags <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Distractor audit verification failed: audited=%s structural=%s numeric=%s new_seed=%s.',
        audited_mcqs,
        structural_failures,
        numeric_mismatches,
        new_seed_flags
      );
  end if;
end
$$;

select
  count(*) as audited_mcqs,
  count(*) filter (where requires_review) as legacy_review_queue,
  count(*) filter (where correct_answer_long_flag)
    as correct_answer_too_long,
  count(*) filter (where correct_answer_short_flag)
    as correct_answer_too_short
from public.obs_question_distractor_quality_audit;
