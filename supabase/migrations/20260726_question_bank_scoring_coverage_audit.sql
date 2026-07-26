-- Read-only question-bank scoring and coverage audit.
--
-- All objects are service-role only. Statistical flags are screening signals,
-- not automatic grounds for quarantine. Difficulty and distractor diagnostics
-- require at least 12 usable responses before they can produce a quality flag.

begin;

do $$
begin
  if to_regclass('public.v_question_bank') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.question_coverage_targets') is null
     or to_regclass('public.obs_biblical_books') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.user_abilities') is null
     or to_regprocedure('public.canonical_assessment_scope(text)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'A required question-bank, taxonomy, response, or scoring object is missing.';
  end if;
end
$$;

create or replace view public.obs_admin_question_bank_audit as
with question_rows as (
  select
    q.generated_question_id,
    q.question_id,
    q.event_id,
    q.question_type,
    q.dedupe_key,
    q.created_at,
    q.payload,
    coalesce(nullif(q.payload->>'prompt', ''), nullif(q.prompt, '')) as prompt,
    upper(coalesce(q.book_code, event.book_code, q.payload->>'book_code')) as book_code,
    q.dimension_key,
    public.obs_infer_question_chapter(
      upper(coalesce(q.book_code, event.book_code, q.payload->>'book_code')),
      coalesce(nullif(q.payload->>'prompt', ''), nullif(q.prompt, '')),
      q.payload,
      q.dedupe_key
    ) as inferred_chapter,
    nullif(q.payload->>'stem_family', '') as stem_family,
    coalesce(
      q.payload->>'correct_choice_id',
      q.payload->>'answer_id',
      q.payload->>'correctAnswerId'
    ) as correct_choice_id,
    case
      when jsonb_typeof(q.payload->'choices') = 'array'
        then jsonb_array_length(q.payload->'choices')
      else null
    end as choice_count,
    case
      when q.payload->>'question_layer' ~ '^[123]$'
        then (q.payload->>'question_layer')::integer
      else null
    end as question_layer,
    coalesce(
      significance.importance_tier,
      case
        when q.payload->>'importance_tier' ~ '^[123]$'
          then (q.payload->>'importance_tier')::integer
      end,
      case
        when coalesce(q.importance_conceptual, q.routing_score, 0) >= 80 then 1
        when coalesce(q.importance_conceptual, q.routing_score, 0) >= 60 then 2
        else 3
      end
    ) as importance_tier,
    public.obs_effective_item_irt_a(
      q.payload,
      event.irt_a::double precision
    ) as effective_irt_a,
    public.obs_effective_item_irt_b(
      q.payload,
      event.irt_b::double precision
    ) as effective_irt_b
  from public.obs_question_bank_with_dimensions q
  left join public.bible_events event
    on event.id = q.event_id
  left join public.event_significance significance
    on significance.event_id = q.event_id
), validated as (
  select
    row.*,
    book.testament,
    book.section_key,
    book.section_name,
    (book.book_code is not null) as book_is_valid,
    (dimension.dimension_key is not null) as dimension_is_valid,
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(row.payload->'choices') = 'array'
            then row.payload->'choices'
          else '[]'::jsonb
        end
      ) choice
      where choice->>'id' = row.correct_choice_id
    ) as answer_key_matches_choice,
    coalesce(target.target_active_questions, 0) as target_active_questions,
    coalesce(target.minimum_active_questions, 0) as minimum_active_questions
  from question_rows row
  left join public.obs_biblical_books book
    on book.book_code = row.book_code
  left join public.obs_bli_dimensions dimension
    on dimension.dimension_key = row.dimension_key
  left join public.question_coverage_targets target
    on target.book_code = row.book_code
   and target.dimension_key = row.dimension_key
)
select
  validated.*,
  array_remove(array[
    case when prompt is null then 'missing_prompt' end,
    case when not book_is_valid then 'missing_or_invalid_book' end,
    case when not dimension_is_valid then 'missing_or_invalid_dimension' end,
    case when choice_count is null then 'choices_not_array' end,
    case when choice_count is distinct from 4 then 'choice_count_not_four' end,
    case when correct_choice_id is null then 'missing_answer_key' end,
    case
      when correct_choice_id is not null and not answer_key_matches_choice
        then 'answer_key_not_in_choices'
    end,
    case when target_active_questions <= 0 then 'no_positive_coverage_target' end
  ]::text[], null) as blocker_reasons,
  array_remove(array[
    case when event_id is null then 'eventless_question' end,
    case when inferred_chapter is null then 'chapter_not_inferred' end,
    case when question_layer is null then 'missing_question_layer' end,
    case when importance_tier not between 1 and 3 then 'invalid_importance_tier' end,
    case when dedupe_key is null or btrim(dedupe_key) = '' then 'missing_dedupe_key' end,
    case when stem_family is null then 'missing_stem_family' end
  ]::text[], null) as warning_reasons,
  (
    prompt is not null
    and book_is_valid
    and dimension_is_valid
    and choice_count = 4
    and correct_choice_id is not null
    and answer_key_matches_choice
    and target_active_questions > 0
  ) as router_eligible,
  md5(regexp_replace(lower(coalesce(prompt, '')), '\s+', ' ', 'g'))
    as prompt_fingerprint
