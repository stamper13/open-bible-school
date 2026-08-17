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
       '%whencandidate.policy_version<>''V4''then0whencandidate.book_answered>=5then2whencandidate.pending_book_code=candidate.book_code%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Absolute five-question book ceiling does not precede exemptions.';
  end if;
end
$$;

select
  'PASS: the five-question general-assessment book ceiling is absolute.'
    as result;
