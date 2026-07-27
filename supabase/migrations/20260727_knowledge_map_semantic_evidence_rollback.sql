begin;

drop function if exists public.obs_get_user_knowledge_evidence(uuid);

notify pgrst, 'reload schema';

commit;