from validated;

create or replace view public.obs_admin_coverage_audit as
with counts as (
  select
    audit.book_code,
    audit.dimension_key,
    count(*)::integer as active_questions,
    count(*) filter (where audit.router_eligible)::integer
      as router_eligible_questions,
    count(*) filter (where cardinality(audit.blocker_reasons) > 0)::integer
      as blocker_questions,
    count(*) filter (where cardinality(audit.warning_reasons) > 0)::integer
      as warning_questions,
    count(*) filter (where audit.importance_tier = 1)::integer as tier_1_questions,
    count(*) filter (where audit.importance_tier = 2)::integer as tier_2_questions,
    count(*) filter (where audit.importance_tier = 3)::integer as tier_3_questions,
    count(*) filter (where audit.question_layer = 1)::integer as layer_1_questions,
    count(*) filter (where audit.question_layer = 2)::integer as layer_2_questions,
    count(*) filter (where audit.question_layer = 3)::integer as layer_3_questions,
    count(distinct audit.event_id)::integer as distinct_events,
    count(distinct audit.stem_family)::integer as distinct_stem_families,
    count(distinct audit.prompt_fingerprint)::integer as distinct_prompts
  from public.obs_admin_question_bank_audit audit
  group by audit.book_code, audit.dimension_key
), response_counts as (
  select
    evidence.book_code,
    evidence.dimension_key,
    count(*)::integer as answer_count
  from public.obs_answer_evidence evidence
  group by evidence.book_code, evidence.dimension_key
)
select
  target.book_code,
  book.display_name as book_name,
  book.testament,
  book.section_key,
  book.section_name,
  target.dimension_key,
  dimension.label as dimension_name,
  target.minimum_active_questions,
  target.target_active_questions,
  target.priority,
  coalesce(counts.active_questions, 0) as active_questions,
  coalesce(counts.router_eligible_questions, 0) as router_eligible_questions,
  greatest(
    target.target_active_questions
      - coalesce(counts.router_eligible_questions, 0),
    0
  ) as target_gap,
  coalesce(counts.blocker_questions, 0) as blocker_questions,
  coalesce(counts.warning_questions, 0) as warning_questions,
  coalesce(counts.tier_1_questions, 0) as tier_1_questions,
  coalesce(counts.tier_2_questions, 0) as tier_2_questions,
  coalesce(counts.tier_3_questions, 0) as tier_3_questions,
  coalesce(counts.layer_1_questions, 0) as layer_1_questions,
  coalesce(counts.layer_2_questions, 0) as layer_2_questions,
  coalesce(counts.layer_3_questions, 0) as layer_3_questions,
  coalesce(counts.distinct_events, 0) as distinct_events,
  coalesce(counts.distinct_stem_families, 0) as distinct_stem_families,
  coalesce(counts.distinct_prompts, 0) as distinct_prompts,
  coalesce(response_counts.answer_count, 0) as answer_count,
  case
    when coalesce(counts.router_eligible_questions, 0) = 0 then 'empty'
    when counts.router_eligible_questions < target.minimum_active_questions
      then 'below_minimum'
    when counts.router_eligible_questions < target.target_active_questions
      then 'under_target'
    when counts.distinct_prompts < greatest(
      target.minimum_active_questions,
      ceil(target.target_active_questions * 0.60)::integer
    ) then 'low_variety'
    else 'healthy'
  end as coverage_status
