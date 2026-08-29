-- Router V7: make initial OT section balance use ranker output.
--
-- The first section-balance wrapper used repeated correlated answer counts in
-- the V7 order clause. That preserved behavior but made production
-- next-question calls too slow. V7 already returns each candidate's attempt
-- section share, so keep the early balance behavior by sorting on that cheap
-- ranker output before candidate_rank.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 fast section balance prerequisites are missing; nothing was changed.';
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
  '20260827115000_router_v7_initial_section_balance_fast_path',
  pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.backup_tag = '20260827115000_router_v7_initial_section_balance_fast_path'
);

do $migration$
declare
  v_sql text;
  v_start integer;
  v_tail_start integer;
  v_tail_needle text := $tail$
      limit 1;
    exception when others then
$tail$;
  v_replacement text;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  if v_sql like '%v7 initial section balance fast path%' then
    raise notice 'Router V7 initial section balance fast path is already installed.';
    return;
  end if;

  if v_sql not like '%v7 initial section balance%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 initial section balance is not installed; apply 20260827113000 first.';
  end if;

  v_start := strpos(v_sql, '      -- v7 initial section balance');
  v_tail_start := strpos(substr(v_sql, v_start), v_tail_needle);

  if v_start <= 0 or v_tail_start <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Could not locate the V7 initial section balance order block.';
  end if;

  v_replacement := $replacement$
      -- v7 initial section balance fast path
      order by
        case
          when coalesce(attempt_row.assessment_kind, '') = 'ot_adaptive'
            and upper(coalesce(attempt_row.scope_key, 'OT')) = 'OT'
            and coalesce(attempt_row.answered_count, 0) between 1 and 39
            then coalesce(ranked.v7_attempt_section_share, 0::numeric)
          else 0::numeric
        end,
        ranked.candidate_rank
      limit 1;
    exception when others then
$replacement$;

  v_sql :=
    substr(v_sql, 1, v_start - 1)
    || v_replacement
    || substr(
      v_sql,
      v_start + v_tail_start + length(v_tail_needle) - 1
    );

  if v_sql not like '%v7 initial section balance fast path%'
     or v_sql like '%from public.assessment_answers section_answer%'
     or v_sql not like '%coalesce(ranked.v7_attempt_section_share, 0::numeric)%'
     or v_sql not like '%ranked.candidate_rank%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 fast section balance patch did not produce the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. With active_version V7, tries the metadata-aware V7 ranker first, adds fast early general-assessment section balance, then falls back to V6/V5 if needed.';

notify pgrst, 'reload schema';

commit;
