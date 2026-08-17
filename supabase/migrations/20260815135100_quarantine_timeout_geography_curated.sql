-- Stop the active assessment from looping over geography_curated timeout items.

begin;

update public.ot_generated_questions question
set question_type = case
    when question.question_type like 'quarantined%' then question.question_type
    else 'quarantined_' || question.question_type
  end,
  payload = jsonb_set(
    question.payload,
    '{quarantine_reason}',
    to_jsonb('Auto-quarantined after repeated answer-submit statement timeouts in question_reports.'::text)
  )
where question.question_type = 'geography_curated_mcq_v1'
  and exists (
    select 1
    from public.question_reports report
    where report.generated_question_id = question.id
      and coalesce(report.status, 'open') not in ('resolved', 'dismissed')
      and report.feedback_text ilike '%57014%'
  );

update public.question_reports report
set status = 'resolved',
    resolved_at = now()
where coalesce(report.status, 'open') not in ('resolved', 'dismissed')
  and report.feedback_text ilike '%57014%'
  and exists (
    select 1
    from public.ot_generated_questions question
    where question.id = report.generated_question_id
      and question.question_type like 'quarantined%'
  );

do $$
declare
  v_open integer;
  v_unquarantined integer;
begin
  select count(*)
  into v_open
  from public.question_reports report
  join public.ot_generated_questions question
    on question.id = report.generated_question_id
  where coalesce(report.status, 'open') not in ('resolved', 'dismissed')
    and question.question_type = 'geography_curated_mcq_v1';

  if v_open <> 0 then
    raise exception 'Expected no open geography_curated timeout reports, found %', v_open;
  end if;

  select count(*)
  into v_unquarantined
  from public.ot_generated_questions question
  where question.id in (
    'ee26ff51-a180-486c-b0df-69142434aeeb'::uuid,
    '0c5f91a1-cfdc-431c-b940-e04ad38f298b'::uuid,
    'eb04b513-bd1e-4a19-8bef-b2723ae348e0'::uuid
  )
    and question.question_type not like 'quarantined%';

  if v_unquarantined <> 0 then
    raise exception 'Expected all flagged geography_curated items to be quarantined.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
