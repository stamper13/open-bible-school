-- Restore the NT selector from the pre-balance implementation by removing
-- the division-progress additions introduced by 20260821130849.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $rollback$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_get_next_nt_assessment_question(uuid)'::regprocedure
  );

  if v_definition like '%nt-early-division%' then
    v_definition := replace(
      v_definition,
      E'  division_progress as (\n    select\n      public.obs_nt_scope_key(book.nt_division, null) as division_key,\n      count(*)::integer as answered\n    from public.assessment_answers answer\n    join public.v_nt_question_bank question\n      on question.generated_question_id = answer.generated_question_id\n    left join public.scripture_books book\n      on book.book_code = question.book_code\n    join authorized_attempt attempt\n      on attempt.id = answer.attempt_id\n    group by public.obs_nt_scope_key(book.nt_division, null)\n  ),\n',
      ''
    );

    v_definition := replace(
      v_definition,
      E'      public.obs_nt_scope_key(book.nt_division, null) as division_key,\n      coalesce(division_progress.answered, 0) as division_answered,\n',
      ''
    );

    v_definition := replace(
      v_definition,
      E'    left join division_progress\n      on division_progress.division_key = public.obs_nt_scope_key(book.nt_division, null)\n',
      ''
    );

    v_definition := replace(
      v_definition,
      E'    case\n      when progress.answered < least(ranked.target_count, 12)\n        then ranked.division_answered\n    end asc nulls last,\n    case\n      when progress.answered < 6 then md5(\n        p_attempt_id::text || '':nt-early-division:'' ||\n        coalesce(ranked.division_key, '''')\n      )\n    end,\n    case\n      when progress.answered < 6 then md5(\n        p_attempt_id::text || '':nt-early-book:'' ||\n        coalesce(ranked.book_code, '''')\n      )\n    end,\n',
      ''
    );
  end if;

  execute v_definition;
end
$rollback$;

notify pgrst, 'reload schema';

commit;
