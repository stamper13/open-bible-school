-- Router performance: cache narrow question facts used by baseline gating.
--
-- The long-run V7 branch replay showed late assessment ranking spending several
-- seconds per question in obs_router_scope_baseline_met(), because that helper
-- expanded obs_question_bank_with_dimensions for every ranker call. This cache
-- stores the exact section/weight inputs the helper needs and keeps live
-- routing behavior unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.obs_router_policy_config') is null
     or to_regprocedure(
       'public.obs_router_scope_baseline_met(uuid,text,timestamptz)'
     ) is null
     or to_regprocedure('public.obs_display_score_from_raw(numeric)') is null
     or to_regclass('public.obs_schema_backups') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Router question facts cache prerequisites are missing; nothing was changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260824202000_router_question_facts_perf_cache',
  'public',
  'obs_router_scope_baseline_met',
  'function',
  pg_get_functiondef(
    'public.obs_router_scope_baseline_met(uuid,text,timestamptz)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260824202000_router_question_facts_perf_cache'
    and backup.object_name = 'obs_router_scope_baseline_met'
);

create table if not exists public.obs_router_question_facts (
  generated_question_id uuid primary key,
  book_code text,
  section_key text,
  dimension_key text,
  baseline_weight numeric not null,
  refreshed_at timestamptz not null default now()
);

alter table public.obs_router_question_facts enable row level security;

revoke all on table public.obs_router_question_facts from public;
revoke all on table public.obs_router_question_facts from anon;
revoke all on table public.obs_router_question_facts from authenticated;
grant select, insert, update, delete on table public.obs_router_question_facts to service_role;

create index if not exists obs_router_question_facts_section_idx
  on public.obs_router_question_facts (section_key, generated_question_id);

create index if not exists obs_router_question_facts_dimension_idx
  on public.obs_router_question_facts (dimension_key, generated_question_id);

create or replace function public.obs_refresh_router_question_facts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refreshed integer;
begin
  truncate table public.obs_router_question_facts;

  insert into public.obs_router_question_facts (
    generated_question_id,
    book_code,
    section_key,
    dimension_key,
    baseline_weight,
    refreshed_at
  )
  select
    question.generated_question_id,
    question.book_code,
    public.canonical_assessment_scope(question.book_code),
    question.dimension_key,
    greatest(
      1,
      coalesce(
        question.importance_conceptual,
        question.routing_score,
        question.importance_context,
        50
      )
    )::numeric,
    now()
  from public.obs_question_bank_with_dimensions question
  where question.generated_question_id is not null;

  get diagnostics v_refreshed = row_count;
  analyze public.obs_router_question_facts;
  return v_refreshed;
end;
$$;

revoke all on function public.obs_refresh_router_question_facts() from public;
revoke all on function public.obs_refresh_router_question_facts() from anon;
revoke all on function public.obs_refresh_router_question_facts() from authenticated;
grant execute on function public.obs_refresh_router_question_facts() to service_role;

do $$
declare
  v_refreshed integer;
begin
  select public.obs_refresh_router_question_facts()
  into v_refreshed;

  if v_refreshed < 1000 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router question facts refresh produced too few rows: %s.',
        v_refreshed
      );
  end if;
end
$$;

create or replace function public.obs_router_scope_baseline_met(
  p_user_id uuid,
  p_scope text,
  p_as_of timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with config as (
    select *
    from public.obs_router_policy_config
    where policy_key = 'OT_GENERAL'
  ),
  ranked as (
    select
      answer.generated_question_id,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      facts.baseline_weight as weight,
      row_number() over (
        partition by answer.generated_question_id
        order by answer.answered_at desc, answer.id desc
      ) as recency_rank
    from public.assessment_answers answer
    join public.obs_router_question_facts facts
      on facts.generated_question_id = answer.generated_question_id
    where answer.user_id = p_user_id
      and answer.scoring_eligible
      and answer.answered_at <= coalesce(p_as_of, now())
      and facts.section_key = upper(p_scope)
  ),
  evidence as (
    select *
    from ranked
    where recency_rank = 1
      and not is_idk
  ),
  score as (
    select
      count(*)::integer as answered,
      sum(weight) as possible,
      sum(weight) filter (where is_correct) as earned
    from evidence
  ),
  display as (
    select
      answered,
      case
        when coalesce(possible, 0) <= 0 then 200
        else public.obs_display_score_from_raw(
          (
            greatest(
              0.0,
              least(
                1.0,
                (
                  coalesce(earned, 0) / possible - 0.25
                ) / 0.75
              )
            ) * 100
          )::numeric
        )
      end as display_score
    from score
  )
  select
    coalesce(display.answered, 0) >= config.advanced_min_answers
    and coalesce(display.display_score, 200) >= config.advanced_min_display_score
  from display
  cross join config;
$$;

comment on table public.obs_router_question_facts is
  'Private cached section/dimension/weight facts for router helper functions. '
  'Refresh with obs_refresh_router_question_facts after question-bank metadata '
  'changes.';

comment on function public.obs_refresh_router_question_facts() is
  'Service-role helper that refreshes the private router question facts cache '
  'from obs_question_bank_with_dimensions.';

comment on function public.obs_router_scope_baseline_met(uuid, text, timestamptz) is
  'Returns whether a learner has enough baseline evidence in an OT section to '
  'unlock advanced dimensions. Uses obs_router_question_facts to avoid expanding '
  'the full question-bank view during every ranker call.';

notify pgrst, 'reload schema';

commit;
