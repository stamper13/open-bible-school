begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

update public.obs_question_ladder_metadata metadata
set review_status = 'needs_review',
    metadata_source = 'hybrid',
    metadata_confidence = least(metadata.metadata_confidence, 0.7200),
    review_notes = 'Low deterministic confidence from available structured metadata.',
    updated_at = now()
where metadata.review_status = 'reviewed'
  and metadata.metadata_source = 'manual'
  and metadata.review_notes like 'Manual V7 law coverage review:%'
  and exists (
    select 1
    from public.obs_question_bank_with_dimensions question
    where question.generated_question_id = metadata.generated_question_id
      and question.dimension_key = 'law_commands'
  );

commit;
