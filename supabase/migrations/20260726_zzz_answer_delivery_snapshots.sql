-- Preserve the exact answer wording delivered to the browser.
--
-- A stored choice ID such as "B" is not sufficient historical evidence when
-- choices can be reordered or question payloads can later be corrected. This
-- migration adds immutable delivery snapshots, a browser-confirmed OT submit
-- RPC, and review logic that never invents selected-answer wording for legacy
-- rows that lack a trustworthy snapshot.

begin;

do $$
begin
  if to_regclass('public.assessment_answers') is null
     or to_regclass('public.assessment_attempts') is null
     or to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_submit_ot_assessment_response(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.obs_get_attempt_review(uuid,uuid)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Answer, attempt, question, backup, submission, or review prerequisites are missing.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_answer_delivery_snapshots',
  'public',
  'obs_get_attempt_review',
  'function',
  pg_get_functiondef(
    'public.obs_get_attempt_review(uuid,uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_answer_delivery_snapshots'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_get_attempt_review'
    and backup.object_type = 'function'
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_answer_delivery_snapshots'
    and object_schema = 'public'
    and object_name = 'obs_get_attempt_review'
    and object_type = 'function';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected one review-function backup, found %s; no changes made.',
        backup_count
      );
  end if;
end
$$;

alter table public.assessment_answers
  add column if not exists delivered_choices_snapshot jsonb,
  add column if not exists selected_choice_text_snapshot text,
  add column if not exists correct_choice_id_snapshot text,
  add column if not exists correct_choice_text_snapshot text,
  add column if not exists question_prompt_snapshot text,
  add column if not exists delivery_contract text;

alter table public.assessment_answers
  drop constraint if exists assessment_answers_delivered_choices_snapshot_ck;

alter table public.assessment_answers
  add constraint assessment_answers_delivered_choices_snapshot_ck
  check (
    delivered_choices_snapshot is null
    or jsonb_typeof(delivered_choices_snapshot) = 'array'
  );

create or replace function public.obs_choice_text(
  p_choices jsonb,
  p_choice_id text
)
returns text
language sql
immutable
parallel safe
as $$
  select choice->>'text'
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_choices) = 'array' then p_choices
      else '[]'::jsonb
    end
  ) choice
  where choice->>'id' = p_choice_id
  limit 1;
$$;

create or replace function public.obs_sequence_choice_text(
  p_choices jsonb,
  p_order jsonb
)
returns text
language sql
immutable
parallel safe
as $$
  select string_agg(
    coalesce(choice->>'text', ordered.item_id),
    ' -> '
    order by ordered.ordinality
  )
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(p_order) = 'array' then p_order
      else '[]'::jsonb
    end
  ) with ordinality ordered(item_id, ordinality)
  left join lateral (
    select item
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_choices) = 'array' then p_choices
        else '[]'::jsonb
      end
    ) item
    where item->>'id' = ordered.item_id
    limit 1
  ) matched(choice) on true;
$$;

create or replace function public.obs_capture_answer_delivery_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question record;
  v_attempt record;
  v_delivery_payload jsonb;
  v_correct_id text;
  v_selected_order jsonb;
