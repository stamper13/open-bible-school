-- Verification for migrations/20260803000500_revoke_non_crud_privileges_and_default_acls.sql
--
-- FULLY READ-ONLY. Executes no DDL, takes no table locks, modifies no row, and
-- is safe to run against production at any time, before or after the migration.
--
-- Before the migration it is EXPECTED TO FAIL at V1 -- that is what makes it a
-- useful check rather than a tautology. After the migration all five assertions
-- must pass.

do $verify$
declare
  v_tables_with_priv bigint;
  v_offenders text;
  v_default_acl text;
  v_foreign_owner text;
  v_crud_missing text;
begin
  -- V1: no client role holds any of the four non-CRUD privileges on any table.
  select count(*), string_agg(c.relname, ', ' order by c.relname)
  into v_tables_with_priv, v_offenders
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

  if v_tables_with_priv <> 0 then
    raise exception 'V1 FAILED: % table(s) still grant TRUNCATE/REFERENCES/TRIGGER/MAINTAIN to a client role: %',
      v_tables_with_priv, left(v_offenders, 500);
  end if;

  -- V2: the default ACL must not re-grant them on future tables. This is the
  --     assertion that keeps the fix from decaying at the next CREATE TABLE.
  select string_agg(item::text, ' | ')
  into v_default_acl
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral unnest(d.defaclacl) as entry(item)
  where n.nspname = 'public'
    and d.defaclobjtype = 'r'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and split_part(item::text, '=', 1) in ('anon', 'authenticated')
    and split_part(split_part(item::text, '=', 2), '/', 1) ~ '[Dxtm]';

  if v_default_acl is not null then
    raise exception 'V2 FAILED: postgres default privileges in public still grant them to a client role: %',
      v_default_acl;
  end if;

  -- V3: supabase_admin's default privileges are outside the migration's reach
  --     unless the executor is a member of that role. That is only acceptable
  --     while supabase_admin owns nothing in public.
  select string_agg(distinct pg_get_userbyid(c.relowner), ', ')
  into v_foreign_owner
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and pg_get_userbyid(c.relowner) <> 'postgres';

  if v_foreign_owner is not null then
    raise exception 'V3 FAILED: public contains table(s) owned by % -- their default privileges were not remediated',
      v_foreign_owner;
  end if;

  -- V4: CRUD must be intact. The migration claims to touch only non-CRUD
  --     privileges, so the application must still work. Spot-check the tables
  --     with known client read paths.
  select string_agg(t, ', ')
  into v_crud_missing
  from unnest(array['scripture_books','scripture_verses','cross_references','bible_events']) as t
  where not has_table_privilege('anon', 'public.' || t, 'SELECT');

  if v_crud_missing is not null then
    raise exception 'V4 FAILED: anon lost SELECT on public reference table(s): %', v_crud_missing;
  end if;

  if not has_table_privilege('authenticated', 'public.assessment_answers', 'SELECT')
     or not has_table_privilege('authenticated', 'public.user_abilities', 'SELECT') then
    raise exception 'V4 FAILED: authenticated lost SELECT on its own assessment data';
  end if;

  -- V5: service_role must retain full access.
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not has_table_privilege('service_role', c.oid, 'TRUNCATE')
  ) then
    raise exception 'V5 FAILED: service_role lost TRUNCATE somewhere in public';
  end if;

  raise notice 'VERIFY PASSED: no client role holds TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, default ACLs will not re-grant them, CRUD intact, service_role intact.';
end
$verify$;
