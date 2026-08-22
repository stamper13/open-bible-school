-- Read-only schema catalog baseline.
--
-- Purpose:
--   Capture a human-readable inventory of the current Supabase/Postgres shape
--   when a full pg_dump baseline is not available. Run against production,
--   branches, or restored projects and compare the result sets.
--
-- This file intentionally does not expose function bodies or table data.

begin;

set local transaction read only;
set local statement_timeout = '30s';

select 'catalog_summary' as section,
  jsonb_build_object(
    'captured_at_utc', now(),
    'migration_count', (select count(*) from supabase_migrations.schema_migrations),
    'latest_migration_versions', (
      select jsonb_agg(version order by version desc)
      from (
        select version
        from supabase_migrations.schema_migrations
        order by version desc
        limit 10
      ) recent
    )
  ) as data;

select 'relation_summary' as section,
  n.nspname as schema_name,
  count(*) filter (where c.relkind in ('r','p'))::int as tables,
  count(*) filter (where c.relkind = 'v')::int as views,
  count(*) filter (where c.relkind = 'm')::int as materialized_views,
  count(*) filter (where c.relkind = 'S')::int as sequences,
  count(*) filter (where c.relkind in ('r','p') and c.relrowsecurity)::int as rls_enabled_tables,
  count(*) filter (where obj_description(c.oid, 'pg_class') is not null)::int as commented_relations,
  count(*)::int as total_relations
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','private')
  and c.relkind in ('r','p','v','m','f','S')
group by n.nspname
order by n.nspname;

select 'relation_catalog' as section,
  n.nspname as schema_name,
  c.relname as relation_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    when 'f' then 'foreign_table'
    when 'S' then 'sequence'
    else c.relkind::text
  end as relation_kind,
  coalesce(c.reltuples::bigint, 0) as estimated_rows,
  case when c.relkind in ('r','p') then c.relrowsecurity else null end as rls_enabled,
  case when c.relkind in ('r','p') then c.relforcerowsecurity else null end as rls_forced,
  obj_description(c.oid, 'pg_class') as comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','private')
  and c.relkind in ('r','p','v','m','f','S')
order by n.nspname, relation_kind, c.relname;

select 'function_summary' as section,
  n.nspname as schema_name,
  count(*)::int as functions,
  count(*) filter (where p.prosecdef)::int as security_definer,
  count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE'))::int as anon_execute,
  count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))::int as authenticated_execute,
  count(*) filter (where has_function_privilege('service_role', p.oid, 'EXECUTE'))::int as service_role_execute,
  count(*) filter (where obj_description(p.oid, 'pg_proc') is not null)::int as commented_functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private')
group by n.nspname
order by n.nspname;

select 'function_catalog' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
  obj_description(p.oid, 'pg_proc') as comment
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname in ('public','private')
order by n.nspname, p.proname, identity_arguments;

select 'policy_catalog' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expr,
  with_check as check_expr
from pg_policies
where schemaname in ('public','private')
order by schemaname, tablename, policyname;

select 'client_relation_grant_summary' as section,
  privilege_type,
  grantee,
  count(*)::int as relation_count
from information_schema.role_table_grants
where table_schema in ('public','private')
  and grantee in ('anon','authenticated','service_role')
group by privilege_type, grantee
order by grantee, privilege_type;

select 'client_relation_mutation_grants' as section,
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema in ('public','private')
  and grantee in ('anon','authenticated')
group by table_schema, table_name, grantee
having bool_or(privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))
order by table_schema, table_name, grantee;

select 'extension_catalog' as section,
  e.extname,
  n.nspname as schema_name,
  e.extversion
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;

commit;
