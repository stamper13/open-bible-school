-- Diversify the first OT baseline questions and strengthen in-attempt
-- duplicate suppression.
--
-- Production has a large OT question bank, but the fast selector's seeded
-- tie-breaker ran after fixed section order and importance. Fresh attempts
-- therefore funneled into the same tiny set of Torah foundation questions.
-- This migration keeps the existing quality/foundation gates, but moves an
-- attempt-seeded section/book shuffle ahead of the fixed section order for the
-- first few answered questions. It also adds a conservative runtime similarity
-- key so same-assessment duplicate checks still work when payload.stem_family
-- is missing.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.obs_assessment_question_similarity_key(
  p_payload jsonb,
  p_book_code text,
  p_dimension_key text,
  p_question_type text,
  p_prompt text
)
returns text
language sql
immutable
set search_path = public
as $function$
  select coalesce(
    nullif(btrim(p_payload->>'stem_family'), ''),
    case
      when nullif(btrim(p_payload->>'source_event_id'), '') is not null
        and nullif(btrim(p_dimension_key), '') is not null
        and nullif(btrim(p_payload->>'question_family'), '') is not null
      then concat_ws(
        '|',
        'source-event',
        lower(btrim(p_payload->>'source_event_id')),
        lower(btrim(p_dimension_key)),
        lower(btrim(p_payload->>'question_family'))
      )
    end,
    case
      when nullif(btrim(p_book_code), '') is not null
        and nullif(btrim(p_dimension_key), '') is not null
        and nullif(btrim(p_payload->>'question_family'), '') is not null
        and nullif(btrim(p_payload->>'knowledge_granularity'), '') is not null
      then concat_ws(
        '|',
        'meta',
        lower(btrim(p_book_code)),
        lower(btrim(p_dimension_key)),
        lower(btrim(p_payload->>'question_family')),
        lower(btrim(p_payload->>'knowledge_granularity'))
      )
    end,
    case
      when nullif(btrim(p_book_code), '') is not null
        and nullif(btrim(p_question_type), '') is not null
        and nullif(btrim(p_payload->>'correct_answer'), '') is not null
      then concat_ws(
        '|',
        'answer',
        lower(btrim(p_book_code)),
        lower(btrim(p_question_type)),
        regexp_replace(lower(btrim(p_payload->>'correct_answer')), '[^a-z0-9]+', '', 'g')
      )
    end,
    case
      when nullif(regexp_replace(lower(coalesce(p_prompt, '')), '[^a-z0-9]+', '', 'g'), '') is not null
      then 'prompt|' || md5(regexp_replace(lower(coalesce(p_prompt, '')), '[^a-z0-9]+', '', 'g'))
    end
  );
$function$;

revoke all on function public.obs_assessment_question_similarity_key(jsonb, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.obs_assessment_question_similarity_key(jsonb, text, text, text, text)
  to service_role;

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  );

  if v_definition not like '%nullif(question.payload->>''stem_family'', '''') as stem_family,%' then
    raise exception 'Unexpected fast selector definition; answered stem_family anchor not found.';
  end if;

  if v_definition not like '%coalesce(question.payload->>''stem_family'', '''') as stem_family,%' then
    raise exception 'Unexpected fast selector definition; candidate stem_family anchor not found.';
  end if;

  if v_definition not like '%where nullif(question.payload->>''stem_family'', '''') is not null%and used_family.stem_family = nullif(question.payload->>''stem_family'', '''')%' then
    raise exception 'Unexpected fast selector definition; stem-family duplicate anchor not found.';
  end if;

  if v_definition not like '%candidate.dimension_answered,%case candidate.section_key%' then
    raise exception 'Unexpected fast selector definition; section-order anchor not found.';
  end if;

  if v_definition not like '%obs_assessment_question_similarity_key%' then
    v_definition := replace(
      v_definition,
      E'      nullif(question.payload->>''stem_family'', '''') as stem_family,\n      lower(coalesce(question.payload->>''question_family'', '''')) as question_family,',
      E'      nullif(question.payload->>''stem_family'', '''') as stem_family,\n      public.obs_assessment_question_similarity_key(\n        question.payload,\n        question.book_code,\n        question.dimension_key,\n        question.question_type,\n        coalesce(question.payload->>''prompt'', question.prompt)\n      ) as similarity_key,\n      lower(coalesce(question.payload->>''question_family'', '''')) as question_family,'
    );

    v_definition := replace(
      v_definition,
      E'      coalesce(question.payload->>''stem_family'', '''') as stem_family,\n      coalesce(user_history.seen_count, 0) as prior_seen_count,',
      E'      coalesce(question.payload->>''stem_family'', '''') as stem_family,\n      public.obs_assessment_question_similarity_key(\n        question.payload,\n        question.book_code,\n        question.dimension_key,\n        question.question_type,\n        coalesce(question.payload->>''prompt'', question.prompt)\n      ) as similarity_key,\n      coalesce(user_history.seen_count, 0) as prior_seen_count,'
    );

    v_definition := replace(
      v_definition,
      E'      and not exists (\n        select 1\n        from answered used_family\n        where nullif(question.payload->>''stem_family'', '''') is not null\n          and used_family.stem_family = nullif(question.payload->>''stem_family'', '''')\n      )',
      E'      and not exists (\n        select 1\n        from answered used_similarity\n        where used_similarity.similarity_key is not null\n          and used_similarity.similarity_key = public.obs_assessment_question_similarity_key(\n            question.payload,\n            question.book_code,\n            question.dimension_key,\n            question.question_type,\n            coalesce(question.payload->>''prompt'', question.prompt)\n          )\n      )'
    );
  end if;

  if v_definition not like '%:early-section:%' then
    v_definition := replace(
      v_definition,
      E'    candidate.dimension_answered,\n    case candidate.section_key',
      E'    candidate.dimension_answered,\n    case\n      when stats.scored_answered < 4 then md5(\n        p_attempt_id::text || '':'' ||\n        p_user_id::text || '':early-section:'' ||\n        coalesce(candidate.section_key, '''')\n      )\n    end,\n    case\n      when stats.scored_answered < 4 then md5(\n        p_attempt_id::text || '':'' ||\n        p_user_id::text || '':early-book:'' ||\n        coalesce(candidate.book_code, '''')\n      )\n    end,\n    case\n      when stats.scored_answered < 4 then md5(\n        p_attempt_id::text || '':'' ||\n        p_user_id::text || '':early-question:'' ||\n        candidate.generated_question_id::text\n      )\n    end,\n    case candidate.section_key'
    );
  end if;

  v_definition := regexp_replace(
    v_definition,
    E'LANGUAGE sql\\s+STABLE',
    E'LANGUAGE sql\nVOLATILE',
    'i'
  );

  execute v_definition;
end
$migration$;

revoke all on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid)
  from public, anon;
grant execute on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid)
  to authenticated, service_role;

comment on function public.obs_assessment_question_similarity_key(jsonb, text, text, text, text) is
  'Returns a conservative same-assessment duplicate key for OT question selection when payload.stem_family is missing.';

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast OT baseline selector with retake novelty, division-taxonomy demotion, book-orientation cap, weak-section follow-up, early seeded diversification, and conservative duplicate suppression.';

notify pgrst, 'reload schema';

commit;
