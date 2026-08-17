begin;

do $$
declare
  saved_definition text;
begin
  select definition
  into saved_definition
  from public.obs_schema_backups
  where backup_tag = '20260729_ot_router_absolute_book_cap'
    and object_schema = 'public'
    and object_name = 'obs_rank_ot_assessment_candidates_v4'
    and object_type = 'function';

  if saved_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Router absolute-book-cap rollback backup is missing.';
  end if;

  execute saved_definition;
end
$$;

commit;
