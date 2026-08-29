\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'obs_router_policy_config'
      and constraint_row.conname = 'obs_router_policy_version_ck'
      and pg_get_constraintdef(constraint_row.oid) like '%V6%'
  ) then
    raise exception 'router v6 policy constraint verify: V6 is not allowed.';
  end if;
end
$$;
