-- Read-only/static verification for the least-evidence BLI follow-up contract.

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.obs_get_bli_section_followup_v1(uuid,text)'::regprocedure
  )
  into function_definition;

  if function_definition not like '%public.obs_is_authorized_user(p_user_id)%'
     or function_definition not like '%answer.scoring_eligible%'
     or function_definition not like '%ranked.answered < 15%'
     or function_definition not like '%15 - ranked.answered%'
  then
    raise exception 'BLI section follow-up contract is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.obs_get_bli_section_followup_v1(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.obs_get_bli_section_followup_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception 'BLI section follow-up ACL is incorrect';
  end if;
end
$$;

select
  'PASS: least-evidence follow-up RPC is authorized, scoring-eligible, and private to authenticated callers.'
  as result;
