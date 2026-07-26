-- Add exact-order sequence questions to persistent Old Testament assessments.
--
-- Sequence responses are stored in assessment_answers.selected_choice_id as:
--   __ORDER__:["event-id-1","event-id-2",...]
-- This preserves the existing answer table and binary IRT contract while making
-- the complete submitted order available for session review and future analysis.

begin;

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.assessment_attempts') is null
     or to_regclass('public.obs_admin_question_bank_audit') is null
     or not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.assessment_answers'::regclass
         and conname = 'assessment_answers_selected_choice_id_check'
     )
     or to_regprocedure(
       'public.get_next_scoped_assessment_question(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_get_attempt_review(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_submit_ot_assessment_answer(uuid,uuid,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Required assessment, review, audit, or backup objects are missing.';
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
  '20260726_sequence_order_questions',
  'public',
  source.object_name,
  source.object_type,
  source.definition
from (
  values
    (
      'get_next_scoped_assessment_question',
      'function',
      pg_get_functiondef(
        'public.get_next_scoped_assessment_question(uuid,uuid)'::regprocedure
      )
    ),
    (
      'obs_get_attempt_review',
      'function',
      pg_get_functiondef(
        'public.obs_get_attempt_review(uuid,uuid)'::regprocedure
      )
    ),
    (
      'obs_admin_question_bank_audit',
      'view',
      pg_get_viewdef('public.obs_admin_question_bank_audit'::regclass, true)
    ),
    (
      'assessment_answers_selected_choice_id_check',
      'constraint',
      (
        select pg_get_constraintdef(constraint_row.oid)
        from pg_constraint constraint_row
        where constraint_row.conrelid = 'public.assessment_answers'::regclass
          and constraint_row.conname =
            'assessment_answers_selected_choice_id_check'
      )
    )
) source(object_name, object_type, definition)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_sequence_order_questions'
    and backup.object_schema = 'public'
    and backup.object_name = source.object_name
    and backup.object_type = source.object_type
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_sequence_order_questions'
    and object_schema = 'public'
    and (
      (object_name = 'get_next_scoped_assessment_question' and object_type = 'function')
      or (object_name = 'obs_get_attempt_review' and object_type = 'function')
      or (object_name = 'obs_admin_question_bank_audit' and object_type = 'view')
      or (
        object_name = 'assessment_answers_selected_choice_id_check'
        and object_type = 'constraint'
      )
    );

  if backup_count <> 4 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected four sequence-question backups, found %s.', backup_count);
  end if;
end
$$;

create or replace function public.obs_parse_sequence_order(
  p_response text
)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  parsed jsonb;
begin
  if p_response is null
     or left(p_response, length('__ORDER__:')) <> '__ORDER__:'
  then
    return null;
  end if;

  begin
    parsed := substr(p_response, length('__ORDER__:') + 1)::jsonb;
  exception when others then
    return null;
  end;

  if jsonb_typeof(parsed) <> 'array' then
    return null;
  end if;

  return parsed;
end
$$;

alter table public.assessment_answers
  drop constraint assessment_answers_selected_choice_id_check;

alter table public.assessment_answers
  add constraint assessment_answers_selected_choice_id_check
  check (
    selected_choice_id is null
    or selected_choice_id in ('A', 'B', 'C', 'D', '__IDK__')
    or (
      left(
        selected_choice_id,
        length('__ORDER__:')
      ) = '__ORDER__:'
      and public.obs_parse_sequence_order(selected_choice_id) is not null
    )
  );

create or replace function public.get_next_scoped_assessment_question(
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
  testament text,
  scope_key text,
  assessment_mode text,
  scoring_version integer
)
language sql
security definer
set search_path = public
as $$
  with attempt as (
    select assessment.*
    from public.assessment_attempts assessment
    where assessment.id = p_attempt_id
      and assessment.user_id = p_user_id
      and (select auth.uid()) = p_user_id
      and not assessment.is_complete
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    where answer.user_id = p_user_id
      and answer.generated_question_id is not null
    group by answer.generated_question_id
  ),
  candidates as (
    select
      question.*,
      attempt.testament as attempt_testament,
      attempt.scope_key as attempt_scope,
      attempt.assessment_mode,
      attempt.scoring_version,
      coalesce(
        event.event_title,
        question.book_code || ' question'
      ) as resolved_event_title,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      coalesce(
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        0.0
      ) as theta_lcb
    from attempt
    join public.v_question_bank question
      on public.question_matches_assessment_scope(
        question.book_code,
        attempt.testament,
        attempt.scope_key
      )
    left join public.bible_events event
      on event.id = question.event_id
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = case
       when attempt.scope_key in ('OT', 'NT')
         then public.canonical_assessment_scope(question.book_code)
       else attempt.scope_key
     end
    where question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        (
          question.question_type = 'sequence_order_v1'
          and jsonb_array_length(question.payload->'choices') between 3 and 5
          and jsonb_typeof(question.payload->'correct_order') = 'array'
          and jsonb_array_length(question.payload->'correct_order')
            = jsonb_array_length(question.payload->'choices')
        )
        or (
          question.question_type <> 'sequence_order_v1'
          and jsonb_array_length(question.payload->'choices') = 4
        )
      )
      and not exists (
        select 1
        from public.assessment_answers existing
        where existing.attempt_id = p_attempt_id
          and existing.generated_question_id = question.generated_question_id
      )
  ),
  gated as (
    select
      candidate.*,
      case
        when assessment_mode = 'pilot' then 0
        when theta_lcb >= 1.5 then 0
        when theta_lcb >= 1.0 then 25
        when theta_lcb >= 0.5 then 40
        else 55
      end as floor_value
    from candidates candidate
  ),
  chosen as (
    select *
    from gated
    where coalesce(importance_conceptual, 0) >= floor_value
    order by
      times_answered,
      last_answered_at nulls first,
      (
        coalesce(
          routing_score,
          importance_conceptual,
          importance_context,
          50
        ) / 100.0
        + random() * 0.45
      ) desc,
      created_at desc
    limit 1
  )
  select
    generated_question_id,
    coalesce(payload->>'prompt', prompt),
    question_type,
    case
      when question_type = 'sequence_order_v1' then payload->'choices'
      else public.assessment_scramble_mcq(
        payload,
        p_attempt_id::text || ':' || generated_question_id::text
      )->'choices'
    end,
    resolved_event_title,
    book_code,
    case
      when coalesce(routing_score, 0) >= 80 then 1
      when coalesce(routing_score, 0) >= 60 then 2
      else 3
    end,
    case public.canonical_assessment_scope(book_code)
      when 'TORAH' then 'Torah'
      when 'FORMER' then 'Former Prophets'
      when 'LATTER' then 'Latter Prophets'
      when 'WRITINGS' then 'Writings'
      when 'GOSPELS_ACTS' then 'Gospels and Acts'
      when 'PAULINE' then 'Pauline Epistles'
      when 'GENERAL' then 'General Epistles'
      when 'APOCALYPSE' then 'Revelation'
    end,
    attempt_testament,
    attempt_scope,
    assessment_mode,
    scoring_version
  from chosen;
