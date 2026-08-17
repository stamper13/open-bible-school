-- Privilege hotfix: remove TRUNCATE, REFERENCES, TRIGGER and MAINTAIN from the
-- client roles on every table in `public`, AND from the default privileges that
-- would otherwise re-grant them on every future table.
--
-- THE DEFAULT-ACL HALF IS THE IMPORTANT HALF
-- ---------------------------------------------------------------------------
-- Revoking on existing tables alone is cosmetic. Verified live state:
--
--   pg_default_acl, role postgres,        schema public, tables:
--     anon=arwdDxtm  authenticated=arwdDxtm
--   pg_default_acl, role supabase_admin,  schema public, tables:
--     anon=arwdDxtm  authenticated=arwdDxtm
--
-- `D` is TRUNCATE, `x` REFERENCES, `t` TRIGGER, `m` MAINTAIN. So every table
-- created afterwards is handed the same privileges again, and the fix silently
-- decays. Both halves are therefore in scope.
--
-- WHY MAINTAIN IS INCLUDED  (scope note -- easy to descope)
-- ---------------------------------------------------------------------------
-- MAINTAIN (PostgreSQL 17) permits VACUUM, ANALYZE, REINDEX, CLUSTER and
-- REFRESH MATERIALIZED VIEW. It is currently held by `anon` on 59 tables and
-- `authenticated` on 62 -- markedly wider than TRUNCATE's 11/14 -- and no
-- policy, function or client path uses it. It is a table privilege in exactly
-- the same family as the other three (non-CRUD, no client consumer, granted
-- only by the permissive default ACL), and leaving it behind would mean the
-- "client roles hold CRUD and nothing else" invariant is still not true.
-- It is called out separately because it was not in the original scope: delete
-- the four occurrences of `maintain` below to drop it from this migration.
-- Default FUNCTION (EXECUTE) and SEQUENCE privileges are deliberately NOT
-- touched here; they are broad too, but changing them risks breaking live RPC
-- access and deserves its own compatibility audit.
--
-- STANDALONE BY DESIGN
-- ---------------------------------------------------------------------------
-- This migration touches ONLY the three non-CRUD privileges. It does not add or
-- remove SELECT/INSERT/UPDATE/DELETE anywhere, does not touch policies or RLS,
-- and modifies no row. That narrowness is deliberate:
--
--   * It has no ordering dependency on the legacy-RPC retirement work. The
--     broader least-privilege sweep cannot be applied in isolation, because
--     `user_abilities` INSERT/UPDATE is still required by the SECURITY INVOKER
--     function update_theta_from_answer_v1, and `assessment_attempts` UPDATE by
--     the SECURITY INVOKER function maybe_complete_assessment. Both are retired
--     later in the ordered bundle, and the intended final CRUD ACL depends on
--     that sequence. TRUNCATE/REFERENCES/TRIGGER have no such dependency: no
--     function, policy or client path uses any of them.
--   * It can therefore ship first, on its own, without pre-judging the CRUD end
--     state.
--
-- WHY THESE THREE
-- ---------------------------------------------------------------------------
--   * TRUNCATE is NOT subject to row level security. A role holding it can empty
--     a table regardless of policy, bypassing the entire RLS model. Verified
--     state before this migration: 11 tables grant TRUNCATE to `anon` and 14 to
--     `authenticated`, including cross_references (69,354 rows),
--     scripture_verses (29,570), users, user_abilities, assessment_answers and
--     assessment_attempts. Several have no inbound foreign keys, so a plain
--     TRUNCATE would succeed without CASCADE.
--   * REFERENCES lets a role create foreign keys against a table it does not
--     own, which can block deletes and pin rows.
--   * TRIGGER lets a role attach triggers to a table it does not own -- an
--     arbitrary code-execution surface on other users' writes.
--
-- SEVERITY, STATED ACCURATELY
-- ---------------------------------------------------------------------------
-- This is a least-privilege defect, not a demonstrated remote exploit. The
-- Supabase Data API (PostgREST) exposes GET/POST/PATCH/DELETE on table
-- endpoints and provides no TRUNCATE verb, so holding the publishable key does
-- not by itself let a caller issue TRUNCATE. An audit of every function
-- EXECUTE-able by `anon` or `authenticated` found none containing a TRUNCATE
-- statement and none performing dynamic SQL (no `EXECUTE <string>`), so no
-- current RPC provides a SQL path either.
--
-- The grants are still wrong and are removed here, because they are one
-- misconfiguration away from being reachable: any future SECURITY DEFINER
-- helper that runs dynamic SQL, any direct-connection credential leak, or any
-- new API surface would turn them into unrestricted data destruction that RLS
-- cannot mitigate.
--
-- Covers assessment_answers and assessment_attempts, which the ten-table
-- least-privilege sweep (20260802224500, currently unapplied) does not include.
--
-- Re-runnable: revoking an already-absent privilege is a no-op.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
declare
  v_crud jsonb := '{}'::jsonb;
  v_rec record;
