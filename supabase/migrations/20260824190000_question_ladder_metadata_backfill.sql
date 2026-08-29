begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_question_ladder_metadata') is null
     or to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.obs_question_bank_with_units') is null
     or to_regclass('public.v_question_bank') is null
     or to_regclass('public.obs_biblical_books') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regclass('public.book_bli_weights') is null
     or to_regclass('public.obs_answer_evidence') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Question ladder metadata backfill prerequisites are missing; no changes made.';
  end if;
end $$;

alter table public.obs_question_ladder_metadata
  add column if not exists section_pair text;

comment on column public.obs_question_ladder_metadata.section_pair is
  'Optional section-pair or comparison scope hint for section/book intersection questions.';

with live_ot_questions as (
  select
    q.generated_question_id,
    q.question_type,
    q.dedupe_key,
    q.prompt,
    q.payload,
    q.book_code,
    q.dimension_key,
    q.importance_conceptual,
    q.importance_context,
    q.difficulty_estimate,
    q.routing_score,
    book.section_key,
    book.section_name,
    unit.unit_key,
    unit.start_chapter as unit_start_chapter,
    unit.end_chapter as unit_end_chapter,
    coalesce(unit.is_foundation, false) as unit_is_foundation,
    with_units.inferred_chapter,
    coalesce(book_weight.chronological_weight, 1.0)::numeric as chronological_weight,
    book_weight.dependency_type
  from public.obs_question_bank_with_dimensions q
  join public.obs_biblical_books book
    on book.book_code = q.book_code
   and book.testament = 'OT'
  join public.ot_generated_questions generated
    on generated.id = q.generated_question_id
  left join public.obs_question_bank_with_units with_units
    on with_units.generated_question_id = q.generated_question_id
  left join public.obs_learning_units unit
    on unit.unit_key = with_units.unit_key
  left join public.book_bli_weights book_weight
    on book_weight.book_code = q.book_code
),
signals as (
  select
    live.*,
    lower(nullif(btrim(live.payload->>'knowledge_granularity'), '')) as knowledge_granularity,
    lower(nullif(btrim(live.payload->>'question_family'), '')) as question_family,
    lower(nullif(btrim(live.payload->>'assessment_role'), '')) as assessment_role,
    lower(nullif(btrim(live.payload->>'retest_stage'), '')) as retest_stage,
    greatest(
      coalesce(live.importance_conceptual, 0),
      coalesce(live.importance_context, 0),
      coalesce(live.routing_score, 0)
    )::numeric as importance_signal,
    (
      lower(coalesce(live.payload->>'exact_chapter_recall_required', 'false'))
        in ('true', 't', '1', 'yes', 'y')
      or coalesce(live.prompt, '') ~* E'(which|what)[[:space:]-]+chapter|chapter[[:space:]-]+number|in[[:space:]]+what[[:space:]]+chapter'
    ) as exact_chapter_recall_required,
    (
      coalesce(live.prompt, '') ~* E'(^|[^[:alpha:]])(Genesis|Gen|Exodus|Exod|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|1[[:space:]]*Samuel|1[[:space:]]*Sam|2[[:space:]]*Samuel|2[[:space:]]*Sam|1[[:space:]]*Kings|1[[:space:]]*Kgs|2[[:space:]]*Kings|2[[:space:]]*Kgs|1[[:space:]]*Chronicles|2[[:space:]]*Chronicles|Ezra|Nehemiah|Esther|Job|Psalm|Psalms|Proverbs|Ecclesiastes|Song[[:space:]]+of[[:space:]]+Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi)[.]?[[:space:]]+[0-9]{1,3}([^0-9]|$)'
    ) as chapter_addressed_prompt,
    (
      lower(coalesce(live.payload->>'knowledge_granularity', '')) in (
        'chapter_detail',
        'chapter_section',
        'episode_detail',
        'event_detail',
        'law_detail',
        'micro_detail',
        'passage_detail',
        'specific_pericope',
        'verse_detail'
      )
      or lower(coalesce(live.payload->>'question_family', '')) in (
        'chapter_detail',
        'chapter_recall',
        'episode_detail',
        'passage_detail',
        'verse_detail',
        'genesis_textual_detail'
      )
      or lower(coalesce(live.question_type, '')) in (
        'chapter_detail_mcq_v1',
        'passage_detail_mcq_v1',
        'verse_detail_mcq_v1'
      )
      or coalesce(live.prompt, '') ~* E'(^|[^[:alpha:]])(Genesis|Gen|Exodus|Exod|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|1[[:space:]]*Samuel|1[[:space:]]*Sam|2[[:space:]]*Samuel|2[[:space:]]*Sam|1[[:space:]]*Kings|1[[:space:]]*Kgs|2[[:space:]]*Kings|2[[:space:]]*Kgs|1[[:space:]]*Chronicles|2[[:space:]]*Chronicles|Ezra|Nehemiah|Esther|Job|Psalm|Psalms|Proverbs|Ecclesiastes|Song[[:space:]]+of[[:space:]]+Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi)[.]?[[:space:]]+[0-9]{1,3}([^0-9]|$)'
    ) as high_specificity
  from live_ot_questions live
),
classified as (
  select
    signals.*,
    case
      when knowledge_granularity in ('verse_detail', 'passage_detail', 'specific_pericope', 'micro_detail') then 'verse_detail'
      when knowledge_granularity in ('chapter_detail', 'chapter_section', 'episode_detail', 'event_detail', 'law_detail') then 'chapter_detail'
      when knowledge_granularity in ('chapter_range') then 'chapter_range'
      when knowledge_granularity in ('unit_overview', 'unit_synthesis') then 'unit_overview'
      when knowledge_granularity in ('book_overview', 'book_geography_overview') then 'book_overview'
      when knowledge_granularity in ('section_overview', 'canon_section') then 'section_overview'
      when lower(coalesce(question_type, '')) in ('section_competency_mcq_v1', 'section_screen_mcq_v1', 'ot_book_section_sort_v1')
        or question_family in ('section_competency', 'section_screen') then 'section_overview'
      when lower(coalesce(question_type, '')) in ('book_orientation_mcq_v1', 'geography_book_mcq_v1')
        or question_family in ('book_orientation', 'book_geography_overview') then 'book_overview'
      when lower(coalesce(question_type, '')) in ('canon_context_mcq_v1', 'chronology_order_mcq_v1', 'time_period_mcq_v1')
        or dimension_key = 'structure_cross_ref' then 'book_intersection'
      when high_specificity and knowledge_granularity in ('passage_detail', 'specific_pericope', 'micro_detail', 'verse_detail') then 'verse_detail'
      when high_specificity then 'chapter_detail'
      when unit_key is not null
        and (
          question_family in ('torah_coverage', 'geography_foundation', 'book_baseline')
          or retest_stage = 'foundation'
          or lower(coalesce(question_type, '')) ~ '(foundation|coverage|critical|minimum)'
        ) then 'unit_overview'
      when unit_key is not null then 'chapter_range'
      when book_code is not null then 'book_overview'
      else 'unknown'
    end as routing_granularity
  from signals
),
scoped as (
  select
    classified.*,
    case routing_granularity
      when 'ot_overview' then 'ot'
      when 'section_overview' then 'section'
      when 'book_overview' then 'book'
      when 'book_intersection' then 'book'
      when 'unit_overview' then 'unit'
      when 'chapter_range' then 'unit'
      when 'chapter_detail' then 'chapter'
      when 'verse_detail' then 'passage'
      else 'unknown'
    end as scoring_scope_level,
    case routing_granularity
      when 'ot_overview' then 1
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
      when routing_granularity = 'ot_overview' then 1.0000
      when routing_granularity = 'section_overview' then 0.9500
      when routing_granularity = 'book_overview' then least(1.0000, 0.7800 + case when importance_signal >= 85 then 0.1000 else 0 end)
      when routing_granularity = 'book_intersection' then least(1.0000, 0.6600 + case when importance_signal >= 85 then 0.0800 else 0 end)
      when routing_granularity = 'unit_overview' then least(1.0000, 0.6200 + case when unit_is_foundation then 0.1200 else 0 end + case when importance_signal >= 85 then 0.0800 else 0 end)
      when routing_granularity = 'chapter_range' then least(1.0000, 0.5000 + case when unit_is_foundation then 0.0800 else 0 end + case when importance_signal >= 90 then 0.0800 else 0 end)
      when routing_granularity = 'chapter_detail' then least(1.0000, 0.3000 + case when unit_is_foundation and importance_signal >= 90 then 0.1000 else 0 end)
      when routing_granularity = 'verse_detail' then least(1.0000, 0.2200 + case when importance_signal >= 90 then 0.0600 else 0 end)
      else 0.3500
    end::numeric(5,4) as foundationality_weight,
    case
      when routing_granularity = 'ot_overview' then 0.9500
      when routing_granularity = 'section_overview' then 0.8500
      when routing_granularity = 'book_overview' then 0.7400
      when routing_granularity = 'book_intersection' then 0.5800
      when routing_granularity = 'unit_overview' then least(1.0000, 0.4600 + case when unit_is_foundation then 0.1200 else 0 end)
      when routing_granularity = 'chapter_range' then least(1.0000, 0.3000 + case when unit_is_foundation and importance_signal >= 85 then 0.1000 else 0 end)
      when routing_granularity = 'chapter_detail' then least(1.0000, 0.1600 + case when unit_is_foundation and importance_signal >= 90 then 0.1000 else 0 end)
      when routing_granularity = 'verse_detail' then least(1.0000, 0.1000 + case when importance_signal >= 90 then 0.0800 else 0 end)
      else 0.2500
    end::numeric(5,4) as global_signal_weight,
    case
      when routing_granularity = 'ot_overview' then 0.4500
      when routing_granularity = 'section_overview' then 0.5200
      when routing_granularity = 'book_overview' then 0.6600
      when routing_granularity = 'book_intersection' then 0.7600
      when routing_granularity = 'unit_overview' then 0.8400
      when routing_granularity = 'chapter_range' then 0.9000
      when routing_granularity = 'chapter_detail' then 0.9600
      when routing_granularity = 'verse_detail' then 1.0000
      else 0.7500
    end::numeric(5,4) as local_signal_weight
  from scoped
),
confidence as (
  select
    weighted.*,
    case
      when knowledge_granularity is not null then 0.9000
      when routing_granularity in ('section_overview', 'book_overview')
        and (question_family is not null or lower(coalesce(question_type, '')) in (
          'section_competency_mcq_v1',
          'section_screen_mcq_v1',
          'ot_book_section_sort_v1',
          'book_orientation_mcq_v1',
          'geography_book_mcq_v1'
        )) then 0.8600
      when routing_granularity in ('unit_overview')
        and unit_key is not null then 0.8000
      when routing_granularity in ('chapter_detail', 'verse_detail')
        and (knowledge_granularity is not null or inferred_chapter is not null or chapter_addressed_prompt) then 0.7200
      when routing_granularity = 'chapter_range'
        and unit_key is not null then 0.7000
      when routing_granularity in ('book_intersection', 'book_overview')
        and book_code is not null then 0.6600
      else 0.5500
    end::numeric(5,4) as base_confidence
  from weighted
),
final_labels as (
  select
    generated_question_id,
    routing_granularity,
    scoring_scope_level,
    depth_stage,
    section_key,
    section_name,
    nullif(btrim(payload->>'section_pair'), '') as section_pair,
    book_code,
    case when scoring_scope_level in ('unit', 'chapter', 'passage') then unit_key else null end as unit_key,
    case
      when scoring_scope_level in ('chapter', 'passage') and inferred_chapter is not null then inferred_chapter
      when scoring_scope_level = 'unit' and unit_start_chapter is not null then unit_start_chapter
      else null
    end as start_chapter,
    case
      when scoring_scope_level in ('chapter', 'passage') and inferred_chapter is not null then inferred_chapter
      when scoring_scope_level = 'unit' and unit_end_chapter is not null then unit_end_chapter
      else null
    end as end_chapter,
    dimension_key,
    foundationality_weight,
    global_signal_weight,
    local_signal_weight,
    exact_chapter_recall_required,
    chapter_addressed_prompt,
    case
      when knowledge_granularity is not null
        and not chapter_addressed_prompt
        and not exact_chapter_recall_required then 'payload'
      when chapter_addressed_prompt or exact_chapter_recall_required then 'hybrid'
      else 'rule_inferred'
    end as metadata_source,
    greatest(
      0.0000,
      least(
        1.0000,
        base_confidence
        - case when book_code is null then 0.1500 else 0 end
        - case when dimension_key is null then 0.1200 else 0 end
        - case when scoring_scope_level in ('unit', 'chapter', 'passage') and unit_key is null then 0.0800 else 0 end
        - case when exact_chapter_recall_required then 0.0800 else 0 end
      )
    )::numeric(5,4) as metadata_confidence,
    case
      when exact_chapter_recall_required then 'needs_review'
      when (
        base_confidence
        - case when book_code is null then 0.1500 else 0 end
        - case when dimension_key is null then 0.1200 else 0 end
        - case when scoring_scope_level in ('unit', 'chapter', 'passage') and unit_key is null then 0.0800 else 0 end
        - case when exact_chapter_recall_required then 0.0800 else 0 end
      ) < 0.7500 then 'needs_review'
      else 'auto_accepted'
    end as review_status,
    nullif(concat_ws(
      '; ',
      case when exact_chapter_recall_required then 'Exact chapter-number recall appears central; keep demoted until human review.' end,
      case when chapter_addressed_prompt then 'Prompt directly addresses a book/chapter reference.' end,
      case when book_code is null then 'Missing book mapping.' end,
      case when dimension_key is null then 'Missing dimension mapping.' end,
      case when scoring_scope_level in ('unit', 'chapter', 'passage') and unit_key is null then 'Narrow label lacks a learning-unit mapping.' end,
      case when base_confidence < 0.7500 then 'Low deterministic confidence from available structured metadata.' end,
      case when routing_granularity in ('chapter_detail', 'verse_detail') and global_signal_weight >= 0.3500 then 'Narrow item has elevated global signal because it appears foundational/high-importance; review weighting.' end
    ), '') as review_notes
  from confidence
)
insert into public.obs_question_ladder_metadata (
  generated_question_id,
  routing_granularity,
  scoring_scope_level,
  depth_stage,
  section_key,
  section_name,
  section_pair,
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
  section_pair,
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
  now()
from final_labels
on conflict (generated_question_id) do update
set routing_granularity = excluded.routing_granularity,
    scoring_scope_level = excluded.scoring_scope_level,
    depth_stage = excluded.depth_stage,
    section_key = excluded.section_key,
    section_name = excluded.section_name,
    section_pair = excluded.section_pair,
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

commit;
