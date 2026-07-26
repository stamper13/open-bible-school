-- Preserve historical answers while removing book-orientation items from
-- active routing.

begin;

update public.ot_generated_questions
set question_type = 'quarantined_book_orientation_mcq_v1'
where question_type = 'book_orientation_mcq_v1'
  and payload->>'source_batch' =
    '20260726_book_orientation_baseline_questions';

do $$
declare
  remaining_active integer;
  quarantined_count integer;
begin
  select count(*)
  into remaining_active
  from public.ot_generated_questions
  where question_type = 'book_orientation_mcq_v1'
    and payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions';

  select count(*)
  into quarantined_count
  from public.ot_generated_questions
  where question_type = 'quarantined_book_orientation_mcq_v1'
    and payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions';

  if remaining_active <> 0 or quarantined_count <> 39 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Book-orientation rollback failed: active=%s quarantined=%s/39.',
        remaining_active,
        quarantined_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
