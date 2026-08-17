-- Probe weak OT sections instead of treating equal section counts as sufficient.
--
-- A 20-question baseline can look balanced while still missing the learner's
-- largest weak spot. If a section has a miss/skip, the fast selector should
-- spend a follow-up question there. Latter Prophets also needs a slightly
-- larger opening floor because it is a large, varied part of the OT.

begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  );

  if v_definition not like '%answer.scoring_eligible,%answer.answered_at,%' then
    raise exception 'Unexpected fast selector definition; answered select anchor not found.';
  end if;

  if v_definition not like '%section_counts as (%' then
    raise exception 'Unexpected fast selector definition; section_counts anchor not found.';
  end if;

  if v_definition not like '%left join section_counts%' then
    raise exception 'Unexpected fast selector definition; section_counts join anchor not found.';
  end if;

  if v_definition not like '%candidate.section_answered,%candidate.dimension_answered,%' then
    raise exception 'Unexpected fast selector definition; order anchor not found.';
  end if;

  v_definition := replace(
    v_definition,
    E'      answer.scoring_eligible,\n      answer.answered_at,',
    E'      answer.scoring_eligible,\n      answer.is_correct,\n      answer.is_idk,\n      answer.answered_at,'
  );

  v_definition := replace(
    v_definition,
    E'  dimension_counts as (',
    E'  section_quality as (\n    select\n      public.canonical_assessment_scope(book_code) as section_key,\n      count(*) filter (\n        where scoring_eligible\n          and (coalesce(is_idk, false) or not coalesce(is_correct, false))\n      )::integer as missed,\n      count(*) filter (\n        where scoring_eligible\n          and question_family <> ''book_orientation''\n      )::integer as non_book_orientation_answered\n    from answered\n    where book_code is not null\n    group by public.canonical_assessment_scope(book_code)\n  ),\n  dimension_counts as ('
  );

  v_definition := replace(
    v_definition,
    E'      coalesce(section_counts.answered, 0) as section_answered,\n      coalesce(dimension_counts.answered, 0) as dimension_answered,',
    E'      coalesce(section_counts.answered, 0) as section_answered,\n      coalesce(section_quality.missed, 0) as section_missed,\n      coalesce(section_quality.non_book_orientation_answered, 0) as section_non_book_orientation_answered,\n      coalesce(dimension_counts.answered, 0) as dimension_answered,'
  );

  v_definition := replace(
    v_definition,
    E'    left join section_counts\n      on section_counts.section_key = public.canonical_assessment_scope(question.book_code)\n    left join dimension_counts',
    E'    left join section_counts\n      on section_counts.section_key = public.canonical_assessment_scope(question.book_code)\n    left join section_quality\n      on section_quality.section_key = public.canonical_assessment_scope(question.book_code)\n    left join dimension_counts'
  );

  v_definition := replace(
    v_definition,
    E'    case\n      when candidate.is_division_taxonomy then 3',
    E'    case\n      when stats.scored_answered >= 12\n        and candidate.section_missed > 0\n        and candidate.section_answered < case when candidate.section_key = ''LATTER'' then 7 else 6 end\n        then 0\n      when stats.scored_answered >= 8\n        and candidate.section_key = ''LATTER''\n        and candidate.section_answered < 6\n        then 1\n      else 2\n    end,\n    case\n      when candidate.is_division_taxonomy then 3'
  );

  v_definition := replace(
    v_definition,
    E'    candidate.section_answered,\n    candidate.dimension_answered,',
    E'    greatest(\n      0,\n      candidate.section_answered - case when candidate.section_key = ''LATTER'' then 6 else 5 end\n    ),\n    candidate.section_answered,\n    candidate.dimension_answered,'
  );

  execute v_definition;
end
$$;

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast OT baseline selector with retake novelty, division-taxonomy demotion, book-orientation cap, weak-section follow-up, and a larger Latter Prophets probe floor.';

notify pgrst, 'reload schema';

commit;
