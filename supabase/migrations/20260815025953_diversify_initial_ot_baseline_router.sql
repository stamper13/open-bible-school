-- Diversify initial OT baseline retakes and demote pure Hebrew-division taxonomy.
--
-- The fast baseline selector should remain quick, but it should not feel like
-- the same 20-item form on every retake. This version sinks questions and stem
-- families recently seen by the same user, and keeps "which book/group belongs
-- to this Hebrew Bible division" items out of the main competency signal unless
-- the assessment is near the end and has not already used one.

begin;

create or replace function public.obs_get_next_ot_baseline_question_fast(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text,
  map jsonb
)
language sql
stable
security definer
set search_path = public
as $function$
  with attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.testament, 'OT')) as testament,
      upper(coalesce(attempt.scope_key, 'OT')) as scope_key
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and auth.uid() = p_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and upper(coalesce(attempt.scope_key, 'OT')) = 'OT'
      and attempt.assessment_kind = 'ot_adaptive'
      and not coalesce(attempt.is_complete, false)
      and attempt.completed_at is null
  ),
  answered as (
    select
      answer.generated_question_id,
      answer.scoring_eligible,
      answer.answered_at,
      question.book_code,
      question.dimension_key,
      nullif(question.payload->>'stem_family', '') as stem_family,
      lower(coalesce(question.payload->>'question_family', '')) as question_family,
      lower(coalesce(question.payload->>'knowledge_granularity', '')) as granularity,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type
    from attempt
    join public.assessment_answers answer
      on answer.attempt_id = attempt.id
     and answer.user_id = attempt.user_id
    left join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as seen_count,
      max(answer.answered_at) as last_seen_at
    from attempt
    join public.assessment_answers answer
      on answer.user_id = attempt.user_id
     and answer.attempt_id <> attempt.id
    group by answer.generated_question_id
  ),
  user_stem_history as (
    select
      nullif(question.payload->>'stem_family', '') as stem_family,
      count(*)::integer as seen_count,
      max(answer.answered_at) as last_seen_at
    from attempt
    join public.assessment_answers answer
      on answer.user_id = attempt.user_id
     and answer.attempt_id <> attempt.id
    join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
    where nullif(question.payload->>'stem_family', '') is not null
    group by nullif(question.payload->>'stem_family', '')
  ),
  stats as (
    select
      count(*) filter (where scoring_eligible)::integer as scored_answered,
      count(*) filter (
        where scoring_eligible
          and (
            question_family in ('book_orientation', 'section_screen')
            or granularity in ('book_overview', 'canon_section', 'section_overview')
          )
      )::integer as foundation_answered,
      count(*) filter (
        where scoring_eligible
          and (
            question_type = 'ot_book_section_sort_v1'
            or prompt ~* 'which group consists entirely of books in'
            or prompt ~* 'which book belongs to .+ rather than'
            or prompt ~* 'called the (former prophets|latter prophets|writings)'
          )
      )::integer as division_taxonomy_answered
    from answered
  ),
  section_counts as (
    select
      public.canonical_assessment_scope(book_code) as section_key,
      count(*) filter (where scoring_eligible)::integer as answered
    from answered
    where book_code is not null
    group by public.canonical_assessment_scope(book_code)
  ),
  dimension_counts as (
    select
      dimension_key,
      count(*) filter (where scoring_eligible)::integer as answered
    from answered
    where dimension_key is not null
    group by dimension_key
  ),
  candidates as (
    select
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      coalesce(event.event_title, question.book_code || ' question') as event_title,
      question.book_code,
      question.dimension_key,
      coalesce(question.importance_conceptual, question.routing_score, 0) as importance_score,
      public.canonical_assessment_scope(question.book_code) as section_key,
      lower(coalesce(question.payload->>'question_family', '')) as question_family,
      lower(coalesce(question.payload->>'knowledge_granularity', '')) as granularity,
      coalesce(section_counts.answered, 0) as section_answered,
      coalesce(dimension_counts.answered, 0) as dimension_answered,
      coalesce(question.payload->>'stem_family', '') as stem_family,
      coalesce(user_history.seen_count, 0) as prior_seen_count,
      user_history.last_seen_at as prior_seen_at,
      coalesce(user_stem_history.seen_count, 0) as prior_stem_seen_count,
      user_stem_history.last_seen_at as prior_stem_seen_at,
      (
        question.question_type = 'ot_book_section_sort_v1'
        or coalesce(question.payload->>'prompt', question.prompt) ~* 'which group consists entirely of books in'
        or coalesce(question.payload->>'prompt', question.prompt) ~* 'which book belongs to .+ rather than'
        or coalesce(question.payload->>'prompt', question.prompt) ~* 'called the (former prophets|latter prophets|writings)'
      ) as is_division_taxonomy
    from attempt
    join public.obs_question_bank_with_dimensions question
      on public.question_matches_assessment_scope(
        question.book_code,
        attempt.testament,
        attempt.scope_key
      )
    left join public.bible_events event
      on event.id = question.event_id
    left join section_counts
      on section_counts.section_key = public.canonical_assessment_scope(question.book_code)
    left join dimension_counts
      on dimension_counts.dimension_key = question.dimension_key
    left join user_history
      on user_history.generated_question_id = question.generated_question_id
    left join user_stem_history
      on user_stem_history.stem_family = nullif(question.payload->>'stem_family', '')
    where question.generated_question_id is not null
      and coalesce(question.payload->>'prompt', question.prompt) is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and question.question_type not like 'quarantined%'
      and question.question_type not like 'map\_%'
      and (
        (
          public.obs_is_order_response_question(question.question_type, question.payload)
          and jsonb_array_length(question.payload->'choices') between 3 and 5
        )
        or (
          not public.obs_is_order_response_question(question.question_type, question.payload)
          and jsonb_array_length(question.payload->'choices') = 4
          and coalesce(
            question.payload->>'correct_choice_id',
            question.payload->>'answer_id',
            question.payload->>'correctAnswerId'
          ) is not null
        )
      )
      and not exists (
        select 1
        from answered used
        where used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from answered used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(question.payload->>'stem_family', '')
      )
  )
  select
    candidate.generated_question_id,
    candidate.prompt::text,
    candidate.question_type::text,
    candidate.payload->'choices',
    candidate.event_title::text,
    candidate.book_code::text,
    case
      when candidate.importance_score >= 80 then 1
      when candidate.importance_score >= 60 then 2
      else 3
    end,
    case candidate.section_key
      when 'TORAH' then 'Torah'
      when 'FORMER' then 'Former Prophets'
      when 'LATTER' then 'Latter Prophets'
      when 'WRITINGS' then 'Writings'
      else 'Old Testament'
    end,
    null::jsonb
  from candidates candidate
  cross join stats
  where (
    not candidate.is_division_taxonomy
    or (
      stats.scored_answered >= 16
      and stats.division_taxonomy_answered = 0
    )
  )
  order by
    case
      when candidate.is_division_taxonomy then 3
      when (stats.scored_answered < 16 or stats.foundation_answered < 12)
        and public.obs_is_high_specificity_assessment_question(
          candidate.prompt,
          candidate.question_type,
          candidate.payload
        )
        then 2
      when stats.scored_answered >= 8
        and (stats.scored_answered < 16 or stats.foundation_answered < 12)
        and candidate.question_family = 'book_orientation'
        then 0
      when stats.foundation_answered < 12
        and (
          candidate.question_family in ('book_orientation', 'section_screen')
          or candidate.granularity in ('book_overview', 'section_overview')
        )
        then 0
      else 1
    end,
    case
      when greatest(
        coalesce(candidate.prior_seen_at, '-infinity'::timestamptz),
        coalesce(candidate.prior_stem_seen_at, '-infinity'::timestamptz)
      ) > now() - interval '30 days' then 3
      when greatest(
        coalesce(candidate.prior_seen_at, '-infinity'::timestamptz),
        coalesce(candidate.prior_stem_seen_at, '-infinity'::timestamptz)
      ) > now() - interval '180 days' then 2
      when candidate.prior_seen_count > 0 or candidate.prior_stem_seen_count > 0 then 1
      else 0
    end,
    candidate.section_answered,
    candidate.dimension_answered,
    case candidate.section_key
      when 'TORAH' then 1
      when 'FORMER' then 2
      when 'LATTER' then 3
      when 'WRITINGS' then 4
      else 5
    end,
    candidate.importance_score desc,
    md5(
      p_attempt_id::text || ':' ||
      p_user_id::text || ':' ||
      candidate.generated_question_id::text
    )
  limit 1;
$function$;

grant execute on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid)
  to authenticated, service_role;

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast OT baseline selector with retake novelty and pure division-taxonomy demotion.';

notify pgrst, 'reload schema';

commit;
