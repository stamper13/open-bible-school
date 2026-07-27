-- Roll back adaptive focused-retest selection and mastery scoring.

begin;

drop function if exists public.obs_get_user_recommendation_v2(uuid);
drop function if exists
  public.obs_get_user_recommendation_pre_ladder(uuid);

do $$
declare
  backup record;
  restored integer := 0;
begin
  for backup in
    select definition
    from public.obs_schema_backups
    where backup_tag = '20260726_adaptive_focused_retest_ladder'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in (
        'obs_get_next_focused_question_v2',
        'obs_get_user_recommendation_v2'
      )
    order by id
  loop
    execute backup.definition;
    restored := restored + 1;
  end loop;

  if restored <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused ladder rollback aborted: expected 2 backups, restored %s.',
        restored
      );
  end if;
end
$$;

drop function if exists public.obs_get_unit_mastery_score(
  uuid, text, text
);
drop function if exists public.obs_focused_mastery_raw(
  numeric, numeric, numeric, boolean, boolean, boolean
);
drop function if exists public.obs_focused_stage_label(integer);
drop function if exists public.obs_focused_item_stage(
  text, jsonb, double precision
);

notify pgrst, 'reload schema';

commit;
