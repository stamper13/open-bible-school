-- Router V7 activation hardening: initialize ranked_row before fallback tests.
--
-- The V7 activation patch changes the outer V5 branch from else to elsif so
-- an already-selected V7 row is not overwritten. Initialize ranked_row with a
-- null generated_question_id before those guards, and reset it the same way in
-- ranker exception handlers, so manual policy toggles remain safe.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 activation record-guard prerequisites are missing; nothing was changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  object_type,
  object_schema,
  object_name,
  backup_tag,
  definition
)
select
  'function',
  'public',
  'get_next_assessment_question',
  '20260827101000_router_v7_activation_record_guard',
  pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.backup_tag = '20260827101000_router_v7_activation_record_guard'
);

do $migration$
declare
  v_sql text;
  v_original text;
  v_needle text;
  v_count integer;
begin
  select pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
  into v_sql;

  v_original := v_sql;

  if v_sql like '%v7 activation ranked_row guard%' then
    raise notice 'Router V7 activation record guard is already installed.';
    return;
  end if;

  v_needle := $needle$
  into v_dashboard_foundation_gap;

  -- The fast baseline selector keeps only the opening cold-start scan. Under
$needle$;

  v_count := (
    length(v_sql) - length(replace(v_sql, v_needle, ''))
  ) / greatest(length(v_needle), 1);

  if v_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Router V7 record guard expected one insertion point, found %s.', v_count);
  end if;

  v_sql := replace(
    v_sql,
    v_needle,
$replacement$
  into v_dashboard_foundation_gap;

  -- v7 activation ranked_row guard
  select null::uuid as generated_question_id
  into ranked_row;

  -- The fast baseline selector keeps only the opening cold-start scan. Under
$replacement$
  );

  v_sql := replace(
    v_sql,
    'ranked_row := null;',
    'select null::uuid as generated_question_id into ranked_row;'
  );

  if v_sql = v_original
     or v_sql not like '%v7 activation ranked_row guard%'
     or v_sql like '%ranked_row := null;%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 record guard patch did not produce the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. With active_version V7, tries V7 first, with initialized fallback state for V6/V5 safety.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
