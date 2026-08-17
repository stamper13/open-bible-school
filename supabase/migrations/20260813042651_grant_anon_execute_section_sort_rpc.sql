grant execute on function public.obs_submit_section_sort_answers(
  uuid, uuid, jsonb
) to anon;

notify pgrst, 'reload schema';
