-- Persist NT assessment attempt summary counters on submit.
--
-- The NT submit RPC already calculates and returns answered/correct/complete
-- state to the frontend, but the assessment_attempts row only received
-- completed_at. That leaves resume/status/history flows reading stale attempt
-- counters after successful submissions.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  v_oid oid;
  v_definition text;
  v_anchor text;
  v_replacement text;
  v_occurrences integer;
begin
  v_oid := to_regprocedure(
    'public.obs_submit_nt_assessment_answer(uuid,uuid,text)'
  );

  if v_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'NT submission RPC is missing';
  end if;

  v_definition := pg_get_functiondef(v_oid);

  if v_definition like '%answered_count = v_answered,%correct_count = v_correct,%is_complete = v_answered >= v_attempt.target_count%' then
    raise notice 'NT attempt summary sync is already installed.';
    return;
  end if;

  v_anchor := $patch$  if v_answered >= v_attempt.target_count then
    update public.assessment_attempts
    set completed_at = coalesce(completed_at, now())
    where id = p_attempt_id;
  end if;$patch$;

  v_replacement := $patch$  update public.assessment_attempts
  set
    answered_count = v_answered,
    correct_count = v_correct,
    is_complete = v_answered >= v_attempt.target_count,
    completed_at = case
      when v_answered >= v_attempt.target_count
        then coalesce(completed_at, now())
      else completed_at
    end
  where id = p_attempt_id;$patch$;

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);

  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT completed_at-only update anchor mismatch; found %s',
        v_occurrences
      );
  end if;

  v_definition := replace(v_definition, v_anchor, v_replacement);

  execute v_definition;
end
$migration$;

revoke all on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) from public, anon;
grant execute on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) to authenticated, service_role;

comment on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) is
  'Grades and persists the first NT answer; exact retries return the original result, changed responses are rejected, and attempt counters stay synchronized.';

notify pgrst, 'reload schema';

commit;
