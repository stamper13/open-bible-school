-- Read-only audit for repeated/rephrased assessment question clusters.
--
-- Purpose:
--   Find places where the question bank likely contains near-duplicate
--   questions that should share explicit stem_family metadata or be merged.
--
-- Safety:
--   This file performs SELECTs only.

\pset pager off
\pset null '[null]'

\echo ''
\echo '=== Question Duplicate Audit: Summary ==='

with bank as (
  select
    question.generated_question_id,
    public.canonical_testament(question.book_code) as testament,
    public.canonical_assessment_scope(question.book_code) as scope_key,
    question.book_code,
    question.dimension_key,
    question.question_type,
    coalesce(question.payload->>'prompt', question.prompt) as prompt,
    question.payload,
    nullif(btrim(question.payload->>'stem_family'), '') as stem_family,
    nullif(btrim(question.payload->>'source_event_id'), '') as source_event_id,
    lower(nullif(btrim(question.payload->>'question_family'), '')) as question_family,
    lower(nullif(btrim(question.payload->>'knowledge_granularity'), '')) as knowledge_granularity,
    lower(nullif(btrim(question.payload->>'correct_answer'), '')) as correct_answer,
    public.obs_assessment_question_similarity_key(
      question.payload,
      question.book_code,
      question.dimension_key,
      question.question_type,
      coalesce(question.payload->>'prompt', question.prompt)
    ) as similarity_key
  from public.obs_question_bank_with_dimensions question
  where question.generated_question_id is not null
),
clustered as (
  select
    *,
    count(*) over (partition by similarity_key) as similarity_cluster_size,
    count(*) over (
      partition by testament, book_code, dimension_key, question_type, correct_answer
    ) as same_answer_cluster_size,
    count(*) over (
      partition by testament, book_code, dimension_key, question_family, knowledge_granularity
    ) as metadata_cluster_size
  from bank
)
select
  testament,
  count(*)::integer as total_questions,
  count(*) filter (where stem_family is not null)::integer as explicit_stem_family_rows,
  count(*) filter (where stem_family is null)::integer as missing_stem_family_rows,
  count(distinct similarity_key) filter (where similarity_cluster_size > 1)::integer
    as similarity_clusters,
  count(*) filter (where similarity_cluster_size > 1)::integer
    as rows_in_similarity_clusters,
  count(distinct concat_ws('|', testament, book_code, dimension_key, question_type, correct_answer))
    filter (where stem_family is null and correct_answer is not null and same_answer_cluster_size > 1)::integer
    as missing_family_same_answer_clusters,
  count(*) filter (
    where stem_family is null
      and correct_answer is not null
      and same_answer_cluster_size > 1
  )::integer as rows_in_missing_family_same_answer_clusters
from clustered
group by testament
order by testament;

\echo ''
\echo '=== Highest-Priority Missing stem_family Clusters ==='

with bank as (
  select
    question.generated_question_id,
    public.canonical_testament(question.book_code) as testament,
    public.canonical_assessment_scope(question.book_code) as scope_key,
    question.book_code,
    question.dimension_key,
    question.question_type,
    coalesce(question.payload->>'prompt', question.prompt) as prompt,
    question.payload,
    nullif(btrim(question.payload->>'stem_family'), '') as stem_family,
    nullif(btrim(question.payload->>'source_event_id'), '') as source_event_id,
    lower(nullif(btrim(question.payload->>'question_family'), '')) as question_family,
    lower(nullif(btrim(question.payload->>'knowledge_granularity'), '')) as knowledge_granularity,
    lower(nullif(btrim(question.payload->>'correct_answer'), '')) as correct_answer
  from public.obs_question_bank_with_dimensions question
  where question.generated_question_id is not null
),
clusters as (
  select
    testament,
    scope_key,
    book_code,
    dimension_key,
    question_type,
    correct_answer,
    count(*)::integer as cluster_size,
    count(distinct question_family)::integer as question_families,
    count(distinct knowledge_granularity)::integer as granularities,
    array_agg(generated_question_id order by generated_question_id) as question_ids,
    array_agg(left(regexp_replace(prompt, '\s+', ' ', 'g'), 180) order by generated_question_id) as prompt_samples
  from bank
  where stem_family is null
    and correct_answer is not null
  group by testament, scope_key, book_code, dimension_key, question_type, correct_answer
  having count(*) > 1
)
select
  testament,
  scope_key,
  book_code,
  dimension_key,
  question_type,
  cluster_size,
  question_families,
  granularities,
  question_ids[1:6] as sample_question_ids,
  prompt_samples[1:4] as sample_prompts
from clusters
order by
  cluster_size desc,
  question_families asc,
  granularities asc,
  testament,
  scope_key,
  book_code
limit 40;

\echo ''
\echo '=== Existing Similarity Clusters With Multiple Rows ==='

with bank as (
  select
    question.generated_question_id,
    public.canonical_testament(question.book_code) as testament,
    public.canonical_assessment_scope(question.book_code) as scope_key,
    question.book_code,
    question.dimension_key,
    question.question_type,
    coalesce(question.payload->>'prompt', question.prompt) as prompt,
    nullif(btrim(question.payload->>'stem_family'), '') as stem_family,
    public.obs_assessment_question_similarity_key(
      question.payload,
      question.book_code,
      question.dimension_key,
      question.question_type,
      coalesce(question.payload->>'prompt', question.prompt)
    ) as similarity_key
  from public.obs_question_bank_with_dimensions question
  where question.generated_question_id is not null
),
clusters as (
  select
    similarity_key,
    min(testament) as testament,
    min(scope_key) as scope_key,
    min(book_code) as book_code,
    min(dimension_key) as dimension_key,
    min(question_type) as question_type,
    count(*)::integer as cluster_size,
    count(*) filter (where stem_family is not null)::integer as explicit_family_rows,
    array_agg(generated_question_id order by generated_question_id) as question_ids,
    array_agg(left(regexp_replace(prompt, '\s+', ' ', 'g'), 180) order by generated_question_id) as prompt_samples
  from bank
  where similarity_key is not null
  group by similarity_key
  having count(*) > 1
)
select
  testament,
  scope_key,
  book_code,
  dimension_key,
  question_type,
  cluster_size,
  explicit_family_rows,
  question_ids[1:8] as sample_question_ids,
  prompt_samples[1:5] as sample_prompts
from clusters
order by
  cluster_size desc,
  explicit_family_rows asc,
  testament,
  scope_key,
  book_code
limit 60;

\echo ''
\echo '=== Book/Scope Areas Most Missing Explicit stem_family ==='

with bank as (
  select
    question.generated_question_id,
    public.canonical_testament(question.book_code) as testament,
    public.canonical_assessment_scope(question.book_code) as scope_key,
    question.book_code,
    question.dimension_key,
    nullif(btrim(question.payload->>'stem_family'), '') as stem_family
  from public.obs_question_bank_with_dimensions question
  where question.generated_question_id is not null
)
select
  testament,
  scope_key,
  book_code,
  dimension_key,
  count(*)::integer as total_questions,
  count(*) filter (where stem_family is null)::integer as missing_stem_family,
  round(
    100.0 * count(*) filter (where stem_family is null) / nullif(count(*), 0),
    1
  ) as missing_pct
from bank
group by testament, scope_key, book_code, dimension_key
having count(*) >= 5
order by missing_stem_family desc, missing_pct desc, total_questions desc
limit 80;
