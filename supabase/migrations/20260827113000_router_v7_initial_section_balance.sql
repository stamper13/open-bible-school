-- Router V7: initial OT section balance.
--
-- Keep the first general OT baseline questions from hyper-fixing on a newly
-- discovered weak section. V7 still ranks the candidates, but the app-facing
-- wrapper prefers under-sampled OT sections early and defers sections that
-- already consumed too much of the short baseline attempt.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null
     or to_regprocedure('public.canonical_assessment_scope(text)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 initial section balance prerequisites are missing; nothing was changed.';
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
  '20260827113000_router_v7_initial_section_balance',
  pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.backup_tag = '20260827113000_router_v7_initial_section_balance'
);

do $migration$
declare
  v_sql text;
  v_original text;
  v_needle text;
  v_replacement text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%v7 initial section balance%' then
    raise notice 'Router V7 initial section balance is already installed.';
    return;
  end if;

  if v_sql not like '%v7 app-facing activation%'
     or v_sql not like '%obs_rank_ot_assessment_candidates_v7%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 activation is not installed on get_next_assessment_question.';
  end if;

  v_needle := $needle$
      order by ranked.candidate_rank
      limit 1;
    exception when others then
$needle$;

  v_count := (
    length(v_sql) - length(replace(v_sql, v_needle, ''))
  ) / greatest(length(v_needle), 1);

  if v_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected one V7 app-wrapper order clause, found %s.',
        v_count
      );
  end if;

  v_replacement := $replacement$
      -- v7 initial section balance
      order by
        case
          when coalesce(attempt_row.assessment_kind, '') = 'ot_adaptive'
            and upper(coalesce(attempt_row.scope_key, 'OT')) = 'OT'
            and coalesce(attempt_row.answered_count, 0) < 20
            and (
              select count(*)::integer
              from public.assessment_answers section_answer
              left join public.obs_question_bank_with_dimensions section_question
                on section_question.generated_question_id =
                  section_answer.generated_question_id
              where section_answer.attempt_id = p_attempt_id
                and section_answer.user_id = p_user_id
                and coalesce(section_answer.scoring_eligible, true)
                and public.canonical_assessment_scope(section_question.book_code)
                  = public.canonical_assessment_scope(ranked.book_code)
            ) < 3
            then 0
          when coalesce(attempt_row.assessment_kind, '') = 'ot_adaptive'
            and upper(coalesce(attempt_row.scope_key, 'OT')) = 'OT'
            and coalesce(attempt_row.answered_count, 0) < 20
            and (
              select count(*)::integer
              from public.assessment_answers section_answer
              left join public.obs_question_bank_with_dimensions section_question
                on section_question.generated_question_id =
                  section_answer.generated_question_id
              where section_answer.attempt_id = p_attempt_id
                and section_answer.user_id = p_user_id
                and coalesce(section_answer.scoring_eligible, true)
                and public.canonical_assessment_scope(section_question.book_code)
                  = public.canonical_assessment_scope(ranked.book_code)
            ) >= 6
            then 20
          when coalesce(attempt_row.assessment_kind, '') = 'ot_adaptive'
            and upper(coalesce(attempt_row.scope_key, 'OT')) = 'OT'
            and coalesce(attempt_row.answered_count, 0) < 40
            and (
              select count(*)::integer
              from public.assessment_answers section_answer
              left join public.obs_question_bank_with_dimensions section_question
                on section_question.generated_question_id =
                  section_answer.generated_question_id
              where section_answer.attempt_id = p_attempt_id
                and section_answer.user_id = p_user_id
                and coalesce(section_answer.scoring_eligible, true)
                and public.canonical_assessment_scope(section_question.book_code)
                  = public.canonical_assessment_scope(ranked.book_code)
            ) < 5
            then 1
          when coalesce(attempt_row.assessment_kind, '') = 'ot_adaptive'
            and upper(coalesce(attempt_row.scope_key, 'OT')) = 'OT'
            and coalesce(attempt_row.answered_count, 0) < 40
            and (
              select count(*)::integer
              from public.assessment_answers section_answer
              left join public.obs_question_bank_with_dimensions section_question
                on section_question.generated_question_id =
                  section_answer.generated_question_id
              where section_answer.attempt_id = p_attempt_id
                and section_answer.user_id = p_user_id
                and coalesce(section_answer.scoring_eligible, true)
                and public.canonical_assessment_scope(section_question.book_code)
                  = public.canonical_assessment_scope(ranked.book_code)
            ) >= 12
            then 18
          else 10
        end,
        ranked.candidate_rank
      limit 1;
    exception when others then
$replacement$;

  v_sql := replace(v_sql, v_needle, v_replacement);

  if v_sql = v_original
     or v_sql not like '%v7 initial section balance%'
     or v_sql not like '%coalesce(attempt_row.answered_count, 0) < 20%'
     or v_sql not like '%coalesce(attempt_row.answered_count, 0) < 40%'
     or v_sql not like '%then 20%'
     or v_sql not like '%then 18%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 initial section balance patch did not produce the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. With active_version V7, tries the metadata-aware V7 ranker first, adds early general-assessment section balance, then falls back to V6/V5 if needed.';

notify pgrst, 'reload schema';

commit;
