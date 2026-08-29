begin;

do $$
declare
  v_failures text[] := array[]::text[];
  v_get_next text;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_get_next;

  if coalesce(v_get_next, '') not like '%v7 initial section balance fast path%' then
    v_failures := v_failures
      || 'get_next_assessment_question is missing the fast section balance marker';
  end if;

  if coalesce(v_get_next, '') not like '%coalesce(ranked.v7_attempt_section_share, 0::numeric)%' then
    v_failures := v_failures
      || 'fast section balance does not use ranker section-share output';
  end if;

  if coalesce(v_get_next, '') like '%from public.assessment_answers section_answer%' then
    v_failures := v_failures
      || 'slow correlated section-answer recount is still present';
  end if;

  if coalesce(v_get_next, '') not like '%coalesce(attempt_row.assessment_kind, '''') = ''ot_adaptive''%'
     or coalesce(v_get_next, '') not like '%upper(coalesce(attempt_row.scope_key, ''OT'')) = ''OT''%'
     or coalesce(v_get_next, '') not like '%between 1 and 39%' then
    v_failures := v_failures
      || 'fast section balance is not scoped to early general OT adaptive attempts';
  end if;

  if coalesce(v_get_next, '') not like '%obs_rank_ot_assessment_candidates_v7%' then
    v_failures := v_failures
      || 'get_next_assessment_question no longer calls the V7 ranker';
  end if;

  if to_regprocedure('public.obs_get_next_ot_assessment_question(uuid)') is null
     or to_regprocedure(
       'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'
     ) is null then
    v_failures := v_failures
      || 'app-facing OT RPC chain no longer resolves';
  end if;

  if to_regprocedure('public.obs_get_next_nt_assessment_question(uuid)') is null
     or to_regprocedure(
       'public.obs_submit_nt_assessment_answer(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.obs_start_nt_assessment(text,text,integer)'
     ) is null then
    v_failures := v_failures
      || 'app-facing NT RPC chain no longer resolves';
  end if;

  if coalesce(pg_get_functiondef(
       'public.obs_get_next_nt_assessment_question(uuid)'::regprocedure
     ), '') like '%v7 initial section balance fast path%' then
    v_failures := v_failures
      || 'NT next-question RPC was unexpectedly changed by the fast OT balance patch';
  end if;

  if array_length(v_failures, 1) is not null then
    raise exception using
      errcode = 'P0001',
      message = '20260827115000_router_v7_initial_section_balance_fast_path_verify failed: '
        || array_to_string(v_failures, '; ');
  end if;
end
$$;

rollback;
