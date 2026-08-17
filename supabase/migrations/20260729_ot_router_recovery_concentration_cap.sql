-- Prevent a recovery state from exempting one book from concentration control
-- for an entire session. Immediate recovery remains available through item 5.

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
      message = 'Router recovery-cap prerequisites are missing.';
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
  '20260729_ot_router_recovery_concentration_cap',
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
          '20260729_ot_router_recovery_concentration_cap'
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
            '20260729_ot_router_recovery_concentration_cap'
      and object_schema = 'public'
      and object_name = 'obs_rank_ot_assessment_candidates_v4'
      and object_type = 'function'
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Router recovery-cap backup assertion failed.';
  end if;

  definition := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );

  anchor := $patch$          or (
            candidate.recovery_stage is not null
            and candidate.latest_book_code = candidate.book_code
          )$patch$;
  replacement := $patch$          or (
            candidate.recovery_stage is not null
            and candidate.latest_book_code = candidate.book_code
            and candidate.book_answered < 5
          )$patch$;

  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);

  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router recovery-cap anchor mismatch; found %s.',
        occurrences
      );
  end if;

  execute replace(definition, anchor, replacement);
end
$$;

commit;
