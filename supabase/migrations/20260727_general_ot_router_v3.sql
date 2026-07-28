-- General OT router v3.
--
-- Fixes three selection defects in the live general assessment:
--   1. Eventless book-orientation responses do not update theta, so the
--      selector needs a session-local performance signal.
--   2. Per-book stem families do not recognize repetition across the broader
--      book_orientation family. A soft family-novelty term now diversifies
--      foundation questions without suppressing useful book sampling for a
--      learner who remains at the foundation stage.
--   3. The live selector did not use the dimension-balancing logic already
--      present in obs_simulate_router_v2.
--
-- Book orientation is treated as a screening gate rather than disposable
-- "easy" evidence. A correct orientation answer earns a depth follow-up in
-- that book. An incorrect orientation answer sends the router onward to
-- screen another book. This creates a compact multistage assessment: breadth
-- where the learner is uncertain, depth where the foundation is present.
--
-- Dependency priors are directional and routing-only:
--   Torah -> Former Prophets + Chronicles/Ezra/Nehemiah -> Latter Prophets.
-- Strong downstream performance may start an upstream prerequisite at a
-- core verification item. A miss immediately returns that book to foundation.
-- No dependency inference awards score or propagates failure backward.
--
-- Focused retests and all scoring functions are deliberately untouched.

begin;

do $$
begin
  if to_regprocedure(
       'public.get_next_assessment_question(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_effective_item_irt_a(jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_effective_item_irt_b(jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_item_information(double precision,double precision,double precision)'
     ) is null
     or to_regprocedure(
       'public.question_matches_assessment_scope(text,text,text)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_admin_question_bank_audit') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.question_coverage_targets') is null
     or not exists (
       select 1
       from information_schema.columns column_info
       where column_info.table_schema = 'public'
         and column_info.table_name = 'assessment_answers'
         and column_info.column_name = 'scoring_eligible'
     )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'General OT router v3 prerequisites are missing; nothing was changed.';
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
  '20260727_general_ot_router_v3',
  'public',
  'get_next_assessment_question',
  'function',
  pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260727_general_ot_router_v3'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260727_general_ot_router_v3'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.object_type = 'function';

  if captured <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General OT router backup failed; expected 1 definition, found %s.',
        captured
      );
  end if;
end
$$;

create index if not exists assessment_answers_router_user_question_idx
  on public.assessment_answers (
    user_id,
    generated_question_id,
    answered_at desc
  );

create or replace function public.obs_general_router_stage(
  p_answered_total integer,
  p_recent_total integer,
  p_recent_correct integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_answered_total, 0) < 3 then 1
    when coalesce(p_recent_total, 0) >= 3
      and coalesce(p_recent_correct, 0) * 2
        < coalesce(p_recent_total, 0)
      then 1
    when coalesce(p_answered_total, 0) >= 7
      and coalesce(p_recent_total, 0) >= 5
      and coalesce(p_recent_correct, 0) * 5
        >= coalesce(p_recent_total, 0) * 4
      then 3
    when coalesce(p_recent_total, 0) >= 3
      and coalesce(p_recent_correct, 0) * 5
        >= coalesce(p_recent_total, 0) * 3
      then 2
    else 1
  end;
$$;

create or replace function public.obs_general_question_family_limit(
  p_question_family text
)
returns integer
language sql
immutable
parallel safe
as $$
  select case lower(coalesce(nullif(btrim(p_question_family), ''), ''))
    when 'book_orientation' then null
    else 3
  end;
$$;

create or replace function public.obs_general_dependency_mastery(
  p_answered integer,
  p_correct integer,
  p_distinct_books integer
)
returns boolean
language sql
immutable
parallel safe
as $$
  select
    coalesce(p_correct, 0) >= 10
    and coalesce(p_distinct_books, 0) >= 3
    and coalesce(p_answered, 0) > 0
    and coalesce(p_correct, 0) * 4
      >= coalesce(p_answered, 0) * 3;
$$;

