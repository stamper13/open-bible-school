begin;

-- These legacy credential helpers are not used by the current frontend.
-- select_exam_questions returns correct_choice_id values, while
-- generate_full_exam exposes its result and creates credential exam rows.
revoke all on function public.select_exam_questions(text, uuid)
  from public, anon, authenticated;
revoke all on function public.generate_full_exam()
  from public, anon, authenticated;

-- This legacy profile helper accepts an arbitrary user UUID and has no
-- ownership check. Modern profile RPCs use obs_is_authorized_user instead.
revoke all on function public.get_user_section_scores(uuid)
  from public, anon, authenticated;

grant execute on function public.select_exam_questions(text, uuid)
  to service_role;
grant execute on function public.generate_full_exam()
  to service_role;
grant execute on function public.get_user_section_scores(uuid)
  to service_role;

commit;
