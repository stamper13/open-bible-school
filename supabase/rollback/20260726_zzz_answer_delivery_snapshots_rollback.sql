-- Restore the previous review function and stop creating new snapshots.
-- Snapshot columns are intentionally retained so rollback never destroys
-- exact historical answer wording already captured.

begin;

do $$
declare
  saved_definition text;
begin
  select backup.definition
  into saved_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_answer_delivery_snapshots'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_get_attempt_review'
    and backup.object_type = 'function';

  if saved_definition is null then
    raise exception using
      errcode = 'P0001',
      message =
        'Answer snapshot rollback requires the saved review function; no changes made.';
  end if;

  execute saved_definition;
end
$$;

drop trigger if exists
  assessment_answers_capture_delivery_snapshot
  on public.assessment_answers;

drop function if exists public.obs_capture_answer_delivery_snapshot();
drop function if exists public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
);
drop function if exists public.obs_sequence_choice_text(jsonb, jsonb);
drop function if exists public.obs_choice_text(jsonb, text);

delete from public.obs_schema_backups
where backup_tag = '20260726_answer_delivery_snapshots'
  and object_schema = 'public'
  and object_name = 'obs_get_attempt_review'
  and object_type = 'function';

notify pgrst, 'reload schema';

commit;
