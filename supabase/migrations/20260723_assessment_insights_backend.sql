-- Learner assessment insights backend.
--
-- Adds additive APIs for:
--   * attempt summaries and answer review
--   * cumulative progress history
--   * honest uncertainty/evidence reporting from theta_se
--   * section, book, dimension, and learning-unit drill-downs
--   * recommendation/study-plan interaction events
--
-- Prerequisites:
--   20260710_obs_recommendations_and_focused_retests.sql
--   20260711_bli_question_dimensions.sql
--   20260722_distractor_difficulty_dial.sql

begin;

create table if not exists public.obs_assessment_snapshots (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  testament text not null,
  raw_bli numeric(6,2) not null,
  display_bli integer not null,
  bli_level text not null,
  questions_answered integer not null,
  correct_answers integer not null,
  idk_answers integer not null,
  theta double precision,
  theta_se double precision,
  n_responses integer not null default 0,
  section_scores jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  constraint obs_assessment_snapshots_testament_ck
    check (testament in ('OT', 'NT')),
  constraint obs_assessment_snapshots_raw_ck
    check (raw_bli between 0 and 100),
  constraint obs_assessment_snapshots_display_ck
    check (display_bli between 200 and 800),
  constraint obs_assessment_snapshots_counts_ck
    check (
      questions_answered >= 0
      and correct_answers >= 0
      and idk_answers >= 0
      and n_responses >= 0
    ),
  unique (attempt_id, testament)
);

create index if not exists obs_assessment_snapshots_user_history_idx
  on public.obs_assessment_snapshots (user_id, testament, captured_at desc);

create table if not exists public.obs_study_plan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_key text references public.obs_learning_units(unit_key) on delete set null,
  event_type text not null,
  attempt_id uuid references public.assessment_attempts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint obs_study_plan_events_type_ck check (
    event_type in (
      'recommendation_viewed',
      'reading_started',
      'reading_completed',
      'retest_started',
      'retest_completed',
      'recommendation_dismissed'
    )
  )
);

create index if not exists obs_study_plan_events_user_idx
  on public.obs_study_plan_events (user_id, created_at desc);

alter table public.obs_assessment_snapshots enable row level security;
alter table public.obs_study_plan_events enable row level security;

drop policy if exists obs_assessment_snapshots_own_select
  on public.obs_assessment_snapshots;
create policy obs_assessment_snapshots_own_select
  on public.obs_assessment_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists obs_study_plan_events_own_select
  on public.obs_study_plan_events;
create policy obs_study_plan_events_own_select
  on public.obs_study_plan_events
  for select
  using (auth.uid() = user_id);

create or replace function public.obs_is_authorized_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = p_user_id
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

