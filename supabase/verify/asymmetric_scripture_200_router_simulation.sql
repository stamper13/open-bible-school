-- Synthetic OT long-run router simulation for ASYMMETRIC_SCRIPTURE_200.
--
-- This creates a short-lived helper function, runs 4 forced 50-question OT
-- attempts through the app-facing RPC chain, returns compact metrics, then
-- drops the helper. The helper deletes all synthetic rows for its auth user on
-- success; on error, the failing statement rolls back its writes.

create or replace function public.obs_tmp_asymmetric_scripture_200_router_simulation()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_start jsonb;
  v_question jsonb;
  v_submit jsonb;
  v_score jsonb;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_item_number integer;
  v_question_row record;
  v_scope text;
  v_band text;
  v_correct_pct integer;
  v_idk_pct integer;
  v_roll integer;
  v_idk_roll integer;
  v_should_correct boolean;
  v_should_idk boolean;
  v_response text;
  v_displayed_choice_text text;
  v_wrong_choice_id text;
  v_reverse_order jsonb;
  v_section_sort_assignments jsonb;
  v_result jsonb;
begin
  create temporary table if not exists obs_tmp_asym_items (
    attempt_number integer not null,
    item_number integer not null,
    attempt_id uuid not null,
    generated_question_id uuid not null,
    book_code text,
    scope_key text,
    dimension_key text,
    question_type text,
    similarity_key text,
    prompt text,
    skill_band text,
    is_correct boolean not null,
    is_idk boolean not null,
    primary key (attempt_number, item_number)
  ) on commit drop;

  truncate table obs_tmp_asym_items;

  insert into auth.users (
    id,
    aud,
    role,
    is_anonymous,
    created_at,
    updated_at
  ) values (
    v_user_id,
    'authenticated',
    'authenticated',
    true,
    now(),
    now()
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  for v_attempt_number in 1..4 loop
    select to_jsonb(start_row)
    into v_start
    from public.obs_start_or_resume_ot_assessment_v2(
      null,
      null,
      null,
      null,
      50,
      true,
      null
    ) start_row;

    v_attempt_id := (v_start->>'attempt_id')::uuid;

    for v_item_number in 1..50 loop
      select to_jsonb(question_row)
      into v_question
      from public.obs_get_next_ot_assessment_question(v_attempt_id) question_row;

      exit when v_question is null
        or not (v_question ? 'out_generated_question_id');

      select
        question.generated_question_id,
        question.question_type,
        question.book_code,
        question.dimension_key,
        question.payload,
        coalesce(question.payload->>'prompt', question.prompt) as prompt,
        public.canonical_assessment_scope(question.book_code) as scope_key,
        public.obs_assessment_question_similarity_key(
          question.payload,
          question.book_code,
          question.dimension_key,
          question.question_type,
          coalesce(question.payload->>'prompt', question.prompt)
        ) as similarity_key,
        coalesce(
          question.payload->>'correct_choice_id',
          question.payload->>'answer_id',
          question.payload->>'correctAnswerId'
        ) as correct_choice_id
      into strict v_question_row
      from public.obs_question_bank_with_dimensions question
      where question.generated_question_id =
        (v_question->>'out_generated_question_id')::uuid;

      v_scope := v_question_row.scope_key;
      v_band := case
        when v_scope in ('FORMER', 'WRITINGS')
          then 'weak_scope_' || lower(v_scope)
        when v_question_row.dimension_key in (
          'geography_nations',
          'characters_lineage',
          'law_commands'
        )
          then 'weak_dimension_' || v_question_row.dimension_key
        when v_scope = 'LATTER'
          and v_question_row.dimension_key in (
            'promise_prophecy',
            'theological_reasoning'
          )
          then 'strong_latter_prophecy_theology'
        when v_scope = 'TORAH'
          then 'strong_scope_torah'
        when v_scope = 'LATTER'
          then 'medium_scope_latter'
        else 'base'
      end;

      v_correct_pct := case
        when v_band like 'strong_%' then 90
        when v_band like 'medium_%' then 72
        when v_band like 'weak_%' then 28
        else 60
      end;

      v_idk_pct := case
        when v_band like 'weak_%' then 34
        else 8
      end;

      v_roll := mod(abs(hashtext(
        'ASYMMETRIC_SCRIPTURE_200:' ||
        v_attempt_number::text || ':' ||
        v_question_row.generated_question_id::text
      )), 100);
      v_idk_roll := mod(abs(hashtext(
        'IDK:ASYMMETRIC_SCRIPTURE_200:' ||
        v_attempt_number::text || ':' ||
        v_question_row.generated_question_id::text
      )), 100);

      v_should_correct := v_roll < v_correct_pct;
      v_should_idk := not v_should_correct and v_idk_roll < v_idk_pct;

      if v_question_row.question_type = 'ot_book_section_sort_v1' then
        select jsonb_agg(
          jsonb_build_object(
            'text',
            coalesce(choice->>'text', choice->>'label', choice->>'id'),
            'section_key',
            '__IDK__'
          )
          order by choice_ordinality
        )
        into v_section_sort_assignments
        from jsonb_array_elements(v_question->'choices')
          with ordinality as choice(choice, choice_ordinality);

        v_response := '__SECTION_SORT__';
        v_should_correct := false;
        v_should_idk := true;
      elsif v_should_idk then
        v_response := '__IDK__';
      elsif public.obs_is_order_response_question(
        v_question_row.question_type,
        v_question_row.payload
      ) then
        if v_should_correct then
          v_response := '__ORDER__:' ||
            coalesce(v_question_row.payload->'correct_order', '[]'::jsonb)::text;
        else
          select jsonb_agg(item.value order by item.ordinality desc)
          into v_reverse_order
          from jsonb_array_elements_text(
            coalesce(v_question_row.payload->'correct_order', '[]'::jsonb)
          ) with ordinality item(value, ordinality);
          v_response := '__ORDER__:' || coalesce(v_reverse_order, '[]'::jsonb)::text;
        end if;
      elsif v_should_correct then
        v_response := coalesce(v_question_row.correct_choice_id, '__IDK__');
      else
        select choice->>'id'
        into v_wrong_choice_id
        from jsonb_array_elements(v_question->'choices') choice
        where choice->>'id' <> v_question_row.correct_choice_id
        order by choice->>'id'
        limit 1;

        v_response := coalesce(v_wrong_choice_id, '__IDK__');
      end if;

      if v_question_row.question_type = 'ot_book_section_sort_v1' then
        select to_jsonb(submit_row)
        into v_submit
        from public.obs_submit_section_sort_answers(
          v_attempt_id,
          v_question_row.generated_question_id,
          coalesce(v_section_sort_assignments, '[]'::jsonb)
        ) submit_row;
      else
        if public.obs_is_order_response_question(
          v_question_row.question_type,
          v_question_row.payload
        ) then
          v_displayed_choice_text := public.obs_sequence_choice_text(
            v_question->'choices',
            public.obs_parse_sequence_order(v_response)
          );
        else
          select choice->>'text'
          into v_displayed_choice_text
          from jsonb_array_elements(v_question->'choices') choice
          where choice->>'id' = v_response
          limit 1;
        end if;

        select to_jsonb(submit_row)
        into v_submit
        from public.obs_submit_ot_assessment_response_v2(
          v_attempt_id,
          v_question_row.generated_question_id,
          v_response,
          case when v_response = '__IDK__' then null else v_displayed_choice_text end,
          v_question->'choices'
        ) submit_row;
      end if;

      insert into obs_tmp_asym_items (
        attempt_number,
        item_number,
        attempt_id,
        generated_question_id,
        book_code,
        scope_key,
        dimension_key,
        question_type,
        similarity_key,
        prompt,
        skill_band,
        is_correct,
        is_idk
      ) values (
        v_attempt_number,
        v_item_number,
        v_attempt_id,
        v_question_row.generated_question_id,
        v_question_row.book_code,
        v_scope,
        v_question_row.dimension_key,
        v_question_row.question_type,
        v_question_row.similarity_key,
        v_question_row.prompt,
        v_band,
        coalesce((v_submit->>'is_correct')::boolean, false),
        coalesce((v_submit->>'is_idk')::boolean, false)
      );

      exit when coalesce((v_submit->>'target_reached')::boolean, false);
    end loop;
  end loop;

  -- The v2 scoring-evidence trigger is deferred. Force it to capture while the
  -- synthetic answer rows still exist, so scoring reads the same evidence a
  -- committed learner answer would have and cleanup can remove the synthetic
  -- private evidence before deleting answers.
  set constraints assessment_answers_capture_scoring_evidence_v2 immediate;

  select to_jsonb(score_row)
  into v_score
  from public.obs_get_bli_scores_v2(v_user_id) score_row;

  with item_rows as (
    select *
    from obs_tmp_asym_items
  ),
  exact_groups as (
    select generated_question_id, count(*) as n, count(distinct attempt_id) as attempts
    from item_rows
    group by generated_question_id
  ),
  similarity_groups as (
    select similarity_key, count(*) as n, count(distinct attempt_id) as attempts
    from item_rows
    where similarity_key is not null
    group by similarity_key
  ),
  exact_repeat_details as (
    select
      item.generated_question_id,
      count(*)::integer as appearances,
      count(distinct item.attempt_id)::integer as attempts,
      jsonb_agg(
        jsonb_build_object(
          'attempt_number', item.attempt_number,
          'item_number', item.item_number,
          'scope_key', item.scope_key,
          'book_code', item.book_code,
          'dimension_key', item.dimension_key,
          'question_type', item.question_type,
          'prompt', item.prompt
        )
        order by item.attempt_number, item.item_number
      ) as appearances_detail
    from item_rows item
    group by item.generated_question_id
    having count(distinct item.attempt_id) > 1
  ),
  similarity_repeat_details as (
    select
      item.similarity_key,
      count(*)::integer as appearances,
      count(distinct item.attempt_id)::integer as attempts,
      count(distinct item.generated_question_id)::integer as distinct_questions,
      jsonb_agg(
        jsonb_build_object(
          'attempt_number', item.attempt_number,
          'item_number', item.item_number,
          'generated_question_id', item.generated_question_id,
          'scope_key', item.scope_key,
          'book_code', item.book_code,
          'dimension_key', item.dimension_key,
          'question_type', item.question_type,
          'prompt', item.prompt
        )
        order by item.attempt_number, item.item_number
      ) as appearances_detail
    from item_rows item
    where item.similarity_key is not null
    group by item.similarity_key
    having count(distinct item.attempt_id) > 1
  ),
  section_rows as (
    select
      scope_key,
      count(*)::integer as served,
      count(distinct book_code)::integer as books,
      round(avg(case when is_correct then 1 else 0 end) * 100, 1) as accuracy_pct
    from item_rows
    group by scope_key
  ),
  dimension_rows as (
    select
      dimension_key,
      count(*)::integer as served,
      round(avg(case when is_correct then 1 else 0 end) * 100, 1) as accuracy_pct
    from item_rows
    group by dimension_key
  ),
  skill_rows as (
    select
      skill_band,
      count(*)::integer as served,
      round(avg(case when is_correct then 1 else 0 end) * 100, 1) as accuracy_pct
    from item_rows
    group by skill_band
  )
  select jsonb_build_object(
    'profile_key', 'ASYMMETRIC_SCRIPTURE_200',
    'total_rows', (select count(*) from item_rows),
    'scored_rows', (
      select count(*)
      from public.assessment_answers answer
      where answer.user_id = v_user_id
        and answer.scoring_eligible
    ),
    'distinct_questions', (select count(distinct generated_question_id) from item_rows),
    'within_attempt_exact_repeat_rows', coalesce((
      select sum(n - 1)::integer
      from (
        select attempt_id, generated_question_id, count(*) as n
        from item_rows
        group by attempt_id, generated_question_id
        having count(*) > 1
      ) repeated
    ), 0),
    'cross_attempt_exact_repeat_rows', coalesce((
      select sum(n - 1)::integer
      from exact_groups
      where attempts > 1
    ), 0),
    'similarity_cluster_repeat_rows', coalesce((
      select sum(n - 1)::integer
      from similarity_groups
      where attempts > 1
    ), 0),
    'exact_repeat_details', coalesce((
      select jsonb_agg(to_jsonb(exact_repeat_details) order by appearances desc)
      from exact_repeat_details
    ), '[]'::jsonb),
    'similarity_repeat_details', coalesce((
      select jsonb_agg(
        to_jsonb(similarity_repeat_details)
        order by appearances desc, distinct_questions desc
      )
      from similarity_repeat_details
    ), '[]'::jsonb),
    'unsupported_order_drag_rows', (
      select count(*)::integer
      from item_rows item
      where item.question_type = 'ot_book_section_sort_v1'
        or item.question_type like '%order%'
    ),
    'high_specificity_rows', (
      select count(*)::integer
      from item_rows item
      where public.obs_is_high_specificity_assessment_question(
        item.prompt,
        item.question_type,
        '{}'::jsonb
      )
    ),
    'chapter_addressed_rows', (
      select count(*)::integer
      from item_rows item
      where item.prompt ~* E'\\m(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1[[:space:]]+Samuel|2[[:space:]]+Samuel|1[[:space:]]+Kings|2[[:space:]]+Kings|1[[:space:]]+Chronicles|2[[:space:]]+Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song[[:space:]]+of[[:space:]]+Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi)[[:space:]]+[0-9]{1,3}\\M'
    ),
    'overall_accuracy_pct', (
      select round(avg(case when is_correct then 1 else 0 end) * 100, 1)
      from item_rows
    ),
    'idk_pct', (
      select round(avg(case when is_idk then 1 else 0 end) * 100, 1)
      from item_rows
    ),
    'by_section', (
      select jsonb_agg(to_jsonb(section_rows) order by served desc, scope_key)
      from section_rows
    ),
    'by_dimension', (
      select jsonb_agg(to_jsonb(dimension_rows) order by served desc, dimension_key)
      from dimension_rows
    ),
    'by_skill_band', (
      select jsonb_agg(to_jsonb(skill_rows) order by served desc, skill_band)
      from skill_rows
    ),
    'score', v_score
  )
  into v_result;

  delete from private.bli_answer_scoring_evidence where user_id = v_user_id;
  delete from public.obs_router_shadow_log where user_id = v_user_id;
  delete from public.obs_router_campaign where user_id = v_user_id;
  delete from public.obs_assessment_snapshots where user_id = v_user_id;
  delete from public.obs_ot_attempt_context where user_id = v_user_id;
  delete from public.user_abilities where user_id = v_user_id;
  delete from public.assessment_answers where user_id = v_user_id;
  delete from public.assessment_attempts where user_id = v_user_id;
  delete from public.users where id = v_user_id;
  delete from auth.users where id = v_user_id;

  return v_result;
end;
$$;

select public.obs_tmp_asymmetric_scripture_200_router_simulation() as result;

drop function if exists public.obs_tmp_asymmetric_scripture_200_router_simulation();
