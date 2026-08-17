-- Verify the Old Testament geography batch and report coverage.

do $$
declare
  batch_count integer;
  book_count integer;
  covered_book_count integer;
  essential_count integer;
  supporting_count integer;
  episode_count integer;
  foundation_count integer;
  core_count integer;
  malformed_count integer;
  blocked_count integer;
  structurally_flagged integer;
  semantic_pass_count integer;
  correct_position_min integer;
  correct_position_max integer;
  essential_mean numeric;
  supporting_mean numeric;
  episode_mean numeric;
begin

  select
    count(*),
    count(*) filter (where payload->>'knowledge_granularity' = 'book_geography_overview'),
    count(distinct payload->>'book_code') filter (
      where payload->>'knowledge_granularity' = 'book_geography_overview'
    ),
    count(*) filter (where payload->>'geography_centrality' = 'essential'),
    count(*) filter (where payload->>'geography_centrality' = 'supporting'),
    count(*) filter (where payload->>'geography_centrality' = 'episode'),
    count(*) filter (where payload->>'retest_stage' = 'foundation'),
    count(*) filter (where payload->>'retest_stage' = 'core')
  into
    batch_count,
    book_count,
    covered_book_count,
    essential_count,
    supporting_count,
    episode_count,
    foundation_count,
    core_count
  from public.ot_generated_questions
  where payload->>'source_batch' = '20260729_ot_geography_centrality_v1';

  select count(*)
  into malformed_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1'
    and (
      question.payload->>'dimension_key' <> 'geography_nations'
      or jsonb_array_length(question.payload->'choices') <> 4
      or (
        select count(*)
        from jsonb_array_elements(question.payload->'choices') choice
        where choice->>'id' = question.payload->>'correct_choice_id'
      ) <> 1
      or (
        select count(distinct lower(btrim(choice->>'text')))
        from jsonb_array_elements(question.payload->'choices') choice
      ) <> 4
    );

  select count(*)
  into blocked_count
  from public.obs_admin_question_bank_audit audit
  where audit.payload->>'source_batch' = '20260729_ot_geography_centrality_v1'
    and (
      cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
    );

  select count(*)
  into structurally_flagged
  from public.obs_question_distractor_quality_audit audit
  join public.ot_generated_questions question
    on question.id = audit.generated_question_id
  where question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1'
    and audit.requires_review;

  select count(*)
  into semantic_pass_count
  from public.obs_semantic_distractor_reviews review
  join public.ot_generated_questions question
    on question.id = review.generated_question_id
  where question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1'
    and review.review_status = 'pass'
    and review.same_semantic_category
    and not review.obvious_elimination_present;

  select min(position_count), max(position_count)
  into correct_position_min, correct_position_max
  from (
    select
      question.payload->>'correct_choice_id' as choice_id,
      count(*)::integer as position_count
    from public.ot_generated_questions question
    where question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1'
    group by question.payload->>'correct_choice_id'
  ) positions;

  select
    avg(
      (
        (payload->>'importance_context')::numeric
        + (payload->>'importance_conceptual')::numeric
      ) / 2.0
    ) filter (where payload->>'geography_centrality' = 'essential'),
    avg(
      (
        (payload->>'importance_context')::numeric
        + (payload->>'importance_conceptual')::numeric
      ) / 2.0
    ) filter (where payload->>'geography_centrality' = 'supporting'),
    avg(
      (
        (payload->>'importance_context')::numeric
        + (payload->>'importance_conceptual')::numeric
      ) / 2.0
    ) filter (where payload->>'geography_centrality' = 'episode')
  into essential_mean, supporting_mean, episode_mean
  from public.ot_generated_questions
  where payload->>'source_batch' = '20260729_ot_geography_centrality_v1';

  if batch_count <> 50
     or book_count <> 39
     or covered_book_count <> 39
     or essential_count <> 33
     or supporting_count <> 6
     or episode_count <> 11
     or foundation_count <> 35
     or core_count <> 15
     or malformed_count <> 0
     or blocked_count <> 0
     or structurally_flagged <> 0
     or semantic_pass_count <> 50
     or correct_position_max - correct_position_min > 1
     or not (
       essential_mean > supporting_mean
       and supporting_mean > episode_mean
     )
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Geography batch failed: total=%s book=%s books=%s centrality=%s/%s/%s stage=%s/%s malformed=%s blocked=%s structural=%s semantic=%s positions=%s-%s means=%s/%s/%s.',
        batch_count,
        book_count,
        covered_book_count,
        essential_count,
        supporting_count,
        episode_count,
        foundation_count,
        core_count,
        malformed_count,
        blocked_count,
        structurally_flagged,
        semantic_pass_count,
        correct_position_min,
        correct_position_max,
        round(essential_mean, 2),
        round(supporting_mean, 2),
        round(episode_mean, 2)
      );
  end if;
  raise notice
    'PASS: 50 geography questions installed (39 book-level, 11 episode-level); all 39 OT books covered; importance centrality and distractors verified.';
end
$$;

select
  question.payload->>'geography_centrality' as geography_centrality,
  question.payload->>'retest_stage' as retest_stage,
  count(*)::integer as questions,
  round(
    avg((question.payload->>'importance_context')::numeric),
    1
  ) as mean_context_importance,
  round(
    avg((question.payload->>'importance_conceptual')::numeric),
    1
  ) as mean_conceptual_importance
from public.ot_generated_questions question
where question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1'
group by
  question.payload->>'geography_centrality',
  question.payload->>'retest_stage'
order by
  min(
    case question.payload->>'geography_centrality'
      when 'essential' then 1
      when 'supporting' then 2
      else 3
    end
  ),
  retest_stage;

select
  book.book_code,
  book.display_name as book_name,
  count(question.generated_question_id)::integer
    as active_geography_questions,
  count(question.generated_question_id) filter (
    where question.payload->>'source_batch' = '20260729_ot_geography_centrality_v1'
  )::integer as new_geography_questions
from public.obs_biblical_books book
left join public.obs_question_bank_with_dimensions question
  on question.book_code = book.book_code
 and question.dimension_key = 'geography_nations'
where book.testament = 'OT'
group by book.canonical_order, book.book_code, book.display_name
order by book.canonical_order;
