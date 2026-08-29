-- Router v6, step 6 of 8: wire the question RPC to v6.
--
-- DELIBERATELY NON-ACTIVATING, following the pattern OT router v4 used. This
-- migration installs the V6-capable body but leaves obs_router_policy_config
-- on active_version = 'V5' and campaign_enabled = false. Production behavior
-- after applying this file is identical to production behavior before it.
--
-- Activation is a separate, reviewed one-line UPDATE (see the bottom of this
-- file, commented out, and supabase/verify for the replay that must pass
-- first).
--
-- Two behavior changes take effect together at activation:
--
--   1. The fast baseline selector is scoped to cold_start. Today
--      obs_get_next_ot_baseline_question_fast is tried FIRST on every OT
--      adaptive attempt and only falls through when it returns nothing, so it
--      routes roughly the first 16 of 20 items. Its ORDER BY carries no
--      dimension-need term, no IRT information term, no stage ladder, and no
--      theta reference at all -- which is why measured difficulty currently
--      falls after success instead of rising. It is genuinely good at the one
--      job it was written for, the opening cold-start section scan, and it
--      keeps only that job.
--
--   2. Everything after the first assessment routes through v6, which has
--      theta, IRT information, the stage ladder, and the campaign lane.
--
-- Rollback is the same UPDATE in reverse; the V5 path below is preserved
-- verbatim, not reimplemented.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.obs_schema_backups (
  id uuid primary key default gen_random_uuid(),
  backup_tag text not null,
  object_schema text not null,
  object_name text not null,
  object_type text not null,
  definition text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regprocedure('public.obs_router_sync_campaign(uuid,uuid)') is null
     or to_regprocedure('public.obs_router_mode(uuid)') is null
     or to_regprocedure(
       'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 6 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

-- Capture the live definition before replacing it, as every prior router
-- migration in this project does.
insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260822_router_v6',
  'public',
  'get_next_assessment_question',
  'function',
  pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260822_router_v6'
    and backup.object_name = 'get_next_assessment_question'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260822_router_v6'
    and backup.object_name = 'get_next_assessment_question';

  if captured <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router v6 backup failed; expected 1 definition, found %s.',
        captured
      );
  end if;
end
$$;

alter table public.obs_router_policy_config
  add column if not exists cold_start_uses_fast_selector boolean not null default true;

alter table public.obs_router_policy_config
  drop constraint if exists obs_router_policy_version_ck;

alter table public.obs_router_policy_config
  add constraint obs_router_policy_version_ck
  check (
    active_version in ('V3', 'V4', 'V5', 'V6')
    and shadow_version in ('V3', 'V4', 'V5')
    and active_version <> shadow_version
  );

comment on column public.obs_router_policy_config.cold_start_uses_fast_selector is
  'When true (and active_version is V6) the fast baseline selector runs for '
  'the opening items of cold_start attempts only. Set false to bypass it '
  'entirely, which is the rollback lever if cold-start section rotation '
  'regresses.';

alter table public.obs_router_policy_config
  add column if not exists cold_start_fast_answer_limit integer not null default 4;

alter table public.obs_router_policy_config
  drop constraint if exists obs_router_policy_config_cold_start_fast_answer_limit_ck;

alter table public.obs_router_policy_config
  add constraint obs_router_policy_config_cold_start_fast_answer_limit_ck
  check (cold_start_fast_answer_limit between 0 and 12);

comment on column public.obs_router_policy_config.cold_start_fast_answer_limit is
  'Maximum scoring-eligible answers in a cold_start attempt for which the fast '
  'baseline selector may run. Default 4 gives it the first-pass section scan '
  'without letting it shadow the adaptive ranker for most of the assessment.';

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
set search_path to 'public'
as $function$
declare
  attempt_row record;
  fast_row record;
  ranked_row record;
  v_map jsonb;
  v_book_orientation_answered integer := 0;
  v_division_taxonomy_answered integer := 0;
  v_active_version text := 'V5';
  v_mode text := 'cold_start';
  v_use_fast boolean := true;
  v_fast_answer_limit integer := 4;
  v_scored_answered integer := 0;
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
    upper(coalesce(config.active_version, 'V5')),
    coalesce(config.cold_start_uses_fast_selector, true),
    greatest(0, least(coalesce(config.cold_start_fast_answer_limit, 4), 12))
  into v_active_version, v_use_fast, v_fast_answer_limit
  from public.obs_router_policy_config config
  where config.policy_key = 'OT_GENERAL';

  -- Campaign bookkeeping runs before ranking because the ranker is STABLE and
  -- cannot write. A failure here must never cost the learner a question, so it
  -- is contained: routing falls back to mode-free behavior.
  if v_active_version = 'V6' then
    begin
      perform public.obs_router_sync_campaign(p_user_id, p_attempt_id);
      v_mode := public.obs_router_mode(p_user_id);
    exception when others then
      v_mode := 'cold_start';
    end;
  end if;

  select
    count(*) filter (where answer.scoring_eligible)::integer,
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
  into v_scored_answered, v_book_orientation_answered, v_division_taxonomy_answered
  from public.assessment_answers answer
  left join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = answer.generated_question_id
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  -- The fast baseline selector keeps only the opening cold-start scan. Under
  -- V5 this condition is always true, which is what makes this migration inert
  -- until the one-line activation update.
  if v_active_version <> 'V6'
     or (
       v_use_fast
       and v_mode = 'cold_start'
       and v_scored_answered < v_fast_answer_limit
     ) then
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
  end if;

  if v_active_version = 'V6' then
    select *
    into ranked_row
    from public.obs_rank_ot_assessment_candidates_v6(
      p_attempt_id, p_user_id, 'V6', null, now(), 25
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
  else
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
  end if;

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

-- Activation, deliberately NOT run here. Apply only after
-- supabase/verify/20260822_router_v6_verify.sql and the profile replay pass:
--
--   update public.obs_router_policy_config
--   set active_version = 'V6',
--       campaign_enabled = true,
--       updated_at = now()
--   where policy_key = 'OT_GENERAL';
--
-- Rollback:
--
--   update public.obs_router_policy_config
--   set active_version = 'V5',
--       campaign_enabled = false,
--       updated_at = now()
--   where policy_key = 'OT_GENERAL';

commit;
