begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_target text;
begin
  select pg_get_functiondef('public.obs_next_campaign_target(uuid)'::regprocedure)
  into v_target;

  if v_target not like '%reread campaigns skip ladder-sufficient units%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: next campaign target is missing the sufficient-unit reread guard.';
  end if;
end
$$;

rollback;
