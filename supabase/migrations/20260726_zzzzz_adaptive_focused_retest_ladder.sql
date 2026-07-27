-- Make focused retests progress from foundation to core knowledge to detail.
-- Unit mastery is stage-based: easy-only success cannot earn an advanced score.

begin;

do $$
begin
  if to_regprocedure(
       'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'
     ) is null
     or to_regprocedure(
       'public.obs_get_user_recommendation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_effective_item_irt_b(jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_payload_number(jsonb,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Adaptive focused-retest ladder preflight failed; required contracts are missing.';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'assessment_answers'
      and column_info.column_name = 'scoring_eligible'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Apply historical answer scoring eligibility before the adaptive retest ladder.';
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
  '20260726_adaptive_focused_retest_ladder',
  'public',
  object_row.object_name,
  'function',
  pg_get_functiondef(object_row.signature::regprocedure)
from (
  values
    (
      'obs_get_next_focused_question_v2',
      'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'
    ),
    (
      'obs_get_user_recommendation_v2',
      'public.obs_get_user_recommendation_v2(uuid)'
    )
) object_row(object_name, signature)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_adaptive_focused_retest_ladder'
    and backup.object_schema = 'public'
    and backup.object_name = object_row.object_name
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_adaptive_focused_retest_ladder'
    and backup.object_schema = 'public'
    and backup.object_type = 'function'
    and backup.object_name in (
      'obs_get_next_focused_question_v2',
      'obs_get_user_recommendation_v2'
    );

  if captured <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Adaptive focused-retest backup failed; expected 2 definitions, found %s.',
        captured
      );
  end if;
end
$$;

create or replace function public.obs_focused_item_stage(
  p_question_type text,
  p_payload jsonb,
  p_effective_irt_b double precision
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_question_type, '') = 'book_orientation_mcq_v1'
      or lower(coalesce(p_payload->>'assessment_role', '')) in (
        'book_orientation',
        'foundation',
        'baseline'
      )
      or coalesce(p_effective_irt_b, 0.0) <= -0.75
      or public.obs_payload_number(
        coalesce(p_payload, '{}'::jsonb),
        'difficulty_estimate'
      ) <= 480
      then 1
    when lower(coalesce(p_question_type, '')) like '%significance%'
      or lower(coalesce(p_question_type, '')) like '%theological%'
      or lower(coalesce(p_question_type, '')) like '%cross_ref%'
      or lower(coalesce(p_question_type, '')) like '%crossref%'
      or coalesce(p_question_type, '') = 'sequence_order_v1'
      or coalesce(p_effective_irt_b, 0.0) > 0.50
      or public.obs_payload_number(
        coalesce(p_payload, '{}'::jsonb),
        'difficulty_estimate'
      ) > 560
      then 3
    else 2
  end;
$$;

create or replace function public.obs_focused_stage_label(
  p_stage integer
)
returns text
language sql
immutable
parallel safe
as $$
  select case greatest(1, least(3, coalesce(p_stage, 1)))
    when 1 then 'Foundation'
    when 2 then 'Core knowledge'
    else 'Detail and synthesis'
  end;
$$;

create or replace function public.obs_focused_mastery_raw(
  p_stage_1_accuracy numeric,
  p_stage_2_accuracy numeric,
  p_stage_3_accuracy numeric,
  p_stage_1_available boolean,
  p_stage_2_available boolean,
  p_stage_3_available boolean
)
returns numeric
language sql
immutable
parallel safe
as $$
  with components as (
    select *
    from (
      values
        (
          40.0::numeric,
          p_stage_1_accuracy,
          coalesce(p_stage_1_available, false)
        ),
        (
          35.0::numeric,
          p_stage_2_accuracy,
          coalesce(p_stage_2_available, false)
        ),
        (
          25.0::numeric,
          p_stage_3_accuracy,
          coalesce(p_stage_3_available, false)
        )
    ) component(max_points, observed_accuracy, available)
  )
  select case
    when coalesce(sum(max_points) filter (where available), 0) = 0
      then null
    else round(
      (
        coalesce(sum(
          max_points
          * greatest(
              0,
              least(
                1,
                (
                  coalesce(observed_accuracy, 0.25) - 0.25
                ) / 0.75
              )
            )
        ) filter (where available), 0)
        / sum(max_points) filter (where available)
      ) * 100,
      2
    )
  end
  from components;
