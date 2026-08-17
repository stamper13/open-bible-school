-- Repair the NT existing-answer record and make submissions first-write-wins.

begin;

do $$
declare
  v_oid oid;
  v_definition text;
  v_anchor text;
  v_replacement text;
  v_occurrences integer;
begin
  v_oid := to_regprocedure(
    'public.obs_submit_nt_assessment_answer(uuid,uuid,text)'
  );

  if v_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'NT submission RPC is missing';
  end if;

  insert into public.obs_schema_backups (
    backup_tag,
    object_schema,
    object_name,
    object_type,
    definition
  )
  select
    '20260731_nt_submission_idempotency',
    'public',
    'obs_submit_nt_assessment_answer',
    'function',
    pg_get_functiondef(v_oid)
  where not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260731_nt_submission_idempotency'
      and backup.object_schema = 'public'
      and backup.object_name = 'obs_submit_nt_assessment_answer'
      and backup.object_type = 'function'
  );

  select count(*)
  into v_occurrences
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260731_nt_submission_idempotency'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_submit_nt_assessment_answer'
    and backup.object_type = 'function';

  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected exactly one NT submission backup; found %s',
        v_occurrences
      );
  end if;

  v_definition := pg_get_functiondef(v_oid);

  if v_definition like '%recorded NT response cannot be changed%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT idempotency patch appears to be installed already';
  end if;

  v_anchor := $patch$  select answer.is_correct, coalesce(answer.is_idk, false)
  into v_existing$patch$;
  v_replacement := $patch$  select
    answer.selected_choice_id,
    answer.is_correct,
    coalesce(answer.is_idk, false) as is_idk
  into v_existing$patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('NT existing-answer select anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $patch$  if found then
    v_is_correct := v_existing.is_correct;$patch$;
  v_replacement := $patch$  if found then
    if v_existing.selected_choice_id is distinct from p_selected_choice_id then
      raise exception using
        errcode = '22023',
        message = 'Question already answered; the recorded NT response cannot be changed';
    end if;

    v_is_correct := v_existing.is_correct;$patch$;
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('NT first-write guard anchor mismatch; found %s', v_occurrences);
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  execute v_definition;
end;
$$;

revoke all on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) from public, anon;
grant execute on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) to authenticated, service_role;

comment on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) is
  'Grades and persists the first NT answer; exact retries return the original result and changed responses are rejected.';

notify pgrst, 'reload schema';

commit;
