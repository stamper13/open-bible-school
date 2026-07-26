-- Restores the prior 200-800 display contract and exact function definitions.

begin;

do $$
declare
  target text;
  v_definition text;
  v_backup_count integer;
begin
  select count(*)
  into v_backup_count
  from public.obs_schema_backups
  where backup_tag = '20260725_canonical_bli_display_contract'
    and object_schema = 'public'
    and object_name in (
      'compute_bli',
      'obs_display_score_from_raw',
      'obs_display_bli_level'
    )
    and object_type = 'function';

  if v_backup_count <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Refusing rollback: expected exactly three canonical BLI backups, found %s.',
        v_backup_count
      );
  end if;

  foreach target in array array[
    'obs_display_score_from_raw',
    'obs_display_bli_level',
    'compute_bli'
  ]
  loop
    select definition
    into v_definition
    from public.obs_schema_backups
    where backup_tag = '20260725_canonical_bli_display_contract'
      and object_schema = 'public'
      and object_name = target
      and object_type = 'function';

    execute v_definition;
  end loop;
end
$$;

alter table public.obs_learning_units
  drop constraint if exists obs_learning_units_score_ck;
alter table public.obs_learning_units
  add constraint obs_learning_units_score_ck
  check (baseline_display_score_required between 200 and 800);
alter table public.obs_learning_units
  alter column baseline_display_score_required set default 585;

update public.obs_learning_units
set baseline_display_score_required = 585
where baseline_display_score_required = 513;

alter table public.obs_assessment_snapshots
  drop constraint if exists obs_assessment_snapshots_display_ck;

update public.obs_assessment_snapshots
set display_bli = public.obs_display_score_from_raw(raw_bli),
    bli_level = public.obs_display_bli_level(
      public.obs_display_score_from_raw(raw_bli)
    );

alter table public.obs_assessment_snapshots
  add constraint obs_assessment_snapshots_display_ck
  check (display_bli between 200 and 800);

revoke all on function public.compute_bli(uuid)
  from public, anon;
grant execute on function public.compute_bli(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
