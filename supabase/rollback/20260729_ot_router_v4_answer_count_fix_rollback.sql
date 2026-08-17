begin;

do $$
declare
  saved_definition text;
begin
  select definition
  into saved_definition
  from public.obs_schema_backups
  where backup_tag = '20260729_ot_router_v4_answer_count_fix'
    and object_schema = 'public'
    and object_name = 'get_next_assessment_question'
    and object_type = 'function'
  order by created_at desc
  limit 1;

  if saved_definition is null then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router answer-count rollback definition is missing.';
  end if;

  execute saved_definition;
end
$$;

notify pgrst, 'reload schema';

commit;
