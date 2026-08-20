begin;

drop function if exists public.obs_submit_ot_assessment_response(uuid, uuid, text);
drop function if exists public.submit_assessment_answer_v1(uuid, uuid, uuid, text);
drop function if exists public.submit_assessment_answer_v2(uuid, uuid, uuid, text);

notify pgrst, 'reload schema';

commit;
