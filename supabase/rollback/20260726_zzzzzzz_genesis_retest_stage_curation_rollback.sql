-- Restore pre-curation Genesis payloads, dimensions, and retest functions.

begin;

do $$
declare
  payload_backup jsonb;
  dimension_backup jsonb;
  restored_functions integer := 0;
  function_backup record;
begin
  select backup.definition::jsonb
  into payload_backup
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_genesis_retest_stage_curation'
    and backup.object_schema = 'public'
    and backup.object_name =
      'ot_generated_questions_gen_1_11_retest_payloads'
    and backup.object_type = 'data'
  order by backup.id desc
  limit 1;

  select backup.definition::jsonb
  into dimension_backup
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_genesis_retest_stage_curation'
    and backup.object_schema = 'public'
    and backup.object_name =
      'obs_question_dimension_overrides_genesis_outline'
    and backup.object_type = 'data'
  order by backup.id desc
  limit 1;

  if payload_backup is null or dimension_backup is null then
    raise exception using
      errcode = 'P0001',
      message = 'Genesis retest rollback aborted: data backups are incomplete.';
  end if;

  update public.ot_generated_questions question
  set payload = restored.payload
  from (
    select
      (item->>'id')::uuid as id,
      item->'payload' as payload
    from jsonb_array_elements(payload_backup) item
  ) restored
  where question.id = restored.id;

  delete from public.obs_question_dimension_overrides override
  using (
    select (item->>'generated_question_id')::uuid
      as generated_question_id
    from jsonb_array_elements(dimension_backup) item
  ) restored
  where override.generated_question_id =
    restored.generated_question_id;

  insert into public.obs_question_dimension_overrides (
    generated_question_id,
    dimension_key,
    review_reason,
    updated_at,
    updated_by
  )
  select
    (item->>'generated_question_id')::uuid,
    item->>'dimension_key',
    item->>'review_reason',
    (item->>'updated_at')::timestamptz,
    (item->>'updated_by')::uuid
  from jsonb_array_elements(dimension_backup) item
  where (item->>'had_override')::boolean;

  for function_backup in
    select backup.definition
    from public.obs_schema_backups backup
    where backup.backup_tag =
        '20260726_genesis_retest_stage_curation'
      and backup.object_schema = 'public'
      and backup.object_type = 'function'
      and backup.object_name in (
        'obs_focused_item_stage',
        'obs_get_next_focused_question_v2',
        'obs_get_next_ot_assessment_question'
      )
    order by case backup.object_name
      when 'obs_focused_item_stage' then 1
      when 'obs_get_next_focused_question_v2' then 2
      else 3
    end
  loop
    execute function_backup.definition;
    restored_functions := restored_functions + 1;
  end loop;

  if restored_functions <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Genesis retest rollback aborted: expected 3 functions, restored %s.',
        restored_functions
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
