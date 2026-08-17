-- Cap book-orientation dominance in the initial OT baseline selector.
--
-- Book descriptions are useful, but a baseline should mix book identity with
-- chronology, section structure, geography, significance, and other text
-- competency probes. This updates the fast selector in place by adding a
-- current-attempt book-orientation count and filtering additional
-- book-orientation candidates once the session already has enough of them.

begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  );

  if v_definition not like '%division_taxonomy_answered%' then
    raise exception 'Unexpected fast selector definition; division taxonomy stats anchor not found.';
  end if;

  if v_definition not like '%from candidates candidate%cross join stats%where (%' then
    raise exception 'Unexpected fast selector definition; final filter anchor not found.';
  end if;

  v_definition := replace(
    v_definition,
    E'      )::integer as division_taxonomy_answered\n    from answered',
    E'      )::integer as division_taxonomy_answered,\n      count(*) filter (\n        where scoring_eligible\n          and question_family = ''book_orientation''\n      )::integer as book_orientation_answered\n    from answered'
  );

  v_definition := replace(
    v_definition,
    E'  where (\n    not candidate.is_division_taxonomy\n    or (\n      stats.scored_answered >= 16\n      and stats.division_taxonomy_answered = 0\n    )\n  )\n  order by',
    E'  where (\n    not candidate.is_division_taxonomy\n    or (\n      stats.scored_answered >= 16\n      and stats.division_taxonomy_answered = 0\n    )\n  )\n  and (\n    candidate.question_family <> ''book_orientation''\n    or stats.scored_answered < 4\n    or stats.book_orientation_answered < 7\n  )\n  order by'
  );

  execute v_definition;
end
$$;

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast OT baseline selector with retake novelty, division-taxonomy demotion, and a book-orientation cap.';

notify pgrst, 'reload schema';

commit;
