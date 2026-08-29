\set ON_ERROR_STOP on

begin;

do $assertion$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
  into v_definition;

  if v_definition not like '%v_dashboard_foundation_gap%'
     or v_definition not like '%not v_dashboard_foundation_gap%' then
    raise exception using
      errcode = 'P0001',
      message = 'get_next_assessment_question is missing the foundation-gap fast-selector guard.';
  end if;
end
$assertion$;

rollback;
