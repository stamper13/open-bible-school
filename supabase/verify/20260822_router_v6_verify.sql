-- Verification for router v6 steps 1-6.
--
-- Run AFTER applying the eight v6 migrations and BEFORE the activation UPDATE.
-- Every check raises on failure, so the whole file either passes silently or
-- stops at the first violated invariant.
--
-- This verifies structure and inertness. It does NOT verify that campaign
-- routing produces good assessments -- that is the profile replay in
-- 20260822_router_v6_campaign_simulation.sql, which must also pass.

\set ON_ERROR_STOP on

do $$
begin
  -- 1. Every object exists.
  if to_regprocedure('public.obs_unit_antievidence(uuid)') is null
     or to_regprocedure('public.obs_learner_evidence_ledger(uuid)') is null
     or to_regprocedure('public.obs_mark_unit_reread(uuid,text,text)') is null
     or to_regprocedure('public.obs_router_mode(uuid)') is null
     or to_regprocedure('public.obs_next_campaign_target(uuid)') is null
     or to_regprocedure('public.obs_router_sync_campaign(uuid,uuid)') is null
     or to_regprocedure(
          'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'
        ) is null
     or to_regclass('public.obs_router_campaign') is null
  then
    raise exception 'v6 verify: a required object is missing.';
  end if;

  -- 2. The migration set is INERT. This is the single most important check:
  --    applying v6 must not change what any learner sees.
  if exists (
    select 1
    from public.obs_router_policy_config config
    where config.policy_key = 'OT_GENERAL'
      and (
        upper(coalesce(config.active_version, 'V5')) <> 'V5'
        or coalesce(config.campaign_enabled, false)
      )
  ) then
    raise exception
      'v6 verify: policy is already activated; verification must run on an '
      'inert install.';
  end if;

  -- 3. Only one campaign may be open per user, structurally.
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'obs_router_campaign'
      and indexname = 'obs_router_campaign_one_open_per_user'
  ) then
    raise exception 'v6 verify: the one-open-campaign-per-user index is missing.';
  end if;

  -- 4. Campaign writes are not client-reachable. A learner must not be able
  --    to author the router's thesis about their own weaknesses.
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'obs_router_campaign'
      and cmd <> 'SELECT'
  ) then
    raise exception 'v6 verify: obs_router_campaign exposes a non-SELECT policy.';
  end if;

  if not exists (
    select 1
    from pg_class
    where relname = 'obs_router_campaign'
      and relrowsecurity
  ) then
    raise exception 'v6 verify: RLS is not enabled on obs_router_campaign.';
  end if;

  -- 5. The backup of the replaced router function was captured.
  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260822_router_v6'
      and backup.object_name = 'get_next_assessment_question'
  ) then
    raise exception 'v6 verify: the pre-v6 router definition was not backed up.';
  end if;

  -- 6. Mode reports cold_start while campaigns are disabled, for everyone.
  if exists (
    select 1
    from auth.users sample_user
    where public.obs_router_mode(sample_user.id) <> 'cold_start'
    limit 1
  ) then
    raise exception
      'v6 verify: obs_router_mode returned a non-cold_start mode while '
      'campaign_enabled is false.';
  end if;
end
$$;

-- 7. The ledger must cover only cells the bank can actually serve, and must
--    never invent evidence. Reported, not raised, so the numbers are visible
--    in the review log.
select
  count(*) as ledger_cells,
  count(*) filter (where bank_items = 0) as cells_without_bank_items,
  count(*) filter (where answered > correct + idk + misses) as impossible_counts,
  count(*) filter (where evidence_is_stale and last_reread_at is null)
    as stale_without_reread
from public.obs_learner_evidence_ledger(
  (select id from auth.users order by created_at limit 1)
);

do $$
declare
  bad integer;
begin
  select count(*)
  into bad
  from public.obs_learner_evidence_ledger(
    (select id from auth.users order by created_at limit 1)
  ) ledger
  where ledger.bank_items = 0
     or (ledger.evidence_is_stale and ledger.last_reread_at is null)
     or (ledger.answered = 0 and ledger.sufficiency <> 'unexplored')
     or (ledger.is_weak and ledger.answered = 0);

  if bad > 0 then
    raise exception 'v6 verify: % ledger rows violate a sufficiency invariant.', bad;
  end if;
end
$$;

-- 8. Reread antievidence must map to units by real chapter overlap. Genesis
--    1-11 and 12-50 must never both match a read of Genesis 1-5.
do $$
begin
  if not public.obs_unit_overlaps_reading(1, 11, 1, 5) then
    raise exception 'v6 verify: gen-1-11 should overlap a read of Genesis 1-5.';
  end if;
  if public.obs_unit_overlaps_reading(12, 50, 1, 5) then
    raise exception 'v6 verify: gen-12-50 must not overlap a read of Genesis 1-5.';
  end if;
  if not public.obs_unit_overlaps_reading(12, 50, 5, 20) then
    raise exception 'v6 verify: gen-12-50 should overlap a read spanning 5-20.';
  end if;
