do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and indexname = 'obs_anonymous_transfer_tokens_claimed_by_idx'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: claimed_by_user_id covering index is missing';
  end if;

  if not exists (
    select 1
    from pg_policy policy
    join pg_class relation on relation.oid = policy.polrelid
    join pg_namespace schema on schema.oid = relation.relnamespace
    where schema.nspname = 'private'
      and relation.relname = 'obs_anonymous_transfer_tokens'
      and policy.polname = 'obs_anonymous_transfer_tokens_no_anon_access'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: anon deny policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policy policy
    join pg_class relation on relation.oid = policy.polrelid
    join pg_namespace schema on schema.oid = relation.relnamespace
    where schema.nspname = 'private'
      and relation.relname = 'obs_anonymous_transfer_tokens'
      and policy.polname = 'obs_anonymous_transfer_tokens_no_authenticated_access'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: authenticated deny policy is missing';
  end if;
end;
$$;

select 'PASS: anonymous transfer token table has explicit deny policies and FK index.' as result;
