-- Router V7 latency: use cached candidate facts in wrapper/history checks.
--
-- The V7 app-facing path still expanded obs_question_bank_with_dimensions for
-- repeat, similarity, and early section-balance checks. Those checks only need
-- stable per-question facts that are already stored in
-- obs_router_candidate_facts. Reading the private cache preserves routing
-- behavior while avoiding repeated view expansion during next-question loads.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_router_candidate_facts') is null
     or to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 candidate-facts cache prerequisites are missing; nothing was changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  object_type,
  object_schema,
  object_name,
  backup_tag,
  definition
)
select
  'function',
  'public',
  'get_next_assessment_question',
  '20260827116000_router_v7_use_candidate_facts_cache',
  pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.backup_tag = '20260827116000_router_v7_use_candidate_facts_cache'
);

insert into public.obs_schema_backups (
  object_type,
  object_schema,
  object_name,
  backup_tag,
  definition
)
select
  'function',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  '20260827116000_router_v7_use_candidate_facts_cache',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v7'
    and backup.backup_tag = '20260827116000_router_v7_use_candidate_facts_cache'
);

do $migration$
declare
  v_get_next text;
  v_ranker text;
  v_get_next_count integer;
  v_ranker_count integer;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_get_next;

  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_ranker;

  if v_get_next like '%v7 candidate-facts cache substitution%'
     and v_ranker like '%v7 candidate-facts cache substitution%' then
    raise notice 'Router V7 candidate-facts cache substitution is already installed.';
    return;
  end if;

  if v_get_next not like '%v7 app-facing activation%'
     or v_get_next not like '%v7 initial section balance%'
     or v_ranker not like '%obs_question_ladder_metadata%' then
    raise exception using
      errcode = 'P0001',
      message = 'Expected V7 activation/balance prerequisites are not installed.';
  end if;

  v_get_next_count := (
    length(v_get_next)
      - length(replace(v_get_next, 'public.obs_question_bank_with_dimensions', ''))
  ) / length('public.obs_question_bank_with_dimensions');
  v_ranker_count := (
    length(v_ranker)
      - length(replace(v_ranker, 'public.obs_question_bank_with_dimensions', ''))
  ) / length('public.obs_question_bank_with_dimensions');

  if v_get_next_count < 1 or v_ranker_count < 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected question-bank view references before cache substitution, found wrapper=%s ranker=%s.',
        v_get_next_count,
        v_ranker_count
      );
  end if;

  v_get_next := replace(
    v_get_next,
    'public.obs_question_bank_with_dimensions',
    'public.obs_router_candidate_facts'
  );
  v_get_next := replace(
    v_get_next,
    '-- v7 initial section balance',
    '-- v7 candidate-facts cache substitution' || chr(10)
      || '      -- v7 initial section balance'
  );

  v_ranker := replace(
    v_ranker,
    'public.obs_question_bank_with_dimensions',
    'public.obs_router_candidate_facts'
  );
  v_ranker := replace(
    v_ranker,
    'with attempt_scope as (',
    '-- v7 candidate-facts cache substitution' || chr(10)
      || '  with attempt_scope as ('
  );

  if v_get_next not like '%v7 candidate-facts cache substitution%'
     or v_get_next like '%public.obs_question_bank_with_dimensions%'
     or v_get_next not like '%public.obs_router_candidate_facts%'
     or v_ranker not like '%v7 candidate-facts cache substitution%'
     or v_ranker like '%public.obs_question_bank_with_dimensions%'
     or v_ranker not like '%public.obs_router_candidate_facts%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 cache substitution did not produce the expected function bodies.';
  end if;

  execute v_get_next;
  execute v_ranker;
end
$migration$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. With active_version V7, uses cached candidate facts for repeat/balance checks, tries V7 first, then falls back to V6/V5 if needed.';

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Active V7 OT candidate ranker. Uses cached candidate facts for answer-history question facts while preserving metadata-aware ranking behavior.';

notify pgrst, 'reload schema';

commit;
