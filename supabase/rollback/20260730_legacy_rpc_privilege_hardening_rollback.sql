begin;

grant execute on function public.select_exam_questions(text, uuid)
  to public, anon, authenticated;
grant execute on function public.generate_full_exam()
  to public, anon, authenticated;
grant execute on function public.get_user_section_scores(uuid)
  to public, anon, authenticated;

commit;