end
$$;

-- 9. In cold_start the v6 ranker must draw only from the widened v5 pool.
--    Earlier drafts required byte-for-byte passthrough, but production replay
--    showed that preserved the defect: v5 route-priority buckets left
--    dimension_need as a tie-breaker. V6 may reorder, but it must not invent
--    candidates outside the known v5 candidate pool.
do $$
declare
  attempt uuid;
  learner uuid;
  outsiders integer;
begin
  select attempt_row.id, attempt_row.user_id
  into attempt, learner
  from public.assessment_attempts attempt_row
  where attempt_row.assessment_kind = 'ot_adaptive'
  order by attempt_row.created_at desc
  limit 1;

  if attempt is null then
    raise notice 'v6 verify: no ot_adaptive attempt available; candidate-pool check skipped.';
    return;
  end if;

  select count(*)
  into outsiders
  from public.obs_rank_ot_assessment_candidates_v6(attempt, learner, 'V6', null, now(), 25) v6
  where not exists (
    select 1
    from public.obs_rank_ot_assessment_candidates_v5(attempt, learner, 'V5', null, now(), 75) v5
    where v5.generated_question_id = v6.generated_question_id
  );

  if outsiders > 0 then
    raise exception
      'v6 verify: cold_start ranker returned % candidates outside the widened v5 pool.',
      outsiders;
  end if;
end
$$;

-- 10. Campaign mode must actually PRODUCE campaign picks. A wrapper can only
--     reorder what v5 surfaced, and v5 ranks for breadth -- during
--     development a campaign on gen-12-50 saw zero of its 38 bank items
--     reach v5's top N. v6 therefore unions the targeted cell in directly.
--     If this check returns zero picks, the union is broken and the campaign
--     is inert no matter what the campaign row says.
do $$
declare
  learner uuid;
  attempt uuid;
  picks integer;
begin
  select attempt_row.user_id, attempt_row.id
  into learner, attempt
  from public.assessment_attempts attempt_row
  where attempt_row.assessment_kind = 'ot_adaptive'
  order by attempt_row.created_at desc
  limit 1;

  if learner is null then
    raise notice 'v6 verify: no attempt available; campaign lane check skipped.';
    return;
  end if;

  -- Exercised inside a subtransaction so the probe leaves nothing behind.
  begin
    update public.obs_router_policy_config
    set campaign_enabled = true
    where policy_key = 'OT_GENERAL';

    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', learner::text, 'role', 'authenticated')::text,
      true
    );

    perform public.obs_router_sync_campaign(learner, null);

    select count(*)
    into picks
    from public.obs_rank_ot_assessment_candidates_v6(attempt, learner, 'V6', null, now(), 10)
    where selection_lane = 'CAMPAIGN';

    raise exception using errcode = 'P0001', message = format('PROBE_RESULT:%s', picks);
  exception when others then
    if sqlerrm like 'PROBE_RESULT:%' then
      picks := split_part(sqlerrm, ':', 2)::integer;
      if picks = 0 then
        raise exception
          'v6 verify: campaign mode produced no CAMPAIGN picks; the campaign '
          'candidate union is not reaching the targeted cell.';
      end if;
      raise notice 'v6 verify: campaign lane produced % picks.', picks;
    else
      raise;
    end if;
  end;
end
$$;

-- 11. v5 is NOT limit-stable -- its section_candidate_ordinal is a window over
--     whatever pool it was handed. v6 now widens deliberately so dimension debt
--     has enough candidate breadth to matter; keep this notice so a future
--     reader does not mistake the drift for an accidental regression.
do $$
declare
  learner uuid;
  attempt uuid;
  drift integer;
begin
  select attempt_row.user_id, attempt_row.id
  into learner, attempt
  from public.assessment_attempts attempt_row
  where attempt_row.assessment_kind = 'ot_adaptive'
  order by attempt_row.created_at desc
  limit 1;

  if learner is null then return; end if;

  select count(*)
  into drift
  from public.obs_rank_ot_assessment_candidates_v5(attempt, learner, 'V5', null, now(), 25) small
  join public.obs_rank_ot_assessment_candidates_v5(attempt, learner, 'V5', null, now(), 75) wide
    on wide.candidate_rank = small.candidate_rank
  where small.generated_question_id is distinct from wide.generated_question_id;

  raise notice
    'v6 verify: v5 limit-instability measured at % of 25 positions (expected '
    'non-zero; v6 widens deliberately and owns the resulting rerank).', drift;
end
$$;

-- 12. The fast selector must be capped under V6 so it cannot shadow the richer
--     ranker for most of a first assessment.
do $$
declare
  limit_value integer;
begin
  select cold_start_fast_answer_limit
  into limit_value
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  if limit_value is null or limit_value > 4 then
    raise exception
      'v6 verify: cold_start_fast_answer_limit must be present and <= 4 before activation; found %.',
      limit_value;
  end if;
end
$$;

select 'router v6 verification passed' as result;