begin
  if new.delivery_contract = 'client_confirmed_v2' then
    return new;
  end if;

  if new.generated_question_id is null then
    return new;
  end if;

  select
    question.question_type,
    question.payload,
    nullif(question.payload->>'prompt', '') as prompt
  into v_question
  from public.ot_generated_questions question
  where question.id = new.generated_question_id;

  if not found then
    return new;
  end if;

  select
    attempt.assessment_kind,
    upper(coalesce(attempt.testament, 'OT')) as testament
  into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = new.attempt_id;

  v_delivery_payload := case
    when v_question.question_type = 'sequence_order_v1'
      then v_question.payload
    when v_attempt.testament = 'OT'
      and coalesce(v_attempt.assessment_kind, '') not in (
        'ot_adaptive',
        'ot_focused'
      )
      then public.assessment_scramble_mcq(
        v_question.payload,
        new.attempt_id::text
          || ':'
          || new.generated_question_id::text
      )
    else v_question.payload
  end;

  new.question_prompt_snapshot := v_question.prompt;

  if v_question.question_type = 'sequence_order_v1' then
    new.delivered_choices_snapshot :=
      coalesce(v_delivery_payload->'choices', '[]'::jsonb);
    v_selected_order :=
      public.obs_parse_sequence_order(new.selected_choice_id);
    new.selected_choice_text_snapshot := case
      when coalesce(new.is_idk, false) then null
      else public.obs_sequence_choice_text(
        new.delivered_choices_snapshot,
        v_selected_order
      )
    end;
    new.correct_choice_id_snapshot :=
      '__ORDER__:' || (v_question.payload->'correct_order')::text;
    new.correct_choice_text_snapshot :=
      public.obs_sequence_choice_text(
        new.delivered_choices_snapshot,
        v_question.payload->'correct_order'
      );
    new.delivery_contract := 'server_sequence_v1';
  else
    -- The server cannot prove which indirect selector mapping an older client
    -- displayed. Only the browser-confirmed v2 RPC may snapshot MCQ wording.
    new.delivered_choices_snapshot := null;
    new.selected_choice_text_snapshot := null;
    new.correct_choice_id_snapshot := null;
    new.correct_choice_text_snapshot := null;
    new.delivery_contract := 'server_unconfirmed_v1';
  end if;

  return new;
end;
$$;

drop trigger if exists
  assessment_answers_capture_delivery_snapshot
  on public.assessment_answers;

create trigger assessment_answers_capture_delivery_snapshot
before insert or update of
  selected_choice_id,
  generated_question_id,
  attempt_id
on public.assessment_answers
for each row
execute function public.obs_capture_answer_delivery_snapshot();

