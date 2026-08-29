begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_function text;
begin
  select pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
  into v_function;

  if coalesce(v_function, '') not like '%v7 activation ranked_row guard%'
     or coalesce(v_function, '') like '%ranked_row := null;%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: V7 activation ranked_row guard is not installed.';
  end if;

  raise notice 'PASS: V7 activation ranked_row guard verifier completed under rollback.';
end
$$;

rollback;
