-- Restore the exact general OT selector captured before router v3.

begin;

do $$
declare
  backup record;
  restored integer := 0;
begin
  for backup in
    select definition
    from public.obs_schema_backups
    where backup_tag = '20260727_general_ot_router_v3'
      and object_schema = 'public'
      and object_name = 'get_next_assessment_question'
      and object_type = 'function'
    order by id
  loop
    execute backup.definition;
    restored := restored + 1;
  end loop;

  if restored <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General OT router rollback aborted: expected 1 backup, restored %s.',
        restored
      );
  end if;
end
$$;

drop function if exists public.obs_general_question_family_limit(text);
drop function if exists public.obs_general_route_priority(
  boolean, integer, boolean, integer, boolean, integer,
  text, integer, integer
);
drop function if exists public.obs_general_dependency_mastery(
  integer, integer, integer
);
drop function if exists public.obs_general_router_stage(
  integer, integer, integer
);

drop index if exists public.assessment_answers_router_user_question_idx;

notify pgrst, 'reload schema';

commit;
