-- Roll back early seeded OT baseline diversification and the runtime
-- similarity-key duplicate guard.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $rollback$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  );

  if v_definition like '%obs_assessment_question_similarity_key%' then
    v_definition := replace(
      v_definition,
      E'      nullif(question.payload->>''stem_family'', '''') as stem_family,\n      public.obs_assessment_question_similarity_key(\n        question.payload,\n        question.book_code,\n        question.dimension_key,\n        question.question_type,\n        coalesce(question.payload->>''prompt'', question.prompt)\n      ) as similarity_key,\n      lower(coalesce(question.payload->>''question_family'', '''')) as question_family,',
      E'      nullif(question.payload->>''stem_family'', '''') as stem_family,\n      lower(coalesce(question.payload->>''question_family'', '''')) as question_family,'
    );

    v_definition := replace(
      v_definition,
      E'      coalesce(question.payload->>''stem_family'', '''') as stem_family,\n      public.obs_assessment_question_similarity_key(\n        question.payload,\n        question.book_code,\n        question.dimension_key,\n        question.question_type,\n        coalesce(question.payload->>''prompt'', question.prompt)\n      ) as similarity_key,\n      coalesce(user_history.seen_count, 0) as prior_seen_count,',
      E'      coalesce(question.payload->>''stem_family'', '''') as stem_family,\n      coalesce(user_history.seen_count, 0) as prior_seen_count,'
    );

    v_definition := replace(
      v_definition,
      E'      and not exists (\n        select 1\n        from answered used_similarity\n        where used_similarity.similarity_key is not null\n          and used_similarity.similarity_key = public.obs_assessment_question_similarity_key(\n            question.payload,\n            question.book_code,\n            question.dimension_key,\n            question.question_type,\n            coalesce(question.payload->>''prompt'', question.prompt)\n          )\n      )',
      E'      and not exists (\n        select 1\n        from answered used_family\n        where nullif(question.payload->>''stem_family'', '''') is not null\n          and used_family.stem_family = nullif(question.payload->>''stem_family'', '''')\n      )'
    );
  end if;

  if v_definition like '%:early-section:%' then
    v_definition := replace(
      v_definition,
      E'    candidate.dimension_answered,\n    case\n      when stats.scored_answered < 4 then md5(\n        p_attempt_id::text || '':'' ||\n        p_user_id::text || '':early-section:'' ||\n        coalesce(candidate.section_key, '''')\n      )\n    end,\n    case\n      when stats.scored_answered < 4 then md5(\n        p_attempt_id::text || '':'' ||\n        p_user_id::text || '':early-book:'' ||\n        coalesce(candidate.book_code, '''')\n      )\n    end,\n    case\n      when stats.scored_answered < 4 then md5(\n        p_attempt_id::text || '':'' ||\n        p_user_id::text || '':early-question:'' ||\n        candidate.generated_question_id::text\n      )\n    end,\n    case candidate.section_key',
      E'    candidate.dimension_answered,\n    case candidate.section_key'
    );
  end if;

  execute v_definition;
end
$rollback$;

drop function if exists public.obs_assessment_question_similarity_key(jsonb, text, text, text, text);

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast OT baseline selector with retake novelty, division-taxonomy demotion, a book-orientation cap, weak-section follow-up, and a larger Latter Prophets probe floor.';

notify pgrst, 'reload schema';

commit;
