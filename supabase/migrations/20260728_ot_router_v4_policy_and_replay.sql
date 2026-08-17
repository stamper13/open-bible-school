-- OT router v4: one ranked-candidate implementation for production, replay,
-- and shadow comparison.
--
-- Installation is deliberately non-activating. OT_GENERAL remains on V3
-- until the companion verification succeeds and the activation migration is
-- applied. Focused-retest demotion and the advanced-dimension gate are
-- deterministic corrections and become active with this migration.
--
-- Inline shadow selection is installed but disabled by default. One ranking
-- consumes roughly half of the authenticated role's statement timeout on the
-- current free-tier database, so comparisons should use the replay helper
-- until ranking latency is reduced.

begin;

do $$
begin
  if to_regprocedure(
       'public.get_next_assessment_question(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'
     ) is null
     or to_regprocedure(
       'public.obs_general_router_stage(integer,integer,integer)'
     ) is null
     or to_regprocedure(
       'public.obs_general_route_priority(boolean,integer,boolean,integer,boolean,integer,text,integer,integer)'
     ) is null
     or to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_effective_item_irt_a(jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_effective_item_irt_b(jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_payload_number(jsonb,text)'
     ) is null
     or to_regprocedure(
       'public.obs_normalize_distractor_distance(text)'
     ) is null
     or to_regprocedure(
       'public.obs_item_information(double precision,double precision,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_display_score_from_raw(numeric)'
     ) is null
     or to_regprocedure(
       'public.obs_general_dependency_mastery(integer,integer,integer)'
     ) is null
     or to_regprocedure(
       'public.obs_general_question_family_limit(text)'
     ) is null
     or to_regprocedure(
       'public.question_matches_assessment_scope(text,text,text)'
     ) is null
     or to_regprocedure(
       'public.canonical_assessment_scope(text)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.obs_question_bank_with_units') is null
     or to_regclass('public.question_coverage_targets') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regclass('public.obs_biblical_books') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regclass('public.user_abilities') is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router v4 prerequisites are missing; nothing was changed.';
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
  '20260728_ot_router_v4',
  'public',
  object_name,
  'function',
  pg_get_functiondef(signature)
from (
  values
    (
      'get_next_assessment_question',
      'public.get_next_assessment_question(uuid,uuid)'::regprocedure
    ),
    (
      'obs_get_next_focused_question_v2',
      'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
    )
) objects(object_name, signature)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260728_ot_router_v4'
    and backup.object_schema = 'public'
    and backup.object_name = objects.object_name
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups
  where backup_tag = '20260728_ot_router_v4'
    and object_schema = 'public'
    and object_type = 'function'
    and object_name in (
      'get_next_assessment_question',
      'obs_get_next_focused_question_v2'
    );

  if captured <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT router v4 backup failed; expected 2 definitions, found %s.',
        captured
      );
  end if;
end
$$;

create table if not exists public.obs_router_policy_config (
  policy_key text primary key,
  active_version text not null,
  shadow_version text not null,
  shadow_enabled boolean not null default false,
  shadow_sample_every_n integer not null default 5,
  exploration_every_n integer not null default 7,
  theta_lcb_multiplier double precision not null default 0.50,
  process_variance_per_day double precision not null default 0.0005,
  minimum_ability_responses integer not null default 3,
  advanced_min_answers integer not null default 3,
  advanced_min_display_score integer not null default 513,
  updated_at timestamptz not null default now(),
  constraint obs_router_policy_version_ck
    check (
      active_version in ('V3', 'V4')
      and shadow_version in ('V3', 'V4')
      and active_version <> shadow_version
    ),
  constraint obs_router_policy_positive_ck
    check (
      shadow_sample_every_n >= 0
      and exploration_every_n >= 0
      and theta_lcb_multiplier between 0 and 2
      and process_variance_per_day between 0 and 0.02
      and minimum_ability_responses >= 1
      and advanced_min_answers >= 1
      and advanced_min_display_score between 200 and 800
    )
);

alter table public.obs_router_policy_config enable row level security;

insert into public.obs_router_policy_config (
  policy_key,
  active_version,
  shadow_version,
  shadow_enabled,
  shadow_sample_every_n,
  exploration_every_n,
  theta_lcb_multiplier,
  process_variance_per_day,
  minimum_ability_responses,
  advanced_min_answers,
  advanced_min_display_score
)
values (
  'OT_GENERAL',
  'V3',
  'V4',
  false,
  5,
  7,
  0.50,
  0.0005,
  3,
  3,
  513
)
on conflict (policy_key) do nothing;

create table if not exists public.obs_router_shadow_log (
  id bigint generated always as identity primary key,
  attempt_id uuid not null
    references public.assessment_attempts(id) on delete cascade,
  user_id uuid not null,
  answer_count integer not null,
  active_version text not null,
  shadow_version text not null,
  active_question_id uuid,
  shadow_question_id uuid,
  active_book_code text,
  shadow_book_code text,
  active_stage integer,
  shadow_stage integer,
  active_target_theta double precision,
  shadow_target_theta double precision,
  active_lane text,
  shadow_lane text,
  same_question boolean generated always as (
    active_question_id is not distinct from shadow_question_id
  ) stored,
  created_at timestamptz not null default now(),
  unique (
    attempt_id,
    answer_count,
    active_version,
    shadow_version
  )
);

alter table public.obs_router_shadow_log enable row level security;

create index if not exists obs_router_shadow_log_created_idx
  on public.obs_router_shadow_log(created_at desc);

