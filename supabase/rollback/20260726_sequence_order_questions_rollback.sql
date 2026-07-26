begin;

do $$
declare
  backup_count integer;
  function_definition text;
  view_definition text;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_sequence_order_questions'
    and object_schema = 'public'
    and (
      (object_name = 'get_next_scoped_assessment_question' and object_type = 'function')
      or (object_name = 'obs_get_attempt_review' and object_type = 'function')
      or (object_name = 'obs_admin_question_bank_audit' and object_type = 'view')
      or (
        object_name = 'assessment_answers_selected_choice_id_check'
        and object_type = 'constraint'
      )
    );

  if backup_count <> 4 then
    raise exception using
      errcode = 'P0001',
      message = format('Rollback requires four backups; found %s.', backup_count);
  end if;

  select definition
  into function_definition
  from public.obs_schema_backups
  where backup_tag = '20260726_sequence_order_questions'
    and object_schema = 'public'
    and object_name = 'get_next_scoped_assessment_question'
    and object_type = 'function';
  execute function_definition;

  select definition
  into function_definition
  from public.obs_schema_backups
  where backup_tag = '20260726_sequence_order_questions'
    and object_schema = 'public'
    and object_name = 'obs_get_attempt_review'
    and object_type = 'function';
  execute function_definition;

  select definition
  into view_definition
  from public.obs_schema_backups
  where backup_tag = '20260726_sequence_order_questions'
    and object_schema = 'public'
    and object_name = 'obs_admin_question_bank_audit'
    and object_type = 'view';
  execute 'create or replace view public.obs_admin_question_bank_audit as '
    || view_definition;

  select definition
  into view_definition
  from public.obs_schema_backups
  where backup_tag = '20260726_sequence_order_questions'
    and object_schema = 'public'
    and object_name = 'assessment_answers_selected_choice_id_check'
    and object_type = 'constraint';

  alter table public.assessment_answers
    drop constraint assessment_answers_selected_choice_id_check;
  execute
    'alter table public.assessment_answers '
    || 'add constraint assessment_answers_selected_choice_id_check '
    || view_definition;
end
$$;

drop function if exists public.obs_submit_ot_assessment_response(
  uuid, uuid, text
);
drop function if exists public.obs_parse_sequence_order(text);

-- Preserve historical answers while making seeded sequence items inactive.
update public.ot_generated_questions
set question_type = 'quarantined_sequence_order_v1'
where question_type = 'sequence_order_v1'
  and dedupe_key like 'sequence|%';

delete from public.obs_schema_backups
where backup_tag = '20260726_sequence_order_questions'
  and object_schema = 'public'
  and object_name in (
    'get_next_scoped_assessment_question',
    'obs_get_attempt_review',
    'obs_admin_question_bank_audit',
    'assessment_answers_selected_choice_id_check'
  );

notify pgrst, 'reload schema';

commit;
