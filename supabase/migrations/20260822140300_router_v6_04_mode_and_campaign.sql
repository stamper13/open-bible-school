-- Router v6, step 4 of 6: routing mode, target selection, and the campaign
-- state machine.
--
-- Three modes:
--   cold_start  -- no completed general assessment yet. Section rotation is
--                  the whole job: build the first picture. v5 already does
--                  this well and is left completely alone.
--   campaign    -- a picture exists. Find the most foundational insufficient
--                  area, size it, then move to the next one.
--   sweep       -- nothing insufficient is left worth drilling. Pay down
--                  long-game dimension coverage debt.
--
-- Target selection uses the hierarchy only to CHOOSE the area. Once chosen,
-- scope and stage do the drilling. Foundational first, in dependency order:
-- is_foundation before not, then obs_learning_units.sequence_order, which is
-- already Torah -> Former -> Latter/Writings.
--
-- Uncertainty and weakness are ranked separately and deliberately. A cell with
-- one miss is uncertain; a cell with four misses is confidently weak. Reread
-- antievidence outranks both: a learner who says they have restudied an area
-- has invalidated the thesis, and retesting it is the router's obligation.
--
-- Installs functions only. Nothing calls them until step 5, and step 5 stays
-- inert until step 6 flips the policy row.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_router_campaign') is null
     or to_regprocedure('public.obs_learner_evidence_ledger(uuid)') is null
     or to_regprocedure('public.obs_unit_antievidence(uuid)') is null
     or to_regprocedure('public.obs_focused_item_stage(text,jsonb,double precision)') is null
     or to_regprocedure('public.obs_effective_item_irt_b(jsonb,double precision)') is null
     or to_regclass('public.obs_router_policy_config') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 4 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

alter table public.obs_router_policy_config
  add column if not exists campaign_enabled boolean not null default false,
  add column if not exists cold_start_completed_attempts integer not null default 1,
  add column if not exists campaign_min_bank_items integer not null default 2,
  add column if not exists campaign_max_items_per_attempt integer not null default 12,
  add column if not exists campaign_max_attempts_spanned integer not null default 3,
  add column if not exists campaign_reopen_cooldown_days integer not null default 30,
  add column if not exists campaign_confirm_answers integer not null default 2;

comment on column public.obs_router_policy_config.campaign_max_items_per_attempt is
  'Anti-obsession cap. Even a live campaign may not consume more than this '
  'many items of a single assessment, so one thesis can never eat a whole '
  'sitting and every attempt keeps some breadth.';

-- ---------------------------------------------------------------------------
-- Mode
-- ---------------------------------------------------------------------------