$$;

create or replace function public.obs_submit_ot_assessment_response(
  p_attempt_id uuid,
  p_generated_question_id uuid,
  p_response text
)
returns table (
  is_correct boolean,
  is_idk boolean,
  correct_choice_id text,
  answered_count integer,
  correct_count integer,
  target_question_count integer,
  target_reached boolean,
  remaining_count integer,
  assessment_kind text,
  unit_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_question public.v_question_bank%rowtype;
  v_delegate record;
  v_response_order jsonb;
  v_correct_order jsonb;
  v_choices jsonb;
  v_is_correct boolean;
  v_is_idk boolean;
  v_answered integer;
  v_correct integer;
  v_target integer;
  v_reached boolean;
  v_answer_id uuid;
  v_item_count integer;
  v_response_count integer;
  v_response_distinct integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select
    attempt.id,
    attempt.assessment_kind,
    attempt.testament,
    attempt.scope_key,
    context.unit_key,
    greatest(
      1,
      coalesce(
        attempt.target_question_count,
        attempt.question_target,
        20
      )
    ) as target_count
  into v_attempt
  from public.assessment_attempts attempt
  left join public.obs_ot_attempt_context context
    on context.attempt_id = attempt.id
   and context.user_id = attempt.user_id
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
  for update of attempt;

  if v_attempt.id is null then
    raise exception using
      errcode = '42501',
      message = 'Attempt not found or not authorized';
  end if;

  select question.*
  into v_question
  from public.v_question_bank question
  where question.generated_question_id = p_generated_question_id;

  if v_question.generated_question_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Question not found or inactive';
  end if;

  if v_question.question_type <> 'sequence_order_v1' then
    return query
    select *
    from public.obs_submit_ot_assessment_answer(
      p_attempt_id,
      p_generated_question_id,
      p_response
    );
    return;
  end if;

  if not public.question_matches_assessment_scope(
    v_question.book_code,
    v_attempt.testament,
    v_attempt.scope_key
  ) then
    raise exception using
      errcode = '22023',
      message = 'Question does not belong to attempt scope';
  end if;

  v_choices := v_question.payload->'choices';
  v_correct_order := v_question.payload->'correct_order';
  v_is_idk := upper(coalesce(p_response, '')) = '__IDK__';

  if jsonb_typeof(v_choices) <> 'array'
     or jsonb_typeof(v_correct_order) <> 'array'
     or jsonb_array_length(v_choices) not between 3 and 5
     or jsonb_array_length(v_correct_order) <> jsonb_array_length(v_choices)
  then
    raise exception using
      errcode = '22023',
      message = 'Sequence question payload is invalid';
  end if;

  if not v_is_idk then
    v_response_order := public.obs_parse_sequence_order(p_response);
    if v_response_order is null then
      raise exception using
        errcode = '22023',
        message = 'Sequence response is invalid';
    end if;

    v_item_count := jsonb_array_length(v_choices);
    select
      count(*)::integer,
      count(distinct response.item_id)::integer
    into v_response_count, v_response_distinct
    from jsonb_array_elements_text(v_response_order) response(item_id);

    if v_response_count <> v_item_count
       or v_response_distinct <> v_item_count
       or exists (
         select 1
         from jsonb_array_elements_text(v_response_order) response(item_id)
         where not exists (
           select 1
           from jsonb_array_elements(v_choices) choice
           where choice->>'id' = response.item_id
         )
       )
    then
      raise exception using
        errcode = '22023',
        message = 'Sequence response must contain every item exactly once';
    end if;
  end if;

  v_is_correct := not v_is_idk and v_response_order = v_correct_order;

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    question_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    answered_at
  ) values (
    p_attempt_id,
    v_user_id,
    p_generated_question_id,
    p_generated_question_id,
    p_response,
    v_is_correct,
    v_is_idk,
    now()
  )
  on conflict (attempt_id, question_id) do update set
    selected_choice_id = excluded.selected_choice_id,
    is_correct = excluded.is_correct,
    is_idk = excluded.is_idk,
    answered_at = excluded.answered_at,
    generated_question_id = excluded.generated_question_id,
    user_id = excluded.user_id
  returning id into v_answer_id;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id;

  v_target := v_attempt.target_count;
  v_reached := v_answered >= v_target;

  update public.assessment_attempts
  set
    answered_count = v_answered,
    correct_count = v_correct,
    is_complete = v_reached,
    completed_at = case
      when v_reached then coalesce(completed_at, now())
      else completed_at
    end
  where id = p_attempt_id;

  if v_question.event_id is not null and not v_is_idk then
    perform public.update_theta_internal(
      v_user_id,
      public.canonical_assessment_scope(v_question.book_code),
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      v_user_id,
      'OT',
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      v_user_id,
      'BIBLE',
      v_question.event_id,
      v_is_correct
    );
  end if;

  if v_reached
     and v_attempt.assessment_kind = 'ot_focused'
     and not exists (
       select 1
       from public.obs_study_plan_events event
       where event.user_id = v_user_id
         and event.attempt_id = p_attempt_id
         and event.event_type = 'retest_completed'
     )
  then
    insert into public.obs_study_plan_events (
      user_id,
      unit_key,
      event_type,
      attempt_id,
      metadata
    ) values (
      v_user_id,
      v_attempt.unit_key,
      'retest_completed',
      p_attempt_id,
      jsonb_build_object(
        'source',
        'focused_sequence_assessment_completion',
        'answered_count',
        v_answered,
        'correct_count',
        v_correct
      )
    );
  end if;

  return query
  select
    v_is_correct,
    v_is_idk,
    '__ORDER__:' || v_correct_order::text,
    v_answered,
    v_correct,
    v_target,
    v_reached,
    greatest(v_target - v_answered, 0),
    v_attempt.assessment_kind,
    v_attempt.unit_key;
