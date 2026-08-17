begin;

alter view public.v_ot_generated_questions_health
  reset (security_invoker);
alter view public.v_obs_answer_position_balance
  reset (security_invoker);

grant select on table public.v_ot_generated_questions_health
  to public, anon, authenticated;
grant select on table public.v_obs_answer_position_balance
  to public, anon, authenticated;

commit;
