begin;

do $$
declare
  v_failures jsonb;
begin
  with checks(name, ok) as (
    values
      (
        'exactly 33 law rows carry the V7 law coverage review marker',
        (
          select count(*) = 33
          from public.obs_question_ladder_metadata metadata
          join public.obs_question_bank_with_dimensions question
            on question.generated_question_id = metadata.generated_question_id
          where question.dimension_key = 'law_commands'
            and metadata.depth_stage <= 3
            and metadata.review_status = 'reviewed'
            and metadata.metadata_source = 'manual'
            and metadata.review_notes like 'Manual V7 law coverage review:%'
        )
      ),
      (
        'all broad/mid law rows are out of needs_review after the focused pass',
        not exists (
          select 1
          from public.obs_question_ladder_metadata metadata
          join public.obs_question_bank_with_dimensions question
            on question.generated_question_id = metadata.generated_question_id
          where question.dimension_key = 'law_commands'
            and metadata.depth_stage <= 3
            and metadata.chapter_addressed_prompt is false
            and metadata.review_status = 'needs_review'
        )
      ),
      (
        'chapter-addressed law detail rows remain demoted',
        exists (
          select 1
          from public.obs_question_ladder_metadata metadata
          join public.obs_question_bank_with_dimensions question
            on question.generated_question_id = metadata.generated_question_id
          where question.dimension_key = 'law_commands'
            and metadata.depth_stage >= 4
            and metadata.chapter_addressed_prompt is true
            and metadata.review_status in ('needs_review', 'flagged')
        )
      ),
      (
        'live next-question RPC still does not call V7',
        coalesce(pg_get_functiondef('public.obs_get_next_ot_assessment_question(uuid)'::regprocedure), '')
          not like '%obs_rank_ot_assessment_candidates_v7%'
      ),
      (
        'displayed BLI still does not use V7 ladder metadata',
        coalesce(pg_get_functiondef('public.obs_get_bli_scores_v2(uuid)'::regprocedure), '')
          not like '%obs_question_ladder_metadata%'
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_failures
  from checks;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'FAIL: V7 law metadata review verification failed: %', v_failures;
  end if;
end;
$$;

rollback;
