-- Improve NT assessment section balance for first-time assessment flows.
--
-- The NT selector was fast after v_nt_question_bank optimization, but short
-- anonymous sessions still over-favored Gospels/Acts. This keeps the existing
-- adaptive score, while preferring less-seen NT divisions early in an attempt
-- and adding deterministic attempt-seeded tie-breakers before adaptive score.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Resolved definition for public.obs_get_next_nt_assessment_question(uuid).
-- Captured verbatim from production with pg_get_functiondef after the
-- original string-mutation form of this migration was applied, so replaying
-- this file from zero produces the same body that production runs.
CREATE OR REPLACE FUNCTION public.obs_get_next_nt_assessment_question(p_attempt_id uuid)
 RETURNS TABLE(out_generated_question_id uuid, prompt text, question_type text, choices jsonb, book_code text, book_name text, nt_division text, answered_count integer, target_question_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with authorized_attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.scope_key, 'NT')) as scope_key,
      greatest(1, coalesce(attempt.target_question_count, 20)) as target_count
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = auth.uid()
      and upper(coalesce(attempt.testament, 'NT')) = 'NT'
  ),
  attempt_answers as (
    select
      answer.generated_question_id,
      question.question_type,
      question.payload,
      nullif(question.payload->>'stem_family', '') as stem_family
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    join authorized_attempt attempt
      on attempt.id = answer.attempt_id
  ),
  progress as (
    select count(*)::integer as answered
    from attempt_answers
  ),
  foundation as (
    select (count(*) filter (
      where lower(coalesce(payload->>'question_family', '')) in (
        'book_orientation',
        'section_screen'
      )
      or lower(coalesce(payload->>'knowledge_granularity', '')) in (
        'book_overview',
        'canon_section',
        'section_overview'
      )
      or question_type in (
        'ot_book_section_sort_v1',
        'nt_book_section_sort_v1'
      )
    ))::integer as answered
    from attempt_answers
  ),
  division_progress as (
    select
      public.obs_nt_scope_key(book.nt_division, null) as division_key,
      count(*)::integer as answered
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    left join public.scripture_books book
      on book.book_code = question.book_code
    join authorized_attempt attempt
      on attempt.id = answer.attempt_id
    group by public.obs_nt_scope_key(book.nt_division, null)
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    where answer.user_id = auth.uid()
    group by answer.generated_question_id
  ),
  candidates as (
    select
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      question.book_code,
      book.name as book_name,
      book.nt_division,
      public.obs_nt_scope_key(book.nt_division, null) as division_key,
      coalesce(division_progress.answered, 0) as division_answered,
      nullif(question.payload->>'stem_family', '') as stem_family,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      public.obs_effective_item_irt_a(question.payload, null) as effective_a,
      public.obs_effective_item_irt_b(question.payload, null) as effective_b,
      coalesce(
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        nt_ability.theta - 0.5 * coalesce(nt_ability.theta_se, 1.0),
        0.0
      ) as theta_lcb,
      greatest(
        0.0,
        least(
          1.0,
          coalesce(
            public.obs_payload_number(
              question.payload,
              'importance_conceptual'
            ) / 100.0,
            0.60
          )
        )
      ) as importance_score,
      attempt.target_count
    from authorized_attempt attempt
    join public.v_nt_question_bank question
      on true
    left join public.scripture_books book
      on book.book_code = question.book_code
    left join public.user_abilities ability
      on ability.user_id = attempt.user_id
     and ability.scope = case
       when attempt.scope_key in (
         'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
       ) then attempt.scope_key
       else public.obs_nt_scope_key(book.nt_division, null)
     end
    left join public.user_abilities nt_ability
      on nt_ability.user_id = attempt.user_id
     and nt_ability.scope = 'NT'
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    left join division_progress
      on division_progress.division_key = public.obs_nt_scope_key(book.nt_division, null)
    cross join progress
    where progress.answered < attempt.target_count
      and question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2
      and public.obs_nt_question_matches_scope(
        question.book_code,
        book.nt_division,
        attempt.scope_key
      )
      and not exists (
        select 1
        from attempt_answers used
        where used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from attempt_answers used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(
            question.payload->>'stem_family',
            ''
          )
      )
  ),
  ranked as (
    select
      candidate.*,
      (
        0.55 * public.obs_item_information(
          candidate.theta_lcb,
          candidate.effective_a,
          candidate.effective_b
        )
        + 0.25 * candidate.importance_score
        + 0.15 * (1.0 / (1.0 + candidate.times_answered))
        + 0.05 * random()
      ) as adaptive_score
    from candidates candidate
  )
  select
    ranked.generated_question_id,
    ranked.prompt,
    ranked.question_type,
    ranked.payload->'choices',
    ranked.book_code,
    ranked.book_name,
    ranked.nt_division,
    progress.answered,
    ranked.target_count
  from ranked
  cross join progress
  cross join foundation
  order by
    case
      when (progress.answered < 16 or foundation.answered < 12)
        and public.obs_is_high_specificity_assessment_question(
          ranked.prompt,
          ranked.question_type,
          ranked.payload
        )
        then 2
      when progress.answered >= 8
        and (progress.answered < 16 or foundation.answered < 12)
        and lower(coalesce(ranked.payload->>'question_family', ''))
          = 'book_orientation'
        then 0
      else 1
    end,
    case
      when progress.answered < least(ranked.target_count, 12)
        then ranked.division_answered
    end asc nulls last,
    case
      when progress.answered < 6 then md5(
        p_attempt_id::text || ':nt-early-division:' ||
        coalesce(ranked.division_key, '')
      )
    end,
    case
      when progress.answered < 6 then md5(
        p_attempt_id::text || ':nt-early-book:' ||
        coalesce(ranked.book_code, '')
      )
    end,
    ranked.adaptive_score desc,
    ranked.times_answered asc,
    ranked.last_answered_at asc nulls first,
    ranked.generated_question_id
  limit 1;
$function$
;

notify pgrst, 'reload schema';

commit;
