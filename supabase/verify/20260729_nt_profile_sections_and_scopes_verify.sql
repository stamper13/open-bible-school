-- Verify distinct NT profile scopes without writing learner data.

begin;

do $$
declare
  gospels_count integer;
  acts_count integer;
  combined_count integer;
begin
  if public.obs_nt_scope_key('Gospels', null) <> 'GOSPELS'
     or public.obs_nt_scope_key('Acts', null) <> 'ACTS'
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT scope normalization failed.';
  end if;

  select count(*)::integer
  into gospels_count
  from public.v_nt_question_bank question
  left join public.scripture_books book
    on book.book_code = question.book_code
  where public.obs_nt_question_matches_scope(
    question.book_code,
    book.nt_division,
    'GOSPELS'
  );

  select count(*)::integer
  into acts_count
  from public.v_nt_question_bank question
  left join public.scripture_books book
    on book.book_code = question.book_code
  where public.obs_nt_question_matches_scope(
    question.book_code,
    book.nt_division,
    'ACTS'
  );

  select count(*)::integer
  into combined_count
  from public.v_nt_question_bank question
  left join public.scripture_books book
    on book.book_code = question.book_code
  where public.obs_nt_question_matches_scope(
    question.book_code,
    book.nt_division,
    'GOSPELS_ACTS'
  );

  if gospels_count = 0
     or acts_count = 0
     or gospels_count + acts_count <> combined_count
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT profile scope counts failed: Gospels=%s Acts=%s combined=%s.',
        gospels_count,
        acts_count,
        combined_count
      );
  end if;
end
$$;

select
  count(*) filter (
    where public.obs_nt_question_matches_scope(
      question.book_code,
      book.nt_division,
      'GOSPELS'
    )
  ) as gospels_questions,
  count(*) filter (
    where public.obs_nt_question_matches_scope(
      question.book_code,
      book.nt_division,
      'ACTS'
    )
  ) as acts_questions
from public.v_nt_question_bank question
left join public.scripture_books book
  on book.book_code = question.book_code;

rollback;