create or replace function public.obs_submit_ot_assessment_response_v2(
  p_attempt_id uuid,
  p_generated_question_id uuid,
  p_response text,
  p_selected_choice_text text,
  p_displayed_choices jsonb
)
returns table (
  is_correct boolean,
  is_idk boolean,
  correct_choice_id text,
  answered_count integer,
  correct_count integer,
  target_question_count integer,
  target_reached boolean,
  remaining_count integer,
  assessment_kind text,
  unit_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question record;
  v_result record;
  v_expected_choices jsonb;
  v_selected_text text;
  v_selected_order jsonb;
  v_canonical_selected_id text;
  v_canonical_correct_id text;
  v_display_correct_id text;
  v_correct_text text;
  v_semantic_is_correct boolean;
  v_is_sequence boolean;
  v_is_idk boolean;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select
    question.question_type,
    question.payload,
    nullif(question.payload->>'prompt', '') as prompt
  into v_question
  from public.ot_generated_questions question
  join public.assessment_attempts attempt
    on attempt.id = p_attempt_id
   and attempt.user_id = auth.uid()
   and upper(coalesce(attempt.testament, 'OT')) = 'OT'
   and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
  where question.id = p_generated_question_id;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Question or authorized attempt not found';
  end if;

  if jsonb_typeof(p_displayed_choices) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Displayed choices must be a JSON array';
  end if;

  v_expected_choices :=
    coalesce(v_question.payload->'choices', '[]'::jsonb);
  v_is_sequence := v_question.question_type = 'sequence_order_v1';
  v_is_idk := upper(coalesce(p_response, '')) = '__IDK__';

  if jsonb_array_length(p_displayed_choices)
       <> jsonb_array_length(v_expected_choices)
     or (
       select count(distinct displayed->>'id')
       from jsonb_array_elements(p_displayed_choices) displayed
     ) <> jsonb_array_length(p_displayed_choices)
     or (
       select count(distinct displayed->>'text')
       from jsonb_array_elements(p_displayed_choices) displayed
     ) <> jsonb_array_length(p_displayed_choices)
     or (
       select count(distinct expected->>'text')
       from jsonb_array_elements(v_expected_choices) expected
     ) <> jsonb_array_length(v_expected_choices)
     or exists (
       select 1
       from jsonb_array_elements(v_expected_choices) expected
       where not exists (
         select 1
         from jsonb_array_elements(p_displayed_choices) displayed
         where displayed->>'text' = expected->>'text'
       )
     )
     or exists (
       select 1
       from jsonb_array_elements(p_displayed_choices) displayed
       where not exists (
         select 1
         from jsonb_array_elements(v_expected_choices) expected
         where expected->>'text' = displayed->>'text'
       )
     )
  then
    raise exception using
      errcode = '22023',
      message =
        'Displayed choices do not match the server question; answer was not recorded';
  end if;

  if v_is_sequence and not v_is_idk then
    v_selected_order := public.obs_parse_sequence_order(p_response);
    v_selected_text := public.obs_sequence_choice_text(
      p_displayed_choices,
      v_selected_order
    );
  elsif not v_is_idk then
    v_selected_text :=
      public.obs_choice_text(p_displayed_choices, p_response);
  end if;

  if not v_is_idk
     and (
       v_selected_text is null
       or p_selected_choice_text is distinct from v_selected_text
     )
  then
    raise exception using
      errcode = '22023',
      message =
        'Selected answer text does not match the selected choice; answer was not recorded';
  end if;

  if v_is_sequence or v_is_idk then
    v_canonical_selected_id := p_response;
  else
    select expected->>'id'
    into v_canonical_selected_id
    from jsonb_array_elements(v_expected_choices) expected
    where expected->>'text' = v_selected_text
    limit 1;
  end if;

  select *
  into v_result
  from public.obs_submit_ot_assessment_response(
    p_attempt_id,
    p_generated_question_id,
    v_canonical_selected_id
  );

  if v_result.correct_choice_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Answer submission returned no result';
  end if;

  if v_is_sequence then
    v_display_correct_id := v_result.correct_choice_id;
    v_correct_text := public.obs_sequence_choice_text(
      p_displayed_choices,
      v_question.payload->'correct_order'
    );
  else
    v_canonical_correct_id := coalesce(
      v_question.payload->>'correct_choice_id',
      v_question.payload->>'answer_id',
      v_question.payload->>'correctAnswerId'
    );
    v_correct_text :=
      public.obs_choice_text(
        v_expected_choices,
        v_canonical_correct_id
      );
    select displayed->>'id'
    into v_display_correct_id
    from jsonb_array_elements(p_displayed_choices) displayed
    where displayed->>'text' = v_correct_text
    limit 1;
  end if;

  v_semantic_is_correct :=
    not v_is_idk
    and v_selected_text = v_correct_text;

  if v_result.is_correct is distinct from v_semantic_is_correct then
    raise exception using
      errcode = 'P0001',
      message =
        'Semantic answer grading disagreed with canonical grading; answer was not recorded';
  end if;

  update public.assessment_answers answer
  set
    selected_choice_id = p_response,
    is_correct = v_semantic_is_correct,
    delivered_choices_snapshot = p_displayed_choices,
    selected_choice_text_snapshot = case
      when v_is_idk then null
      else v_selected_text
    end,
    correct_choice_id_snapshot = v_display_correct_id,
    correct_choice_text_snapshot = v_correct_text,
    question_prompt_snapshot = v_question.prompt,
    delivery_contract = 'client_confirmed_v2'
  where answer.attempt_id = p_attempt_id
    and answer.generated_question_id = p_generated_question_id
    and answer.user_id = auth.uid();

  return query
  select
    v_semantic_is_correct,
    v_result.is_idk,
    v_display_correct_id,
    v_result.answered_count,
    v_result.correct_count,
    v_result.target_question_count,
    v_result.target_reached,
    v_result.remaining_count,
    v_result.assessment_kind,
    v_result.unit_key;
end
$$;

-- A previous draft backfilled current rows from server payloads. The live
-- browser test proved that indirect selector mappings can remap choice IDs, so
-- those inferred snapshots are removed rather than presented as historical
-- fact. Existing grades remain untouched.
update public.assessment_answers answer
set
  delivered_choices_snapshot = null,
  selected_choice_text_snapshot = null,
  correct_choice_id_snapshot = null,
  correct_choice_text_snapshot = null,
  question_prompt_snapshot = null,
  delivery_contract = null
where answer.delivery_contract = 'backfill_server_raw_v1';

create or replace function public.obs_get_attempt_review(
  p_user_id uuid,
  p_attempt_id uuid
)
returns table (
  answer_id uuid,
  answered_at timestamptz,
  generated_question_id uuid,
  prompt text,
  choices jsonb,
  selected_choice_id text,
  selected_choice_text text,
  correct_choice_id text,
  correct_choice_text text,
  is_correct boolean,
  is_idk boolean,
  book_code text,
  section text,
  dimension_key text,
  source_ref text,
  explanation text
)
language sql
stable
security definer
set search_path = public
as $$
  with review_rows as (
    select
      evidence.*,
      attempt.assessment_kind,
      answer.delivered_choices_snapshot,
      answer.selected_choice_text_snapshot,
      answer.correct_choice_id_snapshot,
      answer.correct_choice_text_snapshot,
      answer.question_prompt_snapshot,
      case
        when upper(coalesce(attempt.testament, 'OT')) = 'OT'
          and coalesce(attempt.assessment_kind, '') not in (
            'ot_adaptive',
            'ot_focused'
          )
          and evidence.question_type <> 'sequence_order_v1'
        then public.assessment_scramble_mcq(
          evidence.payload,
          evidence.attempt_id::text
            || ':'
            || evidence.generated_question_id::text
        )
        else evidence.payload
      end as display_payload
    from public.obs_answer_evidence evidence
    join public.assessment_attempts attempt
      on attempt.id = evidence.attempt_id
    join public.assessment_answers answer
      on answer.id = evidence.answer_id
    where evidence.user_id = p_user_id
      and evidence.attempt_id = p_attempt_id
      and public.obs_is_authorized_user(p_user_id)
  ),
  resolved as (
    select
      review.*,
      coalesce(
        review.delivered_choices_snapshot,
        review.display_payload->'choices',
        '[]'::jsonb
      ) as review_choices,
      coalesce(
        review.correct_choice_id_snapshot,
        case
          when review.question_type = 'sequence_order_v1'
            then '__ORDER__:'
              || (review.display_payload->'correct_order')::text
          else coalesce(
            review.display_payload->>'correct_choice_id',
            review.display_payload->>'answer_id',
            review.display_payload->>'correctAnswerId'
          )
        end
      ) as resolved_correct_choice_id
    from review_rows review
  )
  select
    review.answer_id,
    review.answered_at,
    review.generated_question_id,
    coalesce(review.question_prompt_snapshot, review.prompt),
    review.review_choices,
    review.selected_choice_id,
    case
      when review.is_idk then null
      when review.selected_choice_text_snapshot is not null
        then review.selected_choice_text_snapshot
      when review.question_type = 'sequence_order_v1'
        then public.obs_sequence_choice_text(
          review.review_choices,
          public.obs_parse_sequence_order(review.selected_choice_id)
        )
      -- Unsnapshotted MCQs did not preserve delivered wording. Returning NULL
      -- is intentionally honest; the frontend displays the recorded choice ID.
      else null
    end,
    review.resolved_correct_choice_id,
    coalesce(
      review.correct_choice_text_snapshot,
      case
        when review.question_type = 'sequence_order_v1'
          then public.obs_sequence_choice_text(
            review.review_choices,
            review.display_payload->'correct_order'
          )
        else public.obs_choice_text(
          review.review_choices,
          review.resolved_correct_choice_id
        )
      end
    ),
    review.is_correct,
    review.is_idk,
    review.book_code,
    review.section,
    review.dimension_key,
    coalesce(
      review.payload->>'source_ref',
      review.payload->>'reference'
    ),
    coalesce(
      review.payload->>'explanation',
      review.payload->>'rationale',
      review.payload->>'answer_explanation'
    )
  from resolved review
  order by review.answered_at, review.answer_id;
$$;

revoke all on function public.obs_choice_text(jsonb, text)
  from public, anon;
revoke all on function public.obs_sequence_choice_text(jsonb, jsonb)
  from public, anon;
revoke all on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) from public, anon;
revoke all on function public.obs_get_attempt_review(uuid, uuid)
  from public, anon;

grant execute on function public.obs_choice_text(jsonb, text)
  to authenticated, service_role;
grant execute on function public.obs_sequence_choice_text(jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) to authenticated, service_role;
grant execute on function public.obs_get_attempt_review(uuid, uuid)
  to authenticated, service_role;

comment on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) is
  'Validates browser-displayed OT choices, submits the answer, and preserves exact review wording.';

notify pgrst, 'reload schema';

commit;
