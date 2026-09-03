-- Reduce production next-question timeouts caused by router sorts spilling under
-- the API role's small default work_mem. Keep the change scoped to the question
-- selection functions rather than raising the authenticated role timeout.

begin;

alter function public.obs_get_next_ot_assessment_question(uuid)
  set work_mem = '16MB';

alter function public.get_next_assessment_question(uuid, uuid)
  set work_mem = '16MB';

alter function public.get_next_scoped_assessment_question(uuid, uuid)
  set work_mem = '16MB';

alter function public.obs_get_next_ot_baseline_question_fast(uuid, uuid)
  set work_mem = '16MB';

alter function public.obs_rank_ot_assessment_candidates_v4(uuid, uuid, text, integer, timestamp with time zone, integer)
  set work_mem = '16MB';

alter function public.obs_rank_ot_assessment_candidates_v5(uuid, uuid, text, integer, timestamp with time zone, integer)
  set work_mem = '16MB';

alter function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamp with time zone, integer)
  set work_mem = '16MB';

alter function public.obs_rank_ot_assessment_candidates_v7(uuid, uuid, text, integer, timestamp with time zone, integer)
  set work_mem = '16MB';

notify pgrst, 'reload schema';

commit;
