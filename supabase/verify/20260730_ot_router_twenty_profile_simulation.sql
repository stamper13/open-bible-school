-- Service-role-only, temporary 20-profile exercise of the live OT router.
-- Synthetic auth users and all user-owned rows are removed after each run.

create unlogged table if not exists
  public.obs_router_twenty_profile_results (
    run_id uuid not null,
    profile_key text not null,
    item_number integer not null,
    generated_question_id uuid not null,
    book_code text not null,
    canonical_scope text not null,
    dimension_key text,
    question_family text,
    candidate_stage integer not null,
    target_stage integer not null,
    target_theta double precision,
    theta_se double precision,
    theta_source text,
    route_priority integer not null,
    selection_lane text,
    simulated_skill integer not null,
    simulated_result text not null,
    primary key (run_id, item_number)
  );

alter table public.obs_router_twenty_profile_results
  enable row level security;

revoke all on table public.obs_router_twenty_profile_results
  from public, anon, authenticated;

create or replace function public.obs_simulate_ot_router_profile_v2(
  p_profile_key text,
  p_question_count integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile text := upper(btrim(p_profile_key));
  v_profiles constant text[] := array[
    'NOVICE',
    'BEGINNER_IMPROVING',
    'EXPERT',
    'BROAD_INTERMEDIATE',
    'TORAH_WEAK',
    'TORAH_STRONG_FORMER_WEAK',
    'FORMER_STRONG_LATTER_WEAK',
    'PROPHETS_STRONG_FOUNDATION_WEAK',
    'WRITINGS_WEAK',
    'MINOR_PROPHETS_WEAK',
    'GEOGRAPHY_WEAK',
    'THEOLOGY_WEAK',
    'LAW_WEAK',
    'CHARACTERS_WEAK',
    'EVENTS_WEAK',
    'IDK_HEAVY',
    'NOISY_ALTERNATING',
    'FATIGUE_DECLINE',
    'STALE_HIGH_THETA',
    'HIGH_SE_UNCERTAIN'
  ];
  v_run_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_attempt_id uuid := gen_random_uuid();
  v_item integer;
  v_candidate record;
  v_submission record;
  v_scope text;
  v_stage integer;
  v_skill integer;
  v_correct_threshold integer;
  v_idk_threshold integer;
  v_roll integer;
  v_idk_roll integer;
  v_should_correct boolean;
  v_should_idk boolean;
  v_response text;
  v_correct_id text;
  v_wrong_id text;
  v_reverse_order jsonb;
  v_simulation_started_at timestamptz := now() - interval '1 hour';
begin
  if not (v_profile = any(v_profiles)) then
    raise exception using
      errcode = '22023',
      message = 'Unknown synthetic learner profile';
  end if;

  if p_question_count not between 1 and 40 then
    raise exception using
      errcode = '22023',
      message = 'Synthetic session length must be between 1 and 40';
  end if;

  insert into auth.users (
    id,
    aud,
    role,
    is_anonymous,
    created_at,
    updated_at
  ) values (
    v_user_id,
    'authenticated',
    'authenticated',
    true,
    now(),
    now()
  );

  insert into public.assessment_attempts (
    id,
    user_id,
    prior_self_rating,
    testament,
    scope_key,
    assessment_mode,
    assessment_kind,
    question_target,
    target_question_count,
    total_count,
    answered_count,
    correct_count,
    is_complete
  ) values (
    v_attempt_id,
    v_user_id,
    3,
    'OT',
    'OT',
    'adaptive',
    'ot_adaptive',
    p_question_count,
    p_question_count,
    p_question_count,
    0,
    0,
    false
  );

  if v_profile = 'STALE_HIGH_THETA' then
    insert into public.user_abilities (
      user_id,
      scope,
      theta,
      theta_se,
      n_responses,
      updated_at
    )
    select
      v_user_id,
      scope_key,
      1.80,
      0.25,
      30,
      now() - interval '240 days'
    from unnest(
      array['OT', 'TORAH', 'FORMER', 'LATTER', 'WRITINGS']
    ) scope_key;
  elsif v_profile = 'HIGH_SE_UNCERTAIN' then
    insert into public.user_abilities (
      user_id,
      scope,
      theta,
      theta_se,
      n_responses,
      updated_at
    )
    select
      v_user_id,
      scope_key,
      1.80,
      1.50,
      30,
      now()
    from unnest(
      array['OT', 'TORAH', 'FORMER', 'LATTER', 'WRITINGS']
    ) scope_key;
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  for v_item in 1..p_question_count
  loop
    select *
    into v_candidate
    from public.obs_rank_ot_assessment_candidates_v4(
      v_attempt_id,
      v_user_id,
      'V4',
      null,
      now(),
      1
    );

    if v_candidate.generated_question_id is null then
      raise exception using
        errcode = 'P0002',
        message = format(
          'Router returned no item for profile %s at position %s',
          v_profile,
          v_item
        );
    end if;

    v_scope := public.canonical_assessment_scope(
      v_candidate.book_code
    );
    v_stage := greatest(
      1,
      least(3, coalesce(v_candidate.candidate_stage, 1))
    );

    v_skill := case v_profile
      when 'NOVICE' then 15
      when 'BEGINNER_IMPROVING' then
        case when v_item <= 6 then 20 else 78 end
      when 'EXPERT' then 95
      when 'BROAD_INTERMEDIATE' then 60
      when 'TORAH_WEAK' then
        case when v_scope = 'TORAH' then 15 else 78 end
      when 'TORAH_STRONG_FORMER_WEAK' then
        case
          when v_scope = 'TORAH' then 92
          when v_scope = 'FORMER'
            or v_candidate.book_code in ('1CH', '2CH', 'EZR', 'NEH')
            then 18
          else 65
        end
      when 'FORMER_STRONG_LATTER_WEAK' then
        case
          when v_scope in ('TORAH', 'FORMER')
            or v_candidate.book_code in ('1CH', '2CH', 'EZR', 'NEH')
            then 90
          when v_scope = 'LATTER' then 18
          else 72
        end
      when 'PROPHETS_STRONG_FOUNDATION_WEAK' then
        case
          when v_scope = 'LATTER' then 92
          when v_scope in ('TORAH', 'FORMER')
            or v_candidate.book_code in ('1CH', '2CH', 'EZR', 'NEH')
            then 18
          else 65
        end
      when 'WRITINGS_WEAK' then
        case when v_scope = 'WRITINGS' then 18 else 78 end
      when 'MINOR_PROPHETS_WEAK' then
        case
          when v_candidate.book_code in (
            'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC',
            'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'
          ) then 18
          else 78
        end
      when 'GEOGRAPHY_WEAK' then
        case
          when v_candidate.dimension_key = 'geography_nations'
            then 18
          else 82
        end
      when 'THEOLOGY_WEAK' then
        case
          when v_candidate.dimension_key = 'theological_reasoning'
            then 18
          else 82
        end
      when 'LAW_WEAK' then
        case
          when v_candidate.dimension_key = 'law_commands'
            then 18
          else 82
        end
      when 'CHARACTERS_WEAK' then
        case
          when v_candidate.dimension_key = 'characters_lineage'
            then 18
          else 82
        end
      when 'EVENTS_WEAK' then
        case
          when v_candidate.dimension_key = 'events_timeline'
            then 18
          else 82
        end
      when 'IDK_HEAVY' then 28
      when 'NOISY_ALTERNATING' then 55
      when 'FATIGUE_DECLINE' then
        case when v_item <= 10 then 92 else 15 end
      when 'STALE_HIGH_THETA' then 25
      when 'HIGH_SE_UNCERTAIN' then 68
    end;

    v_correct_threshold := greatest(
      3,
      least(
        98,
        v_skill + case v_stage
          when 1 then 20
          when 2 then 0
          else -15
        end
      )
    );

    v_idk_threshold := case
      when v_profile = 'IDK_HEAVY' then 88
      when v_skill < 25 then 68
      when v_skill < 50 then 42
      when v_skill < 75 then 22
      else 8
    end;

    v_roll := mod(
      abs(hashtextextended(
        v_profile || ':' || v_item::text || ':'
        || v_candidate.generated_question_id::text,
        0
      )),
      100
    )::integer;
    v_idk_roll := mod(
      abs(hashtextextended(
        'IDK:' || v_profile || ':' || v_item::text || ':'
        || v_candidate.generated_question_id::text,
        0
      )),
      100
    )::integer;

    if v_profile = 'NOISY_ALTERNATING' then
      v_should_correct := mod(v_item, 2) = 1;
      v_should_idk := false;
    else
      v_should_correct := v_roll < v_correct_threshold;
      v_should_idk := not v_should_correct
        and v_idk_roll < v_idk_threshold;
    end if;

    if v_should_idk then
      v_response := '__IDK__';
    elsif v_candidate.question_type = 'sequence_order_v1' then
      if v_should_correct then
        v_response := '__ORDER__:'
          || (v_candidate.payload->'correct_order')::text;
      else
        select jsonb_agg(item.value order by item.ordinality desc)
        into v_reverse_order
        from jsonb_array_elements_text(
          v_candidate.payload->'correct_order'
        ) with ordinality item(value, ordinality);
        v_response := '__ORDER__:' || v_reverse_order::text;
      end if;
    else
      v_correct_id := coalesce(
        v_candidate.payload->>'correct_choice_id',
        v_candidate.payload->>'answer_id',
        v_candidate.payload->>'correctAnswerId'
      );

      if v_should_correct then
        v_response := v_correct_id;
      else
        select choice->>'id'
        into v_wrong_id
        from jsonb_array_elements(
          v_candidate.payload->'choices'
        ) choice
        where choice->>'id' <> v_correct_id
        order by choice->>'id'
        limit 1;
        v_response := v_wrong_id;
      end if;
    end if;

    select *
    into v_submission
    from public.obs_submit_ot_assessment_response(
      v_attempt_id,
      v_candidate.generated_question_id,
      v_response
    );

    -- now() is transaction-stable, so without an explicit timestamp every
    -- synthetic response ties and UUID ordering corrupts recency-sensitive
    -- router checks. Keep the answers before now() so submit-time theta
    -- recomputation still sees the newly inserted row as the latest response.
    update public.assessment_answers answer
    set answered_at = v_simulation_started_at
      + (v_item * interval '1 second')
    where answer.attempt_id = v_attempt_id
      and answer.generated_question_id = v_candidate.generated_question_id;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = format(
          'Synthetic answer row was not found for profile %s at position %s',
          v_profile,
          v_item
        );
    end if;

    insert into public.obs_router_twenty_profile_results (
      run_id,
      profile_key,
      item_number,
      generated_question_id,
      book_code,
      canonical_scope,
      dimension_key,
      question_family,
      candidate_stage,
      target_stage,
      target_theta,
      theta_se,
      theta_source,
      route_priority,
      selection_lane,
      simulated_skill,
      simulated_result
    ) values (
      v_run_id,
      v_profile,
      v_item,
      v_candidate.generated_question_id,
      v_candidate.book_code,
      v_scope,
      v_candidate.dimension_key,
      v_candidate.question_family,
      v_stage,
      v_candidate.target_stage,
      v_candidate.target_theta,
      v_candidate.theta_se,
      v_candidate.theta_source,
      v_candidate.route_priority,
      v_candidate.selection_lane,
      v_skill,
      case
        when v_submission.is_idk then 'SKIPPED'
        when v_submission.is_correct then 'CORRECT'
        else 'MISSED'
      end
    );
  end loop;

  delete from public.obs_assessment_snapshots
  where user_id = v_user_id;
  delete from public.obs_study_plan_events
  where user_id = v_user_id;
  delete from public.question_reports
  where user_id = v_user_id;
  delete from public.assessment_answers
  where user_id = v_user_id;
  delete from public.user_abilities
  where user_id = v_user_id;
  delete from public.obs_router_shadow_log
  where user_id = v_user_id;
  delete from public.assessment_attempts
  where id = v_attempt_id;
  delete from auth.users
  where id = v_user_id;

  return v_run_id;
exception
  when others then
    delete from public.obs_assessment_snapshots
    where user_id = v_user_id;
    delete from public.obs_study_plan_events
    where user_id = v_user_id;
    delete from public.question_reports
    where user_id = v_user_id;
    delete from public.assessment_answers
    where user_id = v_user_id;
    delete from public.user_abilities
    where user_id = v_user_id;
    delete from public.obs_router_shadow_log
    where user_id = v_user_id;
    delete from public.assessment_attempts
    where id = v_attempt_id;
    delete from auth.users
    where id = v_user_id;
    raise;
end;
$$;

revoke all on function
  public.obs_simulate_ot_router_profile_v2(text, integer)
  from public, anon, authenticated;

-- Run each profile in a separate statement so it receives an independent
-- statement-timeout budget.
--
-- select public.obs_simulate_ot_router_profile_v2('NOVICE', 20);
-- select public.obs_simulate_ot_router_profile_v2('BEGINNER_IMPROVING', 20);
-- select public.obs_simulate_ot_router_profile_v2('EXPERT', 20);
-- select public.obs_simulate_ot_router_profile_v2('BROAD_INTERMEDIATE', 20);
-- select public.obs_simulate_ot_router_profile_v2('TORAH_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('TORAH_STRONG_FORMER_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('FORMER_STRONG_LATTER_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('PROPHETS_STRONG_FOUNDATION_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('WRITINGS_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('MINOR_PROPHETS_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('GEOGRAPHY_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('THEOLOGY_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('LAW_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('CHARACTERS_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('EVENTS_WEAK', 20);
-- select public.obs_simulate_ot_router_profile_v2('IDK_HEAVY', 20);
-- select public.obs_simulate_ot_router_profile_v2('NOISY_ALTERNATING', 20);
-- select public.obs_simulate_ot_router_profile_v2('FATIGUE_DECLINE', 20);
-- select public.obs_simulate_ot_router_profile_v2('STALE_HIGH_THETA', 20);
-- select public.obs_simulate_ot_router_profile_v2('HIGH_SE_UNCERTAIN', 20);

-- Summary after all runs:
select
  result.profile_key,
  round(avg(result.candidate_stage), 2) as avg_stage,
  round(
    avg(result.candidate_stage)
      filter (where result.item_number <= 5),
    2
  ) as first_five_stage,
  round(
    avg(result.candidate_stage)
      filter (where result.item_number > 15),
    2
  ) as last_five_stage,
  count(*) filter (
    where result.question_family = 'book_orientation'
  ) as orientations,
  count(distinct result.book_code) as books,
  max(book_count.questions) as max_per_book,
  count(*) filter (
    where result.simulated_result = 'CORRECT'
  ) as correct,
  count(*) filter (
    where result.simulated_result = 'MISSED'
  ) as missed,
  count(*) filter (
    where result.simulated_result = 'SKIPPED'
  ) as skipped,
  count(*) filter (
    where result.selection_lane = 'EXPLORE'
  ) as exploration_items
from public.obs_router_twenty_profile_results result
join (
  select
    run_id,
    book_code,
    count(*) as questions
  from public.obs_router_twenty_profile_results
  group by run_id, book_code
) book_count
  on book_count.run_id = result.run_id
 and book_count.book_code = result.book_code
group by result.profile_key
order by result.profile_key;

-- Global invariants:
select
  count(distinct profile_key) as profiles,
  count(*) as routed_items,
  count(*) - count(distinct (run_id, generated_question_id))
    as duplicate_items_within_runs,
  max(book_count) as maximum_questions_from_one_book,
  count(*) filter (
    where question_family = 'book_orientation'
  ) as orientation_items,
  count(*) filter (
    where selection_lane = 'EXPLORE'
  ) as exploration_items,
  count(*) filter (
    where question_family is null
      and dimension_key = 'events_timeline'
  ) as unclassified_event_families
from (
  select
    result.*,
    count(*) over (
      partition by run_id, book_code
    ) as book_count
  from public.obs_router_twenty_profile_results result
) measured;

-- Cleanup after the report is exported:
-- drop function public.obs_simulate_ot_router_profile_v2(text, integer);
-- drop table public.obs_router_twenty_profile_results;
