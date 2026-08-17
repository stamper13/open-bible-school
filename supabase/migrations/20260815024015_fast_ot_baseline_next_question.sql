-- Fast OT baseline question selection.
--
-- The full adaptive ranker is useful, but too heavy for every "next question"
-- request in a 20-item initial assessment. This selector keeps the important
-- learner-facing guarantees for baseline sessions: no repeated question, no
-- repeated stem family, broad/foundation questions early, and section/dimension
-- variety. The older adaptive ranker remains as a fallback if this selector
-- cannot find a valid candidate.

begin;

create or replace function public.obs_get_next_ot_baseline_question_fast(
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
language sql
stable
security definer
set search_path = public
as $function$
  with attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.testament, 'OT')) as testament,
      upper(coalesce(attempt.scope_key, 'OT')) as scope_key
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and auth.uid() = p_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and upper(coalesce(attempt.scope_key, 'OT')) = 'OT'
      and attempt.assessment_kind = 'ot_adaptive'
      and not coalesce(attempt.is_complete, false)
      and attempt.completed_at is null
  ),
  answered as (
    select
      answer.generated_question_id,
      answer.scoring_eligible,
      question.book_code,
      question.dimension_key,
      nullif(question.payload->>'stem_family', '') as stem_family,
      lower(coalesce(question.payload->>'question_family', '')) as question_family,
      lower(coalesce(question.payload->>'knowledge_granularity', '')) as granularity
    from attempt
    join public.assessment_answers answer
      on answer.attempt_id = attempt.id
     and answer.user_id = attempt.user_id
    left join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
  ),
  stats as (
    select
      count(*) filter (where scoring_eligible)::integer as scored_answered,
      count(*) filter (
        where scoring_eligible
          and (
            question_family in ('book_orientation', 'section_screen')
            or granularity in ('book_overview', 'canon_section', 'section_overview')
          )
      )::integer as foundation_answered
    from answered
  ),
  section_counts as (
    select
      public.canonical_assessment_scope(book_code) as section_key,
      count(*) filter (where scoring_eligible)::integer as answered
    from answered
    where book_code is not null
    group by public.canonical_assessment_scope(book_code)
  ),
  dimension_counts as (
    select
      dimension_key,
      count(*) filter (where scoring_eligible)::integer as answered
    from answered
    where dimension_key is not null
    group by dimension_key
  ),
  candidates as (
    select
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      coalesce(event.event_title, question.book_code || ' question') as event_title,
      question.book_code,
      question.dimension_key,
      coalesce(question.importance_conceptual, question.routing_score, 0) as importance_score,
      public.canonical_assessment_scope(question.book_code) as section_key,
      lower(coalesce(question.payload->>'question_family', '')) as question_family,
      lower(coalesce(question.payload->>'knowledge_granularity', '')) as granularity,
      coalesce(section_counts.answered, 0) as section_answered,
      coalesce(dimension_counts.answered, 0) as dimension_answered,
      coalesce(question.payload->>'stem_family', '') as stem_family
    from attempt
    join public.obs_question_bank_with_dimensions question
      on public.question_matches_assessment_scope(
        question.book_code,
        attempt.testament,
        attempt.scope_key
      )
    left join public.bible_events event
      on event.id = question.event_id
    left join section_counts
      on section_counts.section_key = public.canonical_assessment_scope(question.book_code)
    left join dimension_counts
      on dimension_counts.dimension_key = question.dimension_key
    where question.generated_question_id is not null
      and coalesce(question.payload->>'prompt', question.prompt) is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and question.question_type not like 'quarantined%'
      and question.question_type not like 'map\_%'
      and (
        (
          public.obs_is_order_response_question(question.question_type, question.payload)
          and jsonb_array_length(question.payload->'choices') between 3 and 5
        )
        or (
          not public.obs_is_order_response_question(question.question_type, question.payload)
          and jsonb_array_length(question.payload->'choices') = 4
          and coalesce(
            question.payload->>'correct_choice_id',
            question.payload->>'answer_id',
            question.payload->>'correctAnswerId'
          ) is not null
        )
      )
      and not exists (
        select 1
        from answered used
        where used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from answered used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(question.payload->>'stem_family', '')
      )
  )
  select
    candidate.generated_question_id,
    candidate.prompt::text,
    candidate.question_type::text,
    candidate.payload->'choices',
    candidate.event_title::text,
    candidate.book_code::text,
    case
      when candidate.importance_score >= 80 then 1
      when candidate.importance_score >= 60 then 2
      else 3
    end,
    case candidate.section_key
      when 'TORAH' then 'Torah'
      when 'FORMER' then 'Former Prophets'
      when 'LATTER' then 'Latter Prophets'
      when 'WRITINGS' then 'Writings'
      else 'Old Testament'
    end,
    null::jsonb
  from candidates candidate
  cross join stats
  order by
    case
      when (stats.scored_answered < 16 or stats.foundation_answered < 12)
        and public.obs_is_high_specificity_assessment_question(
          candidate.prompt,
          candidate.question_type,
          candidate.payload
        )
        then 2
      when stats.scored_answered >= 8
        and (stats.scored_answered < 16 or stats.foundation_answered < 12)
        and candidate.question_family = 'book_orientation'
        then 0
      when stats.foundation_answered < 12
        and (
          candidate.question_family in ('book_orientation', 'section_screen')
          or candidate.granularity in ('book_overview', 'canon_section', 'section_overview')
        )
        then 0
      else 1
    end,
    candidate.section_answered,
    candidate.dimension_answered,
    case candidate.section_key
      when 'TORAH' then 1
      when 'FORMER' then 2
      when 'LATTER' then 3
      when 'WRITINGS' then 4
      else 5
    end,
    candidate.importance_score desc,
    md5(p_attempt_id::text || ':' || candidate.generated_question_id::text)
  limit 1;
$function$;

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

revoke all on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid)
  from public, anon;
grant execute on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid)
  to authenticated, service_role;

revoke all on function public.get_next_assessment_question(uuid, uuid)
  from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid)
  to authenticated, service_role;

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast no-repeat OT baseline selector used before falling back to the full adaptive ranker.';

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question using the fast baseline selector first, with full ranker fallback.';

notify pgrst, 'reload schema';

commit;