create or replace function public.obs_router_mode(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with policy as (
    select
      coalesce(config.campaign_enabled, false) as campaign_enabled,
      coalesce(config.cold_start_completed_attempts, 1) as cold_start_attempts
    from public.obs_router_policy_config config
    where config.policy_key = 'OT_GENERAL'
  ),
  policy_or_default as (
    select
      coalesce((select campaign_enabled from policy), false) as campaign_enabled,
      coalesce((select cold_start_attempts from policy), 1) as cold_start_attempts
  ),
  history as (
    select count(*)::integer as completed_attempts
    from public.assessment_attempts attempt
    where attempt.user_id = p_user_id
      and attempt.assessment_kind = 'ot_adaptive'
      and coalesce(attempt.is_complete, false)
  ),
  open_campaign as (
    select count(*)::integer as open_count
    from public.obs_router_campaign campaign
    where campaign.user_id = p_user_id
      and campaign.closed_at is null
  )
  select case
    when not coalesce(public.obs_is_authorized_user(p_user_id), false)
      then 'cold_start'
    when not policy_or_default.campaign_enabled then 'cold_start'
    when history.completed_attempts < policy_or_default.cold_start_attempts
      then 'cold_start'
    when open_campaign.open_count > 0 then 'campaign'
    when exists (
      select 1
      from public.obs_learner_evidence_ledger(p_user_id) ledger
      where ledger.is_weak
         or ledger.evidence_is_stale
         or ledger.sufficiency = 'unexplored'
    ) then 'campaign'
    else 'sweep'
  end
  from policy_or_default
  cross join history
  cross join open_campaign;
$$;

comment on function public.obs_router_mode(uuid) is
  'cold_start until the learner has a first completed general assessment, '
  'then campaign while any area remains insufficient, then sweep. Returns '
  'cold_start whenever campaign_enabled is false, which is how v6 stays '
  'inert before rollout.';

-- ---------------------------------------------------------------------------
-- Target selection
-- ---------------------------------------------------------------------------

create or replace function public.obs_next_campaign_target(p_user_id uuid)
returns table (
  unit_key text,
  book_code text,
  dimension_key text,
  section text,
  sequence_order integer,
  is_foundation boolean,
  bank_items integer,
  answered integer,
  misses integer,
  evidence_is_stale boolean,
  target_reason text,
  suggested_budget integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with policy as (
    select
      coalesce(config.campaign_min_bank_items, 2) as min_bank_items,
      coalesce(config.campaign_reopen_cooldown_days, 30) as reopen_cooldown_days
    from public.obs_router_policy_config config
    where config.policy_key = 'OT_GENERAL'
  ),
  policy_or_default as (
    select
      coalesce((select min_bank_items from policy), 2) as min_bank_items,
      coalesce((select reopen_cooldown_days from policy), 30) as reopen_cooldown_days
  ),
  ledger as (
    select * from public.obs_learner_evidence_ledger(p_user_id)
  ),
  -- A cell recently closed is not reopened unless a reread claim landed after
  -- it closed. Without this the router would re-litigate the same settled
  -- weakness every session.
  recently_closed as (
    select
      campaign.unit_key,
      campaign.dimension_key,
      max(campaign.closed_at) as closed_at
    from public.obs_router_campaign campaign
    cross join policy_or_default
    where campaign.user_id = p_user_id
      and campaign.closed_at is not null
      and campaign.closed_at
          > now() - make_interval(days => policy_or_default.reopen_cooldown_days)
    group by campaign.unit_key, campaign.dimension_key
  ),
  eligible as (
    select
      ledger.*,
      case
        when ledger.evidence_is_stale then 'reread_retest'
        when ledger.is_weak and ledger.answered >= 2 then 'confirmed_weak'
        when ledger.is_weak then 'suspected_weak'
        when ledger.sufficiency = 'unexplored' then 'unexplored'
        else 'low_evidence'
      end as target_reason
    from ledger
    cross join policy_or_default
    left join recently_closed
      on recently_closed.unit_key is not distinct from ledger.unit_key
     and recently_closed.dimension_key is not distinct from ledger.dimension_key
    where ledger.bank_items >= policy_or_default.min_bank_items
      and (
        ledger.is_weak
        or ledger.evidence_is_stale
        or ledger.sufficiency in ('unexplored', 'provisional')
      )
      and (
        recently_closed.closed_at is null
        or (
          ledger.last_reread_at is not null
          and ledger.last_reread_at > recently_closed.closed_at
        )
      )
  )
  select
    eligible.unit_key,
    eligible.book_code,
    eligible.dimension_key,
    eligible.section,
    eligible.sequence_order,
    eligible.is_foundation,
    eligible.bank_items,
    eligible.answered,
    eligible.misses,
    eligible.evidence_is_stale,
    eligible.target_reason,
    -- Budget follows real bank depth. Cells hold 2-5 items in practice, so a
    -- fixed budget would force repeats the cross-session memory rule forbids.
    greatest(2, least(6, eligible.bank_items))::integer as suggested_budget
  from eligible
  order by
    -- 1. A reread claim is an obligation to retest, ahead of everything.
    case eligible.target_reason
      when 'reread_retest' then 0
      when 'confirmed_weak' then 1
      when 'suspected_weak' then 2
      when 'unexplored' then 3
      else 4
    end,
    -- 2. Foundational areas before dependent ones, in canonical order.
    eligible.is_foundation desc,
    eligible.sequence_order,
    -- 3. Among equals, the least-evidenced cell carries the most uncertainty.
    eligible.answered,
    -- 4. Prefer a cell deep enough to actually drill.
    eligible.bank_items desc,
    eligible.dimension_key
  limit 1;
$$;

comment on function public.obs_next_campaign_target(uuid) is
  'The single most foundational insufficient cell worth opening a campaign '
  'on. Reread staleness outranks confirmed weakness, which outranks '
  'uncertainty. Recently closed cells are excluded unless a reread landed '
  'after they closed.';

-- ---------------------------------------------------------------------------
-- Campaign state machine
-- ---------------------------------------------------------------------------

create or replace function public.obs_router_sync_campaign(
  p_user_id uuid,
  p_attempt_id uuid default null
)
returns public.obs_router_campaign
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_campaign public.obs_router_campaign;
  v_target record;
  v_policy record;
  v_cell record;
  v_reread_at timestamptz;
  v_mode text;
begin
  -- coalesce, because obs_is_authorized_user returns NULL (not false) when
  -- there is no JWT: `if not null then` is false, so a bare guard would fall
  -- through instead of rejecting. Unreachable via PostgREST as `authenticated`,
  -- but the guard should not depend on that.
  if not coalesce(public.obs_is_authorized_user(p_user_id), false) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  select
    coalesce(config.campaign_enabled, false) as campaign_enabled,
    coalesce(config.campaign_max_attempts_spanned, 3) as max_attempts_spanned,
    coalesce(config.campaign_confirm_answers, 2) as confirm_answers
  into v_policy
  from public.obs_router_policy_config config
  where config.policy_key = 'OT_GENERAL';

  if not found or not v_policy.campaign_enabled then
    return null;
  end if;

  v_mode := public.obs_router_mode(p_user_id);
  if v_mode = 'cold_start' then
    return null;
  end if;

  -- Serialize against concurrent question requests for the same learner. The
  -- partial unique index guarantees at most one open row; this lock keeps two
  -- in-flight requests from both trying to create it.
  select *
  into v_campaign
  from public.obs_router_campaign campaign
  where campaign.user_id = p_user_id
    and campaign.closed_at is null
  for update;

  if found then
    -- Measure what the open campaign has actually spent and learned.
    select
      count(*)::integer as answered,
      count(*) filter (
        where answer.is_correct and not coalesce(answer.is_idk, false)
      )::integer as correct,
      count(*) filter (
        where not answer.is_correct or coalesce(answer.is_idk, false)
      )::integer as misses,
      count(distinct answer.attempt_id)::integer as attempts_seen,
      max(
        public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(question.payload, null)
        )
      ) filter (
        where answer.is_correct and not coalesce(answer.is_idk, false)
      ) as best_pass_stage,
      min(
        public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(question.payload, null)
        )
      ) filter (
        where not answer.is_correct or coalesce(answer.is_idk, false)
      ) as worst_fail_stage
    into v_cell
    from public.assessment_answers answer
    join public.obs_question_bank_with_units question
      on question.generated_question_id = answer.generated_question_id
    where answer.user_id = p_user_id
      and answer.answered_at >= v_campaign.opened_at
      and coalesce(answer.scoring_eligible, true)
      and question.dimension_key is not distinct from v_campaign.dimension_key
      and (
        (v_campaign.unit_key is not null
          and question.unit_key = v_campaign.unit_key)
        or (v_campaign.unit_key is null
          and question.book_code = v_campaign.book_code)
      );

    -- A reread claim landing after the campaign opened invalidates the thesis
    -- mid-flight. Close it and let target selection reopen on fresh terms.
    if v_campaign.unit_key is not null then
      select antievidence.last_reread_at
      into v_reread_at
      from public.obs_unit_antievidence(p_user_id) antievidence
      where antievidence.unit_key = v_campaign.unit_key;

      if v_reread_at is not null and v_reread_at > v_campaign.opened_at then
        update public.obs_router_campaign
        set phase = 'closed',
            closed_at = now(),
            closed_reason = 'superseded_by_reread',
            items_spent = coalesce(v_cell.answered, 0),
            last_advanced_at = now(),
            metadata = metadata || jsonb_build_object(
              'superseded_at', v_reread_at
            )
        where id = v_campaign.id;
        v_campaign := null;
      end if;
    end if;

    if v_campaign.id is not null then
      -- Record the stage boundary as it is discovered.
      update public.obs_router_campaign
      set items_spent = coalesce(v_cell.answered, 0),
          attempts_spanned = greatest(
            attempts_spanned,
            coalesce(v_cell.attempts_seen, 0)
          ),
          -- The 0 and 4 sentinels are collapsed back to null inside the same
          -- expression, never written. Both columns carry a
          -- "between 1 and 3" check, so persisting a sentinel and tidying it
          -- afterwards would abort the transaction on the first campaign that
          -- has not yet passed or failed a stage.
          confirmed_pass_stage = nullif(
            greatest(
              coalesce(confirmed_pass_stage, 0),
              coalesce(v_cell.best_pass_stage, 0)
            ),
            0
          ),
          confirmed_fail_stage = nullif(
            least(
              coalesce(confirmed_fail_stage, 4),
              coalesce(v_cell.worst_fail_stage, 4)
            ),
            4
          ),
          last_advanced_at = now()
      where id = v_campaign.id
      returning * into v_campaign;

      -- Phase transitions.
      if v_campaign.phase = 'confirm'
         and coalesce(v_cell.answered, 0) >= v_policy.confirm_answers then
        if coalesce(v_cell.misses, 0) = 0 then
          -- The entry miss did not reproduce. Nothing to size.
          update public.obs_router_campaign
          set phase = 'closed',
              closed_at = now(),
              closed_reason = 'resolved_strong',
              last_advanced_at = now()
          where id = v_campaign.id returning * into v_campaign;
        else
          update public.obs_router_campaign
          set phase = 'widen_scope',
              last_advanced_at = now()
          where id = v_campaign.id returning * into v_campaign;
        end if;

      elsif v_campaign.phase in ('widen_scope', 'widen_sibling')
            and coalesce(v_cell.answered, 0) >= v_policy.confirm_answers + 2 then
        update public.obs_router_campaign
        set phase = 'bracket_stage',
            -- Foundational first: only lift the ceiling once a stage has
            -- actually been passed inside the confirmed scope.
            stage_ceiling = least(
              3,
              greatest(1, coalesce(v_campaign.confirmed_pass_stage, 0) + 1)
            ),
            last_advanced_at = now()
        where id = v_campaign.id returning * into v_campaign;

      elsif v_campaign.phase = 'bracket_stage' then
        update public.obs_router_campaign
        set stage_ceiling = least(
              3,
              greatest(
                v_campaign.stage_floor,
                coalesce(v_campaign.confirmed_pass_stage, 0) + 1
              )
            ),
            last_advanced_at = now()
        where id = v_campaign.id returning * into v_campaign;
      end if;

      -- Close conditions, checked after any transition above.
      if v_campaign.closed_at is null then
        if v_campaign.confirmed_pass_stage is not null
           and v_campaign.confirmed_fail_stage is not null
           and v_campaign.confirmed_fail_stage
               > v_campaign.confirmed_pass_stage
           and v_campaign.phase = 'bracket_stage' then
          update public.obs_router_campaign
          set phase = 'closed',
              closed_at = now(),
              closed_reason = 'bracketed',
              last_advanced_at = now()
          where id = v_campaign.id returning * into v_campaign;

        elsif v_campaign.items_spent >= v_campaign.evidence_budget then
          update public.obs_router_campaign
          set phase = 'closed',
              closed_at = now(),
              closed_reason = 'budget_spent',
              last_advanced_at = now()
          where id = v_campaign.id returning * into v_campaign;

        elsif v_campaign.attempts_spanned > v_policy.max_attempts_spanned then
          update public.obs_router_campaign
          set phase = 'closed',
              closed_at = now(),
              closed_reason = 'stale_abandoned',
              last_advanced_at = now()
          where id = v_campaign.id returning * into v_campaign;
        end if;
      end if;

      if v_campaign.closed_at is null then
        return v_campaign;
      end if;
    end if;
  end if;

  -- No open campaign: open one on the current best target, if any.
  select * into v_target
  from public.obs_next_campaign_target(p_user_id)
  limit 1;

  if not found then
    return null;
  end if;

  insert into public.obs_router_campaign (
    user_id,
    unit_key,
    book_code,
    dimension_key,
    phase,
    stage_floor,
    stage_ceiling,
    evidence_budget,
    opened_by_attempt_id,
    metadata
  ) values (
    p_user_id,
    v_target.unit_key,
    v_target.book_code,
    v_target.dimension_key,
    'confirm',
    1,
    1,
    v_target.suggested_budget,
    p_attempt_id,
    jsonb_build_object(
      'target_reason', v_target.target_reason,
      'section', v_target.section,
      'bank_items_at_open', v_target.bank_items,
      'answered_at_open', v_target.answered,
      'misses_at_open', v_target.misses
    )
  )
  on conflict (user_id) where closed_at is null do nothing
  returning * into v_campaign;

  if v_campaign.id is null then
    select * into v_campaign
    from public.obs_router_campaign campaign
    where campaign.user_id = p_user_id
      and campaign.closed_at is null;
  end if;

  return v_campaign;
end;
$$;

comment on function public.obs_router_sync_campaign(uuid, uuid) is
  'Opens, advances, and closes the learner campaign. The only writer to '
  'obs_router_campaign. Called from the volatile question RPC because the '
  'candidate ranker is STABLE and cannot write.';

revoke all on function public.obs_router_mode(uuid) from public;
grant execute on function public.obs_router_mode(uuid) to authenticated, service_role;

revoke all on function public.obs_next_campaign_target(uuid) from public;
grant execute on function public.obs_next_campaign_target(uuid) to authenticated, service_role;

revoke all on function public.obs_router_sync_campaign(uuid, uuid) from public;
grant execute on function public.obs_router_sync_campaign(uuid, uuid) to authenticated, service_role;

commit;