create or replace function public.obs_book_testament(p_book_code text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when upper(coalesce(p_book_code, '')) = any(array[
      'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI',
      '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER',
      'LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP',
      'HAG','ZEC','MAL'
    ]) then 'OT'
    when upper(coalesce(p_book_code, '')) = any(array[
      'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL',
      '1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN',
      '3JN','JUD','REV'
    ]) then 'NT'
    else null
  end;
$$;

create or replace function public.obs_book_section(p_book_code text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when upper(coalesce(p_book_code, '')) = any(array['GEN','EXO','LEV','NUM','DEU'])
      then 'Torah'
    when upper(coalesce(p_book_code, '')) = any(array[
      'JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST'
    ]) then 'Former Prophets'
    when upper(coalesce(p_book_code, '')) = any(array[
      'ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM',
      'HAB','ZEP','HAG','ZEC','MAL'
    ]) then 'Latter Prophets'
    when upper(coalesce(p_book_code, '')) = any(array['JOB','PSA','PRO','ECC','SNG'])
      then 'Writings'
    when upper(coalesce(p_book_code, '')) = any(array['MAT','MRK','LUK','JHN','ACT'])
      then 'Gospels & Acts'
    when upper(coalesce(p_book_code, '')) = any(array[
      'ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM'
    ]) then 'Pauline Epistles'
    when upper(coalesce(p_book_code, '')) = any(array[
      'HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD'
    ]) then 'General Epistles'
    when upper(coalesce(p_book_code, '')) = 'REV' then 'Apocalypse'
    else 'Unmapped'
  end;
$$;

create or replace function public.obs_display_bli_level(p_display_bli integer)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_display_bli, 200) <= 290 then 'Unfamiliar'
    when p_display_bli <= 434 then 'Acquainted'
    when p_display_bli <= 584 then 'Familiar'
    when p_display_bli <= 674 then 'Literate'
    when p_display_bli <= 734 then 'Studied'
    when p_display_bli <= 770 then 'Learned'
    else 'Scholar'
  end;
$$;

create or replace view public.obs_answer_evidence as
select
  aa.id as answer_id,
  aa.attempt_id,
  aa.user_id,
  aa.generated_question_id,
  aa.selected_choice_id,
  aa.is_correct,
  coalesce(aa.is_idk, false) as is_idk,
  aa.answered_at,
  oq.question_type,
  oq.payload,
  coalesce(q.prompt, oq.payload->>'prompt') as prompt,
  upper(coalesce(q.book_code, be.book_code, oq.payload->>'book_code')) as book_code,
  public.obs_book_testament(
    upper(coalesce(q.book_code, be.book_code, oq.payload->>'book_code'))
  ) as testament,
  public.obs_book_section(
    upper(coalesce(q.book_code, be.book_code, oq.payload->>'book_code'))
  ) as section,
  coalesce(
    q.dimension_key,
    override_dimension.dimension_key,
    public.obs_infer_question_dimension(
      oq.question_type,
      oq.payload,
      oq.payload->>'prompt'
    )
  ) as dimension_key,
  public.obs_infer_question_chapter(
    upper(coalesce(q.book_code, be.book_code, oq.payload->>'book_code')),
    coalesce(q.prompt, oq.payload->>'prompt'),
    oq.payload,
    oq.dedupe_key
  ) as inferred_chapter,
  coalesce(es.importance_tier, 2) as importance_tier,
  coalesce(bw.chronological_weight, 1.0)::numeric as chronological_weight,
  public.obs_effective_item_irt_a(
    oq.payload,
    be.irt_a::double precision
  ) as effective_irt_a,
  public.obs_effective_item_irt_b(
    oq.payload,
    be.irt_b::double precision
  ) as effective_irt_b
from public.assessment_answers aa
join public.ot_generated_questions oq
  on oq.id = aa.generated_question_id
left join public.obs_question_bank_with_dimensions q
  on q.generated_question_id = oq.id
left join public.obs_question_dimension_overrides override_dimension
  on override_dimension.generated_question_id = oq.id
left join public.bible_events be
  on be.id = oq.event_id
left join public.event_significance es
  on es.event_id = oq.event_id
left join public.book_bli_weights bw
  on upper(bw.book_code) = upper(
    coalesce(q.book_code, be.book_code, oq.payload->>'book_code')
  );

create or replace function public.obs_compute_scoped_bli(
  p_user_id uuid,
  p_testament text,
  p_as_of timestamptz default null
)
returns table (
  raw_bli numeric,
  display_bli integer,
  bli_level text,
  questions_answered integer,
  correct_answers integer,
  idk_answers integer,
  section_scores jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where public.obs_is_authorized_user(p_user_id)
      and upper(p_testament) in ('OT', 'NT')
  ),
  rows as (
    select
      evidence.*,
      evidence.chronological_weight
        * case evidence.importance_tier
            when 1 then 1.0
            when 2 then 0.6
            else 0.35
          end as item_weight
    from public.obs_answer_evidence evidence
    join authorized on true
    where evidence.user_id = p_user_id
      and evidence.testament = upper(p_testament)
      and (p_as_of is null or evidence.answered_at <= p_as_of)
      and evidence.question_type not like 'quarantined%'
  ),
  aggregate_score as (
    select
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      coalesce(sum(item_weight), 0) as possible,
      coalesce(sum(
        case
          when is_idk then 0
          when is_correct then
            item_weight * least(
              1.25,
              greatest(0.70, 1.0 + 0.20 * effective_irt_b)
            )
          else -1 * item_weight * (0.25 / 0.75)
        end
      ), 0) as earned
    from rows
  ),
  normalized as (
    select
      greatest(
        0,
        least(
          100,
          round(
            (
              case
                when possible > 0 then earned / possible * 100
                else 0
              end
            )::numeric,
            2
          )
        )
      ) as raw_score,
      answered,
      correct,
      idk
    from aggregate_score
  ),
  section_aggregates as (
    select
      section,
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      round(
        count(*) filter (where is_correct)::numeric
          / nullif(count(*), 0) * 100,
        1
      ) as accuracy
    from rows
    group by section
  ),
  sections as (
    select coalesce(
      jsonb_object_agg(
        section,
        jsonb_build_object(
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy', accuracy
        )
      ),
      '{}'::jsonb
    ) as scores
    from section_aggregates
  )
  select
    normalized.raw_score,
    public.obs_display_score_from_raw(normalized.raw_score),
    public.obs_display_bli_level(
      public.obs_display_score_from_raw(normalized.raw_score)
    ),
    normalized.answered,
    normalized.correct,
    normalized.idk,
    sections.scores
  from normalized
  cross join sections;
$$;

create or replace function public.obs_capture_assessment_snapshot(
  p_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_testament text;
  v_as_of timestamptz;
  v_scope text;
  v_score record;
  v_ability record;
begin
  select
    attempt.user_id,
    upper(nullif(attempt.testament, '')),
    max(answered.answered_at)
  into v_user_id, v_testament, v_as_of
  from public.assessment_attempts attempt
  left join public.assessment_answers answered
    on answered.attempt_id = attempt.id
  where attempt.id = p_attempt_id
  group by attempt.user_id, attempt.testament;

  if v_user_id is null or v_as_of is null then
    return;
  end if;

  if v_testament not in ('OT', 'NT') then
    select evidence.testament
    into v_testament
    from public.obs_answer_evidence evidence
    where evidence.attempt_id = p_attempt_id
      and evidence.testament is not null
    order by evidence.answered_at desc
    limit 1;
  end if;

  if v_testament not in ('OT', 'NT') then
    return;
  end if;

  select *
  into v_score
  from public.obs_compute_scoped_bli(v_user_id, v_testament, v_as_of);

  v_scope := v_testament;
  select ability.theta, ability.theta_se, ability.n_responses
  into v_ability
  from public.user_abilities ability
  where ability.user_id = v_user_id
    and ability.scope = v_scope;

  insert into public.obs_assessment_snapshots (
    attempt_id,
    user_id,
    testament,
    raw_bli,
    display_bli,
    bli_level,
    questions_answered,
    correct_answers,
    idk_answers,
    theta,
    theta_se,
    n_responses,
    section_scores,
    captured_at
  ) values (
    p_attempt_id,
    v_user_id,
    v_testament,
    coalesce(v_score.raw_bli, 0),
    coalesce(v_score.display_bli, 200),
    coalesce(v_score.bli_level, 'Unfamiliar'),
    coalesce(v_score.questions_answered, 0),
    coalesce(v_score.correct_answers, 0),
    coalesce(v_score.idk_answers, 0),
    v_ability.theta,
    v_ability.theta_se,
    coalesce(v_ability.n_responses, 0),
    coalesce(v_score.section_scores, '{}'::jsonb),
    v_as_of
  )
  on conflict (attempt_id, testament) do update
  set raw_bli = excluded.raw_bli,
      display_bli = excluded.display_bli,
      bli_level = excluded.bli_level,
      questions_answered = excluded.questions_answered,
      correct_answers = excluded.correct_answers,
      idk_answers = excluded.idk_answers,
      theta = excluded.theta,
      theta_se = excluded.theta_se,
      n_responses = excluded.n_responses,
      section_scores = excluded.section_scores,
      captured_at = excluded.captured_at;
end;
$$;

create or replace function public.obs_snapshot_answer_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.obs_capture_assessment_snapshot(new.attempt_id);
  return null;
end;
$$;

drop trigger if exists obs_capture_snapshot_after_answer
  on public.assessment_answers;
create constraint trigger obs_capture_snapshot_after_answer
after insert or update of is_correct, is_idk on public.assessment_answers
deferrable initially deferred
for each row
execute function public.obs_snapshot_answer_trigger();

create or replace function public.obs_backfill_assessment_snapshots(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_count integer := 0;
begin
  if not public.obs_is_authorized_user(p_user_id) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  for v_attempt in
    select distinct answer.attempt_id
    from public.assessment_answers answer
    where answer.user_id = p_user_id
      and answer.attempt_id is not null
  loop
    perform public.obs_capture_assessment_snapshot(v_attempt.attempt_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.obs_get_progress_history(
  p_user_id uuid,
  p_testament text default 'OT',
  p_limit integer default 50
)
returns table (
  attempt_id uuid,
  captured_at timestamptz,
  raw_bli numeric,
  display_bli integer,
  bli_level text,
  questions_answered integer,
  correct_answers integer,
  idk_answers integer,
  theta double precision,
  theta_se double precision,
  n_responses integer,
  score_change integer
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where public.obs_is_authorized_user(p_user_id)
  ),
  history as (
    select
      snapshot.*,
      snapshot.display_bli
        - lag(snapshot.display_bli) over (order by snapshot.captured_at)
        as delta
    from public.obs_assessment_snapshots snapshot
    join authorized on true
    where snapshot.user_id = p_user_id
      and snapshot.testament = upper(coalesce(p_testament, 'OT'))
  )
  select
    history.attempt_id,
    history.captured_at,
    history.raw_bli,
    history.display_bli,
    history.bli_level,
    history.questions_answered,
    history.correct_answers,
    history.idk_answers,
    history.theta,
    history.theta_se,
    history.n_responses,
    coalesce(history.delta, 0)::integer
  from history
  order by history.captured_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.obs_get_attempt_summary(
  p_user_id uuid,
  p_attempt_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select attempt.id, attempt.user_id, upper(coalesce(attempt.testament, 'OT')) as testament
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and public.obs_is_authorized_user(p_user_id)
  ),
  answers as (
    select evidence.*
    from public.obs_answer_evidence evidence
    join authorized_attempt attempt
      on attempt.id = evidence.attempt_id
  ),
  scope_breakdown as (
    select
      'section'::text as breakdown_type,
      section as breakdown_key,
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk
    from answers
    group by section
    union all
    select
      'book',
      book_code,
      count(*)::integer,
      count(*) filter (where is_correct)::integer,
      count(*) filter (where is_idk)::integer
    from answers
    group by book_code
    union all
    select
      'dimension',
      dimension_key,
      count(*)::integer,
      count(*) filter (where is_correct)::integer,
      count(*) filter (where is_idk)::integer
    from answers
    group by dimension_key
  ),
  breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', breakdown_type,
          'key', breakdown_key,
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy', round(correct::numeric / nullif(answered, 0) * 100, 1)
        )
        order by breakdown_type, breakdown_key
      ),
      '[]'::jsonb
    ) as value
    from scope_breakdown
  ),
  totals as (
    select
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      min(answered_at) as started_at,
      max(answered_at) as completed_at
    from answers
  )
  select case
    when not exists (select 1 from authorized_attempt) then null
    else jsonb_build_object(
      'attempt_id', p_attempt_id,
      'testament', (select testament from authorized_attempt limit 1),
      'answered', totals.answered,
      'correct', totals.correct,
      'idk', totals.idk,
      'accuracy', round(totals.correct::numeric / nullif(totals.answered, 0) * 100, 1),
      'started_at', totals.started_at,
      'completed_at', totals.completed_at,
      'snapshot', (
        select to_jsonb(snapshot) - 'id' - 'user_id'
        from public.obs_assessment_snapshots snapshot
        where snapshot.attempt_id = p_attempt_id
        order by snapshot.captured_at desc
        limit 1
      ),
      'breakdown', breakdown.value
    )
  end
  from totals
  cross join breakdown;
