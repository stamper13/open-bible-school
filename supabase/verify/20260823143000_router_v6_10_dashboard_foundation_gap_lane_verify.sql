\set ON_ERROR_STOP on

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $assertion$
declare
  v_definition text;
  v_learner uuid;
  v_attempt uuid;
  v_recommendation record;
  v_ranked record;
  v_focused record;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_definition;

  if v_definition not like '%DASHBOARD_FOUNDATION_GAP%'
     or v_definition not like '%FOUNDATION_GAP%' then
    raise exception using
      errcode = 'P0001',
      message = 'V6 ranker does not contain the dashboard foundation-gap lane.';
  end if;

  select id
  into v_learner
  from auth.users
  where lower(email) = 'adstamper35@gmail.com'
  order by created_at desc
  limit 1;

  if v_learner is null then
    raise notice 'Skipping live learner smoke: adstamper35@gmail.com is not present in this database.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_learner::text, true);

  select *
  into v_recommendation
  from public.obs_get_user_recommendation_v2(v_learner)
  limit 1;

  if v_recommendation.unit_key is distinct from 'gen-12-50'
     or v_recommendation.reason is distinct from 'Foundation questions for this unit have not been answered yet' then
    raise notice
      'Skipping targeted foundation-gap smoke: current recommendation is %.%',
      coalesce(v_recommendation.unit_key, '<none>'),
      coalesce(v_recommendation.reason, '<none>');
    return;
  end if;

  select started.attempt_id
  into v_attempt
  from public.obs_start_or_resume_ot_assessment_v2(
    p_unit_key := null,
    p_book_code := null,
    p_start_chapter := null,
    p_end_chapter := null,
    p_target_question_count := 20,
    p_force_new := true,
    p_dimension_key := null
  ) started
  limit 1;

  select *
  into v_ranked
  from public.obs_rank_ot_assessment_candidates_v6(
    v_attempt,
    v_learner,
    'V6',
    null,
    now(),
    10
  )
  order by candidate_rank
  limit 1;

  if v_ranked.generated_question_id is distinct from 'e31ead1e-5c32-4e6b-9a80-3cc3896a5cd2'::uuid
     or v_ranked.selection_lane is distinct from 'FOUNDATION_GAP'
     or v_ranked.candidate_stage is distinct from 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected Genesis foundation item as V6 rank 1; got id=%s lane=%s stage=%s.',
        coalesce(v_ranked.generated_question_id::text, '<none>'),
        coalesce(v_ranked.selection_lane, '<none>'),
        coalesce(v_ranked.candidate_stage::text, '<none>')
      );
  end if;

  select *
  into v_focused
  from public.obs_get_next_focused_question_v2(
    v_learner,
    v_attempt,
    'gen-12-50',
    null,
    null,
    null,
    null
  )
  limit 1;

  if v_focused.out_generated_question_id is distinct from 'e31ead1e-5c32-4e6b-9a80-3cc3896a5cd2'::uuid then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected focused Genesis retest to return e31ead1e; got %s.',
        coalesce(v_focused.out_generated_question_id::text, '<none>')
      );
  end if;
end
$assertion$;

rollback;
