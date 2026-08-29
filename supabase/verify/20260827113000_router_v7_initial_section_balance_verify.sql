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

  if coalesce(v_get_next, '') not like '%v7 initial section balance%' then
    v_failures := v_failures
      || 'get_next_assessment_question is missing the V7 initial section balance marker';
  end if;

  if coalesce(v_get_next, '') not like '%obs_rank_ot_assessment_candidates_v7%' then
    v_failures := v_failures
      || 'get_next_assessment_question no longer calls the V7 ranker';
  end if;

  if coalesce(v_get_next, '') not like '%coalesce(attempt_row.assessment_kind, '''') = ''ot_adaptive''%' then
    v_failures := v_failures
      || 'initial section balance is not scoped to general OT adaptive attempts';
  end if;

  if coalesce(v_get_next, '') like '%v7 initial section balance fast path%' then
    if coalesce(v_get_next, '') not like '%coalesce(ranked.v7_attempt_section_share, 0::numeric)%'
       or coalesce(v_get_next, '') not like '%between 1 and 39%' then
      v_failures := v_failures
        || 'fast section balance supersession is missing its section-share guard';
    end if;
  else
    if coalesce(v_get_next, '') not like '%coalesce(attempt_row.answered_count, 0) < 20%'
       or coalesce(v_get_next, '') not like '%< 3%'
       or coalesce(v_get_next, '') not like '%>= 6%' then
      v_failures := v_failures
        || 'first-20 section floor/cap thresholds are missing';
    end if;

    if coalesce(v_get_next, '') not like '%coalesce(attempt_row.answered_count, 0) < 40%'
       or coalesce(v_get_next, '') not like '%< 5%'
       or coalesce(v_get_next, '') not like '%>= 12%' then
      v_failures := v_failures
        || 'first-40 section floor/cap thresholds are missing';
    end if;

    if coalesce(v_get_next, '') not like '%canonical_assessment_scope(ranked.book_code)%' then
      v_failures := v_failures
        || 'candidate section key is not computed from ranked.book_code';
    end if;
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
     ), '') like '%v7 initial section balance%' then
    v_failures := v_failures
      || 'NT next-question RPC was unexpectedly changed by the OT balance patch';
  end if;

  if array_length(v_failures, 1) is not null then
    raise exception using
      errcode = 'P0001',
      message = '20260827113000_router_v7_initial_section_balance_verify failed: '
        || array_to_string(v_failures, '; ');
  end if;
end
$$;

rollback;
