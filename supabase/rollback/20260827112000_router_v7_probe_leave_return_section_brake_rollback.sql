begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_definition text;
begin
  select backup.definition
  into v_definition
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v7'
    and backup.backup_tag = '20260827112000_router_v7_probe_leave_return_section_brake'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'No backup found for 20260827112000_router_v7_probe_leave_return_section_brake.';
  end if;

  execute v_definition;
end
$$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'V7 OT candidate ranker restored from pre-probe-leave-return backup.';

commit;
