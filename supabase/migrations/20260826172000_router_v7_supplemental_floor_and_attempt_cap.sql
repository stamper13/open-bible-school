-- V7 shadow: supplemental low-evidence candidates and stronger late attempt cap.
--
-- The 300-question replay after the law metadata pass showed that simply
-- promoting clean law-command metadata did not materially raise law coverage,
-- because V7 still depends on the widened V6 pool. This keeps V7 shadow-only
-- and changes no app-facing RPC.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.obs_question_ladder_metadata') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 supplemental floor prerequisites are missing; no changes made.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260826172000_router_v7_supplemental_floor_and_attempt_cap',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260826172000_router_v7_supplemental_floor_and_attempt_cap'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v7'
);

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%V7_LOW_EVIDENCE_SUPPLEMENTAL%'
     and v_sql like '%post-200 attempt section cap%'
  then
    raise notice 'Router V7 supplemental floor patch is already installed.';
    return;
  end if;

  if v_sql not like '%late long-run section brake%'
     or v_sql not like '%LOW_EVIDENCE_FLOOR%'
     or v_sql not like '%then 80 else 40%'
     or v_sql not like '%then 50 else 20%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Expected V7 long-run floor/brake prerequisites are not installed.';
  end if;

  v_sql := replace(
    v_sql,
$needle$
  v6_pool as (
    select *
    from public.obs_rank_ot_assessment_candidates_v6(
      p_attempt_id,
      p_user_id,
      'V6',
      p_answer_limit,
      coalesce(p_as_of, now()),
      200
    )
  ),
$needle$,
$replacement$
  base_v6_pool as (
    select *
    from public.obs_rank_ot_assessment_candidates_v6(
      p_attempt_id,
      p_user_id,
      'V6',
      p_answer_limit,
      coalesce(p_as_of, now()),
      200
    )
  ),
  v7_low_evidence_supplemental_candidates as (
    select
      (900 + row_number() over (
        order by
          greatest(
            0,
            (case when (select scoring_answered from long_run_totals) >= 200 then 50 else 20 end)
              - coalesce(long_run_dimension_stats.answered, 0)
          ) desc,
          greatest(
            0,
            (case when (select scoring_answered from long_run_totals) >= 200 then 80 else 40 end)
              - coalesce(long_run_section_stats.answered, 0)
          ) desc,
          case
            when coalesce(long_run_section_stats.observed_share, 0.0)
              > greatest(coalesce(section_targets.target_share, 0.0) + 0.05, coalesce(section_targets.target_share, 0.0) * 1.18)
              then 1
            else 0
          end,
          coalesce(question.importance_conceptual, question.routing_score, 0) desc,
          question.generated_question_id
      ))::bigint as candidate_rank,
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      event.event_title,
      question.book_code,
      case metadata.section_key
        when 'TORAH' then 'Torah'
        when 'FORMER' then 'Former Prophets'
        when 'LATTER' then 'Latter Prophets'
        when 'WRITINGS' then 'Writings'
        else 'Old Testament'
      end as section,
      case
        when coalesce(question.importance_conceptual, question.routing_score, 0) >= 80 then 1
        when coalesce(question.importance_conceptual, question.routing_score, 0) >= 60 then 2
        else 3
      end as importance_tier,
      question.dimension_key,
      question.payload->>'question_family' as question_family,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
      ) as candidate_stage,
      least(3, metadata.depth_stage)::integer as target_stage,
      coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0)
        as target_theta,
      coalesce(ability.theta_se, 1.0) as theta_se,
      'V7_LOW_EVIDENCE_SUPPLEMENTAL'::text as theta_source,
      0 as route_priority,
      'V7_LOW_EVIDENCE_SUPPLEMENTAL'::text as selection_lane,
      public.obs_item_information(
        coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0),
        public.obs_effective_item_irt_a(question.payload, event.irt_a::double precision),
        public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
      ) as information_score,
      0.45::double precision as information_reliability,
      0 as calibration_responses,
      0.0::double precision as adaptive_score,
      coalesce(history_count.times_answered, 0) as times_answered,
      'v7_supplemental'::text as routing_mode,
      null::text as campaign_phase,
      null::text as campaign_match
    from public.obs_question_bank_with_dimensions question
    join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = question.generated_question_id
    cross join attempt_scope attempt
    left join public.bible_events event
      on event.id = question.event_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = public.canonical_assessment_scope(question.book_code)
    left join long_run_section_stats
      on long_run_section_stats.section_key = metadata.section_key
    left join long_run_dimension_stats
      on long_run_dimension_stats.dimension_key = question.dimension_key
    left join section_targets
      on section_targets.section_key = metadata.section_key
    left join dimension_targets
      on dimension_targets.dimension_key = question.dimension_key
    left join lateral (
      select count(*)::integer as times_answered
      from public.assessment_answers previous
      where previous.user_id = p_user_id
        and previous.generated_question_id = question.generated_question_id
    ) history_count on true
    where (select scoring_answered from long_run_totals) >= 80
      and question.generated_question_id is not null
      and question.book_code is not null
      and question.dimension_key is not null
      and coalesce(question.payload->>'prompt', question.prompt) is not null
      and question.payload ? 'choices'
      and question.payload ? 'correct_choice_id'
      and public.question_matches_assessment_scope(
        question.book_code,
        attempt.testament,
        attempt.scope_key
      )
      and metadata.depth_stage <= 3
      and coalesce(metadata.review_status, '') not in ('needs_review', 'flagged')
      and not coalesce(metadata.chapter_addressed_prompt, false)
      and not coalesce(metadata.exact_chapter_recall_required, false)
      and (
        coalesce(long_run_dimension_stats.answered, 0) <
          case when (select scoring_answered from long_run_totals) >= 200 then 50 else 20 end
        or coalesce(long_run_section_stats.answered, 0) <
          case when (select scoring_answered from long_run_totals) >= 200 then 80 else 40 end
      )
      and not exists (
        select 1
        from base_v6_pool existing
        where existing.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from history prior
        where prior.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from history prior
        where prior.similarity_key =
          public.obs_assessment_question_similarity_key(
            question.payload,
            question.book_code,
            question.dimension_key,
            question.question_type,
            coalesce(question.payload->>'prompt', question.prompt)
          )
      )
    limit 80
  ),
  v6_pool as (
    select * from base_v6_pool
    union all
    select * from v7_low_evidence_supplemental_candidates
  ),
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
        case
          when (select scoring_answered from answer_totals) between 8 and 29
            and enriched.v7_attempt_section_share > greatest(0.40, enriched.v7_section_target_share + 0.10)
            then 'early attempt section brake'
        end,
