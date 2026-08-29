-- Router v6, step 1 of 6: the learner evidence ledger.
--
-- Read-only. Installs no behavior and is called by nothing in this migration.
-- Every later v6 step reads this one function, so it ships first and alone.
--
-- The ledger is the router's map of what it knows about a learner. One row per
-- (learning unit x BLI dimension) cell, carrying how much evidence exists, how
-- good that evidence is, how foundational the cell is, and whether the learner
-- has since claimed to have reread it.
--
-- "Antievidence" is the reread signal. Logging or marking a passage as reread
-- never moves a score -- the BLI still measures only what testing shows. What
-- it does is invalidate the router's standing thesis about that cell: prior
-- misses stop counting as current weakness, and the cell becomes a retest
-- target. Evidence older than the most recent reread is stale, not wrong.
--
-- Cells are keyed on unit_key where the question bank has one and on book_code
-- otherwise: 795 of 1171 OT items currently carry a unit, so book-level cells
-- are the normal degraded case, not an error path.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regclass('public.obs_question_bank_with_units') is null
     or to_regclass('public.obs_reading_log_entries') is null
     or to_regclass('public.obs_study_plan_events') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.obs_router_policy_config') is null
     or to_regprocedure('public.obs_is_authorized_user(uuid)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 1 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

-- Sufficiency thresholds live in the existing policy table rather than as
-- literals inside the ledger, so tuning them is an UPDATE and not a migration.
alter table public.obs_router_policy_config
  add column if not exists cell_provisional_answers integer not null default 1,
  add column if not exists cell_developing_answers integer not null default 3,
  add column if not exists cell_established_answers integer not null default 6,
  add column if not exists cell_weak_accuracy numeric not null default 0.50;

comment on column public.obs_router_policy_config.cell_established_answers is
  'Answers in one unit x dimension cell before v6 treats it as settled. '
  'Distinct from the BLI section-level evidence floors in '
  'docs/validation/BLI_SCORE_FIDELITY_GATES.md, which govern score display.';

-- Chapter-range overlap between a reading-log entry and a learning unit.
-- Immutable so it can be used in indexes later if the log grows.
create or replace function public.obs_unit_overlaps_reading(
  p_unit_start integer,
  p_unit_end integer,
  p_read_start integer,
  p_read_end integer
)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(p_unit_start, 1) <= coalesce(p_read_end, p_read_start, 1)
     and coalesce(p_unit_end, p_unit_start, 1) >= coalesce(p_read_start, 1);
$$;

-- The most recent reread claim per unit, from either source the product has:
-- the dedicated reading log, or a dashboard "I reread it" mark recorded as a
-- reading_completed/reading_started study-plan event.
create or replace function public.obs_unit_antievidence(p_user_id uuid)
returns table (
  unit_key text,
  last_reread_at timestamptz,
  reread_sources text[]
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with authorized as (
    select p_user_id as user_id
    where coalesce(public.obs_is_authorized_user(p_user_id), false)
  ),
  logged as (
    select
      unit.unit_key,
      max(entry.logged_at) as last_at
    from authorized
    join public.obs_reading_log_entries entry
      on entry.user_id = authorized.user_id
    join public.obs_learning_units unit
      on unit.book_code = upper(btrim(entry.book_code))
     and public.obs_unit_overlaps_reading(
           unit.start_chapter,
           unit.end_chapter,
           entry.start_chapter,
           entry.end_chapter
         )
    group by unit.unit_key
  ),
  marked as (
    select
      event.unit_key,
      max(event.created_at) as last_at
    from authorized
    join public.obs_study_plan_events event
      on event.user_id = authorized.user_id
    where event.unit_key is not null
      and event.event_type in ('reading_completed', 'reading_started')
    group by event.unit_key
  )
  select
    coalesce(logged.unit_key, marked.unit_key) as unit_key,
    greatest(
      coalesce(logged.last_at, '-infinity'::timestamptz),
      coalesce(marked.last_at, '-infinity'::timestamptz)
    ) as last_reread_at,
    array_remove(
      array[
        case when logged.unit_key is not null then 'reading_log' end,
        case when marked.unit_key is not null then 'dashboard_mark' end
      ],
      null
    ) as reread_sources
  from logged
  full join marked on marked.unit_key = logged.unit_key;
$$;

comment on function public.obs_unit_antievidence(uuid) is
  'Most recent reread claim per learning unit. Never affects any score; it '
  'only tells the router its standing thesis about a cell may be out of date.';

create or replace function public.obs_learner_evidence_ledger(p_user_id uuid)
returns table (
  unit_key text,
  section text,
  book_code text,
  sequence_order integer,
  is_foundation boolean,
  dimension_key text,
  bank_items integer,
  answered integer,
  correct integer,
  idk integer,
  misses integer,
  accuracy numeric,
  last_answered_at timestamptz,
  last_reread_at timestamptz,
  evidence_is_stale boolean,
  sufficiency text,
  is_weak boolean,
  foundational_rank integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with authorized as (
    select p_user_id as user_id
    where coalesce(public.obs_is_authorized_user(p_user_id), false)
  ),
  policy as (
    select
      coalesce(config.cell_provisional_answers, 1) as provisional_answers,
      coalesce(config.cell_developing_answers, 3) as developing_answers,
      coalesce(config.cell_established_answers, 6) as established_answers,
      coalesce(config.cell_weak_accuracy, 0.50) as weak_accuracy
    from public.obs_router_policy_config config
    where config.policy_key = 'OT_GENERAL'
  ),
  policy_or_default as (
    select
      coalesce((select provisional_answers from policy), 1) as provisional_answers,
      coalesce((select developing_answers from policy), 3) as developing_answers,
      coalesce((select established_answers from policy), 6) as established_answers,
      coalesce((select weak_accuracy from policy), 0.50) as weak_accuracy
  ),
  cells as (
    select
      unit.unit_key,
      unit.section,
      unit.book_code,
      unit.sequence_order,
      unit.is_foundation,
      dimension.dimension_key
    from public.obs_learning_units unit
    cross join public.obs_bli_dimensions dimension
  ),
  bank as (
    select
      question.unit_key,
      question.dimension_key,
      count(*)::integer as bank_items
    from public.obs_question_bank_with_units question
    where question.unit_key is not null
      and question.dimension_key is not null
    group by question.unit_key, question.dimension_key
  ),
  responses as (
    select
      question.unit_key,
      question.dimension_key,
      count(*)::integer as answered,
      count(*) filter (
        where answer.is_correct and not coalesce(answer.is_idk, false)
      )::integer as correct,
      count(*) filter (where coalesce(answer.is_idk, false))::integer as idk,
      count(*) filter (
        where not answer.is_correct or coalesce(answer.is_idk, false)
      )::integer as misses,
      max(answer.answered_at) as last_answered_at
    from authorized
    join public.assessment_answers answer
      on answer.user_id = authorized.user_id
     and coalesce(answer.scoring_eligible, true)
    join public.obs_question_bank_with_units question
      on question.generated_question_id = answer.generated_question_id
    where question.unit_key is not null
      and question.dimension_key is not null
    group by question.unit_key, question.dimension_key
  ),
  antievidence as (
    select * from public.obs_unit_antievidence(p_user_id)
  ),
  assembled as (
    select
      cells.unit_key,
      cells.section,
      cells.book_code,
      cells.sequence_order,
      cells.is_foundation,
      cells.dimension_key,
      coalesce(bank.bank_items, 0) as bank_items,
      coalesce(responses.answered, 0) as answered,
      coalesce(responses.correct, 0) as correct,
      coalesce(responses.idk, 0) as idk,
      coalesce(responses.misses, 0) as misses,
      responses.last_answered_at,
      nullif(antievidence.last_reread_at, '-infinity'::timestamptz)
        as last_reread_at,
      policy_or_default.provisional_answers,
      policy_or_default.developing_answers,
      policy_or_default.established_answers,
      policy_or_default.weak_accuracy
    from cells
    cross join policy_or_default
    left join bank
      on bank.unit_key = cells.unit_key
     and bank.dimension_key = cells.dimension_key
    left join responses
      on responses.unit_key = cells.unit_key
     and responses.dimension_key = cells.dimension_key
    left join antievidence
      on antievidence.unit_key = cells.unit_key
  ),
  scored as (
    select
      assembled.*,
      case
        when assembled.answered = 0 then null
        else round(assembled.correct::numeric / assembled.answered, 4)
      end as accuracy,
      -- Evidence predating the most recent reread claim no longer describes
      -- the learner's current state of the cell.
      (
        assembled.last_reread_at is not null
        and assembled.last_answered_at is not null
        and assembled.last_answered_at < assembled.last_reread_at
      ) as evidence_is_stale
    from assembled
  )
  select
    scored.unit_key,
    scored.section,
    scored.book_code,
    scored.sequence_order,
    scored.is_foundation,
    scored.dimension_key,
    scored.bank_items,
    scored.answered,
    scored.correct,
    scored.idk,
    scored.misses,
    scored.accuracy,
    scored.last_answered_at,
    scored.last_reread_at,
    scored.evidence_is_stale,
    case
      -- Stale evidence reports as its pre-reread strength minus one band, so a
      -- reread cell becomes retestable without pretending it was never seen.
      when scored.answered = 0 then 'unexplored'
      when scored.evidence_is_stale then 'provisional'
      when scored.answered >= scored.established_answers then 'established'
      when scored.answered >= scored.developing_answers then 'developing'
      when scored.answered >= scored.provisional_answers then 'provisional'
      else 'unexplored'
    end as sufficiency,
    (
      scored.answered > 0
      and not scored.evidence_is_stale
      and coalesce(scored.accuracy, 1.0) <= scored.weak_accuracy
    ) as is_weak,
    dense_rank() over (
      order by scored.is_foundation desc, scored.sequence_order
    )::integer as foundational_rank
  from scored
  where scored.bank_items > 0;
$$;

comment on function public.obs_learner_evidence_ledger(uuid) is
  'One row per learning unit x BLI dimension with evidence volume, quality, '
  'foundational rank, and reread staleness. Read-only; router v6 steps 4-5 '
  'consume it. Cells with no bank items are omitted.';

revoke all on function public.obs_unit_overlaps_reading(integer, integer, integer, integer) from public;
grant execute on function public.obs_unit_overlaps_reading(integer, integer, integer, integer) to authenticated, service_role;

revoke all on function public.obs_unit_antievidence(uuid) from public;
grant execute on function public.obs_unit_antievidence(uuid) to authenticated, service_role;

revoke all on function public.obs_learner_evidence_ledger(uuid) from public;
grant execute on function public.obs_learner_evidence_ledger(uuid) to authenticated, service_role;

commit;
