-- Router v6, step 7: reconcile campaign mode with the BLI evidence floor.
--
-- This closes the last blocking gate in docs/router/V6_PLAN.md.
--
-- The dashboard and the campaign were both claiming "what next".
--
-- web/app/page.tsx sets isRecommendationEvidenceBlocked whenever
-- obs_get_bli_section_followup_v1 reports the least-evidenced section as
-- provisional, and while that holds it REPLACES every weakness recommendation
-- with "Clarify your <section> profile / Add section evidence". A campaign
-- pointed at gen-12-50 would have been contradicted on screen by a dashboard
-- telling the learner to go add breadth somewhere else.
--
-- These are not rival claims; they are consecutive phases. Building every
-- section to the interpretation floor is a breadth job, and breadth is exactly
-- what cold_start is for. Drilling is what comes after. So the mode boundary
-- moves onto the dashboard's own threshold, counted from the dashboard's own
-- source: obs_answer_evidence, scoring_eligible answers only, quarantined
-- question types excluded -- identical to obs_get_bli_section_followup_v1.
--
-- By construction the two can now never disagree: campaign mode cannot begin
-- until the dashboard has stopped claiming the recommendation slot.
--
-- This also resolves the section-band concern in
-- docs/validation/BLI_SCORE_FIDELITY_GATES.md at the routing layer. Every
-- canonical section is at or above the interpretation floor before any
-- deliberate unbalancing begins, so campaign drilling cannot pull a section
-- below the threshold the gate cares about -- it can only add evidence on top
-- of an already-sufficient base.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('public.obs_router_mode(uuid)') is null
     or to_regprocedure('public.obs_get_bli_section_followup_v1(uuid,text)') is null
     or to_regclass('public.obs_answer_evidence') is null
     or to_regclass('public.obs_router_policy_config') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 7 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

alter table public.obs_router_policy_config
  add column if not exists cold_start_section_floor integer not null default 15;

comment on column public.obs_router_policy_config.cold_start_section_floor is
  'Answers every canonical section must reach before campaign mode may begin. '
  'Must stay equal to minimum_reliable_answers in '
  'obs_get_bli_section_followup_v1 (15), or the dashboard and the router will '
  'disagree about what the learner should do next.';

create or replace function public.obs_router_mode(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with policy_or_default as (
    select
      coalesce(
        (select config.campaign_enabled from public.obs_router_policy_config config
         where config.policy_key = 'OT_GENERAL'), false) as campaign_enabled,
      coalesce(
        (select config.cold_start_completed_attempts from public.obs_router_policy_config config
         where config.policy_key = 'OT_GENERAL'), 1) as cold_start_attempts,
      coalesce(
        (select config.cold_start_section_floor from public.obs_router_policy_config config
         where config.policy_key = 'OT_GENERAL'), 15) as section_floor
  ),
  history as (
    select count(*)::integer as completed_attempts
    from public.assessment_attempts attempt
    where attempt.user_id = p_user_id
      and attempt.assessment_kind = 'ot_adaptive'
      and coalesce(attempt.is_complete, false)
  ),
  -- Counted exactly as obs_get_bli_section_followup_v1 counts it, so the
  -- router and the dashboard read the same number for the same learner.
  section_evidence as (
    select
      section.section_name,
      coalesce(counted.answered, 0)::integer as answered
    from (values
      ('Torah'), ('Former Prophets'), ('Latter Prophets'), ('Writings')
    ) section(section_name)
    left join (
      select evidence.section as section_name, count(*)::integer as answered
      from public.obs_answer_evidence evidence
      join public.assessment_answers answer
        on answer.id = evidence.answer_id
       and answer.scoring_eligible
      where evidence.user_id = p_user_id
        and evidence.testament = 'OT'
        and evidence.question_type not like 'quarantined%'
      group by evidence.section
    ) counted on counted.section_name = section.section_name
  ),
  floors as (
    select min(section_evidence.answered) as thinnest_section
    from section_evidence
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
    -- Breadth first, at the dashboard's own breadth threshold.
    when floors.thinnest_section < policy_or_default.section_floor
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
  cross join floors
  cross join open_campaign;
$$;

comment on function public.obs_router_mode(uuid) is
  'cold_start until the learner has a completed general assessment AND every '
  'canonical OT section has reached the BLI interpretation floor; then '
  'campaign while any area remains insufficient; then sweep. The section '
  'floor is deliberately the same threshold and the same count the dashboard '
  'uses to block recommendations, so the two cannot disagree about what the '
  'learner should do next. Returns cold_start whenever campaign_enabled is '
  'false, which is how v6 stays inert before rollout.';

commit;
