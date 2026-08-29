-- Mirrored from Supabase migration history on 2026-08-23.
-- Original migration name: obs_evidence_weighted_mastery_and_foundation_guard
-- Applied live before this repo mirror was created.
begin;

set local lock_timeout = '2s';
set local statement_timeout = '30s';

-- 1/5 Score what was demonstrated, not what was skipped. Previously a stage
-- entered the denominator whenever ITEMS EXIST, and an unanswered stage scored
-- coalesce(NULL, 0.25) -> the guessing floor -> 0 points. A single unserved
-- stage-1 item forfeited 40 of 100 points, hard-capping the unit at 480 display
-- against a 513 baseline: mathematically unreachable. Now a stage contributes
-- only when actually answered, and weight redistributes across answered stages.
create or replace function public.obs_focused_mastery_raw(
  p_stage_1_accuracy numeric, p_stage_2_accuracy numeric, p_stage_3_accuracy numeric,
  p_stage_1_available boolean, p_stage_2_available boolean, p_stage_3_available boolean
) returns numeric language sql immutable parallel safe as $function$
  with components as (
    select * from (values
      (40.0::numeric, p_stage_1_accuracy, coalesce(p_stage_1_available, false)),
      (35.0::numeric, p_stage_2_accuracy, coalesce(p_stage_2_available, false)),
      (25.0::numeric, p_stage_3_accuracy, coalesce(p_stage_3_available, false))
    ) component(max_points, observed_accuracy, available)
  ),
  counted as (
    -- an unanswered stage is MISSING EVIDENCE, not a failed stage; it leaves the
    -- calculation entirely and is handled by the coverage guard instead
    select * from components where available and observed_accuracy is not null
  )
  select case
    when coalesce(sum(max_points), 0) = 0 then null
    else round((sum(max_points * greatest(0, least(1, (observed_accuracy - 0.25) / 0.75)))
       / sum(max_points)) * 100, 2)
  end from counted;
$function$;

-- 2/5 Does this unit have any stage-1 items at all? User-independent.
-- 14 units legitimately have none and must not be gated.
create or replace function public.obs_unit_has_foundation_items(p_unit_key text)
returns boolean language sql stable parallel safe
set search_path to 'public' as $function$
  select exists (
    select 1
    from public.obs_learning_units u
    join public.obs_question_bank_with_units q
      on (q.unit_key = u.unit_key
          or (u.start_chapter = 1 and q.book_code = u.book_code
              and q.question_type = 'book_orientation_mcq_v1'))
    left join public.bible_events e on e.id = q.event_id
    where u.unit_key = p_unit_key
      and q.generated_question_id is not null
      and q.payload ? 'choices'
      and jsonb_typeof(q.payload->'choices') = 'array'
      and public.obs_focused_item_stage(q.question_type, q.payload,
            public.obs_effective_item_irt_b(q.payload, e.irt_b::double precision)) = 1
  );
$function$;

