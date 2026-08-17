-- Temporary, service-role-only harness for exercising the live OT router.
-- Run setup once, call obs_simulate_ot_router_profile for each profile, inspect
-- obs_router_profile_simulation_results, then run the cleanup block at bottom.

create unlogged table if not exists public.obs_router_profile_simulation_results (
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
  theta_source text,
  route_priority integer not null,
  selection_lane text,
  simulated_result text not null,
  prompt text not null,
  primary key (run_id, item_number)
);

revoke all on table public.obs_router_profile_simulation_results
  from public, anon, authenticated;

create or replace function public.obs_simulate_ot_router_profile(
  p_profile_key text,
  p_question_count integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile text := upper(btrim(p_profile_key));
  v_run_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_attempt_id uuid := gen_random_uuid();
  v_item integer;
  v_candidate record;
  v_submission record;
  v_scope text;
  v_stage integer;
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
begin
  if v_profile not in (
    'NOVICE',
    'NARRATIVE_STRONG_PROPHETS_WEAK',
    'PROPHETS_STRONG_FOUNDATION_WEAK',
    'BROAD_INTERMEDIATE',
    'ADVANCED_GEOGRAPHY_WEAK'
  ) then
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

  perform set_config(
    'request.jwt.claim.sub',
    v_user_id::text,
    true
  );

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

    v_correct_threshold := case v_profile
      when 'NOVICE' then
        case v_stage when 1 then 45 when 2 then 18 else 5 end

      when 'NARRATIVE_STRONG_PROPHETS_WEAK' then
        case
          when v_scope in ('TORAH', 'FORMER')
            or v_candidate.book_code in ('1CH', '2CH', 'EZR', 'NEH')
            then case v_stage when 1 then 95 when 2 then 82 else 58 end
          when v_scope = 'LATTER'
            then case v_stage when 1 then 42 when 2 then 18 else 6 end
          else case v_stage when 1 then 78 when 2 then 55 else 28 end
        end

      when 'PROPHETS_STRONG_FOUNDATION_WEAK' then
        case
          when v_scope = 'LATTER'
            then case v_stage when 1 then 96 when 2 then 82 else 62 end
          when v_scope in ('TORAH', 'FORMER')
            or v_candidate.book_code in ('1CH', '2CH', 'EZR', 'NEH')
            then case v_stage when 1 then 42 when 2 then 18 else 6 end
          else case v_stage when 1 then 72 when 2 then 48 else 24 end
        end

      when 'BROAD_INTERMEDIATE' then
        case v_stage when 1 then 92 when 2 then 66 else 34 end

      when 'ADVANCED_GEOGRAPHY_WEAK' then
        case
          when v_candidate.dimension_key = 'geography_nations'
            then case v_stage when 1 then 48 when 2 then 22 else 8 end
          else case v_stage when 1 then 98 when 2 then 88 else 68 end
        end
    end;

    v_idk_threshold := case v_profile
      when 'NOVICE' then 70
      when 'NARRATIVE_STRONG_PROPHETS_WEAK' then
        case when v_scope = 'LATTER' then 78 else 30 end
      when 'PROPHETS_STRONG_FOUNDATION_WEAK' then
        case
          when v_scope in ('TORAH', 'FORMER')
            or v_candidate.book_code in ('1CH', '2CH', 'EZR', 'NEH')
            then 72
          else 25
        end
      when 'BROAD_INTERMEDIATE' then 32
      when 'ADVANCED_GEOGRAPHY_WEAK' then
        case
          when v_candidate.dimension_key = 'geography_nations'
            then 60
          else 18
        end
    end;

    v_roll := mod(
      abs(hashtext(
        v_profile || ':' || v_candidate.generated_question_id::text
      )),
      100
    );
    v_idk_roll := mod(
      abs(hashtext(
        'IDK:' || v_profile || ':'
        || v_candidate.generated_question_id::text
      )),
      100
    );
    v_should_correct := v_roll < v_correct_threshold;
    v_should_idk := not v_should_correct
      and v_idk_roll < v_idk_threshold;

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

    insert into public.obs_router_profile_simulation_results (
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
      theta_source,
      route_priority,
      selection_lane,
      simulated_result,
      prompt
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
      v_candidate.theta_source,
      v_candidate.route_priority,
      v_candidate.selection_lane,
      case
        when v_submission.is_idk then 'SKIPPED'
        when v_submission.is_correct then 'CORRECT'
        else 'MISSED'
      end,
      v_candidate.prompt
    );
  end loop;

  -- Delete every synthetic learner artifact while retaining only the
  -- de-identified routing transcript above.
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

revoke all on function public.obs_simulate_ot_router_profile(text, integer)
  from public, anon, authenticated;

-- Run one at a time so each session has an independent timeout budget:
--
-- select public.obs_simulate_ot_router_profile('NOVICE', 20);
-- select public.obs_simulate_ot_router_profile(
--   'NARRATIVE_STRONG_PROPHETS_WEAK', 20
-- );
-- select public.obs_simulate_ot_router_profile(
--   'PROPHETS_STRONG_FOUNDATION_WEAK', 20
-- );
-- select public.obs_simulate_ot_router_profile('BROAD_INTERMEDIATE', 20);
-- select public.obs_simulate_ot_router_profile(
--   'ADVANCED_GEOGRAPHY_WEAK', 20
-- );
--
-- Cleanup after exporting the results:
--
-- drop function public.obs_simulate_ot_router_profile(text, integer);
-- drop table public.obs_router_profile_simulation_results;
