begin;

do $$
declare
  backup record;
  restored integer := 0;
begin
  for backup in
    select definition
    from public.obs_schema_backups
    where backup_tag = '20260729_ot_router_cross_session_memory'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in (
        'obs_rank_ot_assessment_candidates_v4',
        'obs_get_next_focused_question_v2'
      )
    order by object_name
  loop
    execute backup.definition;
    restored := restored + 1;
  end loop;

  if restored <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Cross-session router-memory rollback expected 2 backups, restored %s.',
        restored
      );
  end if;
end
$$;

drop function if exists public.obs_router_repeat_bucket(
  timestamptz, timestamptz, integer
);
drop function if exists public.obs_router_weakness_priority(
  integer, integer, integer, integer, double precision
);

alter table public.obs_router_policy_config
  drop constraint if exists obs_router_policy_memory_windows_ck,
  drop column if exists exact_repeat_cooldown_days,
  drop column if exists focused_repeat_cooldown_days,
  drop column if exists weakness_evidence_window_days,
  drop column if exists weakness_miss_threshold,
  drop column if exists weakness_miss_ratio;

notify pgrst, 'reload schema';

commit;
