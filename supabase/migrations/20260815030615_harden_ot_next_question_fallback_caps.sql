-- Keep fallback ranking aligned with the fast baseline policy.
--
-- If the fast selector returns no row, the wrapper falls back to V5 ranking.
-- That fallback must still honor the initial assessment's content-shape caps.

begin;

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
  fast_row record;
  ranked_row record;
  v_map jsonb;
  v_book_orientation_answered integer := 0;
  v_division_taxonomy_answered integer := 0;
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
    count(*) filter (
      where answer.scoring_eligible
        and lower(coalesce(question.payload->>'question_family', '')) = 'book_orientation'
    )::integer,
    count(*) filter (
      where answer.scoring_eligible
        and (
          question.question_type = 'ot_book_section_sort_v1'
          or coalesce(question.payload->>'prompt', question.prompt) ~* 'which group consists entirely of books in'
          or coalesce(question.payload->>'prompt', question.prompt) ~* 'which book belongs to .+ rather than'
          or coalesce(question.payload->>'prompt', question.prompt) ~* 'called the (former prophets|latter prophets|writings)'
        )
    )::integer
  into v_book_orientation_answered, v_division_taxonomy_answered
  from public.assessment_answers answer
  left join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = answer.generated_question_id
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  select *
  into fast_row
  from public.obs_get_next_ot_baseline_question_fast(p_attempt_id, p_user_id)
  limit 1;

  if found then
    return query
    select
      fast_row.out_generated_question_id::uuid,
      fast_row.prompt::text,
      fast_row.question_type::text,
      fast_row.choices::jsonb,
      fast_row.event_title::text,
      fast_row.book_code::text,
      fast_row.importance_tier::integer,
      fast_row.section::text,
      fast_row.map::jsonb;
    return;
  end if;

  select *
  into ranked_row
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
  and (
    lower(coalesce(ranked.payload->>'question_family', '')) <> 'book_orientation'
    or v_book_orientation_answered < 7
  )
  and (
    not (
      ranked.question_type = 'ot_book_section_sort_v1'
      or coalesce(ranked.payload->>'prompt', ranked.prompt) ~* 'which group consists entirely of books in'
      or coalesce(ranked.payload->>'prompt', ranked.prompt) ~* 'which book belongs to .+ rather than'
      or coalesce(ranked.payload->>'prompt', ranked.prompt) ~* 'called the (former prophets|latter prophets|writings)'
    )
    or (
      coalesce(attempt_row.answered_count, 0) >= 16
      and v_division_taxonomy_answered = 0
    )
  )
  order by ranked.candidate_rank
  limit 1;

  if not found then
    return;
  end if;

  v_map := null;
  if coalesce(ranked_row.question_type, '') like 'map\_%'
     and ranked_row.payload ? 'map_points' then
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
      'points', ranked_row.payload->'map_points'
    )
    into v_map
    from public.obs_map_basemaps basemap
    where basemap.basemap_id = ranked_row.payload->>'basemap_id';
  end if;

  return query
  select
    ranked_row.generated_question_id::uuid,
    ranked_row.prompt::text,
    ranked_row.question_type::text,
    ranked_row.payload->'choices',
    ranked_row.event_title::text,
    ranked_row.book_code::text,
    ranked_row.importance_tier::integer,
    ranked_row.section::text,
    v_map;
end;
$function$;

revoke all on function public.get_next_assessment_question(uuid, uuid)
  from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid)
  to authenticated, service_role;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question using fast baseline selection first, with fallback caps aligned to baseline content policy.';

notify pgrst, 'reload schema';

commit;
