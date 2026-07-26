begin;

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_relationship_importance_and_question_repair'
    and object_schema = 'public'
    and object_name in ('ot_generated_questions', 'person_significance')
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
  where backup_tag = '20260726_relationship_importance_and_question_repair'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    id uuid,
    payload jsonb
  )
)
update public.ot_generated_questions question
set payload = saved.payload
from saved
where question.id = saved.id;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260726_relationship_importance_and_question_repair'
    and object_schema = 'public'
    and object_name = 'person_significance'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    generated_question_id uuid,
    importance_score integer,
    importance_tier integer
  )
)
update public.person_significance significance
set
  importance_score = saved.importance_score,
  importance_tier = saved.importance_tier
from saved
where significance.generated_question_id = saved.generated_question_id;

drop view if exists public.obs_admin_relationship_importance_audit;
drop table if exists public.obs_relationship_question_reviews;
drop table if exists public.obs_relationship_importance_rubric;

delete from public.obs_schema_backups
where backup_tag = '20260726_relationship_importance_and_question_repair'
  and object_schema = 'public'
  and object_name in ('ot_generated_questions', 'person_significance')
  and object_type = 'data';

notify pgrst, 'reload schema';

commit;
