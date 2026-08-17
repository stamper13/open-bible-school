-- Make the session-level book concentration brake outrank a previously
-- detected weakness. Pending confirmation and recovery items already receive
-- a zero concentration bucket and remain eligible for immediate follow-up.

begin;

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router concentration-fix prerequisites are missing.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_ot_router_concentration_precedence_fix',
  'public',
  'obs_rank_ot_assessment_candidates_v4',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_ot_router_concentration_precedence_fix'
    and backup.object_schema = 'public'
    and backup.object_name =
          'obs_rank_ot_assessment_candidates_v4'
    and backup.object_type = 'function'
);

do $$
declare
  definition text;
  anchor text;
  replacement text;
  occurrences integer;
begin
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

  definition := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );

  anchor := $patch$        order by
          repeat_cooldown_bucket,
          weakness_priority,
          orientation_screen_bucket,
          book_concentration_bucket,
          route_priority,$patch$;
  replacement := $patch$        order by
          repeat_cooldown_bucket,
          book_concentration_bucket,
          orientation_screen_bucket,
          weakness_priority,
          route_priority,$patch$;

  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);

  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router concentration ordering anchor mismatch; found %s.',
        occurrences
      );
  end if;

  execute replace(definition, anchor, replacement);
end
$$;

commit;