$$;

create or replace function public.obs_get_unit_mastery_score(
  p_user_id uuid,
  p_unit_key text,
  p_dimension_key text default null
)
returns table (
  unit_key text,
  answered integer,
  correct integer,
  raw_score numeric,
  display_score integer,
  highest_stage_attempted integer,
  foundation_answered integer,
  foundation_correct integer,
  core_answered integer,
  core_correct integer,
  detail_answered integer,
  detail_correct integer
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where public.obs_is_authorized_user(p_user_id)
  ),
  target as (
    select unit.*
    from public.obs_learning_units unit
    join authorized on true
    where unit.unit_key = p_unit_key
    limit 1
  ),
  question_rows as (
    select
      question.generated_question_id,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as stage,
      greatest(
        1,
        coalesce(
          question.importance_conceptual,
          question.routing_score,
          question.importance_context,
          50
        )
      )::numeric as weight
    from target
    join public.obs_question_bank_with_units question
      on (
        question.unit_key = target.unit_key
        or (
          target.start_chapter = 1
          and question.book_code = target.book_code
          and question.question_type = 'book_orientation_mcq_v1'
        )
      )
    left join public.bible_events event
      on event.id = question.event_id
    where question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        p_dimension_key is null
        or question.dimension_key =
          public.obs_normalize_dimension_key(p_dimension_key)
      )
  ),
  latest_answers as (
    select *
    from (
      select
        answer.*,
        row_number() over (
          partition by answer.generated_question_id
          order by answer.answered_at desc, answer.id desc
        ) as recency_rank
      from public.assessment_answers answer
      join question_rows question
        on question.generated_question_id =
          answer.generated_question_id
      where answer.user_id = p_user_id
        and answer.scoring_eligible
    ) ranked
    where recency_rank = 1
  ),
  stage_rows as (
    select
      question.stage,
      question.weight,
      answer.id as answer_id,
      coalesce(answer.is_correct, false) as is_correct
    from question_rows question
    left join latest_answers answer
      on answer.generated_question_id =
        question.generated_question_id
  ),
  stage_scores as (
    select
      stage,
      count(*)::integer as available,
      count(answer_id)::integer as answered,
      count(answer_id) filter (where is_correct)::integer as correct,
      case
        when coalesce(
          sum(weight) filter (where answer_id is not null),
          0
        ) = 0 then null
        else
          sum(weight) filter (
            where answer_id is not null and is_correct
          )
          / sum(weight) filter (where answer_id is not null)
      end as accuracy
    from stage_rows
    group by stage
  ),
  pivoted as (
    select
      coalesce(sum(available) filter (where stage = 1), 0)::integer
        as stage_1_available,
      coalesce(sum(available) filter (where stage = 2), 0)::integer
        as stage_2_available,
      coalesce(sum(available) filter (where stage = 3), 0)::integer
        as stage_3_available,
      coalesce(sum(answered) filter (where stage = 1), 0)::integer
        as stage_1_answered,
      coalesce(sum(answered) filter (where stage = 2), 0)::integer
        as stage_2_answered,
      coalesce(sum(answered) filter (where stage = 3), 0)::integer
        as stage_3_answered,
      coalesce(sum(correct) filter (where stage = 1), 0)::integer
        as stage_1_correct,
      coalesce(sum(correct) filter (where stage = 2), 0)::integer
        as stage_2_correct,
      coalesce(sum(correct) filter (where stage = 3), 0)::integer
        as stage_3_correct,
      max(accuracy) filter (where stage = 1) as stage_1_accuracy,
      max(accuracy) filter (where stage = 2) as stage_2_accuracy,
      max(accuracy) filter (where stage = 3) as stage_3_accuracy
    from stage_scores
  ),
  scored as (
    select
      pivoted.*,
      public.obs_focused_mastery_raw(
        stage_1_accuracy,
        stage_2_accuracy,
        stage_3_accuracy,
        stage_1_available > 0,
        stage_2_available > 0,
        stage_3_available > 0
      ) as calculated_raw
    from pivoted
  )
  select
    p_unit_key,
    (
      stage_1_answered
      + stage_2_answered
      + stage_3_answered
    )::integer,
    (
      stage_1_correct
      + stage_2_correct
      + stage_3_correct
    )::integer,
    case
      when stage_1_answered
        + stage_2_answered
        + stage_3_answered = 0
        then null
      else calculated_raw
    end,
    case
      when stage_1_answered
        + stage_2_answered
        + stage_3_answered = 0
        then null
      else public.obs_display_score_from_raw(calculated_raw)
    end,
    case
      when stage_3_answered > 0 then 3
      when stage_2_answered > 0 then 2
      when stage_1_answered > 0 then 1
      else 0
    end,
    stage_1_answered,
    stage_1_correct,
    stage_2_answered,
    stage_2_correct,
    stage_3_answered,
    stage_3_correct
  from scored;