-- 3/5 Ladder: an unproven foundation stage reports as insufficient_evidence
-- rather than passing on redistributed weight alone.
create or replace function public.obs_get_ladder_state_v1(p_user_id uuid)
 returns table(unit_key text, sequence_order integer, section_key text,
   section_name text, book_code text, book_name text, label text,
   start_chapter integer, end_chapter integer, is_foundation boolean,
   answered integer, display_score integer, required_answers integer,
   required_score integer, state text, is_focus boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  with authorized as (select 1 where public.obs_is_authorized_user(p_user_id)),
  question_rows as (
    select u.unit_key, q.generated_question_id,
      public.obs_focused_item_stage(q.question_type, q.payload,
        public.obs_effective_item_irt_b(q.payload, e.irt_b::double precision)) as stage,
      greatest(1, coalesce(q.importance_conceptual, q.routing_score,
                           q.importance_context, 50))::numeric as weight
    from public.obs_learning_units u
    join authorized on true
    join public.obs_question_bank_with_units q
      on (q.unit_key = u.unit_key
          or (u.start_chapter = 1 and q.book_code = u.book_code
              and q.question_type = 'book_orientation_mcq_v1'))
    left join public.bible_events e on e.id = q.event_id
    where q.generated_question_id is not null
      and q.payload ? 'choices' and jsonb_typeof(q.payload->'choices') = 'array'
  ),
  latest as (
    select * from (
      select a.generated_question_id, a.is_correct,
        row_number() over (partition by a.generated_question_id
                           order by a.answered_at desc, a.id desc) as rk
      from public.assessment_answers a
      where a.user_id = p_user_id and a.scoring_eligible
    ) x where rk = 1
  ),
  stage_scores as (
    select qr.unit_key, qr.stage,
      count(l.generated_question_id)::int as answered,
      case when coalesce(sum(qr.weight) filter (where l.generated_question_id is not null), 0) = 0
        then null
        else sum(qr.weight) filter (where l.generated_question_id is not null and l.is_correct)
             / sum(qr.weight) filter (where l.generated_question_id is not null)
      end as accuracy
    from question_rows qr
    left join latest l on l.generated_question_id = qr.generated_question_id
    group by qr.unit_key, qr.stage
  ),
  scored as (
    select s.unit_key,
      coalesce(sum(s.answered), 0)::int as answered,
      (bool_or(s.stage = 1)
       and max(s.accuracy) filter (where s.stage = 1) is null) as foundation_unproven,
      case when coalesce(sum(s.answered), 0) = 0 then null
        else public.obs_display_score_from_raw(public.obs_focused_mastery_raw(
          max(s.accuracy) filter (where s.stage = 1),
          max(s.accuracy) filter (where s.stage = 2),
          max(s.accuracy) filter (where s.stage = 3),
          bool_or(s.stage = 1), bool_or(s.stage = 2), bool_or(s.stage = 3))) end as display_score
    from stage_scores s group by s.unit_key
  ),
  resolved as (
    select u.unit_key, u.sequence_order,
      bb.section_key, bb.section_name, u.book_code, bb.display_name as book_name,
      u.label, u.start_chapter, u.end_chapter, u.is_foundation,
      coalesce(sc.answered, 0) as answered, sc.display_score,
      u.min_answers_required, u.baseline_display_score_required,
      case
        when coalesce(sc.answered, 0) < u.min_answers_required then 'insufficient_evidence'
        when coalesce(sc.foundation_unproven, false) then 'insufficient_evidence'
        when coalesce(sc.display_score, 0) >= u.baseline_display_score_required then 'sufficient'
        else 'below_baseline'
      end as state
    from public.obs_learning_units u
    join authorized on true
    join public.obs_biblical_books bb on bb.book_code = u.book_code
    left join scored sc on sc.unit_key = u.unit_key
  )
  select r.unit_key, r.sequence_order, r.section_key, r.section_name,
         r.book_code, r.book_name, r.label, r.start_chapter, r.end_chapter,
         r.is_foundation, r.answered, r.display_score,
         r.min_answers_required, r.baseline_display_score_required, r.state,
         (r.sequence_order = (
            select min(r2.sequence_order) from resolved r2 where r2.state <> 'sufficient'
         )) as is_focus
  from resolved r order by r.sequence_order;
$function$;

-- 4/5 Recommender: same guard, plus suppress the dimension pivot when the
-- foundation is unproven so the UI explains the real gap.
create or replace function public.obs_get_user_recommendation_v2(p_user_id uuid)
 returns table(unit_key text, label text, section text, book_code text,
   start_chapter integer, end_chapter integer, sequence_order integer,
   is_foundation boolean, answered integer, correct integer, raw_score numeric,
   display_score integer, baseline_display_score_required integer,
   retest_question_target integer, focus_text text, reason text,
   recommendation_kind text, dimension_key text, dimension_label text,
   dimension_short_label text, dimension_answered integer,
   dimension_correct integer, dimension_display_score integer,
   dimension_available_questions integer, dimension_focus_text text)
 language sql security definer set search_path to 'public'
as $function$
  with authorized as (select 1 where public.obs_is_authorized_user(p_user_id)),
  scored_units as (
    select unit.*, mastery.answered, mastery.correct, mastery.raw_score,
      mastery.display_score, mastery.highest_stage_attempted,
      (public.obs_unit_has_foundation_items(unit.unit_key)
       and coalesce(mastery.foundation_answered, 0) = 0) as foundation_unproven
    from public.obs_learning_units unit
    join authorized on true
    cross join lateral public.obs_get_unit_mastery_score(p_user_id, unit.unit_key, null) mastery
  ),
  foundation_gap as (
    select scored.*,
      case
        when scored.foundation_unproven
          then 'Foundation questions for this unit have not been answered yet'
        when answered < min_answers_required
          then 'Universal biblical-history foundation needs more evidence'
        else 'Universal biblical-history foundation is below baseline'
      end as unit_reason
    from scored_units scored
    where is_foundation
      and (answered < min_answers_required or scored.foundation_unproven
           or coalesce(display_score, 0) < baseline_display_score_required)
    order by sequence_order limit 1
  ),
  dependency_unit_keys as (
    select distinct prerequisite_unit_key as unit_key
    from public.obs_prophetic_recommendation_dependencies
  ),
  later_gap as (
    select scored.*,
      case
        when scored.foundation_unproven
          then 'Foundation questions for this unit have not been answered yet'
        when answered < min_answers_required
          then 'Later unit needs more ladder evidence'
        else 'Lowest post-foundation mastery score'
      end as unit_reason
    from scored_units scored
    where not is_foundation
      and not exists (select 1 from dependency_unit_keys dependency
                      where dependency.unit_key = scored.unit_key)
      and (answered < min_answers_required or scored.foundation_unproven
           or coalesce(display_score, 0) < baseline_display_score_required)
    order by
      case when answered < min_answers_required or scored.foundation_unproven then 0 else 1 end,
      coalesce(display_score, 0), sequence_order
    limit 1
  ),
  dependency_gap as (
    select prerequisite.*,
      'Historical context needed before ' || target.label as unit_reason
    from later_gap target
    join public.obs_prophetic_recommendation_dependencies dependency
      on dependency.target_book_code = target.book_code
    join scored_units prerequisite
      on prerequisite.unit_key = dependency.prerequisite_unit_key
    where prerequisite.answered < prerequisite.min_answers_required
       or prerequisite.foundation_unproven
       or coalesce(prerequisite.display_score, 0) < prerequisite.baseline_display_score_required
    order by dependency.priority, prerequisite.sequence_order limit 1
  ),
  standalone_dependency_gap as (
    select scored.*,
      case
        when scored.foundation_unproven
          then 'Foundation questions for this unit have not been answered yet'
        when answered < min_answers_required
          then 'Historical context unit needs more evidence'
        else 'Historical context unit is below baseline'
      end as unit_reason
    from scored_units scored
    join dependency_unit_keys dependency on dependency.unit_key = scored.unit_key
    where answered < min_answers_required or scored.foundation_unproven
       or coalesce(display_score, 0) < baseline_display_score_required
    order by
      case when answered < min_answers_required or scored.foundation_unproven then 0 else 1 end,
      coalesce(display_score, 0), sequence_order
    limit 1
  ),
  selected as (
    select * from foundation_gap
    union all select * from dependency_gap where not exists (select 1 from foundation_gap)
    union all select * from later_gap
      where not exists (select 1 from foundation_gap)
        and not exists (select 1 from dependency_gap)
    union all select * from standalone_dependency_gap
      where not exists (select 1 from foundation_gap)
        and not exists (select 1 from dependency_gap)
        and not exists (select 1 from later_gap)
    limit 1
  ),
  available_dimensions as (
    select selected.unit_key, selected.baseline_display_score_required,
      dimension.dimension_key, dimension.label as dimension_label,
      dimension.short_label as dimension_short_label,
      dimension.description as dimension_focus_text, dimension.sort_order,
      count(distinct coalesce(nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text))::integer as available_questions
    from selected
    join public.obs_question_bank_with_units question
      on question.unit_key = selected.unit_key
      or (selected.start_chapter = 1 and question.book_code = selected.book_code
          and question.question_type = 'book_orientation_mcq_v1')
    join public.obs_bli_dimensions dimension
      on dimension.dimension_key = question.dimension_key and not dimension.is_advanced
    -- A unit whose foundation stage has no evidence must not pivot to a
    -- dimension drill. Leaving dimension_key null keeps recommendation_kind
    -- 'UNIT' so the foundation-gap reason reaches the UI instead of being
    -- overwritten by 'Weakest supported dimension...'. No-op when proven.
    where not selected.foundation_unproven
    group by selected.unit_key, selected.baseline_display_score_required,
      dimension.dimension_key, dimension.label, dimension.short_label,
      dimension.description, dimension.sort_order
  ),
  scored_dimensions as (
    select available.*, mastery.answered, mastery.correct, mastery.display_score
    from available_dimensions available
    cross join lateral public.obs_get_unit_mastery_score(
      p_user_id, available.unit_key, available.dimension_key) mastery
  ),
  selected_dimension as (
    select dimension.* from scored_dimensions dimension
    where dimension.available_questions >= 8 and dimension.answered >= 3
      and coalesce(dimension.display_score, 800) < dimension.baseline_display_score_required
    order by dimension.display_score, dimension.answered desc, dimension.sort_order
    limit 1
  )
  select selected.unit_key, selected.label, selected.section, selected.book_code,
    selected.start_chapter, selected.end_chapter, selected.sequence_order,
    selected.is_foundation, selected.answered, selected.correct, selected.raw_score,
    selected.display_score, selected.baseline_display_score_required,
    case when dimension.dimension_key is null then selected.retest_question_target
         else least(selected.retest_question_target, dimension.available_questions) end,
    selected.focus_text,
    case when dimension.dimension_key is null then selected.unit_reason
         else 'Weakest supported dimension inside the selected learning unit' end,
    case when dimension.dimension_key is null then 'UNIT' else 'DIMENSION' end,
    dimension.dimension_key, dimension.dimension_label, dimension.dimension_short_label,
    dimension.answered, dimension.correct, dimension.display_score,
    dimension.available_questions, dimension.dimension_focus_text
  from selected
  left join selected_dimension dimension on dimension.unit_key = selected.unit_key;
$function$;

-- 5/5 Focus path: leaves had NO minimum-evidence floor (units require 3
-- answers, leaves required none), so a 2-answer sample scoring 0 outranked a
-- 9-answer section scoring 492. Below the floor, sort in the unproven bucket.
create or replace function public.obs_get_current_focus_path(p_user_id uuid)
 returns table(level text, depth integer, node_id uuid, node_key text, label text,
   book_code text, rank integer, is_focus boolean, answered integer,
   display_score integer, state text, reference text, start_ch integer,
   start_vs integer, end_ch integer, end_vs integer, focus_mode text,
   book_probes_answered integer, book_probes_correct integer)
 language sql stable security definer set search_path to 'public'
as $function$
  with ladder as (select l.* from public.obs_get_ladder_state_v1(p_user_id) l),
  focus_unit as (select * from ladder where is_focus limit 1),
  section_state as (
    select l.section_key, l.section_name, min(l.sequence_order) as section_order,
           sum(l.answered)::int as answered,
           bool_and(l.state = 'sufficient') as all_sufficient,
           (array_agg(l.state order by case when l.state='sufficient' then 1 else 0 end,
                                        l.sequence_order))[1] as first_gap_state
    from ladder l group by l.section_key, l.section_name
  ),
  book_state as (
    select l.section_key, l.book_code, l.book_name, min(l.sequence_order) as book_order,
           sum(l.answered)::int as answered,
           bool_and(l.state = 'sufficient') as all_sufficient,
           (array_agg(l.state order by case when l.state='sufficient' then 1 else 0 end,
                                        l.sequence_order))[1] as first_gap_state
    from ladder l group by l.section_key, l.book_code, l.book_name
  ),
  probe_answers as (
    select q.generated_question_id, a.is_correct,
      row_number() over (partition by q.generated_question_id
                         order by a.answered_at desc, a.id desc) as rk
    from focus_unit fu
    join public.v_question_bank q on q.book_code = fu.book_code and q.event_id is null
    join public.assessment_answers a on a.generated_question_id = q.generated_question_id
    where a.user_id = p_user_id and a.scoring_eligible
      and q.question_type in ('book_orientation_mcq_v1','geography_book_mcq_v1',
        'foundation_mcq_v1','minimum_coverage_mcq_v1','critical_coverage_mcq_v1')
  ),
  gate as (
    select count(*)::int as probes, count(*) filter (where is_correct)::int as probes_correct
    from probe_answers where rk = 1
  ),
  mode as (
    select case when g.probes >= 2 and g.probes_correct = 0
                then 'whole_book' else 'section_drilldown' end as focus_mode,
           g.probes, g.probes_correct
    from gate g
  ),
  lvl1 as (
    select 'testament_section'::text, 1, null::uuid, s.section_key, s.section_name, null::text,
      row_number() over (order by s.section_order)::int,
      (s.section_key = (select section_key from focus_unit)),
      s.answered, null::int,
      case when s.all_sufficient then 'sufficient' else s.first_gap_state end,
      null::text, null::int, null::int, null::int, null::int,
      m.focus_mode, m.probes, m.probes_correct
    from section_state s cross join mode m
  ),
  lvl2 as (
    select 'book'::text, 2, null::uuid, b.book_code, b.book_name, b.book_code,
      row_number() over (order by b.book_order)::int,
      (b.book_code = (select book_code from focus_unit)),
      b.answered, null::int,
      case when b.all_sufficient then 'sufficient' else b.first_gap_state end,
      null::text, null::int, null::int, null::int, null::int,
      m.focus_mode, m.probes, m.probes_correct
    from book_state b
    join focus_unit fu on fu.section_key = b.section_key
    cross join mode m
  ),
  outline_leaves as (
    select n.id, n.slug as node_key, n.title as label, n.book_code,
           n.start_ch, n.start_vs, n.end_ch, n.end_vs, n.importance_score,
           fu.book_name, m.answered, m.display_score
    from focus_unit fu
    join public.outline_nodes n
      on n.book_code = fu.book_code and n.node_kind = 'section'
     and not exists (
       select 1 from public.outline_nodes c
       where c.book_code = n.book_code and c.node_kind = 'section' and c.id <> n.id
         and (c.start_ch * 1000 + c.start_vs) >= (n.start_ch * 1000 + n.start_vs)
         and (c.end_ch * 1000 + c.end_vs) <= (n.end_ch * 1000 + n.end_vs))
    cross join lateral public.obs_get_outline_node_mastery_score(p_user_id, n.id) m
  ),
  unit_leaves as (
    select null::uuid as id, l.unit_key as node_key, l.label, l.book_code,
           l.start_chapter as start_ch, 1 as start_vs, l.end_chapter as end_ch,
           999 as end_vs, null::numeric as importance_score,
           l.book_name, l.answered, l.display_score
    from ladder l
    join focus_unit fu on fu.book_code = l.book_code
    where not exists (select 1 from outline_leaves)
  ),
  leaves as (select * from outline_leaves union all select * from unit_leaves),
  ranked_leaves as (
    select v.*, md.focus_mode, md.probes, md.probes_correct,
      row_number() over (
        order by
          case when md.focus_mode = 'whole_book' then v.start_ch end asc nulls last,
          case when md.focus_mode = 'whole_book' then v.start_vs end asc nulls last,
          -- fewer than 3 answers is unproven, not weak: same neutral bucket as
          -- a leaf with no evidence at all
          coalesce(case when v.answered >= 3 then v.display_score end, 400) asc,
          v.importance_score desc nulls last,
          v.start_ch, v.start_vs
      )::int as rank
    from leaves v cross join mode md
  ),
  lvl3 as (
    select 'book_section'::text, 3, r.id, r.node_key, r.label, r.book_code,
      r.rank, (r.rank = 1), r.answered, r.display_score,
      case when r.answered = 0 then 'insufficient_evidence'
           when coalesce(r.display_score,0) >= 513 then 'sufficient'
           else 'below_baseline' end,
      r.book_name || ' ' || r.start_ch || ':' || r.start_vs
        || '-' || r.end_ch || ':' || r.end_vs,
      r.start_ch, r.start_vs, r.end_ch, r.end_vs,
      r.focus_mode, r.probes, r.probes_correct
    from ranked_leaves r
  )
  select * from lvl1 union all select * from lvl2 union all select * from lvl3
  order by 2, 7;
$function$;

commit;
