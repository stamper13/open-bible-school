-- Exercises the exact OT RPCs used by the frontend as an authenticated role.
-- All writes are rolled back; no assessment or answer is retained.

begin;

create temporary table obs_e2e_ot_state (
  user_id uuid not null,
  attempt_id uuid,
  generated_question_id uuid,
  displayed_choices jsonb,
  served_payload jsonb,
  submit_payload jsonb,
  summary_payload jsonb,
  review_count integer,
  review_is_idk boolean
) on commit drop;

insert into obs_e2e_ot_state (user_id)
select auth_user.id
from auth.users auth_user
where not coalesce(auth_user.is_anonymous, false)
  and auth_user.deleted_at is null
order by auth_user.created_at
limit 1;

do $$
begin
  if not exists (select 1 from obs_e2e_ot_state) then
    raise exception using
      errcode = 'P0001',
      message = 'Authenticated lifecycle test requires one registered user';
  end if;
end;
$$;

grant all on table obs_e2e_ot_state to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from obs_e2e_ot_state),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

set local role authenticated;

with started as (
  select to_jsonb(start_row) as payload
  from public.obs_start_or_resume_ot_assessment_v2(
    null,
    null,
    null,
    null,
    2,
    true,
    null
  ) start_row
)
update obs_e2e_ot_state state
set attempt_id = (started.payload->>'attempt_id')::uuid
from started;

with served as (
  select to_jsonb(question_row) as payload
  from public.obs_get_next_ot_assessment_question(
    (select attempt_id from obs_e2e_ot_state)
  ) question_row
)
update obs_e2e_ot_state state
set
  generated_question_id =
    (served.payload->>'out_generated_question_id')::uuid,
  displayed_choices = served.payload->'choices',
  served_payload = served.payload
from served;

with submitted as (
  select to_jsonb(submit_row) as payload
  from public.obs_submit_ot_assessment_response_v2(
    (select attempt_id from obs_e2e_ot_state),
    (select generated_question_id from obs_e2e_ot_state),
    '__IDK__',
    null,
    (select displayed_choices from obs_e2e_ot_state)
  ) submit_row
)
update obs_e2e_ot_state state
set submit_payload = submitted.payload
from submitted;

update obs_e2e_ot_state state
set summary_payload = public.obs_get_attempt_summary(
  state.user_id,
  state.attempt_id
);

with review as (
  select
    count(*)::integer as answer_count,
    bool_and(review_row.is_idk) as all_idk
  from public.obs_get_attempt_review(
    (select user_id from obs_e2e_ot_state),
    (select attempt_id from obs_e2e_ot_state)
  ) review_row
)
update obs_e2e_ot_state state
set
  review_count = review.answer_count,
  review_is_idk = review.all_idk
from review;

do $$
declare
  state obs_e2e_ot_state%rowtype;
begin
  select * into state from obs_e2e_ot_state;

  if state.attempt_id is null
    or state.generated_question_id is null
    or jsonb_typeof(state.displayed_choices) is distinct from 'array'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Lifecycle failed before a usable question was served';
  end if;

  if state.served_payload ? 'correct_choice_id'
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
      message = 'Served question exposed answer-key metadata';
  end if;

  if coalesce((state.submit_payload->>'is_idk')::boolean, false) is not true
    or coalesce((state.submit_payload->>'answered_count')::integer, 0) <> 1
  then
    raise exception using
      errcode = 'P0001',
      message = 'IDK submission was not recorded correctly';
  end if;

  if coalesce((state.summary_payload->>'answered')::integer, 0) <> 1
    or coalesce((state.summary_payload->>'idk')::integer, 0) <> 1
    or state.review_count <> 1
    or state.review_is_idk is not true
  then
    raise exception using
      errcode = 'P0001',
      message = 'Summary or review did not reproduce the submitted response';
  end if;
end;
$$;

reset role;
rollback;

select
  'PASS: authenticated OT start, serve, submit, summary, and review succeeded; writes rolled back.'
  as result;
