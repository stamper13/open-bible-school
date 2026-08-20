do $$
declare
  v_issue oid := to_regprocedure(
    'public.obs_issue_anonymous_transfer_token()'
  );
  v_claim oid := to_regprocedure(
    'public.obs_claim_anonymous_transfer(text)'
  );
  v_issue_def text;
  v_claim_def text;
begin
  if to_regclass('private.obs_anonymous_transfer_tokens') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: private token table is missing';
  end if;

  if v_issue is null or v_claim is null then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: transfer RPCs are missing';
  end if;

  v_issue_def := lower(pg_get_functiondef(v_issue));
  v_claim_def := lower(pg_get_functiondef(v_claim));

  if v_issue_def not like '%security definer%'
     or v_issue_def not like '%set search_path to ''public'', ''auth'', ''extensions'', ''pg_temp''%' then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: issue RPC security/search_path contract changed';
  end if;

  if v_claim_def not like '%security definer%'
     or v_claim_def not like '%set search_path to ''public'', ''auth'', ''extensions'', ''pg_temp''%' then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: claim RPC security/search_path contract changed';
  end if;

  if v_issue_def not like '%auth.uid()%'
     or v_issue_def not like '%is_anonymous%'
     or v_issue_def not like '%digest(v_token%sha256%'
     or v_issue_def like '%p_anonymous_user_id%' then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: issue RPC no longer mints a source-derived hashed capability';
  end if;

  if v_claim_def not like '%auth.uid()%'
     or v_claim_def not like '%migrate_anonymous_data(%'
     or v_claim_def not like '%v_transfer.source_user_id%'
     or v_claim_def not like '%p_transfer_token%'
     or v_claim_def like '%p_anonymous_user_id%' then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: claim RPC no longer derives source from the capability';
  end if;

  if has_function_privilege('anon', v_issue, 'execute')
     or has_function_privilege('anon', v_claim, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: anon can execute transfer RPCs';
  end if;

  if not has_function_privilege('authenticated', v_issue, 'execute')
     or not has_function_privilege('authenticated', v_claim, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: authenticated cannot execute transfer RPCs';
  end if;

  if has_table_privilege(
    'authenticated',
    'private.obs_anonymous_transfer_tokens',
    'select'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: authenticated can read transfer tokens';
  end if;
end;
$$;

select 'PASS: anonymous transfer RPCs are capability-based and least-privilege.' as result;
