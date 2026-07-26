-- Operational rollback for 20260725_public_question_metadata_and_rpc_hardening.
-- Running this reopens the legacy question-bank surfaces and should only be
-- used to recover from an application outage while a safer correction is made.

begin;

drop view if exists public.obs_public_question_metadata;

drop function if exists public.compute_bli(uuid);

do $$
begin
  if to_regprocedure('public.obs_compute_bli_internal(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'obs_compute_bli_internal(uuid) is missing; compute_bli cannot be restored.';
  end if;

  alter function public.obs_compute_bli_internal(uuid)
    rename to compute_bli;
end
$$;

grant execute on function public.compute_bli(uuid)
  to public, anon, authenticated, service_role;
grant execute on function public.update_theta_internal(uuid, text, uuid, boolean)
  to public, anon, authenticated, service_role;

grant select on table public.ot_generated_questions
  to anon, authenticated, service_role;
grant select on table public.v_question_bank
  to anon, authenticated, service_role;
grant select on table public.obs_question_bank_with_dimensions
  to anon, authenticated, service_role;
grant select on table public.obs_question_bank_with_units
  to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.v_nt_question_bank') is not null then
    execute
      'grant select on table public.v_nt_question_bank to anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.nt_get_pilot_questions(text,text,integer)') is not null then
    execute
      'grant execute on function public.nt_get_pilot_questions(text,text,integer) to anon, authenticated';
  end if;

  if to_regprocedure('public.nt_submit_pilot_answer(uuid,text)') is not null then
    execute
      'grant execute on function public.nt_submit_pilot_answer(uuid,text) to anon, authenticated';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