from public.question_coverage_targets target
join public.obs_biblical_books book
  on book.book_code = target.book_code
join public.obs_bli_dimensions dimension
  on dimension.dimension_key = target.dimension_key
left join counts
  on counts.book_code = target.book_code
 and counts.dimension_key = target.dimension_key
left join response_counts
  on response_counts.book_code = target.book_code
 and response_counts.dimension_key = target.dimension_key;

create or replace view public.obs_admin_repetition_audit as
with event_groups as (
  select
    'event'::text as repetition_type,
    audit.event_id::text as group_key,
    min(audit.book_code) as book_code,
    count(*)::integer as active_questions,
    count(distinct audit.prompt_fingerprint)::integer as distinct_prompts,
    sum(coalesce(quality.answer_count, 0))::integer as answer_count,
    min(audit.prompt) as sample_prompt,
    (array_agg(audit.generated_question_id order by audit.generated_question_id))[1:10]
      as sample_question_ids,
    case when count(*) >= 10 then 'high' else 'review' end as severity
  from public.obs_admin_question_bank_audit audit
  left join public.obs_admin_question_quality quality
    on quality.generated_question_id = audit.generated_question_id
  where audit.event_id is not null
  group by audit.event_id
  having count(*) >= 6
), prompt_groups as (
  select
    'exact_prompt'::text as repetition_type,
    audit.prompt_fingerprint as group_key,
    min(audit.book_code) as book_code,
    count(*)::integer as active_questions,
    count(distinct audit.prompt_fingerprint)::integer as distinct_prompts,
    sum(coalesce(quality.answer_count, 0))::integer as answer_count,
    min(audit.prompt) as sample_prompt,
    (array_agg(audit.generated_question_id order by audit.generated_question_id))[1:10]
      as sample_question_ids,
    case when count(*) >= 4 then 'high' else 'review' end as severity
  from public.obs_admin_question_bank_audit audit
  left join public.obs_admin_question_quality quality
    on quality.generated_question_id = audit.generated_question_id
  where audit.prompt is not null
  group by audit.prompt_fingerprint
  having count(*) >= 2
), family_groups as (
  select
    'stem_family'::text as repetition_type,
    audit.stem_family as group_key,
    min(audit.book_code) as book_code,
    count(*)::integer as active_questions,
    count(distinct audit.prompt_fingerprint)::integer as distinct_prompts,
    sum(coalesce(quality.answer_count, 0))::integer as answer_count,
    min(audit.prompt) as sample_prompt,
    (array_agg(audit.generated_question_id order by audit.generated_question_id))[1:10]
      as sample_question_ids,
    case when count(*) >= 9 then 'high' else 'review' end as severity
  from public.obs_admin_question_bank_audit audit
  left join public.obs_admin_question_quality quality
    on quality.generated_question_id = audit.generated_question_id
  where audit.stem_family is not null
  group by audit.stem_family
  having count(*) >= 5
)
select * from event_groups
union all
select * from prompt_groups
union all
select * from family_groups;

