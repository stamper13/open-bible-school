do $verify$
declare
  v_definition text := pg_get_viewdef('public.v_nt_question_bank'::regclass, true);
  v_bank_count integer;
  v_count integer;
begin
  if v_definition like '%canonical_testament(book_code)%' then
    raise exception 'v_nt_question_bank still filters via canonical_testament(book_code).';
  end if;

  if v_definition not like '%scripture_books%' or v_definition not like '%book.testament = ''NT''%' then
    raise exception 'v_nt_question_bank is not using scripture_books.testament for NT filtering.';
  end if;

  select count(*)
  into v_bank_count
  from public.v_question_bank;

  select count(*)
  into v_count
  from public.v_nt_question_bank;

  if v_bank_count > 0 and v_count < 250 then
    raise exception 'v_nt_question_bank returned too few rows: %', v_count;
  end if;
end
$verify$;
