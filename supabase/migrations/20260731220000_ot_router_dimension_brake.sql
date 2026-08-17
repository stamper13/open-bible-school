-- Keep strong performance in one dimension from forcing hard questions in a
-- dimension where the learner has already missed twice this session.

begin;

create or replace function public.obs_router_dimension_brake_stage(
  p_target_stage integer,
  p_dimension_answered integer,
  p_dimension_misses integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_dimension_misses, 0) >= 2
      then greatest(
        1,
        greatest(1, least(3, coalesce(p_target_stage, 1))) - 1
      )
    else greatest(1, least(3, coalesce(p_target_stage, 1)))
  end;
$$;

create or replace function public.obs_router_dimension_brake_bucket(
  p_dimension_answered integer,
  p_dimension_misses integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    -- Two misses establish the concern. A third item may confirm it, after
    -- which the router should assess something else during this session.
    when coalesce(p_dimension_misses, 0) >= 2
      and coalesce(p_dimension_answered, 0) >= 3
      then 1
    else 0
  end;
$$;

revoke all on function public.obs_router_dimension_brake_stage(
  integer, integer, integer
) from public, anon, authenticated;
revoke all on function public.obs_router_dimension_brake_bucket(
  integer, integer
) from public, anon, authenticated;

grant execute on function public.obs_router_dimension_brake_stage(
  integer, integer, integer
) to service_role;
grant execute on function public.obs_router_dimension_brake_bucket(
  integer, integer
) to service_role;

do $$
declare
  v_oid oid;
  v_definition text;
  v_anchor text;
  v_replacement text;
  v_occurrences integer;
begin
  v_oid := to_regprocedure(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
  );

  if v_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'OT V4 router is missing';
  end if;

  insert into public.obs_schema_backups (
    backup_tag,
    object_schema,
    object_name,
    object_type,
    definition
  )
  select
    '20260731_ot_router_dimension_brake',
    'public',
    'obs_rank_ot_assessment_candidates_v4',
    'function',
    pg_get_functiondef(v_oid)
  where not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260731_ot_router_dimension_brake'
      and backup.object_schema = 'public'
      and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
      and backup.object_type = 'function'
  );

  select count(*)
  into v_occurrences
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260731_ot_router_dimension_brake'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
    and backup.object_type = 'function';

  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected exactly one OT router backup; found %s',
        v_occurrences
      );
  end if;

  v_definition := pg_get_functiondef(v_oid);

  if v_definition like '%dimension_session_state as (%'
    or v_definition like '%dimension_brake_bucket%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dimension brake appears to be installed already';
  end if;

  v_anchor := '  observed_by_dimension as (';
  v_replacement := $patch$  dimension_session_state as (
    select
      dimension_key,
      count(*)::integer as answered,
      count(*) filter (
        where not coalesce(is_correct, false)
          or coalesce(is_idk, false)
      )::integer as misses
    from answer_history
    where dimension_key is not null
    group by dimension_key
  ),
  observed_by_dimension as ($patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Dimension-state CTE anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $patch$      coalesce(current_cell.answered, 0)
        as current_cell_answered,$patch$;
  v_replacement := $patch$      coalesce(current_cell.answered, 0)
        as current_cell_answered,
      coalesce(dimension_session.answered, 0)
        as dimension_session_answered,
      coalesce(dimension_session.misses, 0)
        as dimension_session_misses,$patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Dimension-state select anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := '    left join attempt_cells current_cell';
  v_replacement := $patch$    left join dimension_session_state dimension_session
      on dimension_session.dimension_key = question.dimension_key
    left join attempt_cells current_cell$patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Dimension-state join anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := '      theta.target_theta as v4_target_theta,';
  v_replacement := $patch$      greatest(
        -3.0,
        least(
          3.0,
          theta.target_theta - case
            when candidate.dimension_session_misses >= 2 then 0.90
            else 0.0
          end
        )
      ) as v4_target_theta,$patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Dimension theta anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $patch$      public.obs_router_session_brake_stage(
        public.obs_router_stage_from_theta(
          theta.target_theta,
          candidate.legacy_target_stage
        ),
        candidate.recent_total,
        candidate.recent_correct,
        candidate.latest_two_failures
      ) as v4_target_stage$patch$;
  v_replacement := $patch$      public.obs_router_dimension_brake_stage(
        public.obs_router_session_brake_stage(
          public.obs_router_stage_from_theta(
            theta.target_theta,
            candidate.legacy_target_stage
          ),
          candidate.recent_total,
          candidate.recent_correct,
          candidate.latest_two_failures
        ),
        candidate.dimension_session_answered,
        candidate.dimension_session_misses
      ) as v4_target_stage$patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Dimension-stage anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := '      public.obs_router_weakness_priority(';
  v_replacement := $patch$      public.obs_router_dimension_brake_bucket(
        candidate.dimension_session_answered,
        candidate.dimension_session_misses
      ) as dimension_brake_bucket,
      public.obs_router_weakness_priority($patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Dimension bucket anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $patch$          orientation_screen_bucket,
          weakness_priority,$patch$;
  v_replacement := $patch$          orientation_screen_bucket,
          dimension_brake_bucket,
          weakness_priority,$patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Dimension ordering anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  execute v_definition;
end;
$$;

comment on function public.obs_router_dimension_brake_stage(
  integer, integer, integer
) is
  'Downshifts only a repeatedly missed dimension by one stage during the current assessment.';

comment on function public.obs_router_dimension_brake_bucket(
  integer, integer
) is
  'Deprioritizes a dimension after two misses and one possible confirmation item in the current assessment.';

notify pgrst, 'reload schema';

commit;