create or replace function public.obs_router_stage_from_theta(
  p_theta double precision,
  p_fallback_stage integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when p_theta is null
      then greatest(1, least(3, coalesce(p_fallback_stage, 1)))
    when p_theta < -0.50 then 1
    when p_theta < 0.45 then 2
    else 3
  end;
$$;

create or replace function public.obs_router_adjusted_theta(
  p_section_theta double precision,
  p_section_se double precision,
  p_section_responses integer,
  p_section_updated_at timestamptz,
  p_ot_theta double precision,
  p_ot_se double precision,
  p_ot_responses integer,
  p_ot_updated_at timestamptz,
  p_fallback_stage integer,
  p_as_of timestamptz
)
returns table (
  target_theta double precision,
  effective_se double precision,
  theta_source text
)
language sql
stable
parallel safe
set search_path = public
as $$
  with config as (
    select *
    from public.obs_router_policy_config
    where policy_key = 'OT_GENERAL'
  ),
  chosen as (
    select
      case
        when coalesce(p_section_responses, 0)
          >= config.minimum_ability_responses
          then p_section_theta
        when coalesce(p_ot_responses, 0)
          >= config.minimum_ability_responses
          then p_ot_theta
        else null
      end as theta,
      case
        when coalesce(p_section_responses, 0)
          >= config.minimum_ability_responses
          then p_section_se
        when coalesce(p_ot_responses, 0)
          >= config.minimum_ability_responses
          then p_ot_se
        else null
      end as theta_se,
      case
        when coalesce(p_section_responses, 0)
          >= config.minimum_ability_responses
          then p_section_updated_at
        when coalesce(p_ot_responses, 0)
          >= config.minimum_ability_responses
          then p_ot_updated_at
        else null
      end as ability_updated_at,
      case
        when coalesce(p_section_responses, 0)
          >= config.minimum_ability_responses
          then 'SECTION'
        when coalesce(p_ot_responses, 0)
          >= config.minimum_ability_responses
          then 'OT'
        else 'SESSION_FALLBACK'
      end as source,
      config.*
    from config
  ),
  adjusted as (
    select
      chosen.*,
      case
        when theta is null then null
        else sqrt(
          power(greatest(0.05, coalesce(theta_se, 1.0)), 2)
          + process_variance_per_day
            * greatest(
                0.0,
                extract(
                  epoch from (
                    coalesce(p_as_of, now())
                    - coalesce(
                        ability_updated_at,
                        coalesce(p_as_of, now())
                      )
                  )
                ) / 86400.0
              )
        )
      end as stale_se
    from chosen
  )
  select
    case
      when theta is null then
        case greatest(1, least(3, coalesce(p_fallback_stage, 1)))
          when 1 then -1.0::double precision
          when 2 then 0.0::double precision
          else 0.9::double precision
        end
      else greatest(
        -4.0,
        least(4.0, theta - theta_lcb_multiplier * stale_se)
      )
    end,
    stale_se,
    source
  from adjusted;
$$;

create or replace function public.obs_router_information_reliability(
  p_payload jsonb,
  p_event_irt_a double precision,
  p_event_irt_b double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when public.obs_normalize_distractor_distance(
      p_payload->>'distractor_distance'
    ) is not null
      then 1.00
    when public.obs_payload_number(p_payload, 'irt_a') is not null
      and public.obs_payload_number(p_payload, 'irt_b') is not null
      then 0.65
    when p_event_irt_a is not null and p_event_irt_b is not null
      then 0.35
    when public.obs_payload_number(p_payload, 'irt_b') is not null
      then 0.30
    else 0.15
  end;
$$;

create or replace function public.obs_router_confirmation_stage(
  p_question_family text,
  p_answer_stage integer,
  p_is_correct boolean,
  p_is_idk boolean,
  p_previous_same_book_miss boolean
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_previous_same_book_miss, false)
      and not coalesce(p_is_correct, false)
      then null
    when lower(coalesce(p_question_family, '')) = 'book_orientation'
      and coalesce(p_is_correct, false)
      and not coalesce(p_is_idk, false)
      then 2
    when lower(coalesce(p_question_family, '')) = 'book_orientation'
      then 1
    when not coalesce(p_is_correct, false)
      or coalesce(p_is_idk, false)
      then greatest(1, coalesce(p_answer_stage, 1) - 1)
    else null
  end;
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
      greatest(
        1,
        coalesce(
          question.importance_conceptual,
          question.routing_score,
          question.importance_context,
          50
        )
      )::numeric as weight,
      row_number() over (
        partition by answer.generated_question_id
        order by answer.answered_at desc, answer.id desc
      ) as recency_rank
    from public.assessment_answers answer
    join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
    where answer.user_id = p_user_id
      and answer.scoring_eligible
      and answer.answered_at <= coalesce(p_as_of, now())
      and public.canonical_assessment_scope(question.book_code)
        = upper(p_scope)
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
    display.answered >= config.advanced_min_answers
    and display.display_score >= config.advanced_min_display_score
  from display
  cross join config;
$$;

create or replace function public.obs_advanced_dimension_unlocked(
  p_user_id uuid,
  p_as_of timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.obs_router_scope_baseline_met(p_user_id, 'TORAH', p_as_of)
    and public.obs_router_scope_baseline_met(
      p_user_id,
      'FORMER',
      p_as_of
    );
$$;

create or replace function public.obs_general_route_priority_v4(
  p_pending_book_code text,
  p_pending_stage integer,
  p_candidate_book_code text,
  p_orientation_answered integer,
  p_orientation_correct boolean,
  p_core_correct integer,
  p_historically_confirmed boolean,
  p_question_family text,
  p_candidate_stage integer,
  p_target_stage integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when p_pending_book_code is not null then
      case
        when p_candidate_book_code = p_pending_book_code
          and p_candidate_stage = p_pending_stage
          then -2
        when p_candidate_book_code = p_pending_book_code
          and p_candidate_stage < p_pending_stage
          then -1
        when p_candidate_book_code <> p_pending_book_code
          and lower(coalesce(p_question_family, ''))
            = 'book_orientation'
          then 0
        else 3
      end
    when coalesce(p_orientation_answered, 0) = 0
      and not coalesce(p_historically_confirmed, false)
      then case
        when lower(coalesce(p_question_family, ''))
          = 'book_orientation'
          then 0
        else 3
      end
    when coalesce(p_orientation_correct, false)
      and coalesce(p_core_correct, 0) = 0
      then case
        when lower(coalesce(p_question_family, ''))
            <> 'book_orientation'
          and p_candidate_stage = 2
          then 0
        else 3
      end
    when (
      coalesce(p_orientation_correct, false)
      or coalesce(p_historically_confirmed, false)
    )
      and coalesce(p_core_correct, 0) > 0
      and coalesce(p_target_stage, 1) >= 3
      and p_candidate_stage = 3
      then 1
    when coalesce(p_orientation_answered, 0) > 0
      and not coalesce(p_orientation_correct, false)
      and p_candidate_stage = 1
      then 1
    when coalesce(p_historically_confirmed, false)
      and p_candidate_stage = coalesce(p_target_stage, 1)
      then 1
    else 3
  end;
$$;

create or replace function public.obs_rank_ot_assessment_candidates_v4(
  p_attempt_id uuid,
  p_user_id uuid,
  p_policy text default 'V4',
  p_answer_limit integer default null,
  p_as_of timestamptz default now(),
  p_limit integer default 25
)
returns table (
  candidate_rank bigint,
  generated_question_id uuid,
  prompt text,
  question_type text,
  payload jsonb,
  event_title text,
  book_code text,
  section text,
  importance_tier integer,
  dimension_key text,
  question_family text,
  candidate_stage integer,
  target_stage integer,
  target_theta double precision,
  theta_se double precision,
  theta_source text,
  route_priority integer,
  selection_lane text,
  information_score double precision,
  information_reliability double precision,
  calibration_responses integer,
  adaptive_score double precision,
  times_answered integer
)
language sql
stable
security definer
set search_path = public
as $$
  with policy as (
    select case upper(coalesce(p_policy, 'V4'))
      when 'V3' then 'V3'
      else 'V4'
    end as version
  ),
  config as (
    select *
    from public.obs_router_policy_config
    where policy_key = 'OT_GENERAL'
  ),
  authorized_attempt as (
    select
      attempt.id,
      upper(coalesce(attempt.testament, 'OT')) as testament,
      upper(coalesce(attempt.scope_key, 'OT')) as scope_key
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
  ),
  attempt_answers_ordered as (
    select
      answer.id,
      answer.generated_question_id,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      answer.answered_at,
      question.book_code,
      question.dimension_key,
      question.question_type,
      question.payload,
      nullif(question.payload->>'stem_family', '') as stem_family,
      nullif(
        lower(btrim(question.payload->>'question_family')),
        ''
      ) as question_family,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as answer_stage,
      row_number() over (
        order by answer.answered_at, answer.id
      )::integer as answer_order
    from authorized_attempt attempt
    join public.assessment_answers answer
      on answer.attempt_id = attempt.id
     and answer.user_id = p_user_id
    left join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    where answer.answered_at <= coalesce(p_as_of, now())
  ),
  answer_history_base as (
    select *
    from attempt_answers_ordered
    where p_answer_limit is null
       or answer_order <= greatest(0, p_answer_limit)
  ),
  answer_history as (
    select
      history.*,
      row_number() over (
        order by history.answered_at desc, history.id desc
      )::integer as recency_rank,
      row_number() over (
        partition by history.book_code
        order by history.answered_at desc, history.id desc
      )::integer as book_recency_rank
    from answer_history_base history
  ),
  historical_ranked as (
    select
      answer.id,
      answer.generated_question_id,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      resolved.book_code,
      public.canonical_assessment_scope(resolved.book_code)
        as canonical_scope,
      row_number() over (
        partition by answer.generated_question_id
        order by answer.answered_at desc, answer.id desc
      ) as question_rank
    from public.assessment_answers answer
    join public.ot_generated_questions question
      on question.id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    cross join lateral (
      select upper(coalesce(
        event.book_code,
        question.payload->>'book_code'
      )) as book_code
    ) resolved
    where answer.user_id = p_user_id
      and answer.scoring_eligible
      and answer.answered_at <= coalesce(p_as_of, now())
      and (
        answer.attempt_id <> p_attempt_id
        or exists (
          select 1
          from answer_history included
          where included.id = answer.id
        )
      )
      and resolved.book_code is not null
  ),
  historical_evidence as (
    select
      generated_question_id,
      is_correct,
      is_idk,
      book_code,
      canonical_scope
    from historical_ranked
    where question_rank = 1
  ),
  historical_books as (
    select
      book_code,
      count(*)::integer as answered,
      count(*) filter (
        where is_correct and not is_idk
      )::integer as correct
    from historical_evidence
    group by book_code
  ),
  dependency_counts as (
    select
      count(*) filter (
        where canonical_scope = 'FORMER'
      )::integer as former_answered,
      count(*) filter (
        where canonical_scope = 'FORMER'
          and is_correct and not is_idk
      )::integer as former_correct,
      count(distinct book_code) filter (
        where canonical_scope = 'FORMER'
          and is_correct and not is_idk
      )::integer as former_books,
      count(*) filter (
        where canonical_scope = 'FORMER'
           or book_code in ('1CH', '2CH', 'EZR', 'NEH')
      )::integer as spine_answered,
      count(*) filter (
        where (
          canonical_scope = 'FORMER'
          or book_code in ('1CH', '2CH', 'EZR', 'NEH')
        )
          and is_correct and not is_idk
      )::integer as spine_correct,
      count(distinct book_code) filter (
        where (
          canonical_scope = 'FORMER'
          or book_code in ('1CH', '2CH', 'EZR', 'NEH')
        )
          and is_correct and not is_idk
      )::integer as spine_books,
      count(*) filter (
        where book_code in ('1CH', '2CH', 'EZR', 'NEH')
          and is_correct and not is_idk
      )::integer as bridge_correct,
      count(distinct book_code) filter (
        where book_code in ('1CH', '2CH', 'EZR', 'NEH')
          and is_correct and not is_idk
      )::integer as bridge_books,
      count(*) filter (
        where canonical_scope = 'LATTER'
      )::integer as latter_answered,
      count(*) filter (
        where canonical_scope = 'LATTER'
          and is_correct and not is_idk
      )::integer as latter_correct,
      count(distinct book_code) filter (
        where canonical_scope = 'LATTER'
          and is_correct and not is_idk
      )::integer as latter_books
    from historical_evidence
  ),
  dependency_state as (
    select
      public.obs_general_dependency_mastery(
        former_answered,
        former_correct,
        former_books
      ) as former_mastery,
      (
        public.obs_general_dependency_mastery(
          spine_answered,
          spine_correct,
          spine_books
        )
        and bridge_correct >= 2
        and bridge_books >= 1
      ) as spine_mastery,
      public.obs_general_dependency_mastery(
        latter_answered,
        latter_correct,
        latter_books
      ) as latter_mastery
    from dependency_counts
  ),
  session_stats as (
    select
      count(*)::integer as answered_total,
      count(*) filter (
        where recency_rank <= 5
      )::integer as recent_total,
      count(*) filter (
        where recency_rank <= 5
          and is_correct
          and not is_idk
      )::integer as recent_correct,
      count(*) filter (
        where question_type = 'sequence_order_v1'
      )::integer as sequence_answered
    from answer_history
  ),
  router_state as (
    select
      stats.*,
      public.obs_general_router_stage(
        stats.answered_total,
        stats.recent_total,
        stats.recent_correct
      ) as legacy_target_stage
    from session_stats stats
  ),
  book_progress as (
    select
      history.book_code,
      count(*)::integer as book_answered,
      count(*) filter (
        where history.question_family = 'book_orientation'
      )::integer as orientation_answered,
      coalesce(
        bool_or(
          history.is_correct and not history.is_idk
        ) filter (
          where history.question_family = 'book_orientation'
        ),
        false
      ) as orientation_correct,
      count(*) filter (
        where coalesce(history.question_family, '')
          <> 'book_orientation'
      )::integer as followup_answered,
      coalesce(
        bool_or(
          history.is_correct and not history.is_idk
        ) filter (
          where coalesce(history.question_family, '')
            <> 'book_orientation'
        ),
        false
      ) as followup_correct,
      count(*) filter (
        where history.answer_stage = 2
          and history.is_correct
          and not history.is_idk
      )::integer as core_correct,
      max(
        greatest(1, coalesce(history.answer_stage, 1) - 1)
      ) filter (
        where history.book_recency_rank = 1
          and (
            not coalesce(history.is_correct, false)
            or history.is_idk
          )
      )::integer as recovery_stage
    from answer_history history
    where history.book_code is not null
    group by history.book_code
  ),
  latest_answer as (
    select *
    from answer_history
    where recency_rank = 1
  ),
  previous_answer as (
    select *
    from answer_history
    where recency_rank = 2
  ),
  confirmation as (
    select
      latest.book_code,
      (
        previous.book_code = latest.book_code
        and (
          not coalesce(previous.is_correct, false)
          or coalesce(previous.is_idk, false)
        )
        and (
          not coalesce(latest.is_correct, false)
          or coalesce(latest.is_idk, false)
        )
      ) as back_to_back_miss,
      public.obs_router_confirmation_stage(
        latest.question_family,
        latest.answer_stage,
        latest.is_correct,
        latest.is_idk,
        previous.book_code = latest.book_code
          and (
            not coalesce(previous.is_correct, false)
            or coalesce(previous.is_idk, false)
          )
      ) as desired_stage
    from latest_answer latest
    left join previous_answer previous on true
  ),
  answered_families as (
    select
      question_family,
      count(*)::integer as family_answered
    from answer_history
    where question_family is not null
    group by question_family
  ),
  observed_by_dimension as (
    select
      dimension_key,
      count(*)::double precision as answered
    from answer_history
    where dimension_key is not null
    group by dimension_key
  ),
  observed_total as (
    select count(*)::double precision as answered
    from answer_history
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    where answer.user_id = p_user_id
      and answer.generated_question_id is not null
      and answer.answered_at <= coalesce(p_as_of, now())
      and (
        answer.attempt_id <> p_attempt_id
        or exists (
          select 1
          from answer_history included
          where included.id = answer.id
        )
      )
    group by answer.generated_question_id
  ),
  calibration_history as (
    select
      answer.generated_question_id,
      count(*) filter (
        where answer.scoring_eligible
          and not coalesce(answer.is_idk, false)
      )::integer as calibration_responses
    from public.assessment_answers answer
    where answer.generated_question_id is not null
      and answer.answered_at <= coalesce(p_as_of, now())
    group by answer.generated_question_id
  ),
  advanced_state as (
    select public.obs_advanced_dimension_unlocked(
      p_user_id,
      coalesce(p_as_of, now())
    ) as unlocked
  ),
  eligible_targets as (
    select
      target.book_code,
      target.dimension_key,
      target.target_active_questions::double precision
    from public.question_coverage_targets target
    join public.obs_bli_dimensions dimension
      on dimension.dimension_key = target.dimension_key
    cross join authorized_attempt attempt
    cross join policy
    cross join advanced_state advanced
    where target.target_active_questions > 0
      and public.question_matches_assessment_scope(
        target.book_code,
        attempt.testament,
        attempt.scope_key
      )
      and (
        policy.version = 'V3'
        or not dimension.is_advanced
        or advanced.unlocked
      )
  ),
  target_profiles as (
    select
      target.dimension_key,
      sum(target.target_active_questions)
        / nullif(sum(sum(target.target_active_questions)) over (), 0)
          as target_share
    from eligible_targets target
    group by target.dimension_key
  ),
  raw_candidates as (
    select
      question.generated_question_id,
      question.question_type,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.payload,
      question.book_code,
      question.created_at,
      question.routing_score,
      question.importance_conceptual,
      question.importance_context,
      question.dimension_key,
      coalesce(
        event.event_title,
        question.book_code || ' question'
      ) as resolved_event_title,
      nullif(question.payload->>'stem_family', '') as stem_family,
      nullif(
        lower(btrim(question.payload->>'question_family')),
        ''
      ) as question_family,
      public.obs_effective_item_irt_a(
        question.payload,
        event.irt_a::double precision
      ) as effective_a,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      ) as effective_b,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as candidate_stage,
      public.obs_router_information_reliability(
        question.payload,
        event.irt_a::double precision,
        event.irt_b::double precision
      ) as information_reliability,
      state.*,
      case
        when public.canonical_assessment_scope(question.book_code)
            = 'TORAH'
          and (
            dependencies.former_mastery
            or dependencies.spine_mastery
            or dependencies.latter_mastery
          )
          then 2
        when (
          public.canonical_assessment_scope(question.book_code)
            = 'FORMER'
          or question.book_code in ('1CH', '2CH', 'EZR', 'NEH')
        )
          and dependencies.latter_mastery
          then 2
        else 1
      end::integer as legacy_dependency_floor,
      coalesce(profile.target_share, 0.0) as target_share,
      coalesce(
        observed.answered / nullif(total.answered, 0),
        0.0
      ) as observed_share,
      coalesce(family.family_answered, 0) as family_answered,
      coalesce(progress.book_answered, 0) as book_answered,
      coalesce(progress.orientation_answered, 0)
        as orientation_answered,
      coalesce(progress.orientation_correct, false)
        as orientation_correct,
      coalesce(progress.followup_answered, 0)
        as followup_answered,
      coalesce(progress.followup_correct, false)
        as followup_correct,
      coalesce(progress.core_correct, 0) as core_correct,
      progress.recovery_stage,
      (
        coalesce(historical_book.answered, 0) >= 3
        and coalesce(historical_book.correct, 0) * 3
          >= coalesce(historical_book.answered, 0) * 2
      ) as historically_confirmed,
      case
        when confirmation.desired_stage is not null
          then confirmation.book_code
        else null
      end as pending_book_code,
      confirmation.desired_stage as pending_stage,
      confirmation.book_code as latest_book_code,
      coalesce(confirmation.back_to_back_miss, false)
        as back_to_back_miss,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      coalesce(calibration.calibration_responses, 0)
        as calibration_responses,
      least(
        1.0,
        greatest(
          0.0,
          case
            when question.importance_conceptual is not null
              or question.importance_context is not null
              then (
                0.70 * coalesce(question.importance_conceptual, 0)
                + 0.30 * coalesce(question.importance_context, 0)
              ) / 100.0
            else coalesce(question.routing_score / 100.0, 0.50)
          end
        )
      ) as importance_score,
      section_ability.theta as section_theta,
      section_ability.theta_se as section_se,
      section_ability.n_responses as section_responses,
      section_ability.updated_at as section_updated_at,
      ot_ability.theta as ot_theta,
      ot_ability.theta_se as ot_se,
      ot_ability.n_responses as ot_responses,
      ot_ability.updated_at as ot_updated_at
    from authorized_attempt attempt
    join public.obs_question_bank_with_dimensions question
      on public.question_matches_assessment_scope(
        question.book_code,
        attempt.testament,
        attempt.scope_key
      )
    join public.obs_biblical_books candidate_book
      on candidate_book.book_code = question.book_code
    join public.obs_bli_dimensions candidate_dimension
      on candidate_dimension.dimension_key = question.dimension_key
    join eligible_targets candidate_target
      on candidate_target.book_code = question.book_code
     and candidate_target.dimension_key = question.dimension_key
    left join public.bible_events event
      on event.id = question.event_id
    cross join router_state state
    cross join dependency_state dependencies
    left join target_profiles profile
      on profile.dimension_key = question.dimension_key
    left join observed_by_dimension observed
      on observed.dimension_key = question.dimension_key
    cross join observed_total total
    left join answered_families family
      on family.question_family = nullif(
        lower(btrim(question.payload->>'question_family')),
        ''
      )
    left join book_progress progress
      on progress.book_code = question.book_code
    left join historical_books historical_book
      on historical_book.book_code = question.book_code
    left join confirmation on true
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    left join calibration_history calibration
      on calibration.generated_question_id
        = question.generated_question_id
    left join public.user_abilities section_ability
      on section_ability.user_id = p_user_id
     and section_ability.scope
       = public.canonical_assessment_scope(question.book_code)
    left join public.user_abilities ot_ability
      on ot_ability.user_id = p_user_id
     and ot_ability.scope = 'OT'
    where question.generated_question_id is not null
      and coalesce(question.payload->>'prompt', question.prompt) is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        (
          question.question_type = 'sequence_order_v1'
          and jsonb_array_length(question.payload->'choices')
            between 3 and 5
          and jsonb_typeof(question.payload->'correct_order') = 'array'
          and jsonb_array_length(question.payload->'correct_order')
            = jsonb_array_length(question.payload->'choices')
        )
        or (
          question.question_type <> 'sequence_order_v1'
          and jsonb_array_length(question.payload->'choices') = 4
          and coalesce(
            question.payload->>'correct_choice_id',
            question.payload->>'answer_id',
            question.payload->>'correctAnswerId'
          ) is not null
          and exists (
            select 1
            from jsonb_array_elements(
              question.payload->'choices'
            ) choice
            where choice->>'id' = coalesce(
              question.payload->>'correct_choice_id',
              question.payload->>'answer_id',
              question.payload->>'correctAnswerId'
            )
          )
        )
      )
      and not exists (
        select 1
        from answer_history used
        where used.generated_question_id
          = question.generated_question_id
      )
      and not exists (
        select 1
        from answer_history used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family
            = nullif(question.payload->>'stem_family', '')
      )
  ),
  candidate_targets as (
    select
      candidate.*,
      policy.version as policy_version,
      config.exploration_every_n,
      greatest(
        candidate.legacy_target_stage,
        candidate.legacy_dependency_floor
      ) as v3_target_stage,
      theta.target_theta as v4_target_theta,
      theta.effective_se as v4_theta_se,
      theta.theta_source as v4_theta_source,
      public.obs_router_stage_from_theta(
        theta.target_theta,
        candidate.legacy_target_stage
      ) as v4_target_stage
    from raw_candidates candidate
    cross join policy
    cross join config
    cross join lateral public.obs_router_adjusted_theta(
      candidate.section_theta,
      candidate.section_se,
      candidate.section_responses,
      candidate.section_updated_at,
      candidate.ot_theta,
      candidate.ot_se,
      candidate.ot_responses,
      candidate.ot_updated_at,
      candidate.legacy_target_stage,
      coalesce(p_as_of, now())
    ) theta
  ),
  eligible_candidates as (
    select
      candidate.*,
      case
        when candidate.policy_version = 'V3'
          then candidate.v3_target_stage
        else candidate.v4_target_stage
      end as effective_target_stage,
      case
        when candidate.policy_version = 'V3' then
          case candidate.v3_target_stage
            when 1 then -1.0::double precision
            when 2 then 0.0::double precision
            else 0.9::double precision
          end
        else candidate.v4_target_theta
      end as effective_target_theta,
      case
        when candidate.policy_version = 'V3'
          then null::double precision
        else candidate.v4_theta_se
      end as effective_theta_se,
      case
        when candidate.policy_version = 'V3'
          then 'SESSION_STAGE'
        else candidate.v4_theta_source
      end as effective_theta_source,
      case
        when candidate.policy_version = 'V4'
          and candidate.exploration_every_n > 0
          and mod(
            candidate.answered_total + 1,
            candidate.exploration_every_n
          ) = 0
          then 'EXPLORE'
        else 'EXPLOIT'
      end as selection_lane
    from candidate_targets candidate
    where candidate.question_family is null
       or public.obs_general_question_family_limit(
            candidate.question_family
          ) is null
       or candidate.family_answered
          < public.obs_general_question_family_limit(
              candidate.question_family
            )
  ),
  scored as (
    select
      candidate.*,
      case
        when candidate.policy_version = 'V3' then
          public.obs_general_route_priority(
            exists (
              select 1
              from book_progress pending
              where pending.orientation_correct
                and pending.followup_answered = 0
            ),
            candidate.orientation_answered,
            candidate.orientation_correct,
            candidate.followup_answered,
            candidate.followup_correct,
            candidate.legacy_dependency_floor,
            candidate.question_family,
            candidate.candidate_stage,
            candidate.v3_target_stage
          )
        else
          case
            when candidate.pending_book_code is not null then
              public.obs_general_route_priority_v4(
                candidate.pending_book_code,
                candidate.pending_stage,
                candidate.book_code,
                candidate.orientation_answered,
                candidate.orientation_correct,
                candidate.core_correct,
                candidate.historically_confirmed,
                candidate.question_family,
                candidate.candidate_stage,
                candidate.v4_target_stage
              )
            when candidate.recovery_stage is not null then
              case
                when candidate.candidate_stage
                    = candidate.recovery_stage
                  and candidate.book_code
                    = candidate.latest_book_code
                  and candidate.back_to_back_miss
                  then 2
                when candidate.candidate_stage
                    = candidate.recovery_stage
                  then 0
                when abs(
                  candidate.candidate_stage
                  - candidate.recovery_stage
                ) = 1
                  then 1
                else 3
              end
            else
              public.obs_general_route_priority_v4(
                null,
                null,
                candidate.book_code,
                candidate.orientation_answered,
                candidate.orientation_correct,
                candidate.core_correct,
                candidate.historically_confirmed,
                candidate.question_family,
                candidate.candidate_stage,
                candidate.v4_target_stage
              )
          end
      end as route_priority,
      greatest(
        0.0,
        candidate.target_share - candidate.observed_share
      ) as dimension_need,
      public.obs_item_information(
        candidate.effective_target_theta,
        candidate.effective_a,
        candidate.effective_b
      ) as information_score,
      1.0 / (1.0 + candidate.book_answered)
        as book_novelty_score,
      1.0 / (1.0 + candidate.family_answered)
        as family_novelty_score,
      1.0 / (1.0 + candidate.times_answered)
        as exposure_score,
      1.0 / (1.0 + candidate.calibration_responses / 8.0)
        as calibration_need,
      1.0 / (
        1.0 + abs(
          candidate.candidate_stage
          - candidate.effective_target_stage
        )
      ) as stage_fit
    from eligible_candidates candidate
  ),
  weighted as (
    select
      scored.*,
      case
        when policy_version = 'V3' then
          0.30 * dimension_need
          + 0.25 * information_score
          + 0.20 * importance_score
          + 0.10 * book_novelty_score
          + 0.10 * family_novelty_score
          + 0.05 * exposure_score
        when selection_lane = 'EXPLORE' then
          0.45 * calibration_need
          + 0.20 * dimension_need
          + 0.15 * importance_score
          + 0.10 * book_novelty_score
          + 0.10 * stage_fit
        else
          0.22 * dimension_need
          + 0.25 * information_score * information_reliability
          + 0.18 * importance_score
          + 0.10 * book_novelty_score
          + 0.08 * family_novelty_score
          + 0.05 * exposure_score
          + 0.12 * stage_fit
      end as adaptive_score
    from scored
  ),
  ranked as (
    select
      weighted.*,
      row_number() over (
        order by
          route_priority,
          case
            when sequence_answered = 0
              and answered_total >= 4
              and question_type = 'sequence_order_v1'
              and candidate_stage = effective_target_stage
              then 0
            else 1
          end,
          case
            when policy_version = 'V3'
              then abs(candidate_stage - effective_target_stage)
            else 0
          end,
          case
            when policy_version = 'V4'
              and selection_lane = 'EXPLORE'
              then calibration_need
            else 0
          end desc,
          adaptive_score desc,
          times_answered,
          last_answered_at nulls first,
          md5(p_attempt_id::text || ':' || generated_question_id::text)
      ) as resolved_rank
    from weighted
  )
  select
    ranked.resolved_rank,
    ranked.generated_question_id,
    ranked.prompt,
    ranked.question_type,
    ranked.payload,
    ranked.resolved_event_title,
    ranked.book_code,
    case public.canonical_assessment_scope(ranked.book_code)
      when 'TORAH' then 'Torah'
      when 'FORMER' then 'Former Prophets'
      when 'LATTER' then 'Latter Prophets'
      when 'WRITINGS' then 'Writings'
      else 'Old Testament'
    end,
    case
      when coalesce(
        ranked.importance_conceptual,
        ranked.routing_score,
        0
      ) >= 80 then 1
      when coalesce(
        ranked.importance_conceptual,
        ranked.routing_score,
        0
      ) >= 60 then 2
      else 3
    end,
    ranked.dimension_key,
    ranked.question_family,
    ranked.candidate_stage,
    ranked.effective_target_stage,
    ranked.effective_target_theta,
    ranked.effective_theta_se,
    ranked.effective_theta_source,
    ranked.route_priority,
    ranked.selection_lane,
    ranked.information_score,
    ranked.information_reliability,
    ranked.calibration_responses,
    ranked.adaptive_score,
    ranked.times_answered
  from ranked
  where ranked.resolved_rank
    <= greatest(1, least(coalesce(p_limit, 25), 200))
  order by ranked.resolved_rank;
$$;

create or replace function public.obs_replay_ot_router_attempt(
  p_attempt_id uuid
)
returns table (
  prefix_answers integer,
  actual_next_question_id uuid,
  v3_question_id uuid,
  v4_question_id uuid,
  v3_book_code text,
  v4_book_code text,
  v3_stage integer,
  v4_stage integer,
  v4_target_theta double precision,
  v4_theta_source text,
  v4_lane text,
  v3_v4_same boolean,
  v4_matches_actual boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  attempt_row record;
  prefix integer;
  prefix_as_of timestamptz;
  actual_row record;
  v3_row record;
  v4_row record;
begin
  select attempt.*
  into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and upper(coalesce(attempt.testament, 'OT')) = 'OT';

  if not found then
    return;
  end if;

  if coalesce(attempt_row.answered_count, 0) <= 0 then
    return;
  end if;

  for prefix in 0..greatest(0, attempt_row.answered_count - 1)
  loop
    select
      answer.generated_question_id,
      answer.answered_at
    into actual_row
    from public.assessment_answers answer
    where answer.attempt_id = p_attempt_id
      and answer.user_id = attempt_row.user_id
    order by answer.answered_at, answer.id
    offset prefix
    limit 1;

    if prefix = 0 then
      prefix_as_of := attempt_row.created_at;
    else
      select answer.answered_at
      into prefix_as_of
      from public.assessment_answers answer
      where answer.attempt_id = p_attempt_id
        and answer.user_id = attempt_row.user_id
      order by answer.answered_at, answer.id
      offset prefix - 1
      limit 1;
    end if;

    select *
    into v3_row
    from public.obs_rank_ot_assessment_candidates_v4(
      p_attempt_id,
      attempt_row.user_id,
      'V3',
      prefix,
      prefix_as_of,
      1
    );

    select *
    into v4_row
    from public.obs_rank_ot_assessment_candidates_v4(
      p_attempt_id,
      attempt_row.user_id,
      'V4',
      prefix,
      prefix_as_of,
      1
    );

    prefix_answers := prefix;
    actual_next_question_id := actual_row.generated_question_id;
    v3_question_id := v3_row.generated_question_id;
    v4_question_id := v4_row.generated_question_id;
    v3_book_code := v3_row.book_code;
    v4_book_code := v4_row.book_code;
    v3_stage := v3_row.candidate_stage;
    v4_stage := v4_row.candidate_stage;
    v4_target_theta := v4_row.target_theta;
    v4_theta_source := v4_row.theta_source;
    v4_lane := v4_row.selection_lane;
    v3_v4_same := v3_row.generated_question_id
      is not distinct from v4_row.generated_question_id;
    v4_matches_actual := actual_row.generated_question_id
      is not distinct from v4_row.generated_question_id;
    return next;
  end loop;
end;
$$;

create or replace function public.obs_get_next_focused_question_v2(
  p_user_id uuid,
  p_attempt_id uuid,
  p_unit_key text default null,
  p_book_code text default null,
  p_start_chapter integer default null,
  p_end_chapter integer default null,
  p_dimension_key text default null
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where auth.uid() = p_user_id
  ),
  advanced_state as (
    select public.obs_advanced_dimension_unlocked(
      p_user_id,
      now()
    ) as unlocked
  ),
  target as (
    select
      unit.*,
      dimension.short_label as dimension_short_label,
      coalesce(dimension.is_advanced, false) as dimension_is_advanced
    from public.obs_learning_units unit
    join authorized on true
    left join public.obs_bli_dimensions dimension
      on dimension.dimension_key
        = public.obs_normalize_dimension_key(p_dimension_key)
    where (
      p_unit_key is not null
      and unit.unit_key = p_unit_key
    )
      or (
        p_unit_key is null
        and p_book_code is not null
        and unit.book_code = upper(p_book_code)
        and unit.start_chapter = p_start_chapter
        and unit.end_chapter = p_end_chapter
      )
    order by unit.sequence_order
    limit 1
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    where answer.user_id = p_user_id
      and answer.generated_question_id is not null
    group by answer.generated_question_id
  ),
  candidate_base as (
    select
      question.*,
      case
        when target.dimension_short_label is null
          then coalesce(
            target.label,
            question.unit_label,
            question.book_code || ' focused retest'
          )
        else target.dimension_short_label || ' in ' || target.label
      end as target_label,
      coalesce(
        target.section,
        question.unit_section,
        'Old Testament'
      ) as target_section,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as difficulty_stage,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      ) as effective_irt_b,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      exists (
        select 1
        from public.assessment_answers answer
        where answer.user_id = p_user_id
          and answer.generated_question_id
            = question.generated_question_id
          and answer.attempt_id = p_attempt_id
      ) as answered_in_attempt
    from public.obs_question_bank_with_units question
    join target on true
    cross join advanced_state advanced
    left join public.bible_events event
      on event.id = question.event_id
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    where question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        p_dimension_key is null
        or question.dimension_key
          = public.obs_normalize_dimension_key(p_dimension_key)
      )
      and (
        not target.dimension_is_advanced
        or advanced.unlocked
      )
      and (
        question.unit_key = target.unit_key
        or (
          target.start_chapter = 1
          and question.book_code = target.book_code
          and question.question_type = 'book_orientation_mcq_v1'
        )
      )
  ),
  availability as (
    select
      count(*) filter (
        where difficulty_stage = 1
      )::integer as stage_1_available,
      count(*) filter (
        where difficulty_stage = 2
      )::integer as stage_2_available,
      count(*) filter (
        where difficulty_stage = 3
      )::integer as stage_3_available
    from candidate_base
  ),
  attempt_answer_rows as (
    select
      classified.stage,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      row_number() over (
        order by answer.answered_at desc, answer.id desc
      ) as recency_rank
    from public.assessment_answers answer
    join public.obs_question_bank_with_units question
      on question.generated_question_id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    cross join lateral (
      select public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as stage
    ) classified
    where answer.attempt_id = p_attempt_id
      and answer.user_id = p_user_id
  ),
  attempt_progress as (
    select
      count(*) filter (
        where stage = 1
      )::integer as stage_1_answered,
      count(*) filter (
        where stage = 1 and is_correct and not is_idk
      )::integer as stage_1_correct,
      count(*) filter (
        where stage = 2
      )::integer as stage_2_answered,
      count(*) filter (
        where stage = 2 and is_correct and not is_idk
      )::integer as stage_2_correct,
      count(*) filter (
        where stage = 3
      )::integer as stage_3_answered,
      count(*) filter (
        where stage = 3 and is_correct and not is_idk
      )::integer as stage_3_correct,
      max(stage) filter (
        where recency_rank = 1
      )::integer as latest_stage,
      coalesce(
        bool_or(is_correct and not is_idk) filter (
          where recency_rank = 1
        ),
        true
      ) as latest_correct
    from attempt_answer_rows
  ),
  desired as (
    select case
      when not progress.latest_correct
        and coalesce(progress.latest_stage, 1) >= 2
        then greatest(1, progress.latest_stage - 1)
      when not progress.latest_correct
        and coalesce(progress.latest_stage, 1) = 1
        then 1
      when availability.stage_1_available > 0
        and progress.stage_1_answered
          < least(2, availability.stage_1_available)
        then 1
      when progress.stage_1_answered > 0
        and progress.stage_1_correct::numeric
          / progress.stage_1_answered < 0.67
        and availability.stage_1_available > 0
        then 1
      when availability.stage_2_available > 0
        and progress.stage_2_answered
          < least(4, availability.stage_2_available)
        then 2
      when progress.stage_2_answered > 0
        and progress.stage_2_correct::numeric
          / progress.stage_2_answered < 0.60
        and availability.stage_2_available > 0
        then 2
      else 3
    end as difficulty_stage
    from availability
    cross join attempt_progress progress
  ),
  ranked as (
    select candidate.*
    from candidate_base candidate
    cross join desired
    where not candidate.answered_in_attempt
      and (
        desired.difficulty_stage <> 3
        or candidate.difficulty_stage = 3
      )
      and not exists (
        select 1
        from public.assessment_answers prior
        join public.ot_generated_questions prior_question
          on prior_question.id = prior.generated_question_id
        where prior.attempt_id = p_attempt_id
          and prior.user_id = p_user_id
          and coalesce(
            nullif(prior_question.payload->>'stem_family', ''),
            prior_question.id::text
          ) = coalesce(
            nullif(candidate.payload->>'stem_family', ''),
            candidate.generated_question_id::text
          )
      )
    order by
      abs(candidate.difficulty_stage - desired.difficulty_stage),
      case
        when candidate.difficulty_stage > desired.difficulty_stage
          then 1
        else 0
      end,
      candidate.times_answered,
      candidate.last_answered_at nulls first,
      candidate.effective_irt_b,
      coalesce(
        candidate.importance_conceptual,
        candidate.routing_score,
        candidate.importance_context,
        50
      ) desc,
      random() * 0.05,
      candidate.created_at desc
    limit 1
  )
  select
    generated_question_id,
    coalesce(payload->>'prompt', prompt),
    question_type,
    payload->'choices',
    target_label,
    book_code,
    case
      when coalesce(routing_score, 0) >= 80 then 1
      when coalesce(routing_score, 0) >= 60 then 2
      else 3
    end,
    target_section
  from ranked;
$$;

create or replace function public.get_next_assessment_question(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row record;
  policy_row record;
  active_row record;
  shadow_row record;
  v_answer_count integer;
begin
  select attempt.*
  into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
    and auth.uid() = p_user_id
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null;

  if not found then
    return;
  end if;

  select *
  into policy_row
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  select *
  into active_row
  from public.obs_rank_ot_assessment_candidates_v4(
    p_attempt_id,
    p_user_id,
    policy_row.active_version,
    null,
    now(),
    1
  );

  if not found then
    return;
  end if;

  select count(*)::integer
  into v_answer_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  if policy_row.shadow_enabled
     and policy_row.shadow_sample_every_n > 0
     and mod(v_answer_count, policy_row.shadow_sample_every_n) = 0
     and not exists (
       select 1
       from public.obs_router_shadow_log log
       where log.attempt_id = p_attempt_id
         and log.answer_count = v_answer_count
         and log.active_version = policy_row.active_version
         and log.shadow_version = policy_row.shadow_version
     )
  then
    select *
    into shadow_row
    from public.obs_rank_ot_assessment_candidates_v4(
      p_attempt_id,
      p_user_id,
      policy_row.shadow_version,
      null,
      now(),
      1
    );

    insert into public.obs_router_shadow_log (
      attempt_id,
      user_id,
      answer_count,
      active_version,
      shadow_version,
      active_question_id,
      shadow_question_id,
      active_book_code,
      shadow_book_code,
      active_stage,
      shadow_stage,
      active_target_theta,
      shadow_target_theta,
      active_lane,
      shadow_lane
    )
    values (
      p_attempt_id,
      p_user_id,
      v_answer_count,
      policy_row.active_version,
      policy_row.shadow_version,
      active_row.generated_question_id,
      shadow_row.generated_question_id,
      active_row.book_code,
      shadow_row.book_code,
      active_row.candidate_stage,
      shadow_row.candidate_stage,
      active_row.target_theta,
      shadow_row.target_theta,
      active_row.selection_lane,
      shadow_row.selection_lane
    )
    on conflict (
      attempt_id,
      answer_count,
      active_version,
      shadow_version
    ) do nothing;
  end if;

  return query
  select
    active_row.generated_question_id::uuid,
    active_row.prompt::text,
    active_row.question_type::text,
    active_row.payload->'choices',
    active_row.event_title::text,
    active_row.book_code::text,
    active_row.importance_tier::integer,
    active_row.section::text;
end;
$$;

revoke all on table public.obs_router_policy_config from public;
revoke all on table public.obs_router_policy_config from anon;
revoke all on table public.obs_router_policy_config from authenticated;
revoke all on table public.obs_router_shadow_log from public;
revoke all on table public.obs_router_shadow_log from anon;
revoke all on table public.obs_router_shadow_log from authenticated;

revoke all on function public.obs_rank_ot_assessment_candidates_v4(
  uuid, uuid, text, integer, timestamptz, integer
) from public;
revoke all on function public.obs_rank_ot_assessment_candidates_v4(
  uuid, uuid, text, integer, timestamptz, integer
) from anon;
revoke all on function public.obs_rank_ot_assessment_candidates_v4(
  uuid, uuid, text, integer, timestamptz, integer
) from authenticated;
grant execute on function public.obs_rank_ot_assessment_candidates_v4(
  uuid, uuid, text, integer, timestamptz, integer
) to service_role;

revoke all on function public.obs_replay_ot_router_attempt(uuid)
  from public;
revoke all on function public.obs_replay_ot_router_attempt(uuid)
  from anon;
revoke all on function public.obs_replay_ot_router_attempt(uuid)
  from authenticated;
grant execute on function public.obs_replay_ot_router_attempt(uuid)
  to service_role;

revoke all on function public.obs_router_scope_baseline_met(
  uuid, text, timestamptz
) from public;
revoke all on function public.obs_router_scope_baseline_met(
  uuid, text, timestamptz
) from anon;
revoke all on function public.obs_router_scope_baseline_met(
  uuid, text, timestamptz
) from authenticated;

revoke all on function public.obs_advanced_dimension_unlocked(
  uuid, timestamptz
) from public;
revoke all on function public.obs_advanced_dimension_unlocked(
  uuid, timestamptz
) from anon;
revoke all on function public.obs_advanced_dimension_unlocked(
  uuid, timestamptz
) from authenticated;

grant execute on function public.get_next_assessment_question(uuid,uuid)
  to authenticated;
grant execute on function public.obs_get_next_focused_question_v2(
  uuid, uuid, text, text, integer, integer, text
) to authenticated;

comment on function public.obs_rank_ot_assessment_candidates_v4(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shared OT candidate ranking used by production policy selection, prefix replay, and shadow comparison.';

comment on function public.obs_replay_ot_router_attempt(uuid) is
  'Counterfactual prefix replay against the current bank. V4 uses the currently stored ability prior because historical per-answer theta snapshots do not exist.';

comment on table public.obs_router_shadow_log is
  'Sampled production-versus-shadow OT router decisions; contains question IDs and routing metadata but no answer keys.';

notify pgrst, 'reload schema';

commit;
