-- The fast OT selector depends on freshly inserted assessment_answers rows.
-- Mark it volatile so repeated calls inside a transaction or server-side test
-- harness see the current answer state instead of a stable statement snapshot.

begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  );

  if v_definition not like '%LANGUAGE sql%STABLE%' then
    raise exception 'Unexpected fast selector definition; stable SQL anchor not found.';
  end if;

  v_definition := replace(v_definition, E'LANGUAGE sql\nSTABLE', E'LANGUAGE sql\nVOLATILE');
  execute v_definition;
end
$$;

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast OT baseline selector with retake novelty, division-taxonomy demotion, a book-orientation cap, and fresh answer visibility.';

notify pgrst, 'reload schema';

commit;
