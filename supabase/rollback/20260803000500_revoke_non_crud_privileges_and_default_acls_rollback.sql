-- Rollback for migrations/20260803000500_revoke_non_crud_privileges_and_default_acls.sql
--
-- WARNING -- READ BEFORE RUNNING
-- ---------------------------------------------------------------------------
-- This restores TRUNCATE, REFERENCES, TRIGGER and MAINTAIN to `anon` and
-- `authenticated`, on existing tables and on the default privileges that govern
-- future ones. TRUNCATE is not subject to row level security, so running this
-- deliberately restores a privilege that lets a client role empty a table
-- regardless of policy.
--
-- No consumer of these privileges was found anywhere: no policy, no function
-- body, and no frontend call path. There is therefore no expected reason to run
-- this. It exists because every migration in this repository has a companion
-- rollback, not because reverting is anticipated.
--
-- FUNCTIONAL RECOVERY, NOT EXACT RESTORATION. The forward migration revoked
-- from PUBLIC as well as from anon and authenticated. This script restores only
-- the two named client roles, which is what the pre-migration ACLs actually
-- granted (`anon=arwdDxtm`, `authenticated=arwdDxtm`); it does not re-grant to
-- PUBLIC. The resulting ACL is tighter than the original by that one difference.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
begin
  if current_setting('server_version_num')::int < 170000 then
    raise exception 'Rollback precondition failed: MAINTAIN requires PostgreSQL 17+; server is %',
      current_setting('server_version');
  end if;

  if not pg_has_role(current_user, 'postgres', 'USAGE') then
    raise exception 'Rollback precondition failed: % cannot alter default privileges for role postgres',
      current_user;
  end if;
end
$preconditions$;

do $restore$
declare
  v_tbl text;
begin
  for v_tbl in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format(
      'grant truncate, references, trigger, maintain on table public.%I to anon, authenticated',
      v_tbl
    );
  end loop;
end
$restore$;

alter default privileges for role postgres in schema public
  grant truncate, references, trigger, maintain on tables to anon, authenticated;

do $supabase_admin_defaults$
begin
  if pg_has_role(current_user, 'supabase_admin', 'USAGE') then
    execute 'alter default privileges for role supabase_admin in schema public '
         || 'grant truncate, references, trigger, maintain on tables to anon, authenticated';
  else
    raise notice 'SKIPPED supabase_admin default privileges: % is not a member of supabase_admin. '
      'The forward migration skipped it for the same reason, so nothing is left inconsistent.',
      current_user;
  end if;
end
$supabase_admin_defaults$;

do $postconditions$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not (has_table_privilege('anon', c.oid, 'TRUNCATE')
           and has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
  ) then
    raise exception 'Rollback postcondition failed: TRUNCATE was not restored on every table';
  end if;

  raise notice 'PRIVILEGES REOPENED: anon and authenticated hold TRUNCATE/REFERENCES/TRIGGER/MAINTAIN again, on existing and future tables. Re-apply 20260803000500 as soon as the reason for this rollback is resolved.';
end
$postconditions$;

commit;
