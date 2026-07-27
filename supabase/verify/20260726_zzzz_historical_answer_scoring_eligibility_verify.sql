-- Fail-loud verification for historical answer scoring eligibility.

do $$
declare
  unsafe_but_eligible integer;
  excluded_outside_rule integer;
  expected_excluded integer;
  installed_patches integer;
  ability_count_mismatch integer;
begin
  select count(*)
  into unsafe_but_eligible
  from public.assessment_answers answer
  join public.assessment_attempts attempt
    on attempt.id = answer.attempt_id
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
    and question.question_type <> 'sequence_order_v1'
    and coalesce(answer.delivery_contract, '') <>
      'client_confirmed_v2'
    and answer.scoring_eligible;

  select count(*)
  into excluded_outside_rule
  from public.assessment_answers answer
  join public.assessment_attempts attempt
    on attempt.id = answer.attempt_id
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where not answer.scoring_eligible
    and not (
      upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
      and question.question_type <> 'sequence_order_v1'
      and coalesce(answer.delivery_contract, '') <>
        'client_confirmed_v2'
    );

  select count(*)
  into expected_excluded
  from public.assessment_answers answer
  where not answer.scoring_eligible
    and answer.scoring_exclusion_reason =
      'unverifiable_pre_contract_choice_delivery';

  select count(*)
  into installed_patches
  from (
    values
      ('public.obs_compute_bli_internal(uuid)'),
      ('public.obs_compute_scoped_bli(uuid,text,timestamptz)'),
      ('public.obs_get_scope_summary(uuid,text,text)'),
      ('public.obs_get_user_recommendation_v2(uuid)'),
      ('public.update_theta_internal(uuid,text,uuid,boolean)')
  ) expected(signature)
  where pg_get_functiondef(expected.signature::regprocedure)
    like '%scoring_eligible%';

  select count(*)
  into ability_count_mismatch
  from public.user_abilities ability
  where ability.n_responses <> (
    select count(*)
    from public.assessment_answers answer
    join public.ot_generated_questions question
      on question.id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    left join public.v_question_bank bank
      on bank.generated_question_id = question.id
    where answer.user_id = ability.user_id
      and answer.scoring_eligible
      and answer.answered_at is not null
      and question.question_type not like 'quarantined%'
      and upper(coalesce(event.book_code, bank.book_code)) =
        any(public.obs_book_codes_for_scope(ability.scope))
  );

  if unsafe_but_eligible <> 0
     or excluded_outside_rule <> 0
     or expected_excluded = 0
     or installed_patches <> 5
     or ability_count_mismatch <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Eligibility VERIFY FAILED: unsafe_eligible=%s outside_rule=%s excluded=%s patches=%s/5 ability_count_mismatch=%s.',
        unsafe_but_eligible,
        excluded_outside_rule,
        expected_excluded,
        installed_patches,
        ability_count_mismatch
      );
  end if;

  raise notice
    'PASS: % unverifiable pre-contract OT answers remain in history but are excluded from all installed scoring paths.',
    expected_excluded;
end
$$;

select
  coalesce(attempt.assessment_kind, 'LEGACY') as assessment_kind,
  coalesce(answer.delivery_contract, 'NO_CONTRACT') as delivery_contract,
  count(*)::integer as answers,
  count(*) filter (where answer.scoring_eligible)::integer
    as scoring_eligible,
  count(*) filter (where not answer.scoring_eligible)::integer
    as history_only
from public.assessment_answers answer
join public.assessment_attempts attempt
  on attempt.id = answer.attempt_id
group by attempt.assessment_kind, answer.delivery_contract
order by attempt.assessment_kind nulls first, answer.delivery_contract;
