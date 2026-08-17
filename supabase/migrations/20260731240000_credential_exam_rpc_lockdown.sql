-- Disable the dormant credential-exam mutation surface for browser clients.
-- submit_exam_results trusts caller-supplied totals and must not produce a
-- verified score until the server independently grades immutable responses.

begin;

revoke all on function public.request_custom_exam(text)
  from public, anon, authenticated;
revoke all on function public.mark_exam_generated(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_exam_results(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.request_custom_exam(text)
  to service_role;
grant execute on function public.mark_exam_generated(uuid)
  to service_role;
grant execute on function public.submit_exam_results(uuid, jsonb)
  to service_role;

comment on function public.submit_exam_results(uuid, jsonb) is
  'Legacy credential result writer. Service-role only until results are graded server-side from immutable delivered questions and responses.';

notify pgrst, 'reload schema';

commit;
