-- Verifies NT submit persists the same attempt counters it returns.
-- Writes are rolled back; no synthetic user, attempt, or answer is retained.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $definition$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_submit_nt_assessment_answer(uuid,uuid,text)'::regprocedure
  );

  if v_definition not like '%answered_count = v_answered,%'
     or v_definition not like '%correct_count = v_correct,%'
     or v_definition not like '%is_complete = v_answered >= v_attempt.target_count,%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT submit function is not persisting attempt summary counters.';
  end if;
end
$definition$;

create temporary table obs_nt_summary_sync_verify (
  user_id uuid not null,
  attempt_id uuid,
  generated_question_id uuid,
  answer_choice_id text,
  submit_payload jsonb,
  persisted_answered_count integer,
  persisted_correct_count integer,
  persisted_is_complete boolean
) on commit drop;

insert into obs_nt_summary_sync_verify (user_id)
values (gen_random_uuid());

insert into auth.users (
  id,
  aud,
  role,
  is_anonymous,
  created_at,
  updated_at
)
select
  state.user_id,
  'authenticated',
  'authenticated',
  true,
  now(),
  now()
from obs_nt_summary_sync_verify state;

grant all on table obs_nt_summary_sync_verify to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from obs_nt_summary_sync_verify),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

set local role authenticated;

with started as (
  select to_jsonb(start_row) as payload
  from public.obs_start_nt_assessment(null, null, 5) start_row
)
update obs_nt_summary_sync_verify state
set attempt_id = (started.payload->>'attempt_id')::uuid
from started;

with served as (
  select to_jsonb(question_row) as payload
  from public.obs_get_next_nt_assessment_question(
    (select attempt_id from obs_nt_summary_sync_verify)
  ) question_row
), selected_choice as (
  select
    (served.payload->>'out_generated_question_id')::uuid
      as generated_question_id,
    choice->>'id' as answer_choice_id
  from served
  cross join lateral jsonb_array_elements(served.payload->'choices') choice
  order by choice->>'id'
  limit 1
)
update obs_nt_summary_sync_verify state
set
  generated_question_id = selected_choice.generated_question_id,
  answer_choice_id = selected_choice.answer_choice_id
from selected_choice;

with submitted as (
  select to_jsonb(submit_row) as payload
  from public.obs_submit_nt_assessment_answer(
    (select attempt_id from obs_nt_summary_sync_verify),
    (select generated_question_id from obs_nt_summary_sync_verify),
    (select answer_choice_id from obs_nt_summary_sync_verify)
  ) submit_row
)
update obs_nt_summary_sync_verify state
set submit_payload = submitted.payload
from submitted;

reset role;

update obs_nt_summary_sync_verify state
set
  persisted_answered_count = attempt.answered_count,
  persisted_correct_count = attempt.correct_count,
  persisted_is_complete = attempt.is_complete
from public.assessment_attempts attempt
where attempt.id = state.attempt_id;

do $assertion$
declare
  state obs_nt_summary_sync_verify%rowtype;
begin
  select * into strict state from obs_nt_summary_sync_verify;

  if state.attempt_id is null
     or state.generated_question_id is null
     or state.answer_choice_id is null
     or state.submit_payload is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT summary-sync verify did not reach submit.';
  end if;

  if state.persisted_answered_count
       is distinct from (state.submit_payload->>'answered_count')::integer
     or state.persisted_correct_count
       is distinct from (state.submit_payload->>'correct_count')::integer
     or state.persisted_is_complete
       is distinct from (state.submit_payload->>'target_reached')::boolean
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT persisted attempt counters do not match submit result.';
  end if;
end
$assertion$;

rollback;
