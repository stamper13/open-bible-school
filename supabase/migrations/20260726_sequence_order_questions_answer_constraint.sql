-- Live follow-up for databases where the sequence functions were installed
-- before ordered responses were added to the legacy answer-ID constraint.

begin;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_sequence_order_questions',
  'public',
  'assessment_answers_selected_choice_id_check',
  'constraint',
  pg_get_constraintdef(constraint_row.oid)
from pg_constraint constraint_row
where constraint_row.conrelid = 'public.assessment_answers'::regclass
  and constraint_row.conname = 'assessment_answers_selected_choice_id_check'
  and not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260726_sequence_order_questions'
      and backup.object_schema = 'public'
      and backup.object_name =
        'assessment_answers_selected_choice_id_check'
      and backup.object_type = 'constraint'
  );

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_sequence_order_questions'
    and object_schema = 'public'
    and (
      (
        object_name = 'get_next_scoped_assessment_question'
        and object_type = 'function'
      )
      or (
        object_name = 'obs_get_attempt_review'
        and object_type = 'function'
      )
      or (
        object_name = 'obs_admin_question_bank_audit'
        and object_type = 'view'
      )
      or (
        object_name = 'assessment_answers_selected_choice_id_check'
        and object_type = 'constraint'
      )
    );

  if backup_count <> 4 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected four sequence-question backups, found %s.',
        backup_count
      );
  end if;
end
$$;

alter table public.assessment_answers
  drop constraint assessment_answers_selected_choice_id_check;

alter table public.assessment_answers
  add constraint assessment_answers_selected_choice_id_check
  check (
    selected_choice_id is null
    or selected_choice_id in ('A', 'B', 'C', 'D', '__IDK__')
    or (
      left(
        selected_choice_id,
        length('__ORDER__:')
      ) = '__ORDER__:'
      and public.obs_parse_sequence_order(selected_choice_id) is not null
    )
  );

notify pgrst, 'reload schema';

commit;
