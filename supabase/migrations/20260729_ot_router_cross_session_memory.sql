-- Give the OT router cross-session memory.
--
-- Ordinary assessment:
--   * Prefer any unseen/cooldown-cleared item over an exact recent repeat.
--   * One recent miss in a book + dimension requests one different probe.
--   * Two sufficiently consistent misses deprioritize that cell so the
--     recommendation system can own remediation.
--
-- Explicit focused retest:
--   * The targeted range remains eligible.
--   * A different item is preferred for 45 days; an exact repeat is only a
--     fallback when the targeted bank has no suitable alternative.

begin;

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_router_policy_config') is null
     or to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regprocedure(
       'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Cross-session router-memory prerequisites are missing; nothing changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_ot_router_cross_session_memory',
  'public',
  object_name,
  'function',
  pg_get_functiondef(signature)
from (
  values
    (
      'obs_rank_ot_assessment_candidates_v4',
      'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
    ),
    (
      'obs_get_next_focused_question_v2',
      'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
    )
) objects(object_name, signature)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_ot_router_cross_session_memory'
    and backup.object_schema = 'public'
    and backup.object_name = objects.object_name
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups
  where backup_tag = '20260729_ot_router_cross_session_memory'
    and object_schema = 'public'
    and object_type = 'function'
    and object_name in (
      'obs_rank_ot_assessment_candidates_v4',
      'obs_get_next_focused_question_v2'
    );

  if captured <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Cross-session router-memory backup failed; expected 2 definitions, found %s.',
        captured
      );
  end if;
end
$$;

alter table public.obs_router_policy_config
  add column if not exists exact_repeat_cooldown_days integer
    not null default 120,
  add column if not exists focused_repeat_cooldown_days integer
    not null default 45,
  add column if not exists weakness_evidence_window_days integer
    not null default 90,
  add column if not exists weakness_miss_threshold integer
    not null default 2,
  add column if not exists weakness_miss_ratio double precision
    not null default 0.67;

update public.obs_router_policy_config
set
  exact_repeat_cooldown_days = 120,
  focused_repeat_cooldown_days = 45,
  weakness_evidence_window_days = 90,
  weakness_miss_threshold = 2,
  weakness_miss_ratio = 0.67,
  updated_at = now()
where policy_key = 'OT_GENERAL';

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_info
    where constraint_info.conrelid =
            'public.obs_router_policy_config'::regclass
      and constraint_info.conname =
            'obs_router_policy_memory_windows_ck'
  ) then
    alter table public.obs_router_policy_config
      add constraint obs_router_policy_memory_windows_ck
      check (
        exact_repeat_cooldown_days between 1 and 730
        and focused_repeat_cooldown_days between 1 and 365
        and weakness_evidence_window_days between 1 and 730
        and weakness_miss_threshold between 2 and 20
        and weakness_miss_ratio between 0.50 and 1.00
      );
  end if;
end
$$;

create or replace function public.obs_router_repeat_bucket(
  p_last_answered_at timestamptz,
  p_as_of timestamptz,
  p_cooldown_days integer
)
returns integer
language sql
stable
parallel safe
as $$
  select case
    when p_last_answered_at is null then 0
    when p_last_answered_at <=
      coalesce(p_as_of, now())
      - make_interval(days => greatest(1, p_cooldown_days))
      then 0
    else 1
  end;
$$;

