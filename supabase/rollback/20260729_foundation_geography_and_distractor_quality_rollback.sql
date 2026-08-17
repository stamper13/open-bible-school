begin;

do $$
declare
  backup_payload jsonb;
begin
  select definition::jsonb
  into backup_payload
  from public.obs_schema_backups
  where backup_tag =
          '20260729_foundation_geography_and_distractor_quality'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions'
    and object_type = 'data'
  order by created_at desc
  limit 1;

  if backup_payload is null
     or jsonb_array_length(backup_payload) <> 3
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Foundation/geography rollback payload is missing or incomplete.';
  end if;

  update public.ot_generated_questions question
  set payload = restored.payload
  from (
    select
      (entry->>'id')::uuid as id,
      entry->'payload' as payload
    from jsonb_array_elements(backup_payload) entry
  ) restored
  where question.id = restored.id;
end
$$;

delete from public.ot_generated_questions
where question_type = 'foundation_mcq_v1'
  and dedupe_key like 'foundation_v1|%';

drop view if exists public.obs_question_distractor_quality_audit;

notify pgrst, 'reload schema';

commit;
