-- Restores the original prophets-sequence stem.
--
-- The report-status bookkeeping is intentionally not reversed: those reports
-- point at questions the quarantine already removed from v_question_bank, so
-- reopening them would only restore a queue that does not describe anything
-- a user can still reach.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

update public.ot_generated_questions
set payload = jsonb_set(
    payload,
    '{prompt}',
    to_jsonb(
      'Which broad timeline best fits the settings of these prophetic books?'::text
    )
  )
where id = 'ce3375be-cd72-4a29-996e-33260b064ccb'::uuid;

notify pgrst, 'reload schema';

commit;