end
$$;

create or replace function public.obs_get_attempt_review(
  p_user_id uuid,
  p_attempt_id uuid
)
returns table (
  answer_id uuid,
  answered_at timestamptz,
  generated_question_id uuid,
  prompt text,
  choices jsonb,
  selected_choice_id text,
  selected_choice_text text,
  correct_choice_id text,
  correct_choice_text text,
  is_correct boolean,
  is_idk boolean,
  book_code text,
  section text,
  dimension_key text,
  source_ref text,
  explanation text
)
language sql
stable
security definer
set search_path = public
as $$
  with review_rows as (
    select
      evidence.*,
      case
        when upper(coalesce(attempt.testament, 'OT')) = 'OT'
          and coalesce(attempt.assessment_kind, '') not in (
            'ot_adaptive',
            'ot_focused'
          )
          and evidence.question_type <> 'sequence_order_v1'
        then public.assessment_scramble_mcq(
          evidence.payload,
          evidence.attempt_id::text
            || ':'
            || evidence.generated_question_id::text
        )
        else evidence.payload
      end as display_payload
    from public.obs_answer_evidence evidence
    join public.assessment_attempts attempt
      on attempt.id = evidence.attempt_id
    where evidence.user_id = p_user_id
      and evidence.attempt_id = p_attempt_id
      and public.obs_is_authorized_user(p_user_id)
  )
  select
    review.answer_id,
    review.answered_at,
    review.generated_question_id,
    review.prompt,
    coalesce(review.display_payload->'choices', '[]'::jsonb),
    review.selected_choice_id,
    case
      when review.question_type = 'sequence_order_v1'
        and not review.is_idk
      then (
        select string_agg(
          coalesce(choice->>'text', submitted.item_id),
          ' -> '
          order by submitted.ordinality
        )
        from jsonb_array_elements_text(
          coalesce(
            public.obs_parse_sequence_order(review.selected_choice_id),
            '[]'::jsonb
          )
        ) with ordinality submitted(item_id, ordinality)
        left join lateral (
          select item
          from jsonb_array_elements(
            coalesce(review.display_payload->'choices', '[]'::jsonb)
          ) item
          where item->>'id' = submitted.item_id
          limit 1
        ) matched(choice) on true
      )
      else (
        select choice->>'text'
        from jsonb_array_elements(
          case
            when jsonb_typeof(review.display_payload->'choices') = 'array'
              then review.display_payload->'choices'
            else '[]'::jsonb
          end
        ) choice
        where choice->>'id' = review.selected_choice_id
        limit 1
      )
    end,
    case
      when review.question_type = 'sequence_order_v1'
        then '__ORDER__:' || (review.display_payload->'correct_order')::text
      else coalesce(
        review.display_payload->>'correct_choice_id',
        review.display_payload->>'answer_id',
        review.display_payload->>'correctAnswerId'
      )
    end,
    case
      when review.question_type = 'sequence_order_v1'
      then (
        select string_agg(
          coalesce(choice->>'text', correct.item_id),
          ' -> '
          order by correct.ordinality
        )
        from jsonb_array_elements_text(
          coalesce(review.display_payload->'correct_order', '[]'::jsonb)
        ) with ordinality correct(item_id, ordinality)
        left join lateral (
          select item
          from jsonb_array_elements(
            coalesce(review.display_payload->'choices', '[]'::jsonb)
          ) item
          where item->>'id' = correct.item_id
          limit 1
        ) matched(choice) on true
      )
      else (
        select choice->>'text'
        from jsonb_array_elements(
          case
            when jsonb_typeof(review.display_payload->'choices') = 'array'
              then review.display_payload->'choices'
            else '[]'::jsonb
          end
        ) choice
        where choice->>'id' = coalesce(
          review.display_payload->>'correct_choice_id',
          review.display_payload->>'answer_id',
          review.display_payload->>'correctAnswerId'
        )
        limit 1
      )
    end,
    review.is_correct,
    review.is_idk,
    review.book_code,
    review.section,
    review.dimension_key,
    coalesce(
      review.payload->>'source_ref',
      review.payload->>'reference'
    ),
    coalesce(
      review.payload->>'explanation',
      review.payload->>'rationale',
      review.payload->>'answer_explanation'
    )
  from review_rows review
  order by review.answered_at, review.answer_id;
