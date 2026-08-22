-- Improve NT assessment section balance for first-time assessment flows.
--
-- The NT selector was fast after v_nt_question_bank optimization, but short
-- anonymous sessions still over-favored Gospels/Acts. This keeps the existing
-- adaptive score, while preferring less-seen NT divisions early in an attempt
-- and adding deterministic attempt-seeded tie-breakers before adaptive score.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_get_next_nt_assessment_question(uuid)'::regprocedure
  );

  if v_definition not like '%foundation as (%' then
    raise exception 'Unexpected NT selector definition; foundation CTE anchor not found.';
  end if;

  if v_definition not like '%user_history as (%' then
    raise exception 'Unexpected NT selector definition; user_history CTE anchor not found.';
  end if;

  if v_definition not like '%book.nt_division,%' then
    raise exception 'Unexpected NT selector definition; nt_division select anchor not found.';
  end if;

  if v_definition not like '%left join user_history history%' then
    raise exception 'Unexpected NT selector definition; user_history join anchor not found.';
  end if;

  if v_definition not like '%ranked.adaptive_score desc,%' then
    raise exception 'Unexpected NT selector definition; adaptive order anchor not found.';
  end if;

  if v_definition not like '%nt-early-division%' then
    v_definition := replace(
      v_definition,
      E'  user_history as (',
      E'  division_progress as (\n    select\n      public.obs_nt_scope_key(book.nt_division, null) as division_key,\n      count(*)::integer as answered\n    from public.assessment_answers answer\n    join public.v_nt_question_bank question\n      on question.generated_question_id = answer.generated_question_id\n    left join public.scripture_books book\n      on book.book_code = question.book_code\n    join authorized_attempt attempt\n      on attempt.id = answer.attempt_id\n    group by public.obs_nt_scope_key(book.nt_division, null)\n  ),\n  user_history as ('
    );

    v_definition := replace(
      v_definition,
      E'      book.nt_division,\n      nullif(question.payload->>''stem_family'', '''') as stem_family,',
      E'      book.nt_division,\n      public.obs_nt_scope_key(book.nt_division, null) as division_key,\n      coalesce(division_progress.answered, 0) as division_answered,\n      nullif(question.payload->>''stem_family'', '''') as stem_family,'
    );

    v_definition := replace(
      v_definition,
      E'    left join user_history history\n      on history.generated_question_id = question.generated_question_id\n    cross join progress',
      E'    left join user_history history\n      on history.generated_question_id = question.generated_question_id\n    left join division_progress\n      on division_progress.division_key = public.obs_nt_scope_key(book.nt_division, null)\n    cross join progress'
    );

    v_definition := replace(
      v_definition,
      E'    ranked.adaptive_score desc,',
      E'    case\n      when progress.answered < least(ranked.target_count, 12)\n        then ranked.division_answered\n    end asc nulls last,\n    case\n      when progress.answered < 6 then md5(\n        p_attempt_id::text || '':nt-early-division:'' ||\n        coalesce(ranked.division_key, '''')\n      )\n    end,\n    case\n      when progress.answered < 6 then md5(\n        p_attempt_id::text || '':nt-early-book:'' ||\n        coalesce(ranked.book_code, '''')\n      )\n    end,\n    ranked.adaptive_score desc,'
    );
  end if;

  v_definition := regexp_replace(
    v_definition,
    E'LANGUAGE sql\\s+SECURITY DEFINER',
    E'LANGUAGE sql\nSECURITY DEFINER',
    'i'
  );

  execute v_definition;
end
$migration$;

notify pgrst, 'reload schema';

commit;
