# Question Ladder Metadata Audit - 2026-08-24

Source: read-only inspection of the active Supabase project `open-bible-school1`
plus the deterministic V7 Task 3 labeler in
`supabase/migrations/20260824190000_question_ladder_metadata_backfill.sql`.
No production data was changed.

## Summary

- Total live OT questions labeled by the simulated backfill: 1,168
- Book mappings present: 1,168
- Dimension mappings present: 1,168
- Unit mappings present before labeling: 795
- Chapter-addressed prompt count after labeler regex: 349
- Exact chapter recall count after labeler rules: 1
- Low-confidence count after labeler rules: 966
- Needs-review count after labeler rules: 966
- Missing unit mappings for unit/chapter/passage rows: 63
- Suspicious narrow/high-global combinations: 0

## Deterministic Labeling Rules

- Explicit `payload.knowledge_granularity` wins when present.
- Section and book overview question families/types are accepted from structured
  metadata.
- Unit labels use `obs_question_bank_with_units` and `obs_learning_units`.
- Chapter and passage detail labels use explicit granularity first, then the
  existing high-specificity categories and direct book/chapter prompt patterns.
- Prompt parsing is used only for chapter-addressed and exact-chapter signals.
- Narrow rows receive lower global weight and higher local weight by default.
- Exact chapter-number recall is marked `needs_review` and receives a confidence
  demotion.

## Counts From Live Data

### Simulated V7 Labels

| Routing granularity | Count |
|---|---:|
| `chapter_range` | 409 |
| `chapter_detail` | 321 |
| `book_overview` | 256 |
| `book_intersection` | 86 |
| `section_overview` | 43 |
| `verse_detail` | 30 |
| `unit_overview` | 23 |

| Scoring scope level | Count |
|---|---:|
| `unit` | 432 |
| `book` | 342 |
| `chapter` | 321 |
| `section` | 43 |
| `passage` | 30 |

| Depth stage | Count |
|---|---:|
| 1 | 43 |
| 2 | 256 |
| 3 | 518 |
| 4 | 321 |
| 5 | 30 |

### Section Counts

| Section | Count |
|---|---:|
| `TORAH` | 361 |
| `LATTER` | 339 |
| `FORMER` | 245 |
| `WRITINGS` | 223 |

### Dimension Counts

| Dimension | Count |
|---|---:|
| `events_timeline` | 360 |
| `theological_reasoning` | 238 |
| `promise_prophecy` | 165 |
| `characters_lineage` | 141 |
| `geography_nations` | 108 |
| `law_commands` | 88 |
| `structure_cross_ref` | 68 |

### Top Book Counts

| Book | Count |
|---|---:|
| `GEN` | 159 |
| `EXO` | 93 |
| `1SA` | 46 |
| `2KI` | 46 |
| `ISA` | 39 |
| `NUM` | 38 |
| `LEV` | 37 |
| `1KI` | 36 |
| `JDG` | 36 |
| `DAN` | 34 |
| `DEU` | 34 |
| `2SA` | 32 |
| `JER` | 32 |
| `PSA` | 32 |
| `JOS` | 28 |

### Payload Signal Coverage

| Signal | Count |
|---|---:|
| `payload.knowledge_granularity` missing | 1,007 |
| `section_overview` | 43 |
| `book_geography_overview` | 38 |
| `book_overview` | 38 |
| `passage_detail` | 30 |
| `episode_detail` | 11 |
| `unit_overview` | 1 |

### Top Question Types

| Question type | Count |
|---|---:|
| `primary_mcq_v2` | 216 |
| `significance_mcq_v1` | 121 |
| `speech_promise_mcq_v1` | 83 |
| `minimum_coverage_mcq_v1` | 62 |
| `section_competency_mcq_v1` | 39 |
| `book_orientation_mcq_v1` | 38 |
| `geography_book_mcq_v1` | 38 |
| `relationship_curated_mcq_v1` | 34 |
| `foundation_mcq_v1` | 26 |
| `torah_coverage_mcq_v1` | 21 |

### Question Family Signals

| Question family | Count |
|---|---:|
| missing | 981 |
| `section_competency` | 39 |
| `book_geography_overview` | 38 |
| `book_orientation` | 38 |
| `torah_coverage` | 21 |
| `geography_foundation` | 14 |
| `book_baseline` | 12 |
| `episode_geography` | 11 |
| `genesis_textual_detail` | 10 |
| `section_screen` | 4 |

## Audit Queries To Run After Backfill

