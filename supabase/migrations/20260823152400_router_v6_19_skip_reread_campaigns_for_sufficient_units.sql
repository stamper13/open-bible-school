-- Router v6, step 19: do not open reread campaigns for sufficient units.
--
-- Reread retest debt is useful when a unit is still a live evidence gap. Once
-- the ladder says the unit has enough passing evidence, stale reread metadata
-- should not keep reopening campaigns in that already-strong area.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_next_campaign_target(uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql not like '%reread campaigns skip ladder-sufficient units%' then
    v_sql := replace(
      v_sql,
$needle$
  ledger as (
    select * from public.obs_learner_evidence_ledger(p_user_id)
  ),
$needle$,
$replacement$
  ledger as (
    select * from public.obs_learner_evidence_ledger(p_user_id)
  ),
  ladder_state as (
    select * from public.obs_get_ladder_state_v1(p_user_id)
  ),
$replacement$
    );

    v_sql := replace(
      v_sql,
$needle$
      and (
        recently_closed.closed_at is null
        or (
          ledger.last_reread_at is not null
          and ledger.last_reread_at > recently_closed.closed_at
        )
      )
$needle$,
$replacement$
      and (
        recently_closed.closed_at is null
        or (
          ledger.last_reread_at is not null
          and ledger.last_reread_at > recently_closed.closed_at
        )
      )
      -- reread campaigns skip ladder-sufficient units
      and not (
        ledger.evidence_is_stale
        and exists (
          select 1
          from ladder_state ladder
          where ladder.unit_key = ledger.unit_key
            and ladder.state <> 'insufficient_evidence'
            and ladder.answered >= ladder.required_answers
            and ladder.display_score >= ladder.required_score
        )
      )
$replacement$
    );

    if v_sql = v_original
       or v_sql not like '%reread campaigns skip ladder-sufficient units%' then
      raise exception using
        errcode = 'P0001',
        message = 'Could not patch next campaign target sufficient-unit reread guard.';
    end if;

    execute v_sql;
  end if;
end
$migration$;

comment on function public.obs_next_campaign_target(uuid) is
  'Selects the next OT campaign target, skipping stale reread campaigns for units already sufficient on the ladder.';

notify pgrst, 'reload schema';

commit;
