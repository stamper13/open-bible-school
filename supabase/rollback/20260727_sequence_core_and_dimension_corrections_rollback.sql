-- Restore sequence metadata, prompt text, and dimension overrides.

begin;

do $$
declare
  payload_backup jsonb;
  override_backup jsonb;
begin
  select definition::jsonb
  into payload_backup
  from public.obs_schema_backups
  where backup_tag =
      '20260727_sequence_core_and_dimension_corrections'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions_payload'
    and object_type = 'data';

  select definition::jsonb
  into override_backup
  from public.obs_schema_backups
  where backup_tag =
      '20260727_sequence_core_and_dimension_corrections'
    and object_schema = 'public'
    and object_name = 'obs_question_dimension_overrides'
    and object_type = 'data';

  if jsonb_array_length(coalesce(payload_backup, '[]'::jsonb)) <> 9
     or jsonb_array_length(coalesce(override_backup, '[]'::jsonb)) <> 3
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Sequence/dimension rollback requires payload/override backups with 9/3 rows.';
  end if;

  update public.ot_generated_questions question
  set payload = restored.row->'payload'
  from jsonb_array_elements(payload_backup) restored(row)
  where question.id = (restored.row->>'id')::uuid;

  delete from public.obs_question_dimension_overrides override
  using jsonb_array_elements(override_backup) restored(row)
  where override.generated_question_id = (restored.row->>'id')::uuid
    and not (restored.row->>'had_override')::boolean;

  insert into public.obs_question_dimension_overrides (
    generated_question_id,
    dimension_key,
    review_reason,
    updated_at,
    updated_by
  )
  select
    (restored.row->>'id')::uuid,
    restored.row->>'dimension_key',
    restored.row->>'review_reason',
    (restored.row->>'updated_at')::timestamptz,
    nullif(restored.row->>'updated_by', '')::uuid
  from jsonb_array_elements(override_backup) restored(row)
  where (restored.row->>'had_override')::boolean
  on conflict (generated_question_id) do update set
    dimension_key = excluded.dimension_key,
    review_reason = excluded.review_reason,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end
$$;

notify pgrst, 'reload schema';

commit;
