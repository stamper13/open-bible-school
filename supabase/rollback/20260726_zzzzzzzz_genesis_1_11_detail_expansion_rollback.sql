-- Quarantine the Genesis 1-11 detail expansion without deleting answer history.

begin;

update public.ot_generated_questions question
set
  question_type = case
    when question.question_type like 'quarantined%'
      then question.question_type
    else 'quarantined_' || question.question_type
  end,
  dedupe_key = case
    when question.dedupe_key like 'quarantined|%'
      then question.dedupe_key
    else
      'quarantined|'
      || question.id::text
      || '|'
      || question.dedupe_key
  end
where question.payload->>'source_batch' =
  '20260726_genesis_1_11_detail_expansion';

-- The obsolete event/type uniqueness rule intentionally remains removed.
-- dedupe_key and stem_family continue to provide duplicate control.

notify pgrst, 'reload schema';

commit;
