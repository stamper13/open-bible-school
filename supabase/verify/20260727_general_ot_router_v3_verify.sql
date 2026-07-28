-- Fail-loud structural and behavioral verification for general OT router v3.

do $$
declare
  selector_definition text;
  stage_1_count integer;
  stage_2_count integer;
  stage_3_count integer;
  orientation_count integer;
begin
  if to_regclass(
       'public.assessment_answers_router_user_question_idx'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'General OT router performance index is missing.';
  end if;

  if public.obs_general_router_stage(0, 0, 0) <> 1
     or public.obs_general_router_stage(3, 3, 3) <> 2
     or public.obs_general_router_stage(7, 5, 5) <> 3
     or public.obs_general_router_stage(8, 5, 3) <> 2
     or public.obs_general_router_stage(8, 5, 2) <> 1
     or public.obs_general_question_family_limit(
          'book_orientation'
        ) is not null
     or public.obs_general_question_family_limit(
          'another_family'
        ) <> 3
     or not public.obs_general_dependency_mastery(12, 10, 3)
     or public.obs_general_dependency_mastery(14, 10, 3)
     or public.obs_general_dependency_mastery(12, 10, 2)
     or public.obs_general_route_priority(
          false, 0, false, 0, false, 1,
          'book_orientation', 1, 1
        ) <> 0
     or public.obs_general_route_priority(
          true, 1, true, 0, false, 1,
          null, 2, 1
        ) <> 0
     or public.obs_general_route_priority(
          true, 0, false, 0, false, 1,
          'book_orientation', 1, 1
        ) <> 2
     or public.obs_general_route_priority(
          false, 1, true, 1, true, 1,
          null, 2, 2
        ) <> 1
     or public.obs_general_route_priority(
          false, 0, false, 0, false, 2,
          null, 2, 1
        ) <> -1
     or public.obs_general_route_priority(
          false, 0, false, 1, false, 2,
          'book_orientation', 1, 1
        ) <> -1
     or public.obs_general_route_priority(
          false, 0, false, 1, true, 2,
          'book_orientation', 1, 1
        ) <> 3
     or public.obs_general_route_priority(
          true, 0, false, 0, false, 2,
          null, 2, 1
        ) <> 3
  then
    raise exception using
      errcode = 'P0001',
      message =
        'General OT router helper behavior does not match the ratified ladder and family limits.';
  end if;

  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into selector_definition;

  if selector_definition not like '%obs_general_router_stage%'
     or selector_definition not like
       '%obs_general_question_family_limit%'
     or selector_definition not like '%obs_general_route_priority%'
     or selector_definition not like
       '%obs_general_dependency_mastery%'
     or selector_definition not like
       '%question_matches_assessment_scope%'
     or selector_definition not like '%dimension_need%'
     or selector_definition not like '%candidate_stage%'
     or selector_definition not like '%question_family%'
     or selector_definition not like '%family_novelty_score%'
     or selector_definition not like '%book_progress%'
     or selector_definition not like '%pending_followup%'
     or selector_definition not like '%orientation_correct%'
     or selector_definition not like '%route_priority%'
     or selector_definition not like '%dependency_state%'
     or selector_definition not like '%dependency_floor%'
     or selector_definition not like '%effective_target_stage%'
     or selector_definition not like '%spine_mastery%'
     or selector_definition not like '%scoring_eligible%'
     or selector_definition not like '%sequence_answered%'
     or selector_definition not like '%answered_total >= 4%'
     or selector_definition not like '%ot_generated_questions%'
     or selector_definition like '%obs_admin_question_bank_audit%'
     or selector_definition like '%random()%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'General OT router definition is missing a v3 safeguard or still contains an expensive/random hot-path operation.';
  end if;

  select
    count(*) filter (where classified.stage = 1)::integer,
    count(*) filter (where classified.stage = 2)::integer,
    count(*) filter (where classified.stage = 3)::integer,
    count(*) filter (
      where classified.question_family = 'book_orientation'
    )::integer
  into
    stage_1_count,
    stage_2_count,
    stage_3_count,
    orientation_count
  from (
    select
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as stage,
      lower(question.payload->>'question_family') as question_family
    from public.obs_admin_question_bank_audit question
    left join public.bible_events event
      on event.id = question.event_id
    where question.router_eligible
      and question.testament = 'OT'
  ) classified;

  if stage_1_count < 1
     or stage_2_count < 1
     or stage_3_count < 1
     or orientation_count <> 39
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'General OT router bank verification failed: stages=%s/%s/%s orientation=%s/39.',
        stage_1_count,
        stage_2_count,
        stage_3_count,
        orientation_count
      );
  end if;

  raise notice
    'PASS: general OT router v3 installed; stage bank=%/%/%, orientation screening branches to depth after success, and directional dependency priors are routing-only across % active orientation items.',
    stage_1_count,
    stage_2_count,
    stage_3_count,
    orientation_count;
end
$$;

select
  public.obs_general_router_stage(0, 0, 0) as initial_stage,
  public.obs_general_router_stage(3, 3, 3) as after_three_correct,
  public.obs_general_router_stage(7, 5, 5) as sustained_success,
  public.obs_general_router_stage(8, 5, 3) as after_difficulty_pushback,
  public.obs_general_router_stage(8, 5, 2) as after_clear_struggle,
  public.obs_general_question_family_limit(
    'book_orientation'
  ) as orientation_hard_limit,
  public.obs_general_dependency_mastery(
    12, 10, 3
  ) as strong_downstream_mastery,
  public.obs_general_route_priority(
    false, 0, false, 0, false, 1,
    'book_orientation', 1, 1
  ) as unscreened_book_priority,
  public.obs_general_route_priority(
    true, 1, true, 0, false, 1,
    null, 2, 1
  ) as successful_screen_followup_priority,
  public.obs_general_route_priority(
    false, 0, false, 0, false, 2,
    null, 2, 1
  ) as dependency_core_probe_priority,
  public.obs_general_route_priority(
    false, 0, false, 1, false, 2,
    'book_orientation', 1, 1
  ) as dependency_miss_fallback_priority;
