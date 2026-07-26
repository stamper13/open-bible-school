-- Rollback for 20260711_get_next_assessment_question_avoid_repeats.sql.

begin;

do $$
declare
  old_definition text;
begin
  select definition
  into old_definition
  from public.obs_schema_backups
  where backup_tag = '20260711_get_next_assessment_question_avoid_repeats'
    and object_schema = 'public'
    and object_name = 'get_next_assessment_question'
  order by created_at desc
  limit 1;

  if old_definition is null then
    raise exception 'No get_next_assessment_question backup found for 20260711_get_next_assessment_question_avoid_repeats';
  end if;

  drop function if exists public.get_next_assessment_question(uuid, uuid);

  execute old_definition;
end $$;

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
