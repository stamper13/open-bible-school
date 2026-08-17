-- Exercises the exact NT RPCs used by the frontend as an authenticated role.
-- All writes are rolled back; no assessment or answer is retained.

begin;

create temporary table obs_e2e_nt_state (
  user_id uuid not null,
  attempt_id uuid,
  generated_question_id uuid,
  displayed_choices jsonb,
  served_payload jsonb,
  first_submit_payload jsonb,
  retry_submit_payload jsonb,
  status_payload jsonb,
  summary_payload jsonb,
  review_count integer,
  review_is_idk boolean
) on commit drop;

insert into obs_e2e_nt_state (user_id)
select auth_user.id
from auth.users auth_user
where not coalesce(auth_user.is_anonymous, false)
  and auth_user.deleted_at is null
order by auth_user.created_at
limit 1;

do $$
begin
  if not exists (select 1 from obs_e2e_nt_state) then
    raise exception using
      errcode = 'P0001',
      message = 'Authenticated NT lifecycle test requires one registered user';
  end if;
end;
$$;

grant all on table obs_e2e_nt_state to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from obs_e2e_nt_state),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

set local role authenticated;

with started as (
  select to_jsonb(start_row) as payload
  from public.obs_start_nt_assessment(null, null, 5) start_row
)
update obs_e2e_nt_state state
set attempt_id = (started.payload->>'attempt_id')::uuid
from started;

with served as (
  select to_jsonb(question_row) as payload
  from public.obs_get_next_nt_assessment_question(
    (select attempt_id from obs_e2e_nt_state)
  ) question_row
)
update obs_e2e_nt_state state
set
  generated_question_id =
    (served.payload->>'out_generated_question_id')::uuid,
  displayed_choices = served.payload->'choices',
  served_payload = served.payload
from served;

with submitted as (
  select to_jsonb(submit_row) as payload
  from public.obs_submit_nt_assessment_answer(
    (select attempt_id from obs_e2e_nt_state),
    (select generated_question_id from obs_e2e_nt_state),
    '__IDK__'
  ) submit_row
)
update obs_e2e_nt_state state
set first_submit_payload = submitted.payload
from submitted;

with retried as (
  select to_jsonb(submit_row) as payload
  from public.obs_submit_nt_assessment_answer(
    (select attempt_id from obs_e2e_nt_state),
    (select generated_question_id from obs_e2e_nt_state),
    '__IDK__'
  ) submit_row
)
update obs_e2e_nt_state state
set retry_submit_payload = retried.payload
from retried;

with status as (
  select to_jsonb(status_row) as payload
  from public.obs_get_nt_assessment_status(
    (select attempt_id from obs_e2e_nt_state)
  ) status_row
)
update obs_e2e_nt_state state
set status_payload = status.payload
from status;

update obs_e2e_nt_state state
set summary_payload = public.obs_get_attempt_summary(
  state.user_id,
  state.attempt_id
);

with review as (
  select
    count(*)::integer as answer_count,
    bool_and(review_row.is_idk) as all_idk
  from public.obs_get_attempt_review(
    (select user_id from obs_e2e_nt_state),
    (select attempt_id from obs_e2e_nt_state)
  ) review_row
)
update obs_e2e_nt_state state
set
  review_count = review.answer_count,
  review_is_idk = review.all_idk
from review;

do $$
declare
  state obs_e2e_nt_state%rowtype;
  v_answer_count integer;
begin
  select * into state from obs_e2e_nt_state;

  select count(*)::integer
  into v_answer_count
  from public.assessment_answers answer
  where answer.attempt_id = state.attempt_id
    and answer.generated_question_id = state.generated_question_id
    and answer.user_id = state.user_id;

  if state.attempt_id is null
    or state.generated_question_id is null
    or jsonb_typeof(state.displayed_choices) is distinct from 'array'
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT lifecycle failed before a usable question was served';
  end if;

  if state.served_payload ? 'correct_choice_id'
    or state.served_payload ? 'correct_answer'
    or exists (
      select 1
      from jsonb_array_elements(state.displayed_choices) choice
      where choice ? 'correct'
        or choice ? 'is_correct'
        or choice ? 'correct_choice_id'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT served question exposed answer-key metadata';
  end if;

  if state.first_submit_payload is distinct from state.retry_submit_payload
    or v_answer_count <> 1
    or coalesce(
      (state.first_submit_payload->>'is_idk')::boolean,
      false
    ) is not true
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT submission retry was not idempotent';
  end if;

  if coalesce((state.status_payload->>'answered_count')::integer, 0) <> 1
    or coalesce((state.status_payload->>'idk_count')::integer, 0) <> 1
    or coalesce((state.summary_payload->>'answered')::integer, 0) <> 1
    or coalesce((state.summary_payload->>'idk')::integer, 0) <> 1
    or state.review_count <> 1
    or state.review_is_idk is not true
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT status, summary, or review did not reproduce the response';
  end if;
end;
$$;

reset role;
rollback;

select
  'PASS: authenticated NT start, serve, retry-safe submit, status, summary, and review succeeded; writes rolled back.'
  as result;
