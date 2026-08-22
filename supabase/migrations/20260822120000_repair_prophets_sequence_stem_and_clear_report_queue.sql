-- Repair the dangling prophetic-books stem and clear the stale report queue.
--
-- Two unrelated things left the flagged-question queue holding 24 open rows:
--
-- 1. Twenty-one malformed_question reports point at questions the auto-skip
--    quarantine already pulled out of v_question_bank. The router cannot
--    reach them, so those reports are stale bookkeeping rather than live
--    content risk.
-- 2. section_competency|ot|prophets_sequence_001 asks which timeline fits
--    "these prophetic books" without naming a single book, so the stem has
--    no referent and the item is unanswerable as posed. The 20260815 repair
--    pass fixed its distractors but left the stem, and it was reported
--    again on 2026-08-22. Naming Isaiah, Ezekiel, and Haggai matches the
--    stored explanation and the recorded answer order, so the answer key,
--    the choices, and the IRT parameters are all left untouched.
--
-- Two open poorly_worded reports are deliberately left open. Both questions
-- are answerable and clear the distractor-quality gate, so whether to make
-- them harder is an editorial call rather than a defect fix.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

update public.ot_generated_questions
set payload = jsonb_set(
    payload,
    '{prompt}',
    to_jsonb(
      'Which broad timeline best fits the settings of Isaiah, Ezekiel, and Haggai?'::text
    )
  )
where id = 'ce3375be-cd72-4a29-996e-33260b064ccb'::uuid
  and payload->>'prompt'
    = 'Which broad timeline best fits the settings of these prophetic books?';

update public.question_reports report
set status = 'resolved',
    resolved_at = now()
where coalesce(report.status, 'open') not in ('resolved', 'dismissed')
  and (
    report.generated_question_id
      = 'ce3375be-cd72-4a29-996e-33260b064ccb'::uuid
    or not exists (
      select 1
      from public.v_question_bank bank
      where bank.generated_question_id = report.generated_question_id
    )
  );

do $assertion$
declare
  v_stem text;
  v_open_unreachable integer;
  v_verdict text;
begin
  select question.payload->>'prompt',
         public.obs_distractor_quality_verdict(
           question.payload,
           question.question_type
         )
  into v_stem, v_verdict
  from public.ot_generated_questions question
  where question.id = 'ce3375be-cd72-4a29-996e-33260b064ccb'::uuid;

  if v_stem is null or v_stem like '%these prophetic books%' then
    raise exception using
      errcode = 'P0001',
      message = 'Prophets-sequence stem still has no named books.';
  end if;

  if v_verdict <> 'pass' then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Prophets-sequence distractor verdict regressed to %s',
        v_verdict
      );
  end if;

  select count(*)
  into v_open_unreachable
  from public.question_reports report
  where coalesce(report.status, 'open') not in ('resolved', 'dismissed')
    and not exists (
      select 1
      from public.v_question_bank bank
      where bank.generated_question_id = report.generated_question_id
    );

  if v_open_unreachable <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected no open reports against unreachable questions, found %s',
        v_open_unreachable
      );
  end if;
end
$assertion$;

notify pgrst, 'reload schema';

commit;