$$;

create or replace function public.obs_get_attempt_review(
  p_user_id uuid,
  p_attempt_id uuid
)
returns table (
  answer_id uuid,
  answered_at timestamptz,
  generated_question_id uuid,
  prompt text,
  choices jsonb,
  selected_choice_id text,
  selected_choice_text text,
  correct_choice_id text,
  correct_choice_text text,
  is_correct boolean,
  is_idk boolean,
  book_code text,
  section text,
  dimension_key text,
  source_ref text,
  explanation text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    evidence.answer_id,
    evidence.answered_at,
    evidence.generated_question_id,
    evidence.prompt,
    coalesce(evidence.payload->'choices', '[]'::jsonb),
    evidence.selected_choice_id,
    (
      select choice->>'text'
      from jsonb_array_elements(
        case
          when jsonb_typeof(evidence.payload->'choices') = 'array'
            then evidence.payload->'choices'
          else '[]'::jsonb
        end
      ) choice
      where choice->>'id' = evidence.selected_choice_id
      limit 1
    ),
    coalesce(
      evidence.payload->>'correct_choice_id',
      evidence.payload->>'answer_id',
      evidence.payload->>'correctAnswerId'
    ),
    (
      select choice->>'text'
      from jsonb_array_elements(
        case
          when jsonb_typeof(evidence.payload->'choices') = 'array'
            then evidence.payload->'choices'
          else '[]'::jsonb
        end
      ) choice
      where choice->>'id' = coalesce(
        evidence.payload->>'correct_choice_id',
        evidence.payload->>'answer_id',
        evidence.payload->>'correctAnswerId'
      )
      limit 1
    ),
    evidence.is_correct,
    evidence.is_idk,
    evidence.book_code,
    evidence.section,
    evidence.dimension_key,
    coalesce(
      evidence.payload->>'source_ref',
      evidence.payload->>'reference'
    ),
    coalesce(
      evidence.payload->>'explanation',
      evidence.payload->>'rationale',
      evidence.payload->>'answer_explanation'
    )
  from public.obs_answer_evidence evidence
  where evidence.user_id = p_user_id
    and evidence.attempt_id = p_attempt_id
    and public.obs_is_authorized_user(p_user_id)
  order by evidence.answered_at, evidence.answer_id;
$$;

create or replace function public.obs_get_bli_uncertainty(
  p_user_id uuid,
  p_scope text default 'OT'
)
returns table (
  scope text,
  theta double precision,
  theta_se double precision,
  theta_lower_95 double precision,
  theta_upper_95 double precision,
  n_responses integer,
  evidence_level text,
  evidence_description text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ability.scope,
    ability.theta,
    ability.theta_se,
    ability.theta - 1.96 * ability.theta_se,
    ability.theta + 1.96 * ability.theta_se,
    ability.n_responses,
    case
      when ability.n_responses < 10 or ability.theta_se > 0.80 then 'Very limited'
      when ability.n_responses < 20 or ability.theta_se > 0.60 then 'Limited'
      when ability.n_responses < 40 or ability.theta_se > 0.45 then 'Developing'
      when ability.n_responses < 80 or ability.theta_se > 0.30 then 'Strong'
      else 'Very strong'
    end,
    case
      when ability.n_responses < 10 or ability.theta_se > 0.80
        then 'Only a small amount of evidence is available; expect the estimate to move.'
      when ability.n_responses < 20 or ability.theta_se > 0.60
        then 'The estimate is useful as a starting point but remains sensitive to new answers.'
      when ability.n_responses < 40 or ability.theta_se > 0.45
        then 'The estimate is stabilizing across a broader set of questions.'
      when ability.n_responses < 80 or ability.theta_se > 0.30
        then 'The estimate is supported by substantial evidence and should move gradually.'
      else 'The estimate is supported by broad evidence across many questions.'
    end
  from public.user_abilities ability
  where ability.user_id = p_user_id
    and ability.scope = upper(coalesce(p_scope, 'OT'))
    and public.obs_is_authorized_user(p_user_id)
  limit 1;
$$;

create or replace function public.obs_get_scope_summary(
  p_user_id uuid,
  p_scope_type text,
  p_scope_key text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select
      upper(btrim(p_scope_type)) as scope_type,
      btrim(p_scope_key) as scope_key
    where public.obs_is_authorized_user(p_user_id)
      and upper(btrim(p_scope_type)) in (
        'TESTAMENT', 'SECTION', 'BOOK', 'DIMENSION', 'UNIT'
      )
  ),
  matched as (
    select
      evidence.*,
      unit.unit_key,
      unit.label as unit_label
    from public.obs_answer_evidence evidence
    cross join requested request
    left join public.obs_learning_units unit
      on unit.book_code = evidence.book_code
     and evidence.inferred_chapter between unit.start_chapter and unit.end_chapter
    where evidence.user_id = p_user_id
      and case request.scope_type
        when 'TESTAMENT' then evidence.testament = upper(request.scope_key)
        when 'SECTION' then lower(evidence.section) = lower(request.scope_key)
        when 'BOOK' then evidence.book_code = upper(request.scope_key)
        when 'DIMENSION' then evidence.dimension_key = public.obs_normalize_dimension_key(request.scope_key)
        when 'UNIT' then unit.unit_key = request.scope_key
        else false
      end
  ),
  totals as (
    select
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      min(answered_at) as first_answered_at,
      max(answered_at) as last_answered_at
    from matched
  ),
  by_book as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'book_code', book_code,
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy', round(correct::numeric / nullif(answered, 0) * 100, 1)
        )
        order by book_code
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        book_code,
        count(*)::integer as answered,
        count(*) filter (where is_correct)::integer as correct,
        count(*) filter (where is_idk)::integer as idk
      from matched
      group by book_code
    ) grouped
  ),
  by_dimension as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'dimension_key', dimension_key,
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy', round(correct::numeric / nullif(answered, 0) * 100, 1)
        )
        order by dimension_key
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        dimension_key,
        count(*)::integer as answered,
        count(*) filter (where is_correct)::integer as correct,
        count(*) filter (where is_idk)::integer as idk
      from matched
      group by dimension_key
    ) grouped
  )
  select jsonb_build_object(
    'scope_type', requested.scope_type,
    'scope_key', requested.scope_key,
    'answered', totals.answered,
    'correct', totals.correct,
    'idk', totals.idk,
    'accuracy', round(totals.correct::numeric / nullif(totals.answered, 0) * 100, 1),
    'first_answered_at', totals.first_answered_at,
    'last_answered_at', totals.last_answered_at,
    'evidence_level', case
      when totals.answered < 5 then 'Needs more evidence'
      when totals.answered < 12 then 'Low evidence'
      when totals.answered < 25 then 'Moderate evidence'
      else 'High evidence'
    end,
    'books', by_book.value,
    'dimensions', by_dimension.value
  )
  from requested
  cross join totals
  cross join by_book
  cross join by_dimension;
