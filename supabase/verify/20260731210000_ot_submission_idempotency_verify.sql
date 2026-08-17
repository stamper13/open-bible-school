-- Transactional verification of exact retry behavior and first-write-wins.

begin;

create temporary table obs_idempotency_state (
  user_id uuid not null,
  attempt_id uuid,
  generated_question_id uuid,
  displayed_choices jsonb,
  first_result jsonb,
  retry_result jsonb,
  answer_id uuid,
  answered_at timestamptz,
  ability_snapshot jsonb,
  changed_response_rejected boolean not null default false
) on commit drop;

insert into obs_idempotency_state (user_id)
select auth_user.id
from auth.users auth_user
where not coalesce(auth_user.is_anonymous, false)
  and auth_user.deleted_at is null
order by auth_user.created_at
limit 1;

do $$
begin
  if not exists (select 1 from obs_idempotency_state) then
    raise exception using
      errcode = 'P0001',
      message = 'Idempotency verification requires one registered user';
  end if;

  if pg_get_functiondef(
    'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure
  ) not like '%Question already answered; the recorded response cannot be changed%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'First-write-wins guard is not installed';
  end if;
end;
$$;

grant all on table obs_idempotency_state to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from obs_idempotency_state),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

set local role authenticated;

with started as (
  select to_jsonb(start_row) as payload
  from public.obs_start_or_resume_ot_assessment_v2(
    null, null, null, null, 2, true, null
  ) start_row
)
update obs_idempotency_state state
set attempt_id = (started.payload->>'attempt_id')::uuid
from started;

with served as (
  select to_jsonb(question_row) as payload
  from public.obs_get_next_ot_assessment_question(
    (select attempt_id from obs_idempotency_state)
  ) question_row
)
update obs_idempotency_state state
set
  generated_question_id =
    (served.payload->>'out_generated_question_id')::uuid,
  displayed_choices = served.payload->'choices'
from served;

with submitted as (
  select to_jsonb(submit_row) as payload
  from public.obs_submit_ot_assessment_response_v2(
    (select attempt_id from obs_idempotency_state),
    (select generated_question_id from obs_idempotency_state),
    '__IDK__',
    null,
    (select displayed_choices from obs_idempotency_state)
  ) submit_row
)
update obs_idempotency_state state
set first_result = submitted.payload
from submitted;

update obs_idempotency_state state
set
  answer_id = answer.id,
  answered_at = answer.answered_at,
  ability_snapshot = (
    select coalesce(
      jsonb_agg(to_jsonb(ability) order by ability.scope),
      '[]'::jsonb
    )
    from public.user_abilities ability
    where ability.user_id = state.user_id
  )
from public.assessment_answers answer
where answer.attempt_id = state.attempt_id
  and answer.generated_question_id = state.generated_question_id
  and answer.user_id = state.user_id;

with retried as (
  select to_jsonb(submit_row) as payload
  from public.obs_submit_ot_assessment_response_v2(
    (select attempt_id from obs_idempotency_state),
    (select generated_question_id from obs_idempotency_state),
    '__IDK__',
    null,
    (select displayed_choices from obs_idempotency_state)
  ) submit_row
)
update obs_idempotency_state state
set retry_result = retried.payload
from retried;

do $$
declare
  state obs_idempotency_state%rowtype;
  v_other_choice text;
begin
  select * into state from obs_idempotency_state;

  select choice->>'id'
  into v_other_choice
  from jsonb_array_elements(state.displayed_choices) choice
  limit 1;

  begin
    perform *
    from public.obs_submit_ot_assessment_response_v2(
      state.attempt_id,
      state.generated_question_id,
      v_other_choice,
      (
        select choice->>'text'
        from jsonb_array_elements(state.displayed_choices) choice
        where choice->>'id' = v_other_choice
      ),
      state.displayed_choices
    );
  exception
    when sqlstate '22023' then
      update obs_idempotency_state
      set changed_response_rejected = true;
  end;
end;
$$;

do $$
declare
  state obs_idempotency_state%rowtype;
  v_answer_count integer;
  v_current_answer record;
  v_current_abilities jsonb;
begin
  select * into state from obs_idempotency_state;

  select count(*)::integer
  into v_answer_count
  from public.assessment_answers answer
  where answer.attempt_id = state.attempt_id
    and answer.generated_question_id = state.generated_question_id
    and answer.user_id = state.user_id;

  select answer.*
  into v_current_answer
  from public.assessment_answers answer
  where answer.id = state.answer_id;

  select coalesce(
    jsonb_agg(to_jsonb(ability) order by ability.scope),
    '[]'::jsonb
  )
  into v_current_abilities
  from public.user_abilities ability
  where ability.user_id = state.user_id;

  if state.first_result is distinct from state.retry_result
    or v_answer_count <> 1
    or v_current_answer.selected_choice_id <> '__IDK__'
    or v_current_answer.answered_at is distinct from state.answered_at
    or v_current_abilities is distinct from state.ability_snapshot
    or not state.changed_response_rejected
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Idempotency failed: same_result=%s count=%s response=%s timestamp_same=%s abilities_same=%s changed_rejected=%s',
        state.first_result is not distinct from state.retry_result,
        v_answer_count,
        v_current_answer.selected_choice_id,
        v_current_answer.answered_at is not distinct from state.answered_at,
        v_current_abilities is not distinct from state.ability_snapshot,
        state.changed_response_rejected
      );
  end if;
end;
$$;

reset role;
rollback;

select
  'PASS: identical OT submissions are side-effect-free and changed responses are rejected.'
  as result;
