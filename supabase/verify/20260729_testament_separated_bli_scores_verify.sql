-- Verify OT/NT score isolation and the conditional 0-1600 combined score.

begin;

select set_config(
  'request.jwt.claim.role',
  'service_role',
  true
);

do $$
declare
  mismatch record;
  combined_mismatches integer;
begin
  select
    learner.user_id,
    legacy.questions_answered as legacy_ot_count,
    expected.ot_count
  into mismatch
  from (
    select distinct answer.user_id
    from public.assessment_answers answer
    where answer.user_id is not null
  ) learner
  cross join lateral
    public.obs_compute_bli_internal(learner.user_id) legacy
  cross join lateral (
    select
      count(*) filter (
        where evidence.testament = 'OT'
      )::integer as ot_count
    from public.obs_answer_evidence evidence
    join public.assessment_answers answer
      on answer.id = evidence.answer_id
    where evidence.user_id = learner.user_id
      and answer.scoring_eligible
      and evidence.question_type not like 'quarantined%'
  ) expected
  where legacy.questions_answered <> expected.ot_count
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT BLI still contains cross-testament evidence for user %s: score_count=%s expected_ot=%s.',
        mismatch.user_id,
        mismatch.legacy_ot_count,
        mismatch.ot_count
      );
  end if;

  select count(*)
  into combined_mismatches
  from (
    select distinct answer.user_id
    from public.assessment_answers answer
    where answer.user_id is not null
  ) learner
  cross join lateral
    public.obs_get_testament_bli_scores(learner.user_id) score
  where score.combined_available <>
          (
            score.ot_questions_answered > 0
            and score.nt_questions_answered > 0
          )
     or (
       score.combined_available
       and score.combined_display_bli <>
             score.ot_display_bli + score.nt_display_bli
     )
     or (
       not score.combined_available
       and score.combined_display_bli is not null
     );

  if combined_mismatches <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Combined BLI verification failed for %s learners.',
        combined_mismatches
      );
  end if;
end
$$;

select
  learner.user_id,
  score.ot_display_bli,
  score.ot_questions_answered,
  score.nt_display_bli,
  score.nt_questions_answered,
  score.combined_display_bli,
  score.combined_available
from (
  select distinct answer.user_id
  from public.assessment_answers answer
  where answer.user_id is not null
) learner
cross join lateral
  public.obs_get_testament_bli_scores(learner.user_id) score
order by learner.user_id;

rollback;
