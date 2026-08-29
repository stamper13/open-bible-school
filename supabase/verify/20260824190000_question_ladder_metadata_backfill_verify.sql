do $$
declare
  v_failures jsonb;
begin
  with live_ot_questions as (
    select q.generated_question_id
    from public.obs_question_bank_with_dimensions q
    join public.obs_biblical_books book
      on book.book_code = q.book_code
     and book.testament = 'OT'
  ),
  checks(name, ok) as (
    values
      (
        'every live OT generated question has ladder metadata',
        not exists (
          select 1
          from live_ot_questions q
          left join public.obs_question_ladder_metadata metadata
            on metadata.generated_question_id = q.generated_question_id
          where metadata.generated_question_id is null
        )
      ),
      (
        'every ladder metadata row references an existing generated question',
        not exists (
          select 1
          from public.obs_question_ladder_metadata metadata
          left join public.ot_generated_questions question
            on question.id = metadata.generated_question_id
          where question.id is null
        )
      ),
      (
        'no invalid routing granularity values exist',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where routing_granularity not in (
            'unknown',
            'ot_overview',
            'section_overview',
            'book_overview',
            'book_intersection',
            'unit_overview',
            'chapter_range',
            'chapter_detail',
            'verse_detail'
          )
        )
      ),
      (
        'no invalid scoring scope values exist',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where scoring_scope_level not in (
            'unknown',
            'ot',
            'section',
            'book',
            'unit',
            'chapter',
            'passage'
          )
        )
      ),
      (
        'no invalid depth stages exist',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where depth_stage not between 1 and 5
        )
      ),
      (
        'no invalid review statuses exist',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where review_status not in ('needs_review', 'auto_accepted', 'reviewed', 'flagged')
        )
      ),
      (
        'no invalid metadata sources exist',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where metadata_source not in ('payload', 'rule_inferred', 'llm_assisted', 'manual', 'hybrid')
        )
      ),
      (
        'required weights status and confidence fields are non-null',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where foundationality_weight is null
             or global_signal_weight is null
             or local_signal_weight is null
             or metadata_confidence is null
             or review_status is null
             or metadata_source is null
        )
      ),
      (
        'weight and confidence values remain in range',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where foundationality_weight not between 0 and 1
             or global_signal_weight not between 0 and 1
             or local_signal_weight not between 0 and 1
             or metadata_confidence not between 0 and 1
        )
      ),
      (
        'narrow rows do not carry high global signal',
        not exists (
          select 1
          from public.obs_question_ladder_metadata
          where routing_granularity in ('chapter_detail', 'verse_detail')
            and global_signal_weight > 0.3500
        )
      ),
      (
        'anon direct table access remains absent',
        not has_table_privilege('anon', 'public.obs_question_ladder_metadata', 'select')
      ),
      (
        'authenticated direct table access remains absent',
        not has_table_privilege('authenticated', 'public.obs_question_ladder_metadata', 'select')
      ),
      (
        'low-confidence rows are queryable for audit by service role',
        has_table_privilege('service_role', 'public.obs_question_ladder_metadata', 'select')
        and exists (
          select 1
          from public.obs_question_ladder_metadata
          where metadata_confidence < 0.7500
        )
      ),
      (
        'needs-review rows are queryable for audit by service role',
        has_table_privilege('service_role', 'public.obs_question_ladder_metadata', 'select')
        and exists (
          select 1
          from public.obs_question_ladder_metadata
          where review_status = 'needs_review'
        )
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_failures
  from checks;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'FAIL: question ladder metadata backfill verification failed: %', v_failures;
  end if;
end;
$$;
