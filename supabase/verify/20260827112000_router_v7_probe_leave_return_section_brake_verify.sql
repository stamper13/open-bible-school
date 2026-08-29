begin;

do $$
declare
  v_function text;
  v_attempt_id uuid;
  v_user_id uuid;
  v_candidate_count integer;
  v_failures text[] := array[]::text[];
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_function;

  if coalesce(v_function, '') not like '%probe-leave-return section brake%' then
    v_failures := v_failures || 'V7 ranker is missing probe-leave-return marker';
  end if;

  if coalesce(v_function, '') not like '%reasoned.v7_lane in (''WEAK_AREA_EVIDENCE'', ''LOW_EVIDENCE_FLOOR'')%' then
    v_failures := v_failures || 'probe-leave-return brake does not target weak/floor lanes';
  end if;

  if coalesce(v_function, '') not like '%between 8 and 39%' then
    v_failures := v_failures || 'probe-leave-return brake does not cover short baseline assessments';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.object_type = 'function'
      and backup.object_schema = 'public'
      and backup.object_name = 'obs_rank_ot_assessment_candidates_v7'
      and backup.backup_tag = '20260827112000_router_v7_probe_leave_return_section_brake'
  ) then
    v_failures := v_failures || 'schema backup missing for probe-leave-return brake';
  end if;

  select attempt.id, attempt.user_id
  into v_attempt_id, v_user_id
  from public.assessment_attempts attempt
  where upper(coalesce(attempt.testament, 'OT')) = 'OT'
  order by attempt.created_at desc
  limit 1;

  if v_attempt_id is not null then
    select count(*)::integer
    into v_candidate_count
    from public.obs_rank_ot_assessment_candidates_v7(
      v_attempt_id,
      v_user_id,
      'V7_VERIFY_PROBE_LEAVE_RETURN',
      null,
      now(),
      10
    ) ranked
    where ranked.generated_question_id is not null
      and ranked.payload ? 'choices'
      and jsonb_typeof(ranked.payload->'choices') = 'array';

    if v_candidate_count = 0 then
      v_failures := v_failures || 'V7 ranker returned no renderable candidates for an existing OT attempt';
    end if;
  end if;

  if array_length(v_failures, 1) is not null then
    raise exception using
      errcode = 'P0001',
      message = '20260827112000_router_v7_probe_leave_return_section_brake_verify failed: '
        || array_to_string(v_failures, '; ');
  end if;
end
$$;

rollback;
