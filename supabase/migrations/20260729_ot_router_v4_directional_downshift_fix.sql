-- Keep V4 downshifts directional. A missed or skipped item may route to the
-- requested stage or an easier stage, but never to a harder adjacent stage.

begin;

do $$
begin
  if to_regprocedure(
       'public.obs_general_route_priority_v4(text,integer,text,integer,boolean,integer,boolean,text,integer,integer)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router directional-downshift prerequisites are missing.';
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
  '20260729_ot_router_v4_directional_downshift_fix',
  'public',
  'obs_general_route_priority_v4',
  'function',
  pg_get_functiondef(
    'public.obs_general_route_priority_v4(text,integer,text,integer,boolean,integer,boolean,text,integer,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_ot_router_v4_directional_downshift_fix'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_general_route_priority_v4'
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups
  where backup_tag =
          '20260729_ot_router_v4_directional_downshift_fix'
    and object_schema = 'public'
    and object_name = 'obs_general_route_priority_v4'
    and object_type = 'function';

  if captured <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT router directional-downshift backup failed; found %s rows.',
        captured
      );
  end if;
end
$$;

create or replace function public.obs_general_route_priority_v4(
  p_pending_book_code text,
  p_pending_stage integer,
  p_candidate_book_code text,
  p_orientation_answered integer,
  p_orientation_correct boolean,
  p_core_correct integer,
  p_historically_confirmed boolean,
  p_question_family text,
  p_candidate_stage integer,
  p_target_stage integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when p_pending_book_code is not null then
      case
        when p_candidate_book_code = p_pending_book_code
          and p_candidate_stage = p_pending_stage
          then -2
        when p_candidate_book_code = p_pending_book_code
          and p_candidate_stage < p_pending_stage
          then -1
        when p_candidate_book_code <> p_pending_book_code
          and lower(coalesce(p_question_family, ''))
            = 'book_orientation'
          then 0
        else 3
      end
    when coalesce(p_orientation_answered, 0) = 0
      and not coalesce(p_historically_confirmed, false)
      then case
        when lower(coalesce(p_question_family, ''))
          = 'book_orientation'
          then 0
        else 3
      end
    when coalesce(p_orientation_correct, false)
      and coalesce(p_core_correct, 0) = 0
      then case
        when lower(coalesce(p_question_family, ''))
            <> 'book_orientation'
          and p_candidate_stage = 2
          then 0
        else 3
      end
    when (
      coalesce(p_orientation_correct, false)
      or coalesce(p_historically_confirmed, false)
    )
      and coalesce(p_core_correct, 0) > 0
      and coalesce(p_target_stage, 1) >= 3
      and p_candidate_stage = 3
      then 1
    when coalesce(p_orientation_answered, 0) > 0
      and not coalesce(p_orientation_correct, false)
      and p_candidate_stage = 1
      then 1
    when coalesce(p_historically_confirmed, false)
      and p_candidate_stage = coalesce(p_target_stage, 1)
      then 1
    when p_candidate_stage = coalesce(p_target_stage, 1)
      then 2
    else 3
  end;
$$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.obs_general_route_priority_v4(text,integer,text,integer,boolean,integer,boolean,text,integer,integer)'::regprocedure
  )
  into definition;

  if definition not like
       '%p_candidate_stage < p_pending_stage%'
     or definition not like
       '%p_candidate_book_code <> p_pending_book_code%'
     or definition like
       '%abs(p_candidate_stage - p_pending_stage) = 1%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router directional-downshift fix was not installed.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
