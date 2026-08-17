do $$
declare
  compact_definition text;
begin
  compact_definition := regexp_replace(
    pg_get_functiondef(
      'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
    ),
    '\s+',
    '',
    'g'
  );

  if compact_definition not like
       '%candidate.recovery_stageisnotnullandcandidate.latest_book_code=candidate.book_codeandcandidate.book_answered<5%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router recovery concentration ceiling is missing.';
  end if;
end
$$;

select
  'PASS: recovery exemption ends after five same-book questions.'
    as result;