$needle$,
$replacement$
        case
          when enriched.selection_lane = 'V7_LOW_EVIDENCE_SUPPLEMENTAL'
            then 'supplemental low-evidence candidate source'
        end,
        case
          when (select scoring_answered from answer_totals) between 8 and 29
            and enriched.v7_attempt_section_share > greatest(0.40, enriched.v7_section_target_share + 0.10)
            then 'early attempt section brake'
        end,
        case
          when (select scoring_answered from long_run_totals) >= 200
            and enriched.v7_section_answered >= 80
            and enriched.v7_attempt_section_share > greatest(0.32, enriched.v7_section_target_share + 0.06)
            then 'post-200 attempt section cap'
        end,
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
          case
            when (select scoring_answered from long_run_totals) >= 200
              and reasoned.v7_lane <> 'LOW_EVIDENCE_FLOOR'
              and reasoned.v7_long_run_section_share
                > greatest(reasoned.v7_section_target_share + 0.05, reasoned.v7_section_target_share * 1.18)
              then 3
            else 0
          end,
$needle$,
$replacement$
          case
            when (select scoring_answered from long_run_totals) >= 200
              and reasoned.v7_lane <> 'LOW_EVIDENCE_FLOOR'
              and reasoned.v7_long_run_section_share
                > greatest(reasoned.v7_section_target_share + 0.05, reasoned.v7_section_target_share * 1.18)
              then 5
            else 0
          end,
          case
            when (select scoring_answered from long_run_totals) >= 200
              and reasoned.v7_lane <> 'LOW_EVIDENCE_FLOOR'
              and reasoned.v7_section_answered >= 80
              and reasoned.v7_attempt_section_share > greatest(0.32, reasoned.v7_section_target_share + 0.06)
              then 8
            else 0
          end,
$replacement$
  );

  if v_sql = v_original then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 supplemental floor patch did not match the expected function body.';
  end if;

  if v_sql not like '%V7_LOW_EVIDENCE_SUPPLEMENTAL%'
     or v_sql not like '%supplemental low-evidence candidate source%'
     or v_sql not like '%post-200 attempt section cap%'
     or v_sql not like '%base_v6_pool%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 supplemental floor markers missing after patch.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shadow-only V7 OT candidate ranker. Adds supplemental clean broad/mid low-evidence candidates and a stronger post-200 attempt-section cap. STABLE: writes nothing.';

commit;
