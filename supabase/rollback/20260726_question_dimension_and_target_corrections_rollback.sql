begin;

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_question_dimension_and_target_corrections'
    and object_schema = 'public'
    and object_name in (
      'obs_question_dimension_overrides',
      'question_coverage_targets'
    )
    and object_type = 'data';

  if backup_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format('Rollback requires exactly two data backups; found %s.', backup_count);
  end if;
end
$$;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260726_question_dimension_and_target_corrections'
    and object_schema = 'public'
    and object_name = 'obs_question_dimension_overrides'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    generated_question_id uuid,
    had_override boolean,
    dimension_key text,
    review_reason text,
    updated_at timestamptz,
    updated_by uuid
  )
), removed as (
  delete from public.obs_question_dimension_overrides override
  using saved
  where override.generated_question_id = saved.generated_question_id
)
insert into public.obs_question_dimension_overrides (
  generated_question_id,
  dimension_key,
  review_reason,
  updated_at,
  updated_by
)
select
  generated_question_id,
  dimension_key,
  review_reason,
  updated_at,
  updated_by
from saved
where had_override;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260726_question_dimension_and_target_corrections'
    and object_schema = 'public'
    and object_name = 'question_coverage_targets'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    book_code text,
    dimension_key text,
    minimum_active_questions integer,
    target_active_questions integer,
    priority text,
    rationale text,
    updated_at timestamptz
  )
)
update public.question_coverage_targets target
set
  minimum_active_questions = saved.minimum_active_questions,
  target_active_questions = saved.target_active_questions,
  priority = saved.priority,
  rationale = saved.rationale,
  updated_at = saved.updated_at
from saved
where target.book_code = saved.book_code
  and target.dimension_key = saved.dimension_key;

delete from public.obs_schema_backups
where backup_tag = '20260726_question_dimension_and_target_corrections'
  and object_schema = 'public'
  and object_name in (
    'obs_question_dimension_overrides',
    'question_coverage_targets'
  )
  and object_type = 'data';

notify pgrst, 'reload schema';

commit;