create or replace function public.obs_router_weakness_priority(
  p_recent_answered integer,
  p_recent_misses integer,
  p_current_cell_answered integer,
  p_miss_threshold integer,
  p_miss_ratio double precision
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    -- A single historical miss receives one fresh confirmation probe.
    when coalesce(p_recent_answered, 0) = 1
      and coalesce(p_recent_misses, 0) = 1
      and coalesce(p_current_cell_answered, 0) = 0
      then -1
    -- Distinct misses that agree strongly enough are already actionable.
    when coalesce(p_recent_misses, 0)
        >= greatest(2, coalesce(p_miss_threshold, 2))
      and coalesce(p_recent_misses, 0)::double precision
        / nullif(coalesce(p_recent_answered, 0), 0)
        >= greatest(0.50, least(1.00, coalesce(p_miss_ratio, 0.67)))
      then 1
    else 0
  end;
$$;

do $$
declare
  definition text;
  anchor text;
  replacement text;
  occurrences integer;
begin
  definition := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );

  anchor := $patch$  user_history as ($patch$;
  replacement := $patch$  attempt_cells as (
    select
      history.book_code,
      history.dimension_key,
      count(*)::integer as answered
    from answer_history history
    where history.book_code is not null
      and history.dimension_key is not null
    group by history.book_code, history.dimension_key
  ),
  user_history as ($patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General-router attempt-cell anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$  calibration_history as ($patch$;
  replacement := $patch$  recent_item_ranked as (
    select
      question.book_code,
      question.dimension_key,
      answer.generated_question_id,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      answer.answered_at,
      row_number() over (
        partition by answer.generated_question_id
        order by answer.answered_at desc, answer.id desc
      ) as recency_rank
    from public.assessment_answers answer
    join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
    cross join config
    where answer.user_id = p_user_id
      and answer.scoring_eligible
      and answer.attempt_id <> p_attempt_id
      and answer.answered_at <= coalesce(p_as_of, now())
      and answer.answered_at >
        coalesce(p_as_of, now())
        - make_interval(
            days => config.weakness_evidence_window_days
          )
      and question.book_code is not null
      and question.dimension_key is not null
  ),
  recent_item_evidence as (
    select *
    from recent_item_ranked
    where recency_rank = 1
  ),
  recent_cell_state as (
    select
      book_code,
      dimension_key,
      count(*)::integer as answered,
      count(*) filter (
        where not coalesce(is_correct, false) or is_idk
      )::integer as misses
    from recent_item_evidence
    group by book_code, dimension_key
  ),
  calibration_history as ($patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General-router recent-cell anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$      history.last_answered_at,
      coalesce(calibration.calibration_responses, 0)$patch$;
  replacement := $patch$      history.last_answered_at,
      coalesce(current_cell.answered, 0)
        as current_cell_answered,
      coalesce(recent_cell.answered, 0)
        as recent_cell_answered,
      coalesce(recent_cell.misses, 0)
        as recent_cell_misses,
      coalesce(calibration.calibration_responses, 0)$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General-router candidate-state anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$    left join calibration_history calibration
      on calibration.generated_question_id
        = question.generated_question_id$patch$;
  replacement := $patch$    left join attempt_cells current_cell
      on current_cell.book_code = question.book_code
     and current_cell.dimension_key = question.dimension_key
    left join recent_cell_state recent_cell
      on recent_cell.book_code = question.book_code
     and recent_cell.dimension_key = question.dimension_key
    left join calibration_history calibration
      on calibration.generated_question_id
        = question.generated_question_id$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General-router candidate-join anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$      config.exploration_every_n,$patch$;
  replacement := $patch$      config.exploration_every_n,
      config.exact_repeat_cooldown_days,
      config.weakness_miss_threshold,
      config.weakness_miss_ratio,$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General-router policy-column anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$      greatest(
        0.0,
        candidate.target_share - candidate.observed_share
      ) as dimension_need,$patch$;
  replacement := $patch$      public.obs_router_repeat_bucket(
        candidate.last_answered_at,
        coalesce(p_as_of, now()),
        candidate.exact_repeat_cooldown_days
      ) as repeat_cooldown_bucket,
      public.obs_router_weakness_priority(
        candidate.recent_cell_answered,
        candidate.recent_cell_misses,
        candidate.current_cell_answered,
        candidate.weakness_miss_threshold,
        candidate.weakness_miss_ratio
      ) as weakness_priority,
      greatest(
        0.0,
        candidate.target_share - candidate.observed_share
      ) as dimension_need,$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General-router scoring anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$        order by
          route_priority,$patch$;
  replacement := $patch$        order by
          repeat_cooldown_bucket,
          weakness_priority,
          route_priority,$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General-router ordering anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  execute definition;
end
$$;

do $$
declare
  definition text;
  anchor text;
  replacement text;
  occurrences integer;
begin
  definition := pg_get_functiondef(
    'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
  );

  anchor := $patch$  with authorized as ($patch$;
  replacement := $patch$  with config as (
    select *
    from public.obs_router_policy_config
    where policy_key = 'OT_GENERAL'
  ),
  authorized as ($patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused-router config anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$      history.last_answered_at,
      exists ($patch$;
  replacement := $patch$      history.last_answered_at,
      public.obs_router_repeat_bucket(
        history.last_answered_at,
        now(),
        config.focused_repeat_cooldown_days
      ) as repeat_cooldown_bucket,
      exists ($patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused-router exposure anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$    join target on true
    cross join advanced_state advanced$patch$;
  replacement := $patch$    join target on true
    cross join config
    cross join advanced_state advanced$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused-router config-join anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$    order by
      abs(candidate.difficulty_stage - desired.difficulty_stage),$patch$;
  replacement := $patch$    order by
      candidate.repeat_cooldown_bucket,
      abs(candidate.difficulty_stage - desired.difficulty_stage),$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused-router ordering anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  execute definition;
end
$$;

revoke all on function public.obs_router_repeat_bucket(
  timestamptz, timestamptz, integer
) from public, anon, authenticated;
revoke all on function public.obs_router_weakness_priority(
  integer, integer, integer, integer, double precision
) from public, anon, authenticated;

comment on function public.obs_router_repeat_bucket(
  timestamptz, timestamptz, integer
) is
  'Places an item in the recent-repeat fallback bucket until its configured cooldown expires.';

comment on function public.obs_router_weakness_priority(
  integer, integer, integer, integer, double precision
) is
  'Requests one fresh confirmation after an isolated miss and deprioritizes already-confirmed weak cells.';

do $$
declare
  rank_definition text;
  focused_definition text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into rank_definition;

  select pg_get_functiondef(
    'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
  )
  into focused_definition;

  if rank_definition not like '%recent_cell_state as (%'
     or rank_definition not like '%repeat_cooldown_bucket,%'
     or rank_definition not like '%weakness_priority,%'
     or focused_definition not like
       '%candidate.repeat_cooldown_bucket,%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Cross-session router-memory installation verification failed.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
