-- Capture completed-attempt snapshots after the deferred answer-evidence
-- trigger has materialized the final answer. The existing attempt trigger can
-- fire before private.capture_bli_answer_scoring_evidence_trigger(), which
-- leaves the final answer out of the stored BLI snapshot.

create or replace function public.obs_capture_completed_attempt_snapshot_after_answer_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.assessment_attempts attempt
    where attempt.id = new.attempt_id
      and coalesce(attempt.is_complete, false)
  ) then
    return null;
  end if;

  if exists (
    select 1
    from public.assessment_answers later
    where later.attempt_id = new.attempt_id
      and (later.answered_at, later.id) > (new.answered_at, new.id)
  ) then
    return null;
  end if;

  perform public.obs_capture_assessment_snapshot(new.attempt_id);
  return null;
end;
$$;

revoke all on function public.obs_capture_completed_attempt_snapshot_after_answer_evidence()
  from public, anon;
grant execute on function public.obs_capture_completed_attempt_snapshot_after_answer_evidence()
  to authenticated, service_role;

drop trigger if exists zzz_obs_capture_snapshot_after_answer_evidence
  on public.assessment_answers;

create constraint trigger zzz_obs_capture_snapshot_after_answer_evidence
after insert on public.assessment_answers
deferrable initially deferred
for each row
execute function public.obs_capture_completed_attempt_snapshot_after_answer_evidence();

comment on function public.obs_capture_completed_attempt_snapshot_after_answer_evidence() is
  'Refreshes a completed attempt snapshot after deferred answer scoring evidence exists, so final skips/misses count in BLI.';

select set_config('request.jwt.claim.role', 'service_role', true);

with evidence_counts as (
  select
    snapshot.id,
    count(evidence.answer_id)::integer as evidence_answered,
    count(evidence.answer_id) filter (where evidence.is_correct)::integer
      as evidence_correct,
    count(evidence.answer_id) filter (where evidence.is_idk)::integer
      as evidence_idk
  from public.obs_assessment_snapshots snapshot
  left join public.obs_answer_evidence evidence
    on evidence.user_id = snapshot.user_id
   and evidence.testament = snapshot.testament
   and evidence.answered_at <= snapshot.captured_at
   and evidence.question_type not like 'quarantined%'
   and exists (
     select 1
     from public.assessment_answers answer
     where answer.id = evidence.answer_id
       and answer.scoring_eligible
   )
  group by snapshot.id
),
stale_snapshots as (
  select snapshot.*
  from public.obs_assessment_snapshots snapshot
  join evidence_counts evidence_count
    on evidence_count.id = snapshot.id
  where snapshot.questions_answered is distinct from evidence_count.evidence_answered
     or snapshot.correct_answers is distinct from evidence_count.evidence_correct
     or snapshot.idk_answers is distinct from evidence_count.evidence_idk
),
recalculated as (
  select
    stale_snapshots.id,
    score.raw_bli,
    score.display_bli,
    score.bli_level,
    score.questions_answered,
    score.correct_answers,
    score.idk_answers,
    score.section_scores
  from stale_snapshots
  cross join lateral public.obs_compute_scoped_bli(
    stale_snapshots.user_id,
    stale_snapshots.testament,
    stale_snapshots.captured_at
  ) score
)
update public.obs_assessment_snapshots snapshot
set raw_bli = recalculated.raw_bli,
    display_bli = recalculated.display_bli,
    bli_level = recalculated.bli_level,
    questions_answered = recalculated.questions_answered,
    correct_answers = recalculated.correct_answers,
    idk_answers = recalculated.idk_answers,
    section_scores = recalculated.section_scores
from recalculated
where snapshot.id = recalculated.id;

notify pgrst, 'reload schema';
