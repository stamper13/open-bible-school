-- Roll back router v6 step 22 by restoring the previous
-- get_next_assessment_question wrapper body captured at migration time.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_sql text;
begin
  if to_regclass('public.obs_schema_backups') is null then
    raise exception using
      errcode = 'P0001',
      message = 'obs_schema_backups is missing; cannot restore get_next_assessment_question.';
  end if;

  select backup.definition
  into v_sql
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.backup_tag = '20260823172000_router_v6_22_next_question_fallback'
  order by backup.created_at desc
  limit 1;

  if v_sql is null then
    raise exception using
      errcode = 'P0001',
      message = 'No backup found for router v6 step 22.';
  end if;

  execute v_sql;
end
$rollback$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next OT assessment question.';

notify pgrst, 'reload schema';

commit;