$$;

-- Treat a sequence's first canonical item as its audit answer-key anchor. The
-- serving and grading functions still use the complete correct_order array.
create or replace view public.obs_admin_question_bank_audit as
with question_rows as (
  select
    question.generated_question_id,
    question.question_id,
    question.event_id,
    question.question_type,
    question.dedupe_key,
    question.created_at,
    question.payload,
    coalesce(
      nullif(question.payload->>'prompt', ''),
      nullif(question.prompt, '')
    ) as prompt,
    upper(coalesce(
      question.book_code,
      event.book_code,
      question.payload->>'book_code'
    )) as book_code,
    question.dimension_key,
    public.obs_infer_question_chapter(
      upper(coalesce(
        question.book_code,
        event.book_code,
        question.payload->>'book_code'
      )),
      coalesce(
        nullif(question.payload->>'prompt', ''),
        nullif(question.prompt, '')
      ),
      question.payload,
      question.dedupe_key
    ) as inferred_chapter,
    nullif(question.payload->>'stem_family', '') as stem_family,
    case
      when question.question_type = 'sequence_order_v1'
        and jsonb_typeof(question.payload->'correct_order') = 'array'
        then question.payload->'correct_order'->>0
      else coalesce(
        question.payload->>'correct_choice_id',
        question.payload->>'answer_id',
        question.payload->>'correctAnswerId'
      )
    end as correct_choice_id,
    case
      when jsonb_typeof(question.payload->'choices') = 'array'
        then jsonb_array_length(question.payload->'choices')
      else null
    end as choice_count,
    case
      when question.payload->>'question_layer' ~ '^[123]$'
        then (question.payload->>'question_layer')::integer
      else null
    end as question_layer,
    coalesce(
      significance.importance_tier,
      case
        when question.payload->>'importance_tier' ~ '^[123]$'
          then (question.payload->>'importance_tier')::integer
      end,
      case
        when coalesce(
          question.importance_conceptual,
          question.routing_score,
          0
        ) >= 80 then 1
        when coalesce(
          question.importance_conceptual,
          question.routing_score,
          0
        ) >= 60 then 2
        else 3
      end
    ) as importance_tier,
    public.obs_effective_item_irt_a(
      question.payload,
      event.irt_a::double precision
    ) as effective_irt_a,
    public.obs_effective_item_irt_b(
      question.payload,
      event.irt_b::double precision
    ) as effective_irt_b
  from public.obs_question_bank_with_dimensions question
  left join public.bible_events event
    on event.id = question.event_id
  left join public.event_significance significance
    on significance.event_id = question.event_id
),
validated as (
  select
    row.*,
    book.testament,
    book.section_key,
    book.section_name,
    (book.book_code is not null) as book_is_valid,
    (dimension.dimension_key is not null) as dimension_is_valid,
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(row.payload->'choices') = 'array'
            then row.payload->'choices'
          else '[]'::jsonb
        end
      ) choice
      where choice->>'id' = row.correct_choice_id
    ) as answer_key_matches_choice,
    coalesce(target.target_active_questions, 0) as target_active_questions,
    coalesce(target.minimum_active_questions, 0) as minimum_active_questions
  from question_rows row
  left join public.obs_biblical_books book
    on book.book_code = row.book_code
  left join public.obs_bli_dimensions dimension
    on dimension.dimension_key = row.dimension_key
  left join public.question_coverage_targets target
    on target.book_code = row.book_code
   and target.dimension_key = row.dimension_key
)
select
  validated.*,
  array_remove(array[
    case when prompt is null then 'missing_prompt' end,
    case when not book_is_valid then 'missing_or_invalid_book' end,
    case when not dimension_is_valid then 'missing_or_invalid_dimension' end,
    case when choice_count is null then 'choices_not_array' end,
    case when choice_count is distinct from 4 then 'choice_count_not_four' end,
    case when correct_choice_id is null then 'missing_answer_key' end,
    case
      when correct_choice_id is not null and not answer_key_matches_choice
        then 'answer_key_not_in_choices'
    end,
    case when target_active_questions <= 0
      then 'no_positive_coverage_target'
    end
  ]::text[], null) as blocker_reasons,
  array_remove(array[
    case when event_id is null then 'eventless_question' end,
    case when inferred_chapter is null then 'chapter_not_inferred' end,
    case when question_layer is null then 'missing_question_layer' end,
    case when importance_tier not between 1 and 3
      then 'invalid_importance_tier'
    end,
    case when dedupe_key is null or btrim(dedupe_key) = ''
      then 'missing_dedupe_key'
    end,
    case when stem_family is null then 'missing_stem_family' end
  ]::text[], null) as warning_reasons,
  (
    prompt is not null
    and book_is_valid
    and dimension_is_valid
    and choice_count = 4
    and correct_choice_id is not null
    and answer_key_matches_choice
    and target_active_questions > 0
  ) as router_eligible,
  md5(regexp_replace(
    lower(coalesce(prompt, '')),
    '\s+',
    ' ',
    'g'
  )) as prompt_fingerprint
