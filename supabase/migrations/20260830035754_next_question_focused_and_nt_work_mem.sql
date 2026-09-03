-- Extend the next-question work_mem fix to the focused OT and NT loaders.
-- These app-facing RPCs can also be reached from mobile assessment flows, so
-- keep their sort/hash memory in line with the main OT router.

begin;

alter function public.obs_get_next_focused_question_v2(uuid, uuid, text, text, integer, integer, text)
  set work_mem = '16MB';

alter function public.obs_get_next_nt_assessment_question(uuid)
  set work_mem = '16MB';

notify pgrst, 'reload schema';

commit;