$$;

create or replace function public.obs_get_next_focused_question_v2(
  p_user_id uuid,
  p_attempt_id uuid,
  p_unit_key text default null,
  p_book_code text default null,
  p_start_chapter integer default null,
  p_end_chapter integer default null,
  p_dimension_key text default null
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where auth.uid() = p_user_id
  ),
  target as (
    select
      unit.*,
      dimension.short_label as dimension_short_label
    from public.obs_learning_units unit
    join authorized on true
    left join public.obs_bli_dimensions dimension
      on dimension.dimension_key =
        public.obs_normalize_dimension_key(p_dimension_key)
    where (
      p_unit_key is not null
      and unit.unit_key = p_unit_key
    )
    or (
      p_unit_key is null
      and p_book_code is not null
      and unit.book_code = upper(p_book_code)
      and unit.start_chapter = p_start_chapter
      and unit.end_chapter = p_end_chapter
    )
    order by unit.sequence_order
    limit 1
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
  candidate_base as (
    select
      question.*,
      case
        when target.dimension_short_label is null
          then coalesce(
            target.label,
            question.unit_label,
            question.book_code || ' focused retest'
          )
        else target.dimension_short_label || ' in ' || target.label
      end as target_label,
      coalesce(
        target.section,
        question.unit_section,
        'Old Testament'
      ) as target_section,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as difficulty_stage,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      exists (
        select 1
        from public.assessment_answers answer
        where answer.user_id = p_user_id
          and answer.generated_question_id =
            question.generated_question_id
          and answer.attempt_id = p_attempt_id
      ) as answered_in_attempt
    from public.obs_question_bank_with_units question
    join target on true
    left join public.bible_events event
      on event.id = question.event_id
    left join user_history history
      on history.generated_question_id =
        question.generated_question_id
    where question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        p_dimension_key is null
        or question.dimension_key =
          public.obs_normalize_dimension_key(p_dimension_key)
      )
      and (
        question.unit_key = target.unit_key
        or (
          target.start_chapter = 1
          and question.book_code = target.book_code
          and question.question_type = 'book_orientation_mcq_v1'
        )
      )
  ),
  availability as (
    select
      count(*) filter (where difficulty_stage = 1)::integer
        as stage_1_available,
      count(*) filter (where difficulty_stage = 2)::integer
        as stage_2_available,
      count(*) filter (where difficulty_stage = 3)::integer
        as stage_3_available
    from candidate_base
  ),
  attempt_progress as (
    select
      count(*) filter (where stage = 1)::integer
        as stage_1_answered,
      count(*) filter (
        where stage = 1 and answer.is_correct
      )::integer as stage_1_correct,
      count(*) filter (where stage = 2)::integer
        as stage_2_answered,
      count(*) filter (
        where stage = 2 and answer.is_correct
      )::integer as stage_2_correct
    from public.assessment_answers answer
    join public.obs_question_bank_with_units question
      on question.generated_question_id =
        answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    cross join lateral (
      select public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as stage
    ) classified
    where answer.attempt_id = p_attempt_id
      and answer.user_id = p_user_id
  ),
  desired as (
    select case
      when availability.stage_1_available > 0
        and progress.stage_1_answered <
          least(2, availability.stage_1_available)
        then 1
      when progress.stage_1_answered > 0
        and progress.stage_1_correct::numeric
          / progress.stage_1_answered < 0.67
        and availability.stage_1_available > 0
        then 1
      when availability.stage_2_available > 0
        and progress.stage_2_answered <
          least(4, availability.stage_2_available)
        then 2
      when progress.stage_2_answered > 0
        and progress.stage_2_correct::numeric
          / progress.stage_2_answered < 0.60
        and availability.stage_2_available > 0
        then 2
      else 3
    end as difficulty_stage
    from availability
    cross join attempt_progress progress
  ),
  ranked as (
    select candidate.*
    from candidate_base candidate
    cross join desired
    where not candidate.answered_in_attempt
      and not exists (
        select 1
        from public.assessment_answers prior
        join public.ot_generated_questions prior_question
          on prior_question.id = prior.generated_question_id
        where prior.attempt_id = p_attempt_id
          and prior.user_id = p_user_id
          and coalesce(
            nullif(
              prior_question.payload->>'stem_family',
              ''
            ),
            prior_question.id::text
          ) = coalesce(
            nullif(candidate.payload->>'stem_family', ''),
            candidate.generated_question_id::text
          )
      )
    order by
      abs(candidate.difficulty_stage - desired.difficulty_stage),
      case
        when candidate.difficulty_stage > desired.difficulty_stage
          then 1
        else 0
      end,
      candidate.times_answered,
      candidate.last_answered_at nulls first,
      coalesce(
        candidate.importance_conceptual,
        candidate.routing_score,
        candidate.importance_context,
        50
      ) desc,
      random() * 0.05,
      candidate.created_at desc
    limit 1
  )
  select
    generated_question_id,
    coalesce(payload->>'prompt', prompt),
    question_type,
    payload->'choices',
    target_label,
    book_code,
    case
      when coalesce(routing_score, 0) >= 80 then 1
      when coalesce(routing_score, 0) >= 60 then 2
      else 3
    end,
    target_section
  from ranked;
