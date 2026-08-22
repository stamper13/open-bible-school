-- Verifies the prophets-sequence stem names its books and that no open
-- question report points at a question the router can no longer serve.
-- Read-only; the transaction is rolled back.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $assertion$
declare
  v_stem text;
  v_open_unreachable integer;
begin
  select question.payload->>'prompt'
  into v_stem
  from public.ot_generated_questions question
  where question.id = 'ce3375be-cd72-4a29-996e-33260b064ccb'::uuid;

  if v_stem is null then
    raise exception using
      errcode = 'P0001',
      message = 'Prophets-sequence question is missing.';
  end if;

  if v_stem like '%these prophetic books%' then
    raise exception using
      errcode = 'P0001',
      message = 'Prophets-sequence stem still has no named books.';
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
        'Open reports against unreachable questions: %s',
        v_open_unreachable
      );
  end if;
end
$assertion$;

rollback;
