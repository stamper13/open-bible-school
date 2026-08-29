-- Router v6, step 3 of 6: persisted campaign state.
--
-- A campaign is the router's standing thesis about one area of insufficiency,
-- plus the boundary search that sizes it. Persisting it is the whole point of
-- v6: a thesis has to survive across assessments, or the router restarts its
-- reasoning every session and can only ever do breadth.
--
-- Two axes are searched, not one:
--   scope  -- how wide is the weakness? chapter band, then book, then siblings
--   stage  -- how deep does it go? foundation, then core, then detail
-- A campaign closes when both axes are bracketed, or its budget is spent.
--
-- One open campaign per user, enforced by a partial unique index. That single
-- constraint is what stops the router thrashing between theses, and it is the
-- structural reason "keep gathering evidence for this thesis" holds.
--
-- Installs a table and no behavior. Nothing reads this until step 5.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regclass('public.assessment_attempts') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 3 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

create table if not exists public.obs_router_campaign (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,

  -- The targeted cell. unit_key is null when the bank has no unit mapping for
  -- the area, in which case book_code carries the scope. 376 of 1171 OT items
  -- currently lack a unit, so this is a normal case, not a defect.
  unit_key text
    references public.obs_learning_units (unit_key) on delete set null,
  book_code text,
  dimension_key text
    references public.obs_bli_dimensions (dimension_key) on delete set null,

  phase text not null default 'confirm'
    check (phase in (
      'confirm',
      'widen_scope',
      'widen_sibling',
      'bracket_stage',
      'closed'
    )),

  -- Stage window the campaign is currently allowed to ask inside. Foundation
  -- first: a new campaign opens at stage 1 and only ascends once the
  -- foundation of the cell is confirmed present.
  stage_floor integer not null default 1
    check (stage_floor between 1 and 3),
  stage_ceiling integer not null default 1
    check (stage_ceiling between 1 and 3),
  confirmed_pass_stage integer check (confirmed_pass_stage between 1 and 3),
  confirmed_fail_stage integer check (confirmed_fail_stage between 1 and 3),

  -- Budgets are sized from real bank depth at open time, not from a constant:
  -- a typical unit x dimension cell holds only 2-5 items, so a fixed budget
  -- would guarantee starvation and force pointless repeats.
  evidence_budget integer not null default 6 check (evidence_budget > 0),
  items_spent integer not null default 0 check (items_spent >= 0),
  attempts_spanned integer not null default 0 check (attempts_spanned >= 0),

  opened_at timestamptz not null default now(),
  last_advanced_at timestamptz not null default now(),
  opened_by_attempt_id uuid
    references public.assessment_attempts (id) on delete set null,
  closed_at timestamptz,
  closed_reason text
    check (closed_reason is null or closed_reason in (
      'bracketed',
      'budget_spent',
      'bank_exhausted',
      'resolved_strong',
      'superseded_by_reread',
      'stale_abandoned'
    )),

  metadata jsonb not null default '{}'::jsonb,

  constraint obs_router_campaign_scope_ck
    check (unit_key is not null or book_code is not null),
  constraint obs_router_campaign_closed_ck
    check (
      (closed_at is null and closed_reason is null and phase <> 'closed')
      or (closed_at is not null and closed_reason is not null and phase = 'closed')
    ),
  constraint obs_router_campaign_stage_window_ck
    check (stage_ceiling >= stage_floor)
);

-- The structural guarantee that the router pursues one thesis at a time.
create unique index if not exists obs_router_campaign_one_open_per_user
  on public.obs_router_campaign (user_id)
  where closed_at is null;

create index if not exists obs_router_campaign_user_closed_idx
  on public.obs_router_campaign (user_id, closed_at desc nulls first);

create index if not exists obs_router_campaign_cell_idx
  on public.obs_router_campaign (user_id, unit_key, dimension_key, closed_at);

comment on table public.obs_router_campaign is
  'One row per router thesis about an area of insufficiency. At most one open '
  'row per user. Router v6 reads the open row to bias selection and writes '
  'phase transitions from obs_router_sync_campaign.';

comment on column public.obs_router_campaign.phase is
  'confirm: was the entry miss real. widen_scope: is it this chapter band or '
  'the whole book. widen_sibling: is it this book or the section. '
  'bracket_stage: how deep does it go. closed: both axes bracketed or budget '
  'spent.';

alter table public.obs_router_campaign enable row level security;

drop policy if exists obs_router_campaign_select_own on public.obs_router_campaign;
create policy obs_router_campaign_select_own
  on public.obs_router_campaign
  for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go through the SECURITY DEFINER sync function only. No client-side
-- insert or update policy exists, deliberately: a learner must not be able to
-- author or close the router's thesis about their own weaknesses.

revoke all on table public.obs_router_campaign from public;
grant select on table public.obs_router_campaign to authenticated;
grant select, insert, update on table public.obs_router_campaign to service_role;

commit;
