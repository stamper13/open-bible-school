-- NT V7 shadow prep.
--
-- Adds provisional ladder metadata for NT assessment questions and a
-- service-only NT V7 candidate ranker. This does not change the app-facing NT
-- RPC chain:
--   obs_start_nt_assessment ->
--   obs_get_next_nt_assessment_question ->
--   obs_submit_nt_assessment_answer

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.obs_question_ladder_metadata') is null
     or to_regclass('public.v_nt_question_bank') is null
     or to_regclass('public.scripture_books') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regprocedure('public.obs_nt_scope_key(text,text)') is null
     or to_regprocedure('public.obs_nt_question_matches_scope(text,text,text)') is null
     or to_regprocedure('public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)') is null
     or to_regprocedure('public.obs_is_high_specificity_assessment_question(text,text,jsonb)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT V7 shadow prep prerequisites are missing; no changes made.';
  end if;
end $$;

alter table public.obs_question_ladder_metadata
  drop constraint if exists obs_question_ladder_metadata_granularity_ck,
  drop constraint if exists obs_question_ladder_metadata_scope_level_ck,
  drop constraint if exists obs_question_ladder_metadata_section_key_ck,
  drop constraint if exists obs_question_ladder_metadata_section_name_ck,
  drop constraint if exists obs_question_ladder_metadata_section_pair_ck;

alter table public.obs_question_ladder_metadata
  add constraint obs_question_ladder_metadata_granularity_ck
    check (routing_granularity in (
      'unknown',
      'ot_overview',
      'nt_overview',
      'section_overview',
      'book_overview',
      'book_intersection',
      'unit_overview',
      'chapter_range',
      'chapter_detail',
      'verse_detail'
    )),
  add constraint obs_question_ladder_metadata_scope_level_ck
    check (scoring_scope_level in (
      'unknown',
      'ot',
      'nt',
      'section',
      'book',
      'unit',
      'chapter',
      'passage'
    )),
  add constraint obs_question_ladder_metadata_section_key_ck
    check (
      section_key is null
      or section_key in (
        'TORAH',
        'FORMER',
        'LATTER',
        'WRITINGS',
        'GOSPELS_ACTS',
        'GOSPELS',
        'ACTS',
        'PAULINE',
        'GENERAL',
        'APOCALYPSE'
      )
    ),
  add constraint obs_question_ladder_metadata_section_name_ck
    check (
      section_name is null
      or section_name in (
        'Torah',
        'Former Prophets',
        'Latter Prophets',
        'Writings',
        'Gospels and Acts',
        'Gospels',
        'Acts',
        'Pauline Epistles',
        'General Epistles',
        'Apocalypse'
      )
    ),
  add constraint obs_question_ladder_metadata_section_pair_ck
    check (
      section_key is null
      or section_name is null
      or (
        (section_key = 'TORAH' and section_name = 'Torah')
        or (section_key = 'FORMER' and section_name = 'Former Prophets')
        or (section_key = 'LATTER' and section_name = 'Latter Prophets')
        or (section_key = 'WRITINGS' and section_name = 'Writings')
        or (section_key = 'GOSPELS_ACTS' and section_name = 'Gospels and Acts')
        or (section_key = 'GOSPELS' and section_name = 'Gospels')
        or (section_key = 'ACTS' and section_name = 'Acts')
        or (section_key = 'PAULINE' and section_name = 'Pauline Epistles')
        or (section_key = 'GENERAL' and section_name = 'General Epistles')
        or (section_key = 'APOCALYPSE' and section_name = 'Apocalypse')
      )
    );

with nt_questions as (
  select
    question.generated_question_id,
    question.question_type,
    coalesce(question.payload->>'prompt', question.prompt) as prompt,
    question.payload,
    question.book_code,
    book.name as book_name,
    book.nt_division,
    nullif(question.payload->>'dimension_key', '') as payload_dimension_key,
    nullif(question.payload->>'dimension', '') as payload_dimension,
    nullif(question.payload->>'question_layer', '') as question_layer,
    nullif(question.payload->>'content_layer', '') as content_layer,
    nullif(question.payload->>'expository_target', '') as expository_target,
    nullif(question.payload->>'reference', '') as reference_text,
    case
      when question.payload->>'chapter' ~ '^[0-9]+$'
        then (question.payload->>'chapter')::integer
      else null
    end as chapter_number,
    greatest(
      coalesce(question.importance_conceptual, 0),
      coalesce(question.importance_context, 0),
      coalesce(question.routing_score, 0)
    )::numeric as importance_signal
  from public.v_nt_question_bank question
  left join public.scripture_books book
    on book.book_code = question.book_code
  where question.generated_question_id is not null
),
signals as (
  select
    nt_questions.*,
    case
      when book_code in ('MAT', 'MRK', 'LUK', 'JHN') then 'GOSPELS'
      when book_code = 'ACT' then 'ACTS'
      when public.obs_nt_scope_key(nt_division, null) in (
        'PAULINE', 'GENERAL', 'APOCALYPSE'
      ) then public.obs_nt_scope_key(nt_division, null)
      else 'GOSPELS_ACTS'
    end as section_key,
    coalesce(payload_dimension_key, payload_dimension) as dimension_key,
    (
      prompt ~* E'(^|[^[:alpha:]])(Matthew|Matt|Mark|Luke|John|Acts|Romans|1[[:space:]]*Corinthians|2[[:space:]]*Corinthians|Galatians|Ephesians|Philippians|Colossians|1[[:space:]]*Thessalonians|2[[:space:]]*Thessalonians|1[[:space:]]*Timothy|2[[:space:]]*Timothy|Titus|Philemon|Hebrews|James|1[[:space:]]*Peter|2[[:space:]]*Peter|1[[:space:]]*John|2[[:space:]]*John|3[[:space:]]*John|Jude|Revelation|Rev)[.]?[[:space:]]+[0-9]{1,3}([^0-9]|$)'
      or reference_text ~* E'[0-9]{1,3}:[0-9]{1,3}'
    ) as chapter_addressed_prompt,
    (
      lower(coalesce(payload->>'exact_chapter_recall_required', 'false'))
        in ('true', 't', '1', 'yes', 'y')
      or prompt ~* E'(main subject of|main point of|main idea of|central subject of)[[:space:]]+([1-3][[:space:]]+)?[[:alpha:]]+[[:alpha:][:space:]]*[[:space:]]+[0-9]{1,3}\\M'
      or prompt ~* E'(what happens in|what occurs in|what is described in)[[:space:]]+([1-3][[:space:]]+)?[[:alpha:]]+[[:alpha:][:space:]]*[[:space:]]+[0-9]{1,3}\\M'
    ) as exact_chapter_recall_required,
    public.obs_is_high_specificity_assessment_question(
      prompt,
      question_type,
      payload
    ) as high_specificity
  from nt_questions
),
classified as (
  select
    signals.*,
    case section_key
      when 'GOSPELS_ACTS' then 'Gospels and Acts'
      when 'GOSPELS' then 'Gospels'
      when 'ACTS' then 'Acts'
      when 'PAULINE' then 'Pauline Epistles'
      when 'GENERAL' then 'General Epistles'
      when 'APOCALYPSE' then 'Apocalypse'
      else null
    end as section_name,
    case
      when lower(coalesce(question_type, '')) = 'nt_book_section_sort_v1'
        then 'section_overview'
      when lower(coalesce(question_type, '')) = 'nt_foundation_mcq_v1'
        and not chapter_addressed_prompt
        then 'book_overview'
      when lower(coalesce(question_type, '')) like 'crossref_%'
        then 'book_intersection'
      when lower(coalesce(dimension_key, '')) = 'structure_cross_ref'
        and not chapter_addressed_prompt
        then 'book_intersection'
      when lower(coalesce(expository_target, '')) = 'argument_flow'
        then 'chapter_range'
      when reference_text ~* E'[0-9]{1,3}:[0-9]{1,3}'
        then 'chapter_detail'
      when chapter_number is not null
        then 'chapter_detail'
      when high_specificity
        then 'chapter_detail'
      when book_code is not null
        then 'book_overview'
      else 'unknown'
    end as routing_granularity
  from signals
),
scoped as (
  select
    classified.*,
    case routing_granularity
      when 'nt_overview' then 'nt'
      when 'section_overview' then 'section'
      when 'book_overview' then 'book'
      when 'book_intersection' then 'book'
      when 'unit_overview' then 'unit'
      when 'chapter_range' then 'chapter'
      when 'chapter_detail' then 'chapter'
      when 'verse_detail' then 'passage'
      else 'unknown'
    end as scoring_scope_level,
    case routing_granularity
      when 'nt_overview' then 1
      when 'section_overview' then 1
      when 'book_overview' then 2
      when 'book_intersection' then 3
      when 'unit_overview' then 3
      when 'chapter_range' then 3
      when 'chapter_detail' then 4
      when 'verse_detail' then 5
      else 1
    end as depth_stage
  from classified
),
weighted as (
  select
    scoped.*,
    case
      when routing_granularity = 'nt_overview' then 1.0000
      when routing_granularity = 'section_overview' then 0.9300
      when routing_granularity = 'book_overview' then least(1.0000, 0.7600 + case when importance_signal >= 85 then 0.1000 else 0 end)
      when routing_granularity = 'book_intersection' then least(1.0000, 0.6600 + case when importance_signal >= 85 then 0.0800 else 0 end)
      when routing_granularity = 'unit_overview' then least(1.0000, 0.6000 + case when importance_signal >= 85 then 0.0800 else 0 end)
      when routing_granularity = 'chapter_range' then least(1.0000, 0.5000 + case when lower(coalesce(expository_target, '')) = 'argument_flow' then 0.0800 else 0 end)
      when routing_granularity = 'chapter_detail' then least(1.0000, 0.3200 + case when importance_signal >= 90 then 0.0800 else 0 end)
      when routing_granularity = 'verse_detail' then least(1.0000, 0.2200 + case when importance_signal >= 90 then 0.0600 else 0 end)
      else 0.3500
    end::numeric(5,4) as foundationality_weight,
    case
      when routing_granularity = 'nt_overview' then 0.9500
      when routing_granularity = 'section_overview' then 0.8400
      when routing_granularity = 'book_overview' then 0.7200
      when routing_granularity = 'book_intersection' then 0.5700
      when routing_granularity = 'unit_overview' then 0.4600
      when routing_granularity = 'chapter_range' then 0.3600
      when routing_granularity = 'chapter_detail' then 0.1800
      when routing_granularity = 'verse_detail' then 0.1000
      else 0.2500
    end::numeric(5,4) as global_signal_weight,
    case
      when routing_granularity = 'nt_overview' then 0.4500
      when routing_granularity = 'section_overview' then 0.5200
      when routing_granularity = 'book_overview' then 0.6600
      when routing_granularity = 'book_intersection' then 0.7600
      when routing_granularity = 'unit_overview' then 0.8400
      when routing_granularity = 'chapter_range' then 0.9000
      when routing_granularity = 'chapter_detail' then 0.9600
      when routing_granularity = 'verse_detail' then 1.0000
      else 0.7500
    end::numeric(5,4) as local_signal_weight,
    case
      when question_type = 'nt_foundation_mcq_v1'
        and not chapter_addressed_prompt then 0.8500
      when reference_text is not null or chapter_number is not null then 0.7600
      when dimension_key is not null then 0.7000
      else 0.5500
    end::numeric(5,4) as metadata_confidence
  from scoped
)
insert into public.obs_question_ladder_metadata (
  generated_question_id,
  routing_granularity,
  scoring_scope_level,
  depth_stage,
  section_key,
  section_name,
  book_code,
  unit_key,
  start_chapter,
  end_chapter,
  dimension_key,
  foundationality_weight,
  global_signal_weight,
  local_signal_weight,
  exact_chapter_recall_required,
  chapter_addressed_prompt,
  metadata_source,
  metadata_confidence,
  review_status,
  review_notes,
  updated_at
)
select
  generated_question_id,
  routing_granularity,
  scoring_scope_level,
  depth_stage,
  section_key,
  section_name,
  book_code,
  null,
  chapter_number,
  chapter_number,
  case
    when dimension_key is not null
      and exists (
        select 1
        from public.obs_bli_dimensions dimension
        where dimension.dimension_key = weighted.dimension_key
      )
      then dimension_key
    else null
  end,
  foundationality_weight,
  global_signal_weight,
  local_signal_weight,
  exact_chapter_recall_required,
  chapter_addressed_prompt,
  'rule_inferred',
  metadata_confidence,
  case
    when metadata_confidence >= 0.8000 and routing_granularity in (
      'book_overview',
      'chapter_detail'
    ) then 'auto_accepted'
    else 'needs_review'
  end,
  concat_ws(
    '; ',
    'NT V7 provisional backfill',
    nullif('question_layer=' || coalesce(question_layer, ''), 'question_layer='),
    nullif('expository_target=' || coalesce(expository_target, ''), 'expository_target='),
    nullif('reference=' || coalesce(reference_text, ''), 'reference=')
  ),
  now()
from weighted
on conflict (generated_question_id) do update
set routing_granularity = excluded.routing_granularity,
    scoring_scope_level = excluded.scoring_scope_level,
    depth_stage = excluded.depth_stage,
    section_key = excluded.section_key,
    section_name = excluded.section_name,
    book_code = excluded.book_code,
    unit_key = excluded.unit_key,
    start_chapter = excluded.start_chapter,
    end_chapter = excluded.end_chapter,
    dimension_key = excluded.dimension_key,
    foundationality_weight = excluded.foundationality_weight,
    global_signal_weight = excluded.global_signal_weight,
    local_signal_weight = excluded.local_signal_weight,
    exact_chapter_recall_required = excluded.exact_chapter_recall_required,
    chapter_addressed_prompt = excluded.chapter_addressed_prompt,
    metadata_source = excluded.metadata_source,
    metadata_confidence = excluded.metadata_confidence,
    review_status = excluded.review_status,
    review_notes = excluded.review_notes,
    updated_at = now();

create table if not exists public.obs_router_nt_v7_shadow_log (
  id bigserial primary key,
  attempt_id uuid not null,
  user_id uuid not null,
  answer_count integer not null,
  active_question_id uuid,
  v7_question_id uuid,
  active_book_code text,
  v7_book_code text,
  active_dimension_key text,
  v7_dimension_key text,
  v7_section_key text,
  v7_depth_stage smallint,
  v7_routing_granularity text,
  v7_selection_lane text,
  created_at timestamptz not null default now(),
  constraint obs_router_nt_v7_shadow_log_unique
    unique (attempt_id, answer_count, active_question_id)
);

alter table public.obs_router_nt_v7_shadow_log enable row level security;

revoke all on table public.obs_router_nt_v7_shadow_log from public, anon, authenticated;
revoke all on sequence public.obs_router_nt_v7_shadow_log_id_seq from public, anon, authenticated;
grant all on table public.obs_router_nt_v7_shadow_log to service_role;
grant usage, select on sequence public.obs_router_nt_v7_shadow_log_id_seq to service_role;

create index if not exists obs_router_nt_v7_shadow_log_attempt_idx
  on public.obs_router_nt_v7_shadow_log (attempt_id, created_at desc);

create index if not exists obs_router_nt_v7_shadow_log_user_idx
  on public.obs_router_nt_v7_shadow_log (user_id, created_at desc);

create or replace function public.obs_rank_nt_assessment_candidates_v7(
  p_attempt_id uuid,
  p_user_id uuid,
  p_policy text default 'NT_V7_SHADOW',
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
  book_code text,
  book_name text,
  nt_division text,
  section_key text,
  dimension_key text,
  similarity_key text,
  routing_granularity text,
  scoring_scope_level text,
  depth_stage smallint,
  route_priority integer,
  selection_lane text,
  adaptive_score double precision,
  total_score double precision,
  times_answered integer,
  prior_exact_seen boolean,
  prior_similarity_seen boolean,
  attempt_section_share double precision,
  attempt_book_share double precision,
  attempt_dimension_share double precision,
  long_run_section_share double precision,
  long_run_book_share double precision,
  long_run_dimension_share double precision,
  metadata_confidence numeric,
  review_status text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with authorized_attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.scope_key, 'NT')) as scope_key,
      greatest(1, coalesce(attempt.target_question_count, 20)) as target_count
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and upper(coalesce(attempt.testament, 'NT')) = 'NT'
      and not coalesce(attempt.is_complete, false)
      and attempt.completed_at is null
    limit 1
  ),
  current_attempt_answers as (
    select
      answer.generated_question_id,
      question.book_code,
      case
        when question.book_code in ('MAT', 'MRK', 'LUK', 'JHN') then 'GOSPELS'
        when question.book_code = 'ACT' then 'ACTS'
        else public.obs_nt_scope_key(book.nt_division, null)
      end as section_key,
      coalesce(
        metadata.dimension_key,
        nullif(question.payload->>'dimension_key', ''),
        nullif(question.payload->>'dimension', '')
      ) as dimension_key,
      public.obs_assessment_question_similarity_key(
        question.payload,
        question.book_code,
        coalesce(
          metadata.dimension_key,
          nullif(question.payload->>'dimension_key', ''),
          nullif(question.payload->>'dimension', '')
        ),
        question.question_type,
        coalesce(question.payload->>'prompt', question.prompt)
      ) as similarity_key
    from public.assessment_answers answer
    join authorized_attempt attempt
      on attempt.id = answer.attempt_id
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    left join public.scripture_books book
      on book.book_code = question.book_code
    left join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = question.generated_question_id
    where answer.user_id = p_user_id
      and answer.answered_at <= coalesce(p_as_of, now())
      and coalesce(answer.scoring_eligible, true)
  ),
  progress as (
    select count(*)::integer as answered
    from current_attempt_answers
  ),
  all_history as (
    select
      answer.attempt_id,
      answer.generated_question_id,
      answer.answered_at,
      coalesce(answer.is_correct, false) as is_correct,
      question.book_code,
      case
        when question.book_code in ('MAT', 'MRK', 'LUK', 'JHN') then 'GOSPELS'
        when question.book_code = 'ACT' then 'ACTS'
        else public.obs_nt_scope_key(book.nt_division, null)
      end as section_key,
      coalesce(
        metadata.dimension_key,
        nullif(question.payload->>'dimension_key', ''),
        nullif(question.payload->>'dimension', '')
      ) as dimension_key,
      public.obs_assessment_question_similarity_key(
        question.payload,
        question.book_code,
        coalesce(
          metadata.dimension_key,
          nullif(question.payload->>'dimension_key', ''),
          nullif(question.payload->>'dimension', '')
        ),
        question.question_type,
        coalesce(question.payload->>'prompt', question.prompt)
      ) as similarity_key
    from public.assessment_answers answer
    join authorized_attempt attempt
      on attempt.user_id = answer.user_id
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    left join public.scripture_books book
      on book.book_code = question.book_code
    left join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = question.generated_question_id
    where answer.user_id = p_user_id
      and answer.answered_at <= coalesce(p_as_of, now())
      and coalesce(answer.scoring_eligible, true)
      and public.obs_nt_question_matches_scope(
        question.book_code,
        book.nt_division,
        attempt.scope_key
      )
  ),
  history_totals as (
    select
      count(*)::double precision as total_answered,
      count(*) filter (where attempt_id = p_attempt_id)::double precision
        as attempt_answered
    from all_history
  ),
  attempt_section_stats as (
    select
      section_key,
      count(*)::double precision
        / nullif((select attempt_answered from history_totals), 0)
        as observed_share,
      count(*)::integer as answered
    from all_history
    where attempt_id = p_attempt_id
    group by section_key
  ),
  attempt_book_stats as (
    select
      book_code,
      count(*)::double precision
        / nullif((select attempt_answered from history_totals), 0)
        as observed_share,
      count(*)::integer as answered
    from all_history
    where attempt_id = p_attempt_id
    group by book_code
  ),
  attempt_dimension_stats as (
    select
      dimension_key,
      count(*)::double precision
        / nullif((select attempt_answered from history_totals), 0)
        as observed_share,
      count(*)::integer as answered
    from all_history
    where attempt_id = p_attempt_id
    group by dimension_key
  ),
  long_run_section_stats as (
    select
      section_key,
      count(*)::double precision
        / nullif((select total_answered from history_totals), 0)
        as observed_share,
      count(*)::integer as answered
    from all_history
    group by section_key
  ),
  long_run_book_stats as (
    select
      book_code,
      count(*)::double precision
        / nullif((select total_answered from history_totals), 0)
        as observed_share,
      count(*)::integer as answered
    from all_history
    group by book_code
  ),
  long_run_dimension_stats as (
    select
      dimension_key,
      count(*)::double precision
        / nullif((select total_answered from history_totals), 0)
        as observed_share,
      count(*)::integer as answered
    from all_history
    group by dimension_key
  ),
  candidates as (
    select
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      question.book_code,
      book.name as book_name,
      book.nt_division,
      case
        when question.book_code in ('MAT', 'MRK', 'LUK', 'JHN') then 'GOSPELS'
        when question.book_code = 'ACT' then 'ACTS'
        else public.obs_nt_scope_key(book.nt_division, null)
      end as section_key,
      coalesce(
        metadata.dimension_key,
        nullif(question.payload->>'dimension_key', ''),
        nullif(question.payload->>'dimension', '')
      ) as dimension_key,
      coalesce(metadata.routing_granularity, 'unknown') as routing_granularity,
      coalesce(metadata.scoring_scope_level, 'unknown') as scoring_scope_level,
      coalesce(metadata.depth_stage, 1)::smallint as depth_stage,
      coalesce(metadata.global_signal_weight, 0.2500) as global_signal_weight,
      coalesce(metadata.local_signal_weight, 0.7500) as local_signal_weight,
      coalesce(metadata.metadata_confidence, 0.0000) as metadata_confidence,
      coalesce(metadata.review_status, 'needs_review') as review_status,
      coalesce(metadata.chapter_addressed_prompt, false)
        or public.obs_is_high_specificity_assessment_question(
          coalesce(question.payload->>'prompt', question.prompt),
          question.question_type,
          question.payload
        ) as chapter_or_passage_addressed,
      coalesce(metadata.exact_chapter_recall_required, false)
        as exact_chapter_recall_required,
      public.obs_assessment_question_similarity_key(
        question.payload,
        question.book_code,
        coalesce(
          metadata.dimension_key,
          nullif(question.payload->>'dimension_key', ''),
          nullif(question.payload->>'dimension', '')
        ),
        question.question_type,
        coalesce(question.payload->>'prompt', question.prompt)
      ) as similarity_key,
      public.obs_effective_item_irt_a(question.payload, null) as effective_a,
      public.obs_effective_item_irt_b(question.payload, null) as effective_b,
      greatest(
        0.0,
        least(
          1.0,
          coalesce(
            public.obs_payload_number(
              question.payload,
              'importance_conceptual'
            ) / 100.0,
            0.60
          )
        )
      ) as importance_score,
      coalesce(
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        nt_ability.theta - 0.5 * coalesce(nt_ability.theta_se, 1.0),
        0.0
      ) as theta_lcb
    from authorized_attempt attempt
    join public.v_nt_question_bank question
      on true
    left join public.scripture_books book
      on book.book_code = question.book_code
    left join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = question.generated_question_id
    left join public.user_abilities ability
      on ability.user_id = attempt.user_id
     and ability.scope = case
       when attempt.scope_key in (
         'GOSPELS', 'ACTS', 'GOSPELS_ACTS',
         'PAULINE', 'GENERAL', 'APOCALYPSE'
       ) then attempt.scope_key
       else public.obs_nt_scope_key(book.nt_division, null)
     end
    left join public.user_abilities nt_ability
      on nt_ability.user_id = attempt.user_id
     and nt_ability.scope = 'NT'
    cross join progress
    where progress.answered < attempt.target_count
      and question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2
      and public.obs_nt_question_matches_scope(
        question.book_code,
        book.nt_division,
        attempt.scope_key
      )
      and not exists (
        select 1
        from current_attempt_answers used
        where used.generated_question_id = question.generated_question_id
      )
  ),
  candidate_context as (
    select
      candidate.*,
      coalesce(uh.times_answered, 0) as times_answered,
      uh.last_answered_at,
      exists (
        select 1
        from all_history history
        where history.attempt_id <> p_attempt_id
          and history.generated_question_id = candidate.generated_question_id
      ) as prior_exact_seen,
      exists (
        select 1
        from all_history history
        where history.attempt_id <> p_attempt_id
          and history.similarity_key = candidate.similarity_key
      ) as prior_similarity_seen,
      exists (
        select 1
        from current_attempt_answers used
        where used.similarity_key = candidate.similarity_key
      ) as attempt_similarity_seen,
      coalesce(ass.observed_share, 0.0) as attempt_section_share,
      coalesce(abs.observed_share, 0.0) as attempt_book_share,
      coalesce(ads.observed_share, 0.0) as attempt_dimension_share,
      coalesce(lss.observed_share, 0.0) as long_run_section_share,
      coalesce(lbs.observed_share, 0.0) as long_run_book_share,
      coalesce(lds.observed_share, 0.0) as long_run_dimension_share,
      coalesce(lss.answered, 0) as long_run_section_answered,
      coalesce(lbs.answered, 0) as long_run_book_answered,
      coalesce(lds.answered, 0) as long_run_dimension_answered
    from candidates candidate
    left join (
      select
        generated_question_id,
        count(*)::integer as times_answered,
        max(answered_at) as last_answered_at
      from all_history
      group by generated_question_id
    ) uh on uh.generated_question_id = candidate.generated_question_id
    left join attempt_section_stats ass
      on ass.section_key = candidate.section_key
    left join attempt_book_stats abs
      on abs.book_code = candidate.book_code
    left join attempt_dimension_stats ads
      on ads.dimension_key is not distinct from candidate.dimension_key
    left join long_run_section_stats lss
      on lss.section_key = candidate.section_key
    left join long_run_book_stats lbs
      on lbs.book_code = candidate.book_code
    left join long_run_dimension_stats lds
      on lds.dimension_key is not distinct from candidate.dimension_key
  ),
  scored as (
    select
      candidate_context.*,
      (
        0.50 * public.obs_item_information(
          candidate_context.theta_lcb,
          candidate_context.effective_a,
          candidate_context.effective_b
        )
        + 0.20 * candidate_context.importance_score
        + 0.12 * candidate_context.global_signal_weight::double precision
        + 0.10 * (1.0 / (1.0 + candidate_context.times_answered))
        + 0.08 * random()
      ) as adaptive_score,
      case
        when candidate_context.attempt_similarity_seen then 90
        when candidate_context.prior_exact_seen then 70
        when candidate_context.prior_similarity_seen then 60
        when progress.answered < 16
          and candidate_context.exact_chapter_recall_required then 50
        when progress.answered < 16
          and candidate_context.depth_stage >= 4 then 45
        when progress.answered >= 6
          and candidate_context.attempt_section_share >= 0.4500 then 38
        when progress.answered >= 6
          and candidate_context.attempt_dimension_share >= 0.4000 then 34
        when progress.answered >= 8
          and candidate_context.attempt_book_share >= 0.3000 then 30
        when progress.answered < 10
          and candidate_context.depth_stage <= 2 then 0
        when candidate_context.long_run_section_answered < 6 then 5
        when candidate_context.long_run_book_answered < 2 then 6
        when candidate_context.long_run_dimension_answered < 4 then 7
        else 10
      end as route_priority,
      case
        when progress.answered < 10
          and candidate_context.depth_stage <= 2 then 'early_broad_foundation'
        when candidate_context.long_run_section_answered < 6 then 'low_evidence_section'
        when candidate_context.long_run_book_answered < 2 then 'low_evidence_book'
        when candidate_context.long_run_dimension_answered < 4 then 'low_evidence_dimension'
        when candidate_context.depth_stage >= 4 then 'narrow_probe'
        else 'balanced_adaptive'
      end as selection_lane
    from candidate_context
    cross join progress
  ),
  final_scored as (
    select
      scored.*,
      (
        scored.adaptive_score
        + case when scored.long_run_section_answered < 6 then 0.1800 else 0 end
        + case when scored.long_run_book_answered < 2 then 0.1200 else 0 end
        + case when scored.long_run_dimension_answered < 4 then 0.1000 else 0 end
        + case when scored.depth_stage <= 2 then 0.0600 else 0 end
        - case when scored.prior_exact_seen then 0.5500 else 0 end
        - case when scored.prior_similarity_seen then 0.3500 else 0 end
        - case when scored.exact_chapter_recall_required then 0.1600 else 0 end
        - greatest(0.0, scored.attempt_section_share - 0.4500) * 0.8000
        - greatest(0.0, scored.attempt_dimension_share - 0.4000) * 0.7000
        - greatest(0.0, scored.attempt_book_share - 0.3000) * 0.6500
      ) as total_score
    from scored
  )
  select
    row_number() over (
      order by
        final_scored.route_priority asc,
        final_scored.total_score desc,
        final_scored.times_answered asc,
        final_scored.last_answered_at asc nulls first,
        md5(
          p_attempt_id::text
          || ':nt-v7:'
          || coalesce(p_policy, '')
          || ':'
          || final_scored.generated_question_id::text
        ),
        final_scored.generated_question_id
    ) as candidate_rank,
    final_scored.generated_question_id,
    final_scored.prompt,
    final_scored.question_type,
    final_scored.payload,
    final_scored.book_code,
    final_scored.book_name,
    final_scored.nt_division,
    final_scored.section_key,
    final_scored.dimension_key,
    final_scored.similarity_key,
    final_scored.routing_granularity,
    final_scored.scoring_scope_level,
    final_scored.depth_stage,
    final_scored.route_priority,
    final_scored.selection_lane,
    final_scored.adaptive_score,
    final_scored.total_score,
    final_scored.times_answered,
    final_scored.prior_exact_seen,
    final_scored.prior_similarity_seen,
    final_scored.attempt_section_share,
    final_scored.attempt_book_share,
    final_scored.attempt_dimension_share,
    final_scored.long_run_section_share,
    final_scored.long_run_book_share,
    final_scored.long_run_dimension_share,
    final_scored.metadata_confidence,
    final_scored.review_status
  from final_scored
  order by
    final_scored.route_priority asc,
    final_scored.total_score desc,
    final_scored.times_answered asc,
    final_scored.last_answered_at asc nulls first,
    md5(
      p_attempt_id::text
      || ':nt-v7:'
      || coalesce(p_policy, '')
      || ':'
      || final_scored.generated_question_id::text
    ),
    final_scored.generated_question_id
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

