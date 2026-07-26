-- Rollback for 20260710_v_question_bank_batch_gate_floor.sql.

begin;

do $$
declare
  old_definition text;
begin
  select definition
  into old_definition
  from public.obs_schema_backups
  where backup_tag = '20260710_v_question_bank_batch_gate_floor'
    and object_schema = 'public'
    and object_name = 'v_question_bank'
  order by created_at desc
  limit 1;

  if old_definition is null then
    raise exception 'No v_question_bank backup found for 20260710_v_question_bank_batch_gate_floor';
  end if;

  old_definition := regexp_replace(old_definition, ';[[:space:]]*$', '');

  execute format('create or replace view public.v_question_bank as %s', old_definition);
end $$;

grant select on public.v_question_bank to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
