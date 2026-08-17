begin;

alter view public.v_ot_generated_questions_health
  set (security_invoker = true);
alter view public.v_obs_answer_position_balance
  set (security_invoker = true);

revoke all on table public.v_ot_generated_questions_health
  from public, anon, authenticated;
revoke all on table public.v_obs_answer_position_balance
  from public, anon, authenticated;

grant select on table public.v_ot_generated_questions_health
  to service_role;
grant select on table public.v_obs_answer_position_balance
  to service_role;

comment on view public.v_ot_generated_questions_health is
  'Internal question-bank health view. Contains answer-key diagnostics and is service-role only.';
comment on view public.v_obs_answer_position_balance is
  'Internal answer-position balance audit view. Service-role only.';

commit;
