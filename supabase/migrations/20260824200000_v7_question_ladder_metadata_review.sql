-- V7 task 4: focused human review of riskiest question ladder metadata.
--
-- This migration only updates the V7 sidecar labels. It does not change the
-- live question bank, live routing RPC chain, displayed BLI, or learner-facing
-- selection behavior.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_question_ladder_metadata') is null
     or to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_bli_dimensions') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'V7 metadata review prerequisites are missing; no changes made.';
  end if;
end
$$;

with reviewed(
  generated_question_id,
  routing_granularity,
  scoring_scope_level,
  depth_stage,
  dimension_key,
  global_signal_weight,
  local_signal_weight,
  metadata_confidence,
  review_status,
  start_chapter,
  end_chapter,
  review_notes
) as (
  values
    ('05381644-715a-4560-a9ad-52f22d6bc395'::uuid, 'verse_detail', 'passage', 5, 'characters_lineage', 0.1000, 1.0000, 0.9200, 'reviewed', null::integer, null::integer, 'Manual V7 review: Genesis 12:1-5 companion detail is local passage evidence, not broad book-structure evidence.'),
    ('568abbc0-2e38-4b3d-a753-351d56c5b9f7'::uuid, 'chapter_detail', 'chapter', 4, 'characters_lineage', 0.1200, 0.9800, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Abram/Sarai naming detail should remain local and chapter-address demoted.'),
    ('7b315a71-cd6d-47ef-aa41-db40144c4693'::uuid, 'verse_detail', 'passage', 5, 'characters_lineage', 0.1000, 1.0000, 0.9200, 'reviewed', null::integer, null::integer, 'Manual V7 review: Genesis 12:1-5 call-recipient detail is passage-level character evidence.'),
    ('82de6030-86f0-4418-b9a0-2a09c843a844'::uuid, 'verse_detail', 'passage', 5, 'geography_nations', 0.1000, 1.0000, 0.9200, 'reviewed', null::integer, null::integer, 'Manual V7 review: Abram altar location in Genesis 12:6-7 is local passage geography.'),
    ('7c2714e8-d2f8-4f2d-9f14-226bcab2a0c2'::uuid, 'chapter_detail', 'chapter', 4, 'law_commands', 0.1600, 0.9600, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Exodus 27 bronze altar question is tabernacle law/detail evidence, not book-structure evidence.'),
    ('8f83678c-0f68-4cab-aac0-6fa70ecc2ec9'::uuid, 'chapter_detail', 'chapter', 4, 'characters_lineage', 0.1600, 0.9600, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Exodus 6 genealogy prompt is character-lineage detail.'),
    ('9f12502e-1b4c-40e6-9ed1-7e8b48bb1d43'::uuid, 'chapter_detail', 'chapter', 4, 'geography_nations', 0.1600, 0.9600, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Ruth 3 threshing-floor location is local geography/detail evidence.'),
    ('acef0831-8f05-4702-a5eb-b2d5d963a990'::uuid, 'chapter_detail', 'chapter', 4, 'events_timeline', 0.1600, 0.9600, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Joseph famine administration is a local event-detail item.'),
    ('b48eddbf-18fe-4bcf-91ad-44cf1e75bd3c'::uuid, 'chapter_detail', 'chapter', 4, 'characters_lineage', 0.1600, 0.9600, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Genesis 36 Esau/Edom line is local lineage evidence.'),
    ('c912e8d1-e2f0-4619-b55a-aba4a241abf2'::uuid, 'chapter_detail', 'chapter', 4, 'structure_cross_ref', 0.1600, 0.9600, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Ezra 2 list-preservation prompt is chapter-level structure evidence.'),
    ('f1125b60-f3b5-4cb7-b1b4-af6a5b2b6241'::uuid, 'verse_detail', 'passage', 5, 'structure_cross_ref', 0.1800, 1.0000, 0.9000, 'reviewed', null::integer, null::integer, 'Manual V7 review: Hosea 11 / Matthew cross-reference is passage detail with modest global signal only after parent evidence.'),
    ('9e7a693a-0773-439a-b2b5-323859722812'::uuid, 'unit_overview', 'unit', 3, 'theological_reasoning', 0.5800, 0.8400, 0.9300, 'reviewed', null::integer, null::integer, 'Manual V7 review: the Shema is foundational unit-level theological evidence despite a chapter-addressed prompt.'),
    ('cc44530b-5b7e-4fc0-ba29-e10fc656ca59'::uuid, 'unit_overview', 'unit', 3, 'promise_prophecy', 0.5800, 0.8400, 0.9300, 'reviewed', null::integer, null::integer, 'Manual V7 review: Deuteronomy 30 life/death choice is covenant-renewal unit evidence, not mere chapter detail.'),
    ('033e38cc-81da-4470-8ebe-3a6822268308'::uuid, 'unit_overview', 'unit', 3, 'law_commands', 0.5800, 0.8400, 0.9300, 'reviewed', null::integer, null::integer, 'Manual V7 review: Exodus 20 Sinai law item is foundational law-command unit evidence.'),
    ('03fb9053-9604-4cfd-863b-a99afe4c9693'::uuid, 'unit_overview', 'unit', 3, 'events_timeline', 0.5800, 0.8400, 0.9300, 'reviewed', null::integer, null::integer, 'Manual V7 review: Babel judgment is foundational Genesis 1-11 unit storyline evidence.'),
    ('01df1d7f-1dcb-4f08-b12e-bacfb155e9be'::uuid, 'unit_overview', 'unit', 3, 'promise_prophecy', 0.5800, 0.8400, 0.9300, 'reviewed', null::integer, null::integer, 'Manual V7 review: Genesis 12:3 universal promise is foundational Abrahamic-promise unit evidence.'),
    ('1b583062-717d-47c9-bdf9-5800c0728100'::uuid, 'chapter_range', 'chapter', 3, 'structure_cross_ref', 0.1600, 0.9600, 0.8200, 'flagged', 46, 51, 'Manual V7 review: exact Jeremiah 46-51 chapter-range recall should remain demoted and needs content-review before it can carry global routing weight.')
)
update public.obs_question_ladder_metadata metadata
set routing_granularity = reviewed.routing_granularity,
    scoring_scope_level = reviewed.scoring_scope_level,
    depth_stage = reviewed.depth_stage,
    dimension_key = reviewed.dimension_key,
    global_signal_weight = reviewed.global_signal_weight,
    local_signal_weight = reviewed.local_signal_weight,
    metadata_source = 'manual',
    metadata_confidence = reviewed.metadata_confidence,
    review_status = reviewed.review_status,
    start_chapter = coalesce(reviewed.start_chapter, metadata.start_chapter),
    end_chapter = coalesce(reviewed.end_chapter, metadata.end_chapter),
    review_notes = reviewed.review_notes,
    updated_at = now()
from reviewed
where metadata.generated_question_id = reviewed.generated_question_id
  and exists (
    select 1
    from public.ot_generated_questions question
    where question.id = reviewed.generated_question_id
  )
  and exists (
    select 1
    from public.obs_bli_dimensions dimension
    where dimension.dimension_key = reviewed.dimension_key
  );

commit;
