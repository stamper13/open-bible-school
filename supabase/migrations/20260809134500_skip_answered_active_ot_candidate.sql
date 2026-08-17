-- Defensively skip an already-answered adaptive OT candidate.
--
-- The rankers normally exclude answered questions, but this wrapper is the
-- final gate before the browser sees an item. If a stale/cached active row ever
-- leaks through, select the first ranked candidate not already answered in the
-- attempt instead of trapping the learner in a duplicate-submit loop.

create or replace function public.get_next_assessment_question(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text,
  map jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row record;
  policy_row record;
  active_row record;
  shadow_row record;
  v_answer_count integer;
  v_map jsonb;
begin
  select attempt.*
  into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
    and auth.uid() = p_user_id
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null;

  if not found then
    return;
  end if;

  select *
  into policy_row
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  if upper(coalesce(policy_row.active_version, 'V4')) = 'V5' then
    select *
    into active_row
    from public.obs_rank_ot_assessment_candidates_v5(
      p_attempt_id, p_user_id, 'V5', null, now(), 25
    ) ranked
    where not exists (
      select 1
      from public.assessment_answers answer
      where answer.attempt_id = p_attempt_id
        and answer.user_id = p_user_id
        and answer.generated_question_id = ranked.generated_question_id
    )
    order by ranked.candidate_rank
    limit 1;
  else
    select *
    into active_row
    from public.obs_rank_ot_assessment_candidates_v4(
      p_attempt_id, p_user_id, policy_row.active_version, null, now(), 25
    ) ranked
    where not exists (
      select 1
      from public.assessment_answers answer
      where answer.attempt_id = p_attempt_id
        and answer.user_id = p_user_id
        and answer.generated_question_id = ranked.generated_question_id
    )
    order by ranked.candidate_rank
    limit 1;
  end if;

  if not found then
    return;
  end if;

  select count(*)::integer
  into v_answer_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  if policy_row.shadow_enabled
     and policy_row.shadow_sample_every_n > 0
     and mod(v_answer_count, policy_row.shadow_sample_every_n) = 0
     and not exists (
       select 1 from public.obs_router_shadow_log log
       where log.attempt_id = p_attempt_id
         and log.answer_count = v_answer_count
         and log.active_version = policy_row.active_version
         and log.shadow_version = policy_row.shadow_version
     )
  then
    if upper(coalesce(policy_row.shadow_version, 'V4')) = 'V5' then
      select *
      into shadow_row
      from public.obs_rank_ot_assessment_candidates_v5(
        p_attempt_id, p_user_id, 'V5', null, now(), 1
      );
    else
      select *
      into shadow_row
      from public.obs_rank_ot_assessment_candidates_v4(
        p_attempt_id, p_user_id, policy_row.shadow_version, null, now(), 1
      );
    end if;

    insert into public.obs_router_shadow_log (
      attempt_id, user_id, answer_count, active_version, shadow_version,
      active_question_id, shadow_question_id, active_book_code, shadow_book_code,
      active_stage, shadow_stage, active_target_theta, shadow_target_theta,
      active_lane, shadow_lane
    ) values (
      p_attempt_id, p_user_id, v_answer_count,
      policy_row.active_version, policy_row.shadow_version,
      active_row.generated_question_id, shadow_row.generated_question_id,
      active_row.book_code, shadow_row.book_code,
      active_row.candidate_stage, shadow_row.candidate_stage,
      active_row.target_theta, shadow_row.target_theta,
      active_row.selection_lane, shadow_row.selection_lane
    )
    on conflict (attempt_id, answer_count, active_version, shadow_version)
      do nothing;
  end if;

  v_map := null;
  if coalesce(active_row.question_type, '') like 'map\_%'
     and active_row.payload ? 'map_points' then
    select jsonb_build_object(
      'basemap_id', basemap.basemap_id,
      'label', basemap.label,
      'bounds', jsonb_build_object(
        'lat_min', basemap.lat_min,
        'lat_max', basemap.lat_max,
        'lon_min', basemap.lon_min,
        'lon_max', basemap.lon_max
      ),
      'min_separation_km', basemap.min_separation_km,
      'points', active_row.payload->'map_points'
    )
    into v_map
    from public.obs_map_basemaps basemap
    where basemap.basemap_id = active_row.payload->>'basemap_id';
  end if;

  return query
  select
    active_row.generated_question_id::uuid,
    active_row.prompt::text,
    active_row.question_type::text,
    active_row.payload->'choices',
    active_row.event_title::text,
    active_row.book_code::text,
    active_row.importance_tier::integer,
    active_row.section::text,
    v_map;
end;
$$;

revoke all on function public.get_next_assessment_question(uuid, uuid)
  from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid)
  to authenticated, service_role;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question and defensively skips candidates already answered in the attempt.';

notify pgrst, 'reload schema';
