do $$
declare
  compact_definition text;
begin
  compact_definition := regexp_replace(
    pg_get_functiondef(
      'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
    ),
    '\s+',
    '',
    'g'
  );

  if compact_definition not like
       '%repeat_cooldown_bucket,%book_concentration_bucket,%orientation_screen_bucket,%weakness_priority,%route_priority,%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Router concentration bucket does not precede weakness priority.';
  end if;

  if (
    select count(*)
    from public.obs_schema_backups
    where backup_tag =
            '20260729_ot_router_concentration_precedence_fix'
      and object_schema = 'public'
      and object_name = 'obs_rank_ot_assessment_candidates_v4'
      and object_type = 'function'
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Router concentration-fix backup assertion failed.';
  end if;
end
$$;

select
  'PASS: book concentration now precedes weakness priority.'
    as result;
