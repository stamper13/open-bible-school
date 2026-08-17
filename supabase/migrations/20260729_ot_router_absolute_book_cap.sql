-- Make the five-question general-assessment book ceiling absolute. A pending
-- confirmation may bypass the softer three-question penalty, but not this cap.

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
      message = 'Router absolute-book-cap prerequisites are missing.';
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
  '20260729_ot_router_absolute_book_cap',
  'public',
  'obs_rank_ot_assessment_candidates_v4',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260729_ot_router_absolute_book_cap'
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
    where backup_tag = '20260729_ot_router_absolute_book_cap'
      and object_schema = 'public'
      and object_name = 'obs_rank_ot_assessment_candidates_v4'
      and object_type = 'function'
  ) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Router absolute-book-cap backup assertion failed.';
  end if;

  definition := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );

  anchor := $patch$      case
        when candidate.policy_version <> 'V4'
          or candidate.pending_book_code = candidate.book_code
          or (
            candidate.recovery_stage is not null
            and candidate.latest_book_code = candidate.book_code
            and candidate.book_answered < 5
          )
          then 0
        when candidate.book_answered >= 5 then 2
        when candidate.book_answered >= 3 then 1
        else 0
      end as book_concentration_bucket,$patch$;
  replacement := $patch$      case
        when candidate.policy_version <> 'V4' then 0
        when candidate.book_answered >= 5 then 2
        when candidate.pending_book_code = candidate.book_code
          or (
            candidate.recovery_stage is not null
            and candidate.latest_book_code = candidate.book_code
            and candidate.book_answered < 5
          )
          then 0
        when candidate.book_answered >= 3 then 1
        else 0
      end as book_concentration_bucket,$patch$;

  occurrences := (
    length(definition) - length(replace(definition, anchor, ''))
  ) / length(anchor);

  if occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router absolute-book-cap anchor mismatch; found %s.',
        occurrences
      );
  end if;

  execute replace(definition, anchor, replacement);
end
$$;

commit;