from validated;

with seed (
  dedupe_key,
  book_code,
  chapter,
  prompt,
  reference,
  explanation,
  choices,
  correct_order,
  importance_conceptual,
  importance_context,
  irt_b
) as (
  values
    (
      'sequence|GEN|abraham_early_life',
      'GEN',
      12,
      'Place these events from Abraham''s life in chronological order.',
      'Genesis 12; 16-17; 21',
      'God called Abram before Ishmael was born. Abram was then renamed Abraham, and Isaac was born afterward.',
      '[{"id":"abraham_name","text":"God changes Abram''s name to Abraham"},{"id":"abram_call","text":"God calls Abram to leave his country"},{"id":"isaac_birth","text":"Isaac is born"},{"id":"ishmael_birth","text":"Ishmael is born"}]'::jsonb,
      '["abram_call","ishmael_birth","abraham_name","isaac_birth"]'::jsonb,
      92,
      90,
      1.0
    ),
    (
      'sequence|GEN|jacob_major_events',
      'GEN',
      25,
      'Place these events from Jacob''s life in chronological order.',
      'Genesis 25; 27-28; 32',
      'Esau sold his birthright before Jacob received Isaac''s blessing. Jacob then dreamed at Bethel and later wrestled before meeting Esau again.',
      '[{"id":"jacob_wrestles","text":"Jacob wrestles through the night and is named Israel"},{"id":"birthright_sold","text":"Esau sells his birthright to Jacob"},{"id":"bethel_dream","text":"Jacob dreams of a stairway at Bethel"},{"id":"isaac_blessing","text":"Jacob receives Isaac''s blessing"}]'::jsonb,
      '["birthright_sold","isaac_blessing","bethel_dream","jacob_wrestles"]'::jsonb,
      90,
      88,
      1.2
    ),
    (
      'sequence|EXO|exodus_to_sinai',
      'EXO',
      3,
      'Place these events from Exodus in chronological order.',
      'Exodus 3; 12; 14; 19-20',
      'Moses encountered God at the burning bush before the Passover, the crossing of the sea, and Israel''s arrival at Sinai.',
      '[{"id":"red_sea","text":"Israel crosses the sea on dry ground"},{"id":"burning_bush","text":"God calls Moses from the burning bush"},{"id":"sinai","text":"Israel receives the covenant commands at Sinai"},{"id":"passover","text":"Israel keeps the first Passover"}]'::jsonb,
      '["burning_bush","passover","red_sea","sinai"]'::jsonb,
      96,
      94,
      0.8
    ),
    (
      'sequence|JOS|entry_into_canaan',
      'JOS',
      2,
      'Place these events from Israel''s entry into Canaan in chronological order.',
      'Joshua 2-7',
      'The spies met Rahab before Israel crossed the Jordan. Jericho fell after the crossing, and Achan''s sin was exposed afterward.',
      '[{"id":"jericho_falls","text":"The walls of Jericho fall"},{"id":"achan_exposed","text":"Achan''s sin is exposed"},{"id":"rahab_spies","text":"Rahab hides the Israelite spies"},{"id":"jordan_crossing","text":"Israel crosses the Jordan"}]'::jsonb,
      '["rahab_spies","jordan_crossing","jericho_falls","achan_exposed"]'::jsonb,
      86,
      84,
      1.3
    ),
    (
      'sequence|1SA|saul_to_david',
      '1SA',
      8,
      'Place these events from the rise of Israel''s monarchy in chronological order.',
      '1 Samuel 8-17',
      'Israel requested a king before Saul was anointed. Saul was rejected before Samuel anointed David, and David later defeated Goliath.',
      '[{"id":"david_goliath","text":"David defeats Goliath"},{"id":"saul_anointed","text":"Samuel anoints Saul as king"},{"id":"king_requested","text":"Israel asks Samuel for a king"},{"id":"david_anointed","text":"Samuel anoints David"}]'::jsonb,
      '["king_requested","saul_anointed","david_anointed","david_goliath"]'::jsonb,
      90,
      87,
      1.3
    ),
    (
      'sequence|1KI|solomon_to_division',
      '1KI',
      1,
      'Place these events from Solomon''s reign and its aftermath in chronological order.',
      '1 Kings 1-12',
      'Solomon became king and asked God for wisdom before the temple was completed. The kingdom divided after Solomon''s death.',
      '[{"id":"temple_dedicated","text":"Solomon dedicates the temple"},{"id":"kingdom_divides","text":"The kingdom divides under Rehoboam and Jeroboam"},{"id":"solomon_king","text":"Solomon becomes king"},{"id":"wisdom_request","text":"Solomon asks God for wisdom"}]'::jsonb,
      '["solomon_king","wisdom_request","temple_dedicated","kingdom_divides"]'::jsonb,
      88,
      86,
      1.4
    )
),
prepared as (
  select
    seed.*,
    (
      select event.id
      from public.bible_events event
      where event.book_code = seed.book_code
        and event.start_chapter <= seed.chapter
        and event.end_chapter >= seed.chapter
      order by
        (event.end_chapter - event.start_chapter),
        event.start_chapter
      limit 1
    ) as event_id
  from seed
)
insert into public.ot_generated_questions (
  event_id,
  question_type,
  payload,
  dedupe_key
)
select
  prepared.event_id,
  'sequence_order_v1',
  jsonb_build_object(
    'prompt', prepared.prompt,
    'book_code', prepared.book_code,
    'chapter', prepared.chapter,
    'reference', prepared.reference,
    'explanation', prepared.explanation,
    'choices', prepared.choices,
    'correct_order', prepared.correct_order,
    'correct_choice_id', prepared.correct_order->>0,
    'correct_answer', (
      select string_agg(choice->>'text', ' -> ' order by ordered.ordinality)
      from jsonb_array_elements_text(prepared.correct_order)
        with ordinality ordered(item_id, ordinality)
      join lateral (
        select item
        from jsonb_array_elements(prepared.choices) item
        where item->>'id' = ordered.item_id
        limit 1
      ) matched(choice) on true
    ),
    'dimension_key', 'events_timeline',
    'question_layer', '1',
    'question_format', 'sequence_order',
    'source_batch', '20260726_sequence_order_questions',
    'stem_family', prepared.dedupe_key,
    'importance_conceptual', prepared.importance_conceptual,
    'importance_context', prepared.importance_context,
    'difficulty_estimate', round(500 + prepared.irt_b * 80),
    'irt_b', prepared.irt_b
  ),
  prepared.dedupe_key
from prepared
where prepared.event_id is not null
  and not exists (
    select 1
    from public.ot_generated_questions existing
    where existing.dedupe_key = prepared.dedupe_key
      and existing.question_type not like 'quarantined%'
  );

revoke all on function public.obs_parse_sequence_order(text)
  from public, anon;
revoke all on function public.obs_submit_ot_assessment_response(
  uuid, uuid, text
) from public, anon;
revoke all on function public.get_next_scoped_assessment_question(
  uuid, uuid
) from public, anon;
revoke all on function public.obs_get_attempt_review(uuid, uuid)
  from public, anon;

grant execute on function public.obs_parse_sequence_order(text)
  to authenticated, service_role;
grant execute on function public.obs_submit_ot_assessment_response(
  uuid, uuid, text
) to authenticated, service_role;
grant execute on function public.get_next_scoped_assessment_question(
  uuid, uuid
) to authenticated, service_role;
grant execute on function public.obs_get_attempt_review(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.obs_get_next_ot_assessment_question(uuid)
  to authenticated, service_role;

comment on function public.obs_submit_ot_assessment_response(
  uuid, uuid, text
) is
  'Submits either an MCQ choice or an exact-order sequence response for a persistent OT assessment.';

notify pgrst, 'reload schema';

commit;