$$;

create or replace function public.obs_record_study_event(
  p_user_id uuid,
  p_unit_key text,
  p_event_type text,
  p_attempt_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.obs_is_authorized_user(p_user_id) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  insert into public.obs_study_plan_events (
    user_id,
    unit_key,
    event_type,
    attempt_id,
    metadata
  ) values (
    p_user_id,
    p_unit_key,
    lower(btrim(p_event_type)),
    p_attempt_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on table public.obs_answer_evidence from public, anon, authenticated;
grant select on public.obs_answer_evidence to service_role;

revoke all on function public.obs_is_authorized_user(uuid) from public;
grant execute on function public.obs_is_authorized_user(uuid)
  to authenticated, service_role;

grant execute on function public.obs_book_testament(text)
  to anon, authenticated, service_role;
grant execute on function public.obs_book_section(text)
  to anon, authenticated, service_role;
grant execute on function public.obs_display_bli_level(integer)
  to anon, authenticated, service_role;

revoke all on function public.obs_compute_scoped_bli(uuid, text, timestamptz)
  from public, anon;
revoke all on function public.obs_capture_assessment_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.obs_backfill_assessment_snapshots(uuid)
  from public, anon;
revoke all on function public.obs_get_progress_history(uuid, text, integer)
  from public, anon;
revoke all on function public.obs_get_attempt_summary(uuid, uuid)
  from public, anon;
revoke all on function public.obs_get_attempt_review(uuid, uuid)
  from public, anon;
revoke all on function public.obs_get_bli_uncertainty(uuid, text)
  from public, anon;
revoke all on function public.obs_get_scope_summary(uuid, text, text)
  from public, anon;
revoke all on function public.obs_record_study_event(uuid, text, text, uuid, jsonb)
  from public, anon;

grant execute on function public.obs_compute_scoped_bli(uuid, text, timestamptz)
  to authenticated, service_role;
grant execute on function public.obs_backfill_assessment_snapshots(uuid)
  to authenticated, service_role;
grant execute on function public.obs_get_progress_history(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.obs_get_attempt_summary(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.obs_get_attempt_review(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.obs_get_bli_uncertainty(uuid, text)
  to authenticated, service_role;
grant execute on function public.obs_get_scope_summary(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.obs_record_study_event(uuid, text, text, uuid, jsonb)
  to authenticated, service_role;

grant select on public.obs_assessment_snapshots
  to authenticated, service_role;
grant select on public.obs_study_plan_events
  to authenticated, service_role;

comment on function public.obs_get_bli_uncertainty(uuid, text) is
  'Returns posterior theta uncertainty and a plain-language evidence label. The theta interval must not be presented as a BLI score interval.';

comment on table public.obs_assessment_snapshots is
  'One cumulative learner-score snapshot per attempt and testament, captured after answer transactions commit.';

notify pgrst, 'reload schema';

commit;
