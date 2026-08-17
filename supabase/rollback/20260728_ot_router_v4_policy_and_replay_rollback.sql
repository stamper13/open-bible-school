begin;

do $$
declare
  backup record;
  restored integer := 0;
begin
  for backup in
    select definition
    from public.obs_schema_backups
    where backup_tag = '20260728_ot_router_v4'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in (
        'get_next_assessment_question',
        'obs_get_next_focused_question_v2'
      )
    order by id
  loop
    execute backup.definition;
    restored := restored + 1;
  end loop;

  if restored <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT router v4 rollback aborted: expected 2 backups, restored %s.',
        restored
      );
  end if;
end
$$;

drop function if exists public.obs_replay_ot_router_attempt(uuid);
drop function if exists public.obs_rank_ot_assessment_candidates_v4(
  uuid, uuid, text, integer, timestamptz, integer
);
drop function if exists public.obs_general_route_priority_v4(
  text, integer, text, integer, boolean, integer, boolean,
  text, integer, integer
);
drop function if exists public.obs_advanced_dimension_unlocked(
  uuid, timestamptz
);
drop function if exists public.obs_router_scope_baseline_met(
  uuid, text, timestamptz
);
drop function if exists public.obs_router_confirmation_stage(
  text, integer, boolean, boolean, boolean
);
drop function if exists public.obs_router_information_reliability(
  jsonb, double precision, double precision
);
drop function if exists public.obs_router_adjusted_theta(
  double precision, double precision, integer, timestamptz,
  double precision, double precision, integer, timestamptz,
  integer, timestamptz
);
drop function if exists public.obs_router_stage_from_theta(
  double precision, integer
);

drop table if exists public.obs_router_shadow_log;
drop table if exists public.obs_router_policy_config;

notify pgrst, 'reload schema';

commit;