$$;

alter function public.obs_get_user_recommendation_v2(uuid)
  rename to obs_get_user_recommendation_pre_ladder;

create or replace function public.obs_get_user_recommendation_v2(
  p_user_id uuid
)
returns table (
  unit_key text,
  label text,
  section text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  sequence_order integer,
  is_foundation boolean,
  answered integer,
  correct integer,
  raw_score numeric,
  display_score integer,
  baseline_display_score_required integer,
  retest_question_target integer,
  focus_text text,
  reason text,
  recommendation_kind text,
  dimension_key text,
  dimension_label text,
  dimension_short_label text,
  dimension_answered integer,
  dimension_correct integer,
  dimension_display_score integer,
  dimension_available_questions integer,
  dimension_focus_text text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where public.obs_is_authorized_user(p_user_id)
  ),
  scored_units as (
    select
      unit.*,
      mastery.answered,
      mastery.correct,
      mastery.raw_score,
      mastery.display_score,
      mastery.highest_stage_attempted
    from public.obs_learning_units unit
    join authorized on true
    cross join lateral public.obs_get_unit_mastery_score(
      p_user_id,
      unit.unit_key,
      null
    ) mastery
  ),
  foundation_gap as (
    select
      scored.*,
      case
        when answered < min_answers_required
          then 'Foundational unit needs more ladder evidence'
        else 'Foundational unit is below baseline mastery'
      end as unit_reason
    from scored_units scored
    where is_foundation
      and (
        answered < min_answers_required
        or coalesce(display_score, 200) <
          baseline_display_score_required
      )
    order by sequence_order
    limit 1
  ),
  later_gap as (
    select
      scored.*,
      case
        when answered < min_answers_required
          then 'Later unit needs more ladder evidence'
        else 'Lowest post-foundation mastery score'
      end as unit_reason
    from scored_units scored
    where not is_foundation
      and (
        answered < min_answers_required
        or coalesce(display_score, 200) <
          baseline_display_score_required
      )
    order by
      case when answered < min_answers_required then 0 else 1 end,
      coalesce(display_score, 200),
      sequence_order
    limit 1
  ),
  selected as (
    select * from foundation_gap
    union all
    select * from later_gap
    where not exists (select 1 from foundation_gap)
    limit 1
  ),
  prior_recommendation as (
    select prior.*
    from public.obs_get_user_recommendation_pre_ladder(
      p_user_id
    ) prior
  )
  select
    selected.unit_key,
    selected.label,
    selected.section,
    selected.book_code,
    selected.start_chapter,
    selected.end_chapter,
    selected.sequence_order,
    selected.is_foundation,
    selected.answered,
    selected.correct,
    selected.raw_score,
    selected.display_score,
    selected.baseline_display_score_required,
    case
      when prior.unit_key = selected.unit_key
        and prior.dimension_key is not null
        then least(
          selected.retest_question_target,
          prior.dimension_available_questions
        )
      else selected.retest_question_target
    end,
    selected.focus_text,
    case
      when prior.unit_key = selected.unit_key
        and prior.dimension_key is not null
        then
          'Weakest supported dimension inside the earliest ladder gap'
      else selected.unit_reason
    end,
    case
      when prior.unit_key = selected.unit_key
        and prior.dimension_key is not null
        then 'DIMENSION'
      else 'UNIT'
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_key
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_label
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_short_label
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_answered
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_correct
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_display_score
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_available_questions
    end,
    case
      when prior.unit_key = selected.unit_key
        then prior.dimension_focus_text
    end
  from selected
  left join prior_recommendation prior
    on prior.unit_key = selected.unit_key;
