do $$
declare
  definition text;
  compact_definition text;
begin
  if public.obs_router_session_brake_stage(3, 5, 5, 0) <> 3
     or public.obs_router_session_brake_stage(3, 5, 3, 2) <> 2
     or public.obs_router_session_brake_stage(3, 5, 2, 0) <> 2
     or public.obs_router_session_brake_stage(3, 4, 1, 0) <> 1
     or public.obs_router_session_brake_stage(1, 5, 5, 0) <> 1
  then
    raise exception using
      errcode = 'P0001',
      message = 'Session-brake helper behavior is incorrect.';
  end if;

  definition := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );
  compact_definition := regexp_replace(definition, '\s+', '', 'g');

  if definition not like '%obs_router_session_brake_stage(%'
     or definition not like '%latest_two_failures%'
     or definition not like '%orientation_screen_bucket%'
     or definition not like '%book_concentration_bucket%'
     or (
       compact_definition not like
         '%repeat_cooldown_bucket,%weakness_priority,%orientation_screen_bucket,%book_concentration_bucket,%route_priority,%'
       and compact_definition not like
         '%repeat_cooldown_bucket,%book_concentration_bucket,%orientation_screen_bucket,%weakness_priority,%route_priority,%'
     )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Router graduation wiring is incomplete or ordering changed unexpectedly.';
  end if;

  if (
    select count(*)
    from public.obs_schema_backups
    where backup_tag =
            '20260729_ot_router_graduation_and_session_brake'
      and object_schema = 'public'
      and object_name = 'obs_rank_ot_assessment_candidates_v4'
      and object_type = 'function'
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Router graduation backup assertion failed.';
  end if;
end
$$;

select
  'PASS: orientation graduation, book concentration, and session brake are installed.'
    as result;