```sql
select routing_granularity, count(*)
from public.obs_question_ladder_metadata
group by routing_granularity
order by count(*) desc, routing_granularity;

select scoring_scope_level, count(*)
from public.obs_question_ladder_metadata
group by scoring_scope_level
order by count(*) desc, scoring_scope_level;

select depth_stage, count(*)
from public.obs_question_ladder_metadata
group by depth_stage
order by depth_stage;

select section_key, book_code, dimension_key, count(*)
from public.obs_question_ladder_metadata
group by section_key, book_code, dimension_key
order by section_key, book_code, count(*) desc;

select *
from public.obs_question_ladder_metadata
where metadata_confidence < 0.7500
   or review_status = 'needs_review'
order by exact_chapter_recall_required desc,
         chapter_addressed_prompt desc,
         metadata_confidence,
         routing_granularity,
         generated_question_id
limit 200;
```

## Suspicious Combinations

The verifier blocks the highest-risk combination: `chapter_detail` or
`verse_detail` with `global_signal_weight > 0.3500`.

The simulated backfill produced 0 rows in that blocked category.

Additional review query:

```sql
select generated_question_id, routing_granularity, scoring_scope_level,
       global_signal_weight, local_signal_weight, review_notes
from public.obs_question_ladder_metadata
where (routing_granularity in ('chapter_detail', 'verse_detail')
       and global_signal_weight >= 0.3000)
   or (routing_granularity in ('ot_overview', 'section_overview', 'book_overview')
       and local_signal_weight > 0.8500)
order by global_signal_weight desc, local_signal_weight desc;
```

## Recommended Human-Review Batches

1. Exact chapter recall rows: confirm whether the chapter number is truly
   required, then demote/rewrite where appropriate.
2. Chapter-addressed prompts: prioritize high-use books from the existing
   chapter-addressed audit, especially Genesis and Ezekiel.
3. Low-confidence book/intersection fallback rows: review rows where no explicit
   `knowledge_granularity` or `question_family` exists.
4. Narrow rows with elevated global signal: keep only if the item measures a
   genuinely foundational event/concept and parent scope evidence is expected.
5. Missing unit mappings: decide whether the item is genuinely whole-book or
   whether a learning-unit map should be added.

## Sample Row Query

Representative simulated rows:

| Routing granularity | Sample generated question ID | Scope | Stage | Section | Book | Unit | Dimension | Confidence | Review |
|---|---|---|---:|---|---|---|---|---:|---|
| `book_intersection` | `1b583062-717d-47c9-bdf9-5800c0728100` | `book` | 3 | `LATTER` | `JER` | null | `structure_cross_ref` | 0.5800 | yes |
| `book_overview` | `032ce8f9-7b02-4d82-8c27-fdc67a72ba45` | `book` | 2 | `WRITINGS` | `JOB` | null | `theological_reasoning` | 0.6600 | yes |
| `chapter_detail` | `013db451-6cd9-4e69-b690-4fcc7250e421` | `chapter` | 4 | `LATTER` | `JER` | null | `law_commands` | 0.6400 | yes |
| `chapter_range` | `0031a1f5-f987-45e1-96fa-c2cf31a6cf26` | `unit` | 3 | `LATTER` | `HOS` | `hos-1-14` | `promise_prophecy` | 0.7000 | yes |
| `section_overview` | `055113eb-024f-4fe8-ab62-ba78dc2c92bc` | `section` | 1 | `FORMER` | `1SA` | null | `events_timeline` | 0.9000 | no |
| `unit_overview` | `00b2a46a-acfc-461a-abb2-b3ed8840413a` | `unit` | 3 | `TORAH` | `GEN` | `gen-1-11` | `law_commands` | 0.8000 | no |
| `verse_detail` | `0033358f-fa0c-407e-bbec-15236006aedd` | `passage` | 5 | `TORAH` | `LEV` | `lev-17-27` | `promise_prophecy` | 0.9000 | no |

Use this query after applying the backfill to sample each major category without
exposing the full question text in the report:

```sql
with ranked as (
  select
    metadata.*,
    row_number() over (
      partition by routing_granularity
      order by review_status desc, metadata_confidence, generated_question_id
    ) as rn
  from public.obs_question_ladder_metadata metadata
)
select generated_question_id, routing_granularity, scoring_scope_level,
       depth_stage, section_key, book_code, unit_key, dimension_key,
       metadata_confidence, review_status, review_notes
from ranked
where rn <= 10
order by routing_granularity, rn;
```