create or replace function public.obs_general_route_priority(
  p_has_pending_followup boolean,
  p_orientation_answered integer,
  p_orientation_correct boolean,
  p_followup_answered integer,
  p_followup_correct boolean,
  p_dependency_floor integer,
  p_question_family text,
  p_candidate_stage integer,
  p_target_stage integer
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when not coalesce(p_has_pending_followup, false)
      and coalesce(p_dependency_floor, 1) >= 2
      and coalesce(p_orientation_answered, 0) = 0
    then
      case
        when coalesce(p_followup_answered, 0) = 0
          and coalesce(p_question_family, '') <> 'book_orientation'
          and coalesce(p_candidate_stage, 1)
            >= coalesce(p_dependency_floor, 2)
          then -1
        when coalesce(p_followup_answered, 0) > 0
          and not coalesce(p_followup_correct, false)
          and coalesce(p_question_family, '') = 'book_orientation'
          then -1
        when coalesce(p_followup_correct, false)
          then 3
        when coalesce(p_question_family, '') = 'book_orientation'
          then 2
        else 3
      end
    when coalesce(p_has_pending_followup, false) then
      case
        when coalesce(p_orientation_correct, false)
          and coalesce(p_followup_answered, 0) = 0
          and coalesce(p_question_family, '') <> 'book_orientation'
          and coalesce(p_candidate_stage, 1)
            = greatest(2, coalesce(p_target_stage, 1))
          then 0
        when coalesce(p_orientation_correct, false)
          and coalesce(p_followup_answered, 0) = 0
          and coalesce(p_question_family, '') <> 'book_orientation'
          then 1
        when coalesce(p_question_family, '') = 'book_orientation'
          and coalesce(p_orientation_answered, 0) = 0
          then 2
        else 3
      end
    else
      case
        when coalesce(p_question_family, '') = 'book_orientation'
          and coalesce(p_orientation_answered, 0) = 0
          then 0
        when coalesce(p_orientation_correct, false)
          and coalesce(p_question_family, '') <> 'book_orientation'
          and coalesce(p_candidate_stage, 1)
            = coalesce(p_target_stage, 1)
          then 1
        when coalesce(p_orientation_answered, 0) > 0
          and not coalesce(p_orientation_correct, false)
          and coalesce(p_candidate_stage, 1) = 1
          then 2
        else 3
      end
  end;
$$;

create or replace function public.get_next_assessment_question(
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
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select
      attempt.id,
      upper(coalesce(attempt.testament, 'OT')) as testament,
      upper(coalesce(attempt.scope_key, 'OT')) as scope_key
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and auth.uid() = p_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and not coalesce(attempt.is_complete, false)
      and attempt.completed_at is null
  ),
  answer_history as (
    select
      answer.generated_question_id,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      answer.answered_at,
      question.book_code,
      question.dimension_key,
      nullif(question.payload->>'stem_family', '') as stem_family,
      nullif(
        lower(btrim(question.payload->>'question_family')),
        ''
      ) as question_family,
      row_number() over (
        order by answer.answered_at desc, answer.id desc
      ) as recency_rank
    from authorized_attempt attempt
    join public.assessment_answers answer
      on answer.attempt_id = attempt.id
     and answer.user_id = p_user_id
    left join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
  ),
  historical_ranked as (
    select
      answer.generated_question_id,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      resolved.book_code,
      public.canonical_assessment_scope(resolved.book_code)
        as canonical_scope,
      row_number() over (
        partition by answer.generated_question_id
        order by answer.answered_at desc, answer.id desc
      ) as question_rank
    from public.assessment_answers answer
    join public.ot_generated_questions question
      on question.id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    cross join lateral (
      select upper(coalesce(
        event.book_code,
        question.payload->>'book_code'
      )) as book_code
    ) resolved
    where answer.user_id = p_user_id
      and answer.scoring_eligible
      and resolved.book_code is not null
  ),
  historical_evidence as (
    select
      generated_question_id,
      is_correct,
      is_idk,
      book_code,
      canonical_scope
    from historical_ranked
    where question_rank = 1
  ),
  dependency_counts as (
    select
      count(*) filter (
        where evidence.canonical_scope = 'FORMER'
      )::integer as former_answered,
      count(*) filter (
        where evidence.canonical_scope = 'FORMER'
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as former_correct,
      count(distinct evidence.book_code) filter (
        where evidence.canonical_scope = 'FORMER'
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as former_books,
      count(*) filter (
        where evidence.canonical_scope = 'FORMER'
           or evidence.book_code in ('1CH', '2CH', 'EZR', 'NEH')
      )::integer as spine_answered,
      count(*) filter (
        where (
          evidence.canonical_scope = 'FORMER'
          or evidence.book_code in ('1CH', '2CH', 'EZR', 'NEH')
        )
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as spine_correct,
      count(distinct evidence.book_code) filter (
        where (
          evidence.canonical_scope = 'FORMER'
          or evidence.book_code in ('1CH', '2CH', 'EZR', 'NEH')
        )
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as spine_books,
      count(*) filter (
        where evidence.book_code in ('1CH', '2CH', 'EZR', 'NEH')
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as bridge_correct,
      count(distinct evidence.book_code) filter (
        where evidence.book_code in ('1CH', '2CH', 'EZR', 'NEH')
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as bridge_books,
      count(*) filter (
        where evidence.canonical_scope = 'LATTER'
      )::integer as latter_answered,
      count(*) filter (
        where evidence.canonical_scope = 'LATTER'
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as latter_correct,
      count(distinct evidence.book_code) filter (
        where evidence.canonical_scope = 'LATTER'
          and evidence.is_correct
          and not evidence.is_idk
      )::integer as latter_books
    from historical_evidence evidence
  ),
  dependency_state as (
    select
      public.obs_general_dependency_mastery(
        counts.former_answered,
        counts.former_correct,
        counts.former_books
      ) as former_mastery,
      (
        public.obs_general_dependency_mastery(
          counts.spine_answered,
          counts.spine_correct,
          counts.spine_books
        )
        and counts.bridge_correct >= 2
        and counts.bridge_books >= 1
      ) as spine_mastery,
      public.obs_general_dependency_mastery(
        counts.latter_answered,
        counts.latter_correct,
        counts.latter_books
      ) as latter_mastery
    from dependency_counts counts
  ),
  session_stats as (
    select
      count(*)::integer as answered_total,
      count(*) filter (where recency_rank <= 5)::integer as recent_total,
      count(*) filter (
        where recency_rank <= 5
          and is_correct
          and not is_idk
      )::integer as recent_correct
    from answer_history
  ),
  router_state as (
    select
      stats.*,
      public.obs_general_router_stage(
        stats.answered_total,
        stats.recent_total,
        stats.recent_correct
      ) as target_stage
    from session_stats stats
  ),
  book_progress as (
    select
      history.book_code,
      count(*) filter (
        where history.question_family = 'book_orientation'
      )::integer as orientation_answered,
      coalesce(
        bool_or(
          history.is_correct and not history.is_idk
        ) filter (
          where history.question_family = 'book_orientation'
        ),
        false
      ) as orientation_correct,
      count(*) filter (
        where coalesce(history.question_family, '')
          <> 'book_orientation'
      )::integer as followup_answered,
      coalesce(
        bool_or(
          history.is_correct and not history.is_idk
        ) filter (
          where coalesce(history.question_family, '')
            <> 'book_orientation'
        ),
        false
      ) as followup_correct
    from answer_history history
    where history.book_code is not null
    group by history.book_code
  ),
  pending_followup as (
    select exists (
      select 1
      from book_progress progress
      where progress.orientation_correct
        and progress.followup_answered = 0
    ) as has_pending_followup
  ),
  answered_families as (
    select
      question_family,
      count(*)::integer as family_answered
    from answer_history
    where question_family is not null
    group by question_family
  ),
  answered_books as (
    select
      book_code,
      count(*)::integer as book_answered
    from answer_history
    where book_code is not null
    group by book_code
  ),
  observed_by_dimension as (
    select
      dimension_key,
      count(*)::double precision as answered
    from answer_history
    where dimension_key is not null
    group by dimension_key
  ),
  observed_total as (
    select count(*)::double precision as answered
    from answer_history
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
  eligible_targets as (
    select
      target.book_code,
      target.dimension_key,
      target.target_active_questions::double precision
    from public.question_coverage_targets target
    cross join authorized_attempt attempt
    where target.target_active_questions > 0
      and public.question_matches_assessment_scope(
        target.book_code,
        attempt.testament,
        attempt.scope_key
      )
  ),
  target_profiles as (
    select
      target.dimension_key,
      sum(target.target_active_questions)
        / nullif(sum(sum(target.target_active_questions)) over (), 0)
          as target_share
    from eligible_targets target
    group by target.dimension_key
  ),
  raw_candidates as (
    select
      question.generated_question_id,
      question.question_type,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.payload,
      question.book_code,
      question.created_at,
      question.routing_score,
      question.importance_conceptual,
      question.importance_context,
      question.dimension_key,
      coalesce(
        event.event_title,
        question.book_code || ' question'
      ) as resolved_event_title,
      nullif(question.payload->>'stem_family', '') as stem_family,
      nullif(
        lower(btrim(question.payload->>'question_family')),
        ''
      ) as question_family,
      public.obs_effective_item_irt_a(
        question.payload,
        event.irt_a::double precision
      ) as effective_a,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      ) as effective_b,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as candidate_stage,
      state.target_stage,
      greatest(
        state.target_stage,
        dependency.dependency_floor
      ) as effective_target_stage,
      dependency.dependency_floor,
      case greatest(
        state.target_stage,
        dependency.dependency_floor
      )
        when 1 then -1.00::double precision
        when 2 then 0.00::double precision
        else 0.90::double precision
      end as target_theta,
      coalesce(profile.target_share, 0.0) as target_share,
      coalesce(
        observed.answered / nullif(total.answered, 0),
        0.0
      ) as observed_share,
      coalesce(family.family_answered, 0) as family_answered,
      coalesce(book.book_answered, 0) as book_answered,
      coalesce(progress.orientation_answered, 0)
        as orientation_answered,
      coalesce(progress.orientation_correct, false)
        as orientation_correct,
      coalesce(progress.followup_answered, 0)
        as followup_answered,
      coalesce(progress.followup_correct, false)
        as followup_correct,
      pending.has_pending_followup,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      least(
        1.0,
        greatest(
          0.0,
          case
            when question.importance_conceptual is not null
              or question.importance_context is not null
            then (
              0.70 * coalesce(question.importance_conceptual, 0)
              + 0.30 * coalesce(question.importance_context, 0)
            ) / 100.0
            else coalesce(question.routing_score / 100.0, 0.50)
          end
        )
      ) as importance_score
    from authorized_attempt attempt
    join public.obs_question_bank_with_dimensions question
      on public.question_matches_assessment_scope(
        question.book_code,
        attempt.testament,
        attempt.scope_key
      )
    join public.obs_biblical_books candidate_book
      on candidate_book.book_code = question.book_code
    join public.obs_bli_dimensions candidate_dimension
      on candidate_dimension.dimension_key = question.dimension_key
    join public.question_coverage_targets candidate_target
      on candidate_target.book_code = question.book_code
     and candidate_target.dimension_key = question.dimension_key
     and candidate_target.target_active_questions > 0
    left join public.bible_events event
      on event.id = question.event_id
    cross join router_state state
    cross join dependency_state dependencies
    cross join lateral (
      select case
        when public.canonical_assessment_scope(question.book_code) = 'TORAH'
          and (
            dependencies.former_mastery
            or dependencies.spine_mastery
            or dependencies.latter_mastery
          )
          then 2
        when (
          public.canonical_assessment_scope(question.book_code) = 'FORMER'
          or question.book_code in ('1CH', '2CH', 'EZR', 'NEH')
        )
          and dependencies.latter_mastery
          then 2
        else 1
      end::integer as dependency_floor
    ) dependency
    left join target_profiles profile
      on profile.dimension_key = question.dimension_key
    left join observed_by_dimension observed
      on observed.dimension_key = question.dimension_key
    cross join observed_total total
    left join answered_families family
      on family.question_family = nullif(
        lower(btrim(question.payload->>'question_family')),
        ''
      )
    left join answered_books book
      on book.book_code = question.book_code
    left join book_progress progress
      on progress.book_code = question.book_code
    cross join pending_followup pending
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    where question.generated_question_id is not null
      and coalesce(question.payload->>'prompt', question.prompt) is not null
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
          and coalesce(
            question.payload->>'correct_choice_id',
            question.payload->>'answer_id',
            question.payload->>'correctAnswerId'
          ) is not null
          and exists (
            select 1
            from jsonb_array_elements(question.payload->'choices') choice
            where choice->>'id' = coalesce(
              question.payload->>'correct_choice_id',
              question.payload->>'answer_id',
              question.payload->>'correctAnswerId'
            )
          )
        )
      )
      and not exists (
        select 1
        from answer_history used
        where used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from answer_history used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family =
            nullif(question.payload->>'stem_family', '')
      )
  ),
  eligible_candidates as (
    select candidate.*
    from raw_candidates candidate
    where candidate.question_family is null
       or public.obs_general_question_family_limit(
            candidate.question_family
          ) is null
       or candidate.family_answered
          < public.obs_general_question_family_limit(
              candidate.question_family
            )
  ),
  scored as (
    select
      candidate.*,
      public.obs_general_route_priority(
        candidate.has_pending_followup,
        candidate.orientation_answered,
        candidate.orientation_correct,
        candidate.followup_answered,
        candidate.followup_correct,
        candidate.dependency_floor,
        candidate.question_family,
        candidate.candidate_stage,
        candidate.effective_target_stage
      ) as route_priority,
      greatest(
        0.0,
        candidate.target_share - candidate.observed_share
      ) as dimension_need,
      public.obs_item_information(
        candidate.target_theta,
        candidate.effective_a,
        candidate.effective_b
      ) as information_score,
      1.0 / (1.0 + candidate.book_answered) as book_novelty_score,
      1.0 / (1.0 + candidate.family_answered)
        as family_novelty_score,
      1.0 / (1.0 + candidate.times_answered) as exposure_score
    from eligible_candidates candidate
  ),
  ranked as (
    select
      scored.*,
      (
        0.30 * scored.dimension_need
        + 0.25 * scored.information_score
        + 0.20 * scored.importance_score
        + 0.10 * scored.book_novelty_score
        + 0.10 * scored.family_novelty_score
        + 0.05 * scored.exposure_score
      ) as adaptive_score
    from scored
  )
  select
    generated_question_id as out_generated_question_id,
    prompt,
    question_type,
    payload->'choices' as choices,
    resolved_event_title as event_title,
    book_code,
    case
      when coalesce(importance_conceptual, routing_score, 0) >= 80 then 1
      when coalesce(importance_conceptual, routing_score, 0) >= 60 then 2
      else 3
    end as importance_tier,
    case public.canonical_assessment_scope(book_code)
      when 'TORAH' then 'Torah'
      when 'FORMER' then 'Former Prophets'
      when 'LATTER' then 'Latter Prophets'
      when 'WRITINGS' then 'Writings'
      else 'Old Testament'
    end as section
  from ranked
  order by
    route_priority,
    abs(candidate_stage - effective_target_stage),
    adaptive_score desc,
    times_answered,
    last_answered_at nulls first,
    md5(p_attempt_id::text || ':' || generated_question_id::text)
  limit 1;
$$;

revoke all on function public.obs_general_router_stage(
  integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.obs_general_router_stage(
  integer, integer, integer
) to service_role;

revoke all on function public.obs_general_question_family_limit(text)
  from public, anon, authenticated;
grant execute on function public.obs_general_question_family_limit(text)
  to service_role;

revoke all on function public.obs_general_dependency_mastery(
  integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.obs_general_dependency_mastery(
  integer, integer, integer
) to service_role;

revoke all on function public.obs_general_route_priority(
  boolean, integer, boolean, integer, boolean, integer,
  text, integer, integer
) from public, anon, authenticated;
grant execute on function public.obs_general_route_priority(
  boolean, integer, boolean, integer, boolean, integer,
  text, integer, integer
) to service_role;

revoke all on function public.get_next_assessment_question(uuid, uuid)
  from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid)
  to authenticated, service_role;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'General OT router v3: book-orientation screening with conditional depth follow-ups, directional routing-only dependency priors, session-adaptive stages, family safeguards, scope filtering, dimension need, item information, importance, and exposure.';

notify pgrst, 'reload schema';

commit;
