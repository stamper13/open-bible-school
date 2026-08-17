-- Reduce OT next-question latency in the learner hot path.
--
-- V5 previously asked V4 to rank 200 candidates before reranking, even when
-- the public wrapper only needed one next item. Around question 15 this pushed
-- the RPC near the statement timeout. Keep enough breadth for V5's section
-- balancing, but bound the internal pool and remove shadow ranking from the
-- user-facing request path.

begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v5(uuid,uuid,text,integer,timestamp with time zone,integer)'::regprocedure
  );

  if v_definition not like '%coalesce(p_as_of, now()),%200%' then
    raise exception 'Unexpected V5 ranker definition; internal V4 limit anchor not found.';
  end if;

  v_definition := replace(
    v_definition,
    E'      coalesce(p_as_of, now()),\n      200',
    E'      coalesce(p_as_of, now()),\n      greatest(25, least(coalesce(p_limit, 25) * 2, 75))'
  );

  execute v_definition;
end
$$;

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
as $function$
declare
  attempt_row record;
  policy_row record;
  active_row record;
  v_answer_count integer := 0;
  v_foundation_count integer := 0;
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

  select
    count(*)::integer,
    (count(*) filter (
      where lower(coalesce(question.payload->>'question_family', '')) in (
        'book_orientation',
        'section_screen'
      )
      or lower(coalesce(question.payload->>'knowledge_granularity', '')) in (
        'book_overview',
        'canon_section',
        'section_overview'
      )
      or question.question_type in (
        'ot_book_section_sort_v1',
        'nt_book_section_sort_v1'
      )
    ))::integer
  into v_answer_count, v_foundation_count
  from public.assessment_answers answer
  left join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = answer.generated_question_id
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

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
    order by
      case
        when (v_answer_count < 16 or v_foundation_count < 12)
          and public.obs_is_high_specificity_assessment_question(
            ranked.prompt,
            ranked.question_type,
            ranked.payload
          )
          then 2
        when v_answer_count >= 8
          and (v_answer_count < 16 or v_foundation_count < 12)
          and lower(coalesce(ranked.payload->>'question_family', ''))
            = 'book_orientation'
          then 0
        else 1
      end,
      ranked.candidate_rank
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
    order by
      case
        when (v_answer_count < 16 or v_foundation_count < 12)
          and public.obs_is_high_specificity_assessment_question(
            ranked.prompt,
            ranked.question_type,
            ranked.payload
          )
          then 2
        when v_answer_count >= 8
          and (v_answer_count < 16 or v_foundation_count < 12)
          and lower(coalesce(ranked.payload->>'question_family', ''))
            = 'book_orientation'
          then 0
        else 1
      end,
      ranked.candidate_rank
    limit 1;
  end if;

  if not found then
    return;
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
$function$;

revoke all on function public.get_next_assessment_question(uuid, uuid)
  from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid)
  to authenticated, service_role;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question with a bounded candidate pool for fast learner-facing loads.';

notify pgrst, 'reload schema';

commit;
