begin;

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_dimension_aware_recommendations'
    and object_schema = 'public'
    and object_name = 'obs_get_next_ot_assessment_question'
    and object_type = 'function';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Rollback requires one focused-selector backup; found %s.', backup_count);
  end if;
end
$$;

drop function if exists public.obs_start_or_resume_ot_assessment_v2(
  text, text, integer, integer, integer, boolean, text
);
drop function if exists public.obs_get_next_focused_question_v2(
  uuid, uuid, text, text, integer, integer, text
);
drop function if exists public.obs_get_user_recommendation_v2(uuid);

do $$
declare
  saved_definition text;
begin
  select definition
  into saved_definition
  from public.obs_schema_backups
  where backup_tag = '20260726_dimension_aware_recommendations'
    and object_schema = 'public'
    and object_name = 'obs_get_next_ot_assessment_question'
    and object_type = 'function';

  execute saved_definition;
end
$$;

drop index if exists public.obs_ot_attempt_context_user_unit_dimension_idx;
alter table public.obs_ot_attempt_context
  drop column if exists dimension_key;

delete from public.obs_schema_backups
where backup_tag = '20260726_dimension_aware_recommendations'
  and object_schema = 'public'
  and object_name = 'obs_get_next_ot_assessment_question'
  and object_type = 'function';

notify pgrst, 'reload schema';

commit;
