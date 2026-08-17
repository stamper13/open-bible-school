begin;

grant execute on function public.request_custom_exam(text)
  to anon, authenticated;
grant execute on function public.mark_exam_generated(uuid)
  to anon, authenticated;
grant execute on function public.submit_exam_results(uuid, jsonb)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
