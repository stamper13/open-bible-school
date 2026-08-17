do $$
declare
  definition text;
  backup_count integer;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into definition;

  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_ot_router_v4_answer_count_fix'
    and object_schema = 'public'
    and object_name = 'get_next_assessment_question'
    and object_type = 'function';

  if backup_count <> 1
     or definition not like '%v_answer_count integer%'
     or definition not like
       '%log.answer_count = v_answer_count%'
     or definition ~ E'\\n\\s*answer_count\\s+integer;'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router answer-count fix verification failed.';
  end if;

  raise notice
    'PASS: OT router answer-count identifier is unambiguous.';
end
$$;
