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
  where backup.backup_tag = '20260827113000_router_v7_initial_section_balance'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing backup for 20260827113000_router_v7_initial_section_balance rollback.';
  end if;

  execute v_definition;
end
$$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. With active_version V7, tries the metadata-aware V7 ranker first, then falls back to V6/V5 if needed.';

notify pgrst, 'reload schema';

commit;
