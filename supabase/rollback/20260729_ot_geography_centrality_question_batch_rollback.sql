-- Remove the geography batch only when it has no answer history.

begin;

do $$
declare
  referenced_count integer;
  backup_count integer;
begin
  select count(*)
  into referenced_count
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1';

  if referenced_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Rollback refused: %s assessment answers reference this geography batch.',
        referenced_count
      );
  end if;

  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_ot_geography_centrality_question_batch'
    and object_schema = 'public'
    and object_name = 'question_coverage_targets'
    and object_type = 'data';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Rollback requires exactly one geography-target backup; found %s.',
        backup_count
      );
  end if;
end
$$;

delete from public.obs_semantic_distractor_reviews review
using public.ot_generated_questions question
where question.id = review.generated_question_id
  and question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1';

delete from public.ot_generated_questions
where payload->>'source_batch' = '20260729_ot_geography_centrality_v1';

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260729_ot_geography_centrality_question_batch'
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
where backup_tag = '20260729_ot_geography_centrality_question_batch'
  and object_schema = 'public'
  and object_name = 'question_coverage_targets'
  and object_type = 'data';

notify pgrst, 'reload schema';

commit;