create or replace view public.obs_admin_difficulty_audit as
with modeled_responses as (
  select
    audit.generated_question_id,
    answer.is_correct,
    1.0 / (
      1.0 + exp(
        -audit.effective_irt_a
        * (ability.theta - audit.effective_irt_b)
      )
    ) as expected_probability
  from public.obs_admin_question_bank_audit audit
  join public.assessment_answers answer
    on answer.generated_question_id = audit.generated_question_id
   and answer.answered_at is not null
   and not coalesce(answer.is_idk, false)
  join public.user_abilities ability
    on ability.user_id = answer.user_id
   and ability.scope = public.canonical_assessment_scope(audit.book_code)
), modeled_totals as (
  select
    response.generated_question_id,
    count(*)::integer as calibration_answer_count,
    round(
      avg(case when response.is_correct then 1.0 else 0.0 end)::numeric * 100,
      1
    ) as observed_percent_correct,
    round(avg(response.expected_probability)::numeric * 100, 1)
      as model_expected_percent_correct
  from modeled_responses response
  group by response.generated_question_id
), all_totals as (
  select
    answer.generated_question_id,
    count(*) filter (
      where answer.answered_at is not null
        and not coalesce(answer.is_idk, false)
    )::integer as non_idk_answer_count
  from public.assessment_answers answer
  group by answer.generated_question_id
)
select
  audit.generated_question_id,
  audit.book_code,
  audit.dimension_key,
  audit.prompt,
  audit.effective_irt_a,
  audit.effective_irt_b,
  coalesce(all_totals.non_idk_answer_count, 0) as non_idk_answer_count,
  coalesce(modeled.calibration_answer_count, 0) as calibration_answer_count,
  modeled.observed_percent_correct,
  modeled.model_expected_percent_correct,
  round(
    modeled.observed_percent_correct
      - modeled.model_expected_percent_correct,
    1
  ) as residual_percentage_points,
  case
    when coalesce(modeled.calibration_answer_count, 0) < 12
      then 'insufficient_data'
    when abs(
      modeled.observed_percent_correct
        - modeled.model_expected_percent_correct
    ) >= 25 then 'high_mismatch'
    when abs(
      modeled.observed_percent_correct
        - modeled.model_expected_percent_correct
    ) >= 15 then 'review'
    else 'aligned'
  end as difficulty_status
from public.obs_admin_question_bank_audit audit
left join modeled_totals modeled
  on modeled.generated_question_id = audit.generated_question_id
left join all_totals
  on all_totals.generated_question_id = audit.generated_question_id;

create or replace view public.obs_admin_distractor_audit as
with choices as (
  select
    audit.generated_question_id,
    audit.book_code,
    audit.dimension_key,
    audit.prompt,
    audit.correct_choice_id,
    choice->>'id' as choice_id,
    coalesce(
      choice->>'text',
      choice->>'label',
      choice->>'value',
      '<text unavailable>'
    ) as choice_text
  from public.obs_admin_question_bank_audit audit
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(audit.payload->'choices') = 'array'
        then audit.payload->'choices'
      else '[]'::jsonb
    end
  ) choice
  where audit.answer_key_matches_choice
    and choice->>'id' is distinct from audit.correct_choice_id
), answer_totals as (
  select
    answer.generated_question_id,
    count(*) filter (
      where answer.answered_at is not null
        and not coalesce(answer.is_idk, false)
    )::integer as exposure_count
  from public.assessment_answers answer
  group by answer.generated_question_id
), selected_totals as (
  select
    answer.generated_question_id,
    answer.selected_choice_id as choice_id,
    count(*)::integer as selected_count
  from public.assessment_answers answer
  where answer.answered_at is not null
    and not coalesce(answer.is_idk, false)
  group by answer.generated_question_id, answer.selected_choice_id
)
select
  choices.generated_question_id,
  choices.book_code,
  choices.dimension_key,
  choices.prompt,
  choices.choice_id,
  choices.choice_text,
  coalesce(answer_totals.exposure_count, 0) as exposure_count,
  coalesce(selected_totals.selected_count, 0) as selected_count,
  case
    when coalesce(answer_totals.exposure_count, 0) = 0 then null
    else round(
      coalesce(selected_totals.selected_count, 0)::numeric
        / answer_totals.exposure_count * 100,
      1
    )
  end as selection_percent,
  case
    when coalesce(answer_totals.exposure_count, 0) < 12
      then 'insufficient_data'
    when coalesce(selected_totals.selected_count, 0) = 0
      then 'never_selected'
    when selected_totals.selected_count::numeric
      / answer_totals.exposure_count < 0.05
      then 'weak'
    else 'working'
  end as distractor_status
from choices
left join answer_totals
  on answer_totals.generated_question_id = choices.generated_question_id
