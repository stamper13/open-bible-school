-- Keep answer submission fast by removing full BLI snapshot capture from the
-- per-answer hot path. Ability estimates are still updated during submission;
-- snapshots are captured once when an attempt is completed.

begin;

drop trigger if exists obs_capture_snapshot_after_answer
  on public.assessment_answers;

create or replace function public.obs_snapshot_completed_attempt_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.is_complete
     and (
       tg_op = 'INSERT'
       or old.is_complete is distinct from new.is_complete
       or old.completed_at is distinct from new.completed_at
       or old.answered_count is distinct from new.answered_count
       or old.correct_count is distinct from new.correct_count
     )
  then
    perform public.obs_capture_assessment_snapshot(new.id);
  end if;

  return null;
end;
$function$;

drop trigger if exists obs_capture_snapshot_on_attempt_complete
  on public.assessment_attempts;

create trigger obs_capture_snapshot_on_attempt_complete
after insert or update of
  is_complete,
  completed_at,
  answered_count,
  correct_count
on public.assessment_attempts
for each row
when (new.is_complete)
execute function public.obs_snapshot_completed_attempt_trigger();

revoke all on function public.obs_snapshot_completed_attempt_trigger()
  from public, anon, authenticated;
grant execute on function public.obs_snapshot_completed_attempt_trigger()
  to service_role;

comment on function public.obs_snapshot_completed_attempt_trigger() is
  'Captures assessment snapshots when attempts complete, keeping every answer submit from recomputing a full scoped BLI snapshot.';

notify pgrst, 'reload schema';

commit;
