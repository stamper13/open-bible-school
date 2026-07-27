-- Restore the pre-expansion Torah curation and quarantine the new questions.

begin;

do $$
declare
  function_definition text;
begin
  select backup.definition
  into function_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_infer_question_chapter'
    and backup.object_type = 'function';

  if function_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Torah coverage rollback failed; chapter-inference backup is missing.';
  end if;

  execute function_definition;
end
$$;

with backup_rows as (
  select item
  from public.obs_schema_backups backup
  cross join lateral jsonb_array_elements(
    backup.definition::jsonb
  ) item
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name = 'ot_generated_questions_torah_curation'
    and backup.object_type = 'data'
)
update public.ot_generated_questions question
set
  question_type = backup_rows.item->>'question_type',
  dedupe_key = backup_rows.item->>'dedupe_key',
  payload = backup_rows.item->'payload'
from backup_rows
where question.id = (backup_rows.item->>'id')::uuid;

with curated_questions as (
  select (item->>'generated_question_id')::uuid as generated_question_id
  from public.obs_schema_backups backup
  cross join lateral jsonb_array_elements(
    backup.definition::jsonb
  ) item
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name =
      'obs_question_dimension_overrides_torah_curation'
    and backup.object_type = 'data'
)
delete from public.obs_question_dimension_overrides override
using curated_questions
where override.generated_question_id =
  curated_questions.generated_question_id;

with backup_rows as (
  select item
  from public.obs_schema_backups backup
  cross join lateral jsonb_array_elements(
    backup.definition::jsonb
  ) item
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name =
      'obs_question_dimension_overrides_torah_curation'
    and backup.object_type = 'data'
)
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
  nullif(item->>'updated_by', '')::uuid
from backup_rows
where (item->>'had_override')::boolean
on conflict (generated_question_id) do update set
  dimension_key = excluded.dimension_key,
  review_reason = excluded.review_reason,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

update public.ot_generated_questions question
set
  question_type = case
    when question.question_type like 'quarantined%'
      then question.question_type
    else 'quarantined_' || question.question_type
  end,
  dedupe_key = case
    when question.dedupe_key like 'quarantined|%'
      then question.dedupe_key
    else
      'quarantined|'
      || question.id::text
      || '|'
      || question.dedupe_key
  end
where question.payload->>'source_batch' =
  '20260726_torah_question_coverage';

notify pgrst, 'reload schema';

commit;