left join selected_totals
  on selected_totals.generated_question_id = choices.generated_question_id
 and selected_totals.choice_id = choices.choice_id;

create or replace view public.obs_admin_assessment_readiness as
with scope_definitions(scope_key, scope_name, required_serving_units) as (
  values
    ('BIBLE', 'Whole Bible', 20),
    ('OT', 'Old Testament', 20),
    ('NT', 'New Testament', 20),
    ('TORAH', 'Torah', 10),
    ('FORMER', 'Former Prophets', 10),
    ('LATTER', 'Latter Prophets', 10),
    ('WRITINGS', 'Writings', 10),
    ('GOSPELS_ACTS', 'Gospels & Acts', 10),
    ('PAULINE', 'Pauline Epistles', 10),
    ('GENERAL', 'General Epistles', 10),
    ('APOCALYPSE', 'Apocalypse', 10)
), scope_books as (
  select
    scope.scope_key,
    scope.scope_name,
    scope.required_serving_units,
    book.book_code
  from scope_definitions scope
  join public.obs_biblical_books book
    on scope.scope_key = 'BIBLE'
    or scope.scope_key = book.testament
    or scope.scope_key = book.section_key
), question_counts as (
  select
    scope.scope_key,
    count(audit.generated_question_id)::integer as active_questions,
    count(audit.generated_question_id) filter (
      where audit.router_eligible
    )::integer as router_eligible_questions,
    (
      count(audit.generated_question_id) filter (
        where audit.router_eligible and audit.stem_family is null
      )
      + count(distinct audit.stem_family) filter (
        where audit.router_eligible and audit.stem_family is not null
      )
    )::integer as serving_units,
    count(distinct scope.book_code)::integer as books_in_scope,
    count(distinct audit.book_code) filter (
      where audit.router_eligible
    )::integer as books_with_eligible_questions,
    count(distinct audit.dimension_key) filter (
      where audit.router_eligible
    )::integer as dimensions_with_eligible_questions,
    count(audit.generated_question_id) filter (
      where cardinality(audit.blocker_reasons) > 0
    )::integer as blocker_questions,
    count(audit.generated_question_id) filter (
      where cardinality(audit.warning_reasons) > 0
    )::integer as warning_questions
  from scope_books scope
  left join public.obs_admin_question_bank_audit audit
    on audit.book_code = scope.book_code
  group by scope.scope_key
), coverage_counts as (
  select
    scope.scope_key,
    count(*) filter (
      where coverage.coverage_status in ('empty', 'below_minimum')
    )::integer as blocked_coverage_cells,
    count(*) filter (
      where coverage.coverage_status = 'under_target'
    )::integer as under_target_cells
  from scope_books scope
  join public.obs_admin_coverage_audit coverage
    on coverage.book_code = scope.book_code
  group by scope.scope_key
)
select
  scope.scope_key,
  scope.scope_name,
  scope.required_serving_units,
  coalesce(questions.active_questions, 0) as active_questions,
  coalesce(questions.router_eligible_questions, 0) as router_eligible_questions,
  coalesce(questions.serving_units, 0) as serving_units,
  coalesce(questions.books_in_scope, 0) as books_in_scope,
  coalesce(questions.books_with_eligible_questions, 0)
    as books_with_eligible_questions,
  coalesce(questions.dimensions_with_eligible_questions, 0)
    as dimensions_with_eligible_questions,
  coalesce(questions.blocker_questions, 0) as blocker_questions,
  coalesce(questions.warning_questions, 0) as warning_questions,
  coalesce(coverage.blocked_coverage_cells, 0) as blocked_coverage_cells,
  coalesce(coverage.under_target_cells, 0) as under_target_cells,
  case
    when coalesce(questions.serving_units, 0) < scope.required_serving_units
      then 'blocked'
    when questions.serving_units < scope.required_serving_units * 2
      then 'thin'
    when coalesce(coverage.blocked_coverage_cells, 0) > 0
      then 'ready_with_gaps'
    else 'ready'
  end as readiness_status
from scope_definitions scope
left join question_counts questions
  on questions.scope_key = scope.scope_key
