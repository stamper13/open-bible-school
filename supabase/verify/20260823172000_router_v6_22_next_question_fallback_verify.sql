-- Verify router v6 step 22 next-question fallback.

do $verify$
declare
  v_sql text;
  v_attempt_id uuid := 'c7e50723-306d-47b5-99cd-49b2677b2ccc'::uuid;
  v_user_id uuid;
  v_rows integer;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  if v_sql not like '%v6 next-question fallback to v5%' then
    raise exception 'get_next_assessment_question is missing the V6 fallback marker';
  end if;

  if v_sql not like '%V6 OT ranker failed for attempt %' then
    raise exception 'get_next_assessment_question is missing the V6 fallback warning';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.object_type = 'function'
      and backup.object_schema = 'public'
      and backup.object_name = 'get_next_assessment_question'
      and backup.backup_tag = '20260823172000_router_v6_22_next_question_fallback'
  ) then
    raise exception 'schema backup missing for router v6 step 22';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_next_assessment_question(uuid,uuid)',
       'execute'
     ) then
    raise exception 'anon must not execute get_next_assessment_question';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.obs_get_next_ot_assessment_question(uuid)',
       'execute'
     ) then
    raise exception 'authenticated must execute obs_get_next_ot_assessment_question';
  end if;

  select attempt.user_id
  into v_user_id
  from public.assessment_attempts attempt
  where attempt.id = v_attempt_id
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null;

  if v_user_id is not null then
    perform set_config('request.jwt.claim.sub', v_user_id::text, true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_user_id::text, 'role', 'authenticated')::text,
      true
    );

    select count(*)::integer
    into v_rows
    from public.obs_get_next_ot_assessment_question(v_attempt_id);

    if v_rows <> 1 then
      raise exception 'reported stuck attempt should receive exactly one next question, got %', v_rows;
    end if;
  end if;
end
$verify$;
