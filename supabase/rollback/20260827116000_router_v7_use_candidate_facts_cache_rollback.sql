begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_get_next text;
  v_ranker text;
begin
  select backup.definition
  into v_get_next
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260827116000_router_v7_use_candidate_facts_cache'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  select backup.definition
  into v_ranker
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260827116000_router_v7_use_candidate_facts_cache'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v7'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_get_next is null or v_ranker is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing backup for 20260827116000_router_v7_use_candidate_facts_cache rollback.';
  end if;

  execute v_get_next;
  execute v_ranker;
end
$$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question restored from pre-candidate-facts-cache substitution backup.';

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'V7 OT candidate ranker restored from pre-candidate-facts-cache substitution backup.';

notify pgrst, 'reload schema';

commit;