$$;

revoke all on function public.obs_focused_item_stage(
  text, jsonb, double precision
) from public;
revoke all on function public.obs_focused_stage_label(integer)
  from public;
revoke all on function public.obs_focused_mastery_raw(
  numeric, numeric, numeric, boolean, boolean, boolean
) from public;
revoke all on function public.obs_get_unit_mastery_score(
  uuid, text, text
) from public, anon;
revoke all on function public.obs_get_next_focused_question_v2(
  uuid, uuid, text, text, integer, integer, text
) from public, anon;
revoke all on function public.obs_get_user_recommendation_v2(uuid)
  from public, anon;
revoke all on function
  public.obs_get_user_recommendation_pre_ladder(uuid)
  from public, anon;

grant execute on function public.obs_focused_item_stage(
  text, jsonb, double precision
) to authenticated, service_role;
grant execute on function public.obs_focused_stage_label(integer)
  to authenticated, service_role;
grant execute on function public.obs_focused_mastery_raw(
  numeric, numeric, numeric, boolean, boolean, boolean
) to authenticated, service_role;
grant execute on function public.obs_get_unit_mastery_score(
  uuid, text, text
) to authenticated, service_role;
grant execute on function public.obs_get_next_focused_question_v2(
  uuid, uuid, text, text, integer, integer, text
) to authenticated, service_role;
grant execute on function public.obs_get_user_recommendation_v2(uuid)
  to authenticated, service_role;
grant execute on function
  public.obs_get_user_recommendation_pre_ladder(uuid)
  to service_role;

comment on function public.obs_focused_item_stage(
  text, jsonb, double precision
) is
  'Classifies focused-retest items as foundation, core knowledge, or detail and synthesis.';
comment on function public.obs_focused_mastery_raw(
  numeric, numeric, numeric, boolean, boolean, boolean
) is
  'Produces a 0-100 ladder mastery score: 40 foundation points, 35 core points, and 25 detail points, normalized only across stages supported by the bank.';
comment on function public.obs_get_unit_mastery_score(
  uuid, text, text
) is
  'Scores the latest eligible response per item across the three focused-retest stages.';

notify pgrst, 'reload schema';

commit;
