-- Rollback for 20260711_enforce_question_quarantine_in_v_question_bank.sql.
-- Restores the exact prior public.v_question_bank definition from obs_schema_backups.

do $$
declare
  old_definition text;
begin
  select definition
    into old_definition
  from public.obs_schema_backups
  where backup_tag = '20260711_enforce_question_quarantine_in_v_question_bank'
    and object_schema = 'public'
    and object_name = 'v_question_bank'
    and object_type = 'view'
  order by created_at desc
  limit 1;

  if old_definition is null then
    raise exception 'No v_question_bank backup found for 20260711_enforce_question_quarantine_in_v_question_bank';
  end if;

  execute format('create or replace view public.v_question_bank as %s', old_definition);
end $$;

grant select on public.v_question_bank to anon, authenticated, service_role;