begin
  -- Snapshot every client CRUD privilege so the postcondition can prove this
  -- migration changed none of them.
  for v_rec in
    select c.relname,
           has_table_privilege('anon', c.oid, 'SELECT') as a_s,
           has_table_privilege('anon', c.oid, 'INSERT') as a_i,
           has_table_privilege('anon', c.oid, 'UPDATE') as a_u,
           has_table_privilege('anon', c.oid, 'DELETE') as a_d,
           has_table_privilege('authenticated', c.oid, 'SELECT') as t_s,
           has_table_privilege('authenticated', c.oid, 'INSERT') as t_i,
           has_table_privilege('authenticated', c.oid, 'UPDATE') as t_u,
           has_table_privilege('authenticated', c.oid, 'DELETE') as t_d
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    v_crud := jsonb_set(v_crud, array[v_rec.relname], to_jsonb(
      concat(v_rec.a_s, v_rec.a_i, v_rec.a_u, v_rec.a_d,
             v_rec.t_s, v_rec.t_i, v_rec.t_u, v_rec.t_d)));
  end loop;

  perform set_config('obs_migration.pre_crud', v_crud::text, true);

  -- Fail closed if an unexpected grantee holds privileges anywhere in public;
  -- this migration only reasons about public, anon, authenticated.
  if exists (
    select 1 from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.grantee not in ('postgres', 'service_role', 'anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'Precondition failed: unexpected grantee(s) on public tables; review manually: %',
      (select string_agg(distinct g.grantee, ', ') from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.grantee not in ('postgres', 'service_role', 'anon', 'authenticated', 'PUBLIC'));
  end if;

  -- MAINTAIN requires PostgreSQL 17+. Fail early and by name rather than on a
  -- syntax error halfway through the revoke loop.
  if current_setting('server_version_num')::int < 170000 then
    raise exception 'Precondition failed: MAINTAIN requires PostgreSQL 17+; server is %',
      current_setting('server_version');
  end if;

  -- ALTER DEFAULT PRIVILEGES FOR ROLE <r> requires membership in <r>. Verify
  -- per role rather than discovering it mid-migration.
  if not pg_has_role(current_user, 'postgres', 'USAGE') then
    raise exception 'Precondition failed: % cannot alter default privileges for role postgres; '
      'postgres owns every table in public, so this migration cannot stop the grants recurring',
      current_user;
  end if;
end
$preconditions$;

-- Revoke per table. PUBLIC is included because a privilege granted to PUBLIC is
-- held by every role, so revoking only anon/authenticated would leave it
-- reachable. Each statement takes a brief ACCESS EXCLUSIVE lock on one table;
-- lock_timeout above bounds the wait.
do $revoke$
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
      'revoke truncate, references, trigger, maintain on table public.%I from public, anon, authenticated',
      v_tbl
    );
  end loop;
end
$revoke$;

-- The half that stops recurrence. Without this, the loop above is undone by the
-- next CREATE TABLE.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from public, anon, authenticated;

-- supabase_admin carries an identical permissive default in `public`, but
-- ALTER DEFAULT PRIVILEGES FOR ROLE requires membership in that role, and the
-- migration executor (postgres) is NOT a member of supabase_admin -- verified
-- live: pg_has_role('postgres','supabase_admin','USAGE') = false. It is
-- therefore attempted only when the executor is actually authorized, so this
-- migration neither fails nor silently claims to have done it.
--
-- Residual risk is bounded and asserted below: all 94 tables in public are
-- owned by postgres, so supabase_admin's default governs nothing here today,
-- and the postcondition fails if a supabase_admin-owned table ever appears.
do $supabase_admin_defaults$
begin
  if pg_has_role(current_user, 'supabase_admin', 'USAGE') then
    execute 'alter default privileges for role supabase_admin in schema public '
         || 'revoke truncate, references, trigger, maintain on tables '
         || 'from public, anon, authenticated';
    raise notice 'Revoked supabase_admin default table privileges in public.';
  else
    raise notice 'SKIPPED supabase_admin default privileges: % is not a member of supabase_admin. '
      'Every table in public is owned by postgres, so this does not affect the fix today, but a '
      'table created in public BY supabase_admin would receive the permissive default. The '
      'postcondition below fails if such a table exists.', current_user;
  end if;
end
$supabase_admin_defaults$;

do $postconditions$
declare
  v_pre jsonb := current_setting('obs_migration.pre_crud')::jsonb;
  v_rec record;
  v_now text;
  v_offenders text;
begin
  -- 1) No client role may retain any of the four privileges on any table.
  select string_agg(c.relname || '(' ||
           concat_ws('/',
             case when has_table_privilege('anon', c.oid, 'TRUNCATE') then 'anon:TRUNCATE' end,
             case when has_table_privilege('anon', c.oid, 'REFERENCES') then 'anon:REFERENCES' end,
             case when has_table_privilege('anon', c.oid, 'TRIGGER') then 'anon:TRIGGER' end,
             case when has_table_privilege('anon', c.oid, 'MAINTAIN') then 'anon:MAINTAIN' end,
             case when has_table_privilege('authenticated', c.oid, 'TRUNCATE') then 'auth:TRUNCATE' end,
             case when has_table_privilege('authenticated', c.oid, 'REFERENCES') then 'auth:REFERENCES' end,
             case when has_table_privilege('authenticated', c.oid, 'TRIGGER') then 'auth:TRIGGER' end,
             case when has_table_privilege('authenticated', c.oid, 'MAINTAIN') then 'auth:MAINTAIN' end
           ) || ')', ', ')
  into v_offenders
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('anon', c.oid, 'REFERENCES')
      or has_table_privilege('anon', c.oid, 'TRIGGER')
      or has_table_privilege('anon', c.oid, 'MAINTAIN')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'REFERENCES')
      or has_table_privilege('authenticated', c.oid, 'TRIGGER')
      or has_table_privilege('authenticated', c.oid, 'MAINTAIN'));

  if v_offenders is not null then
    raise exception 'Postcondition failed: client roles still hold TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on: %', v_offenders;
  end if;

  -- 1b) THE RECURRENCE CHECK. The default ACL for postgres in `public` must no
  --     longer hand any of the four to a client role, or every future table
  --     silently undoes this migration.
  if exists (
    select 1
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral unnest(d.defaclacl) as entry(item)
    where n.nspname = 'public'
      and d.defaclobjtype = 'r'
      and pg_get_userbyid(d.defaclrole) = 'postgres'
      and split_part(item::text, '=', 1) in ('anon', 'authenticated')
      and split_part(split_part(item::text, '=', 2), '/', 1) ~ '[Dxtm]'
  ) then
    raise exception 'Postcondition failed: postgres default privileges in public still grant TRUNCATE/REFERENCES/TRIGGER/MAINTAIN to a client role; future tables would be vulnerable again';
  end if;

  -- 1c) supabase_admin's default could not necessarily be altered (see above).
  --     That is only safe while it owns nothing in public. Assert it.
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and pg_get_userbyid(c.relowner) <> 'postgres'
  ) then
    raise exception 'Postcondition failed: public contains table(s) not owned by postgres (%); their default privileges are outside this migration''s reach',
      (select string_agg(distinct pg_get_userbyid(c.relowner), ', ')
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and pg_get_userbyid(c.relowner) <> 'postgres');
  end if;

  -- 2) Not one CRUD privilege may have changed. This is what makes the
  --    migration safe to ship ahead of the RPC retirement work.
  for v_rec in
    select c.relname, c.oid
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    v_now := concat(
      has_table_privilege('anon', v_rec.oid, 'SELECT'),
      has_table_privilege('anon', v_rec.oid, 'INSERT'),
      has_table_privilege('anon', v_rec.oid, 'UPDATE'),
      has_table_privilege('anon', v_rec.oid, 'DELETE'),
      has_table_privilege('authenticated', v_rec.oid, 'SELECT'),
      has_table_privilege('authenticated', v_rec.oid, 'INSERT'),
      has_table_privilege('authenticated', v_rec.oid, 'UPDATE'),
      has_table_privilege('authenticated', v_rec.oid, 'DELETE'));

    if v_now is distinct from (v_pre ->> v_rec.relname) then
      raise exception 'Postcondition failed: CRUD privileges changed on % (before %, after %)',
        v_rec.relname, v_pre ->> v_rec.relname, v_now;
    end if;
  end loop;

  -- 3) service_role and the owner must be untouched.
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not (has_table_privilege('service_role', c.oid, 'TRUNCATE')
           and has_table_privilege('service_role', c.oid, 'SELECT'))
  ) then
    raise exception 'Postcondition failed: service_role lost privileges';
  end if;
end
$postconditions$;

commit;
