-- Enforce the soft-quarantine convention in the router-facing question view.
-- Before this migration, question_type values renamed to quarantined_* were still
-- visible through public.v_question_bank and therefore still servable.

do $$
declare
  old_definition text;
  wrapped_definition text;
begin
  if exists (
    select 1
    from public.obs_schema_backups
    where backup_tag = '20260711_enforce_question_quarantine_in_v_question_bank'
      and object_schema = 'public'
      and object_name = 'v_question_bank'
      and object_type = 'view'
  ) then
    raise notice '20260711_enforce_question_quarantine_in_v_question_bank already applied; skipping.';
    return;
  end if;

  select pg_get_viewdef('public.v_question_bank'::regclass, true)
    into old_definition;

  wrapped_definition := regexp_replace(old_definition, ';\s*$', '');

  insert into public.obs_schema_backups (
    backup_tag,
    object_schema,
    object_name,
    object_type,
    definition
  ) values (
    '20260711_enforce_question_quarantine_in_v_question_bank',
    'public',
    'v_question_bank',
    'view',
    old_definition
  );

  execute format(
    'create or replace view public.v_question_bank as select * from (%s) q where coalesce(q.question_type, '''') not like %L',
    wrapped_definition,
    'quarantined%'
  );
end $$;

grant select on public.v_question_bank to anon, authenticated, service_role;
