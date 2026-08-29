begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_function text;
  v_functions text[] := array[
    'obs_start_or_resume_ot_assessment',
    'obs_start_or_resume_ot_assessment_v2',
    'obs_start_nt_assessment'
  ];
  v_name text;
begin
  foreach v_name in array v_functions loop
    select backup.definition
    into v_function
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260827117000_standard_assessment_target_25'
      and backup.object_schema = 'public'
      and backup.object_name = v_name
      and backup.object_type = 'function'
    order by backup.created_at desc
    limit 1;

    if v_function is null then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Missing backup for 20260827117000_standard_assessment_target_25 rollback: %s.',
          v_name
        );
    end if;

    execute v_function;
  end loop;
end
$$;

notify pgrst, 'reload schema';

commit;
