\set ON_ERROR_STOP on

begin;

do $assertion$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_definition;

  if v_definition not like '%campaign_scope.dimension_key is null%'
     or v_definition not like '%campaign_scope.dimension_key is not null%' then
    raise exception using
      errcode = 'P0001',
      message = 'V6 ranker is missing unit-campaign all-dimensions handling.';
  end if;
end
$assertion$;

rollback;
