-- Fail-loud verification for the canonical zero-based BLI display contract.

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_contract_mismatches integer;
  v_scoring_mismatches integer;
  v_label_mismatches integer;
  v_snapshot_mismatches integer;
  v_threshold_mismatches integer;
  v_users_checked integer;
begin
  if to_regprocedure('public.compute_bli(uuid)') is null
     or to_regprocedure('public.obs_compute_bli_internal(uuid)') is null
     or to_regprocedure('public.obs_display_score_from_raw(numeric)') is null
     or to_regprocedure('public.obs_display_bli_level(integer)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: a canonical BLI function is missing.';
  end if;

  select count(*)
  into v_contract_mismatches
  from (
    values
      (0::numeric, 0, 'Unfamiliar'::text),
      (15::numeric, 120, 'Unfamiliar'::text),
      (15.1::numeric, 121, 'Acquainted'::text),
      (39::numeric, 312, 'Acquainted'::text),
      (39.1::numeric, 313, 'Familiar'::text),
      (64::numeric, 512, 'Familiar'::text),
      (64.1::numeric, 513, 'Literate'::text),
      (79::numeric, 632, 'Literate'::text),
      (79.1::numeric, 633, 'Studied'::text),
      (89::numeric, 712, 'Studied'::text),
      (89.1::numeric, 713, 'Learned'::text),
      (95::numeric, 760, 'Learned'::text),
      (95.1::numeric, 761, 'Scholar'::text),
      (100::numeric, 800, 'Scholar'::text)
  ) expected(raw_score, display_score, level_name)
  where public.obs_display_score_from_raw(expected.raw_score)
          is distinct from expected.display_score
     or public.obs_display_bli_level(expected.display_score)
          is distinct from expected.level_name;

  if v_contract_mismatches <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'VERIFY FAILED: %s canonical BLI boundary cases differ.',
        v_contract_mismatches
      );
  end if;

  with users as (
    select distinct user_id
    from public.assessment_answers
    where user_id is not null
  ),
  compared as (
    select
      internal_result.*,
      wrapper_result.bli_score as wrapper_bli_score,
      wrapper_result.bli_level as wrapper_bli_level,
      wrapper_result.total_weighted_possible as wrapper_total_weighted_possible,
      wrapper_result.total_weighted_earned as wrapper_total_weighted_earned,
      wrapper_result.questions_answered as wrapper_questions_answered,
      wrapper_result.section_scores as wrapper_section_scores
    from users
    cross join lateral public.obs_compute_bli_internal(users.user_id)
      as internal_result
    cross join lateral public.compute_bli(users.user_id)
      as wrapper_result
  )
  select
    count(*),
    count(*) filter (
      where bli_score is distinct from wrapper_bli_score
         or total_weighted_possible is distinct from wrapper_total_weighted_possible
         or total_weighted_earned is distinct from wrapper_total_weighted_earned
         or questions_answered is distinct from wrapper_questions_answered
         or section_scores is distinct from wrapper_section_scores
    ),
    count(*) filter (
      where wrapper_bli_level is distinct from public.obs_display_bli_level(
        public.obs_display_score_from_raw(bli_score)
      )
    )
  into v_users_checked, v_scoring_mismatches, v_label_mismatches
  from compared;

  select count(*)
  into v_snapshot_mismatches
  from public.obs_assessment_snapshots snapshot
  where snapshot.display_bli is distinct from
          public.obs_display_score_from_raw(snapshot.raw_bli)
     or snapshot.bli_level is distinct from public.obs_display_bli_level(
          public.obs_display_score_from_raw(snapshot.raw_bli)
        );

  select count(*)
  into v_threshold_mismatches
  from public.obs_learning_units unit
  where unit.baseline_display_score_required not between 0 and 800
     or unit.baseline_display_score_required = 585;

  if v_scoring_mismatches <> 0
     or v_label_mismatches <> 0
     or v_snapshot_mismatches <> 0
     or v_threshold_mismatches <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'VERIFY FAILED: raw=%s labels=%s snapshots=%s thresholds=%s.',
        v_scoring_mismatches,
        v_label_mismatches,
        v_snapshot_mismatches,
        v_threshold_mismatches
      );
  end if;

  if has_function_privilege('anon', 'public.compute_bli(uuid)', 'execute')
     or not has_function_privilege(
       'authenticated',
       'public.compute_bli(uuid)',
       'execute'
     )
  then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: compute_bli privileges changed unexpectedly.';
  end if;

  raise notice
    'PASS: 0-800 BLI verified for % users; raw scoring and all non-label outputs are unchanged.',
    v_users_checked;
end
$$;

rollback;