left join coverage_counts coverage
  on coverage.scope_key = scope.scope_key;

create or replace view public.obs_admin_question_bank_audit_summary as
select
  'metadata'::text as audit_group,
  'questions_with_blockers'::text as metric_key,
  'Questions with serving blockers'::text as label,
  case when count(*) > 0 then 'high' else 'ok' end as severity,
  count(*)::integer as item_count,
  'Missing prompt, valid book/dimension, four choices, answer key, or coverage target.'
    as detail
from public.obs_admin_question_bank_audit
where cardinality(blocker_reasons) > 0
union all
select
  'metadata',
  'questions_with_warnings',
  'Questions with metadata warnings',
  case when count(*) > 0 then 'review' else 'ok' end,
  count(*)::integer,
  'Event, chapter, layer, dedupe key, or stem-family metadata needs attention.'
from public.obs_admin_question_bank_audit
where cardinality(warning_reasons) > 0
union all
select
  'coverage',
  'blocked_coverage_cells',
  'Empty or below-minimum coverage cells',
  case when count(*) > 0 then 'high' else 'ok' end,
  count(*)::integer,
  'Book-by-dimension cells that cannot meet their declared minimum.'
from public.obs_admin_coverage_audit
where coverage_status in ('empty', 'below_minimum')
union all
select
  'coverage',
  'under_target_cells',
  'Coverage cells below target',
  case when count(*) > 0 then 'review' else 'ok' end,
  count(*)::integer,
  'Cells that meet the minimum but remain below the desired target.'
from public.obs_admin_coverage_audit
where coverage_status = 'under_target'
union all
select
  'repetition',
  'high_repetition_groups',
  'Highly repeated events or prompts',
  case when count(*) > 0 then 'high' else 'ok' end,
  count(*)::integer,
  'Events, exact prompts, or stem families above the high repetition threshold.'
from public.obs_admin_repetition_audit
where severity = 'high'
union all
select
  'difficulty',
  'difficulty_mismatches',
  'Provisional difficulty mismatches',
  case when count(*) > 0 then 'review' else 'ok' end,
  count(*)::integer,
  'Observed correctness differs from the 2PL expectation after at least 12 modeled responses.'
from public.obs_admin_difficulty_audit
where difficulty_status in ('review', 'high_mismatch')
union all
select
  'distractors',
  'weak_distractors',
  'Never-selected or weak distractors',
  case when count(*) > 0 then 'review' else 'ok' end,
  count(*)::integer,
  'Distractors selected by fewer than 5% after at least 12 exposures.'
from public.obs_admin_distractor_audit
where distractor_status in ('never_selected', 'weak')
union all
select
  'routing',
  'blocked_assessment_scopes',
  'Assessment scopes unable to serve a full set',
  case when count(*) > 0 then 'high' else 'ok' end,
  count(*)::integer,
  'Scopes with fewer independent eligible serving units than the assessment requires.'
from public.obs_admin_assessment_readiness
where readiness_status = 'blocked';

do $$
declare
  object_name text;
begin
  foreach object_name in array array[
    'obs_admin_question_bank_audit',
    'obs_admin_coverage_audit',
    'obs_admin_repetition_audit',
    'obs_admin_difficulty_audit',
    'obs_admin_distractor_audit',
    'obs_admin_assessment_readiness',
    'obs_admin_question_bank_audit_summary'
  ]
  loop
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      object_name
    );
    execute format(
      'grant select on table public.%I to service_role',
      object_name
    );
  end loop;
end
$$;

comment on view public.obs_admin_question_bank_audit is
  'Service-role per-question metadata and router eligibility diagnostics.';
comment on view public.obs_admin_difficulty_audit is
  'Provisional observed-versus-2PL difficulty screening; requires 12 modeled responses before flagging.';
comment on view public.obs_admin_distractor_audit is
  'Per-distractor selection screening; requires 12 non-IDK exposures before flagging.';
comment on view public.obs_admin_assessment_readiness is
  'Static serving-capacity check by testament and canonical section.';

notify pgrst, 'reload schema';

commit;
