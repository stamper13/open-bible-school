-- Read-only structural verification. Distribution/reproducibility is verified
-- separately against synthetic attempt IDs or disposable attempts.

do $verify$
declare
  v_definition text := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );
begin
  if strpos(v_definition, 'opening_top_score') = 0
     or strpos(v_definition, 'opening_top_score - 0.005') = 0
     or strpos(v_definition, 'from opening_banded') = 0
  then
    raise exception 'Initial OT near-tie diversification is missing';
  end if;

  if pg_get_function_result(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
     ) not like 'TABLE(candidate_rank bigint,%'
  then
    raise exception 'OT router result contract changed unexpectedly';
  end if;

  if has_function_privilege(
       'anon',
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)',
       'execute'
     )
  then
    raise exception 'OT router execute privileges are not least-privilege';
  end if;
end
$verify$;