revoke all on function public.obs_rank_nt_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.obs_rank_nt_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) to service_role;

create or replace function public.obs_log_nt_assessment_v7_shadow_selection(
  p_attempt_id uuid,
  p_user_id uuid,
  p_active_question_id uuid default null,
  p_as_of timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer_count integer;
  v_active_book_code text;
  v_active_dimension_key text;
  v_shadow record;
begin
  select count(*)::integer
  into v_answer_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id
    and answer.answered_at <= coalesce(p_as_of, now());

  if p_active_question_id is not null then
    select
      question.book_code,
      coalesce(
        metadata.dimension_key,
        nullif(question.payload->>'dimension_key', ''),
        nullif(question.payload->>'dimension', '')
      ) as dimension_key
    into v_active_book_code, v_active_dimension_key
    from public.v_nt_question_bank question
    left join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = question.generated_question_id
    where question.generated_question_id = p_active_question_id;
  end if;

  select *
  into v_shadow
  from public.obs_rank_nt_assessment_candidates_v7(
    p_attempt_id,
    p_user_id,
    'NT_V7_SHADOW',
    null,
    coalesce(p_as_of, now()),
    1
  );

  if v_shadow.generated_question_id is null then
    return null;
  end if;

  insert into public.obs_router_nt_v7_shadow_log (
    attempt_id,
    user_id,
    answer_count,
    active_question_id,
    v7_question_id,
    active_book_code,
    v7_book_code,
    active_dimension_key,
    v7_dimension_key,
    v7_section_key,
    v7_depth_stage,
    v7_routing_granularity,
    v7_selection_lane
  ) values (
    p_attempt_id,
    p_user_id,
    v_answer_count,
    p_active_question_id,
    v_shadow.generated_question_id,
    v_active_book_code,
    v_shadow.book_code,
    v_active_dimension_key,
    v_shadow.dimension_key,
    v_shadow.section_key,
    v_shadow.depth_stage,
    v_shadow.routing_granularity,
    v_shadow.selection_lane
  )
  on conflict (attempt_id, answer_count, active_question_id)
    do nothing;

  return v_shadow.generated_question_id;
end;
$$;

revoke all on function public.obs_log_nt_assessment_v7_shadow_selection(
  uuid, uuid, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.obs_log_nt_assessment_v7_shadow_selection(
  uuid, uuid, uuid, timestamptz
) to service_role;

comment on function public.obs_rank_nt_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shadow-only NT V7 candidate ranker: provisional ladder metadata, cross-attempt novelty, similarity suppression, and section/book/dimension share brakes.';

comment on function public.obs_log_nt_assessment_v7_shadow_selection(
  uuid, uuid, uuid, timestamptz
) is
  'Service-only helper for comparing the live NT selector with NT V7 shadow candidate selection.';

comment on table public.obs_router_nt_v7_shadow_log is
  'Private NT V7 shadow comparison log. Not used by the app-facing NT assessment RPC chain.';

notify pgrst, 'reload schema';

commit;
