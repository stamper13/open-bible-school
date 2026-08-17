-- Let demonstrated session ability outrank repeated book-orientation screens,
-- cap excessive within-session book concentration, and add a conservative
-- emergency brake when recent answers contradict the stored ability estimate.

begin;

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Router graduation prerequisites are missing; nothing changed.';
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
  '20260729_ot_router_graduation_and_session_brake',
  'public',
  'obs_rank_ot_assessment_candidates_v4',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_ot_router_graduation_and_session_brake'
    and backup.object_schema = 'public'
    and backup.object_name =
          'obs_rank_ot_assessment_candidates_v4'
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups
  where backup_tag =
          '20260729_ot_router_graduation_and_session_brake'
    and object_schema = 'public'
    and object_name = 'obs_rank_ot_assessment_candidates_v4'
    and object_type = 'function';

  if captured <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router graduation backup failed; expected 1 definition, found %s.',
        captured
      );
  end if;
end
$$;

create or replace function public.obs_router_session_brake_stage(
  p_target_stage integer,
  p_recent_total integer,
  p_recent_correct integer,
  p_latest_two_failures integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    -- A sustained 0-25% recent window is stronger evidence than stale theta.
    when coalesce(p_recent_total, 0) >= 4
      and coalesce(p_recent_correct, 0) * 4
        <= coalesce(p_recent_total, 0)
      then 1
    -- Two of five is struggle, but not evidence of total unfamiliarity.
    when coalesce(p_recent_total, 0) >= 5
      and coalesce(p_recent_correct, 0) <= 2
      then least(
        greatest(1, least(3, coalesce(p_target_stage, 1))),
        2
      )
    -- Two immediate failures apply one downshift, not a full reset.
    when coalesce(p_latest_two_failures, 0) >= 2
      then greatest(
        1,
        greatest(1, least(3, coalesce(p_target_stage, 1))) - 1
      )
    else greatest(1, least(3, coalesce(p_target_stage, 1)))
  end;
$$;

revoke all on function public.obs_router_session_brake_stage(
  integer,
  integer,
  integer,
  integer
) from public, anon, authenticated;

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

  if definition like '%obs_router_session_brake_stage(%'
     or definition like '%orientation_screen_bucket%'
     or definition like '%book_concentration_bucket%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Router graduation patch appears to be installed already; nothing changed.';
  end if;

  anchor := $patch$      count(*) filter (
        where question_type = 'sequence_order_v1'
      )::integer as sequence_answered$patch$;
  replacement := $patch$      count(*) filter (
        where question_type = 'sequence_order_v1'
      )::integer as sequence_answered,
      count(*) filter (
        where recency_rank <= 2
          and (
            not coalesce(is_correct, false)
            or coalesce(is_idk, false)
          )
      )::integer as latest_two_failures$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Session-brake stats anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$      public.obs_router_stage_from_theta(
        theta.target_theta,
        candidate.legacy_target_stage
      ) as v4_target_stage$patch$;
  replacement := $patch$      public.obs_router_session_brake_stage(
        public.obs_router_stage_from_theta(
          theta.target_theta,
          candidate.legacy_target_stage
        ),
        candidate.recent_total,
        candidate.recent_correct,
        candidate.latest_two_failures
      ) as v4_target_stage$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Session-brake target anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$      public.obs_router_weakness_priority(
        candidate.recent_cell_answered,
        candidate.recent_cell_misses,
        candidate.current_cell_answered,
        candidate.weakness_miss_threshold,
        candidate.weakness_miss_ratio
      ) as weakness_priority,
      greatest($patch$;
  replacement := $patch$      public.obs_router_weakness_priority(
        candidate.recent_cell_answered,
        candidate.recent_cell_misses,
        candidate.current_cell_answered,
        candidate.weakness_miss_threshold,
        candidate.weakness_miss_ratio
      ) as weakness_priority,
      case
        when candidate.policy_version = 'V4'
          and candidate.v4_target_stage >= 2
          and candidate.question_family = 'book_orientation'
          and candidate.family_answered >= 1
          then 1
        else 0
      end as orientation_screen_bucket,
      case
        when candidate.policy_version <> 'V4'
          or candidate.pending_book_code = candidate.book_code
          or (
            candidate.recovery_stage is not null
            and candidate.latest_book_code = candidate.book_code
          )
          then 0
        when candidate.book_answered >= 5 then 2
        when candidate.book_answered >= 3 then 1
        else 0
      end as book_concentration_bucket,
      greatest($patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Graduation scoring anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  anchor := $patch$        order by
          repeat_cooldown_bucket,
          weakness_priority,
          route_priority,$patch$;
  replacement := $patch$        order by
          repeat_cooldown_bucket,
          weakness_priority,
          orientation_screen_bucket,
          book_concentration_bucket,
          route_priority,$patch$;
  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);
  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Graduation ordering anchor mismatch; found %s.',
        occurrences
      );
  end if;
  definition := replace(definition, anchor, replacement);

  execute definition;
end
$$;

comment on function public.obs_router_session_brake_stage(
  integer,
  integer,
  integer,
  integer
) is
  'Caps OT router difficulty after immediate or sustained session struggle without replacing theta as the normal difficulty controller.';

commit;
