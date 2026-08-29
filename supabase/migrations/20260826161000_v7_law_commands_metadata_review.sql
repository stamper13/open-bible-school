-- V7 law coverage: promote clean broad/mid law-command metadata rows.
--
-- The 300-question V7 replay after the long-run brake still served
-- law_commands at only 7.0%. A focused audit found that only 7 broad/mid law
-- rows were accepted, while 33 clean broad/mid law rows were demoted solely
-- because the deterministic metadata backfill had low confidence. This updates
-- only V7 ladder sidecar metadata. It does not change question content, scoring,
-- or the live V6 app-facing router chain.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_question_ladder_metadata') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'V7 law metadata review prerequisites are missing; no changes made.';
  end if;
end
$$;

with reviewed as (
  select metadata.generated_question_id
  from public.obs_question_ladder_metadata metadata
  join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = metadata.generated_question_id
  where question.dimension_key = 'law_commands'
    and metadata.depth_stage <= 3
    and metadata.routing_granularity in (
      'book_overview',
      'chapter_range',
      'unit_overview'
    )
    and metadata.review_status = 'needs_review'
    and metadata.chapter_addressed_prompt is false
    and metadata.review_notes = 'Low deterministic confidence from available structured metadata.'
)
update public.obs_question_ladder_metadata metadata
set review_status = 'reviewed',
    metadata_source = 'manual',
    metadata_confidence = greatest(metadata.metadata_confidence, 0.8600),
    review_notes = concat_ws(
      ' ',
      'Manual V7 law coverage review: clean broad/mid law-command row promoted out of deterministic low-confidence demotion.',
      'Original note:',
      metadata.review_notes
    ),
    updated_at = now()
from reviewed
where metadata.generated_question_id = reviewed.generated_question_id;

do $$
declare
  v_promoted integer;
begin
  select count(*)
  into v_promoted
  from public.obs_question_ladder_metadata metadata
  join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = metadata.generated_question_id
  where question.dimension_key = 'law_commands'
    and metadata.depth_stage <= 3
    and metadata.review_status = 'reviewed'
    and metadata.metadata_source = 'manual'
    and metadata.review_notes like 'Manual V7 law coverage review:%';

  if v_promoted <> 33 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected to promote 33 clean broad/mid law rows, promoted %s.',
        v_promoted
      );
  end if;
end
$$;

commit;
