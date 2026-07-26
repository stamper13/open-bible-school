-- Align OT grading with the choices actually delivered to the browser.
--
-- Persistent OT selectors return payload choices without scrambling them.
-- submit_assessment_answer_v2 still scrambled the answer key, causing visibly
-- correct answers to be stored as wrong and vice versa. Legacy attempts retain
-- their historical deterministic scramble behavior.

begin;

do $$
begin
  if to_regprocedure(
       'public.submit_assessment_answer_v2(uuid,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.obs_get_attempt_review(uuid,uuid)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.assessment_attempts') is null
     or to_regclass('public.user_abilities') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Required grading, review, answer, attempt, ability, or backup objects are missing.';
  end if;
end
$$;

create temporary table obs_grading_affected_answers
on commit drop
as
select
  answer.id as answer_id,
  answer.user_id,
  answer.attempt_id,
  answer.generated_question_id,
  answer.is_correct as previous_is_correct,
  (
    not coalesce(answer.is_idk, false)
    and answer.selected_choice_id = coalesce(
      question.payload->>'correct_choice_id',
      question.payload->>'answer_id',
      question.payload->>'correctAnswerId'
    )
  ) as corrected_is_correct
from public.assessment_answers answer
join public.assessment_attempts attempt
  on attempt.id = answer.attempt_id
join public.ot_generated_questions question
  on question.id = answer.generated_question_id
where attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
  and upper(coalesce(attempt.testament, 'OT')) = 'OT'
  and not coalesce(answer.is_idk, false)
  and answer.is_correct is distinct from (
    answer.selected_choice_id = coalesce(
      question.payload->>'correct_choice_id',
      question.payload->>'answer_id',
      question.payload->>'correctAnswerId'
    )
  );

create temporary table obs_grading_affected_users
on commit drop
as
select distinct user_id
from obs_grading_affected_answers;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_ot_answer_grading_alignment',
  'public',
  'submit_assessment_answer_v2',
  'function',
  pg_get_functiondef(
    'public.submit_assessment_answer_v2(uuid,uuid,uuid,text)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_ot_answer_grading_alignment'
    and backup.object_schema = 'public'
    and backup.object_name = 'submit_assessment_answer_v2'
    and backup.object_type = 'function'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_ot_answer_grading_alignment',
  'public',
  'obs_get_attempt_review',
  'function',
  pg_get_functiondef(
    'public.obs_get_attempt_review(uuid,uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_ot_answer_grading_alignment'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_get_attempt_review'
    and backup.object_type = 'function'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_ot_answer_grading_alignment',
  'public',
  'assessment_answers',
  'data',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', affected.answer_id,
        'is_correct', affected.previous_is_correct
      )
      order by affected.answer_id
    ),
    '[]'::jsonb
  )::text
from obs_grading_affected_answers affected
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_ot_answer_grading_alignment'
    and backup.object_schema = 'public'
    and backup.object_name = 'assessment_answers'
    and backup.object_type = 'data'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_ot_answer_grading_alignment',
  'public',
  'assessment_attempts',
  'data',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', attempt.id,
        'answered_count', attempt.answered_count,
        'correct_count', attempt.correct_count,
        'is_complete', attempt.is_complete,
        'completed_at', attempt.completed_at
      )
      order by attempt.id
    ),
    '[]'::jsonb
  )::text
from public.assessment_attempts attempt
where attempt.id in (
  select distinct affected.attempt_id
  from obs_grading_affected_answers affected
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_ot_answer_grading_alignment'
    and backup.object_schema = 'public'
    and backup.object_name = 'assessment_attempts'
    and backup.object_type = 'data'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_ot_answer_grading_alignment',
  'public',
  'user_abilities',
  'data',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', target.user_id,
        'scope', target.scope,
        'had_row', ability.user_id is not null,
        'theta', ability.theta,
        'theta_se', ability.theta_se,
        'n_responses', ability.n_responses,
        'updated_at', ability.updated_at
      )
      order by target.user_id, target.scope
    ),
    '[]'::jsonb
  )::text
from (
  select affected.user_id, scope.scope
  from obs_grading_affected_users affected
  cross join (
    values
      ('BIBLE'),
      ('OT'),
      ('TORAH'),
      ('FORMER'),
      ('LATTER'),
      ('WRITINGS')
  ) scope(scope)
) target
left join public.user_abilities ability
  on ability.user_id = target.user_id
 and ability.scope = target.scope
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_ot_answer_grading_alignment'
    and backup.object_schema = 'public'
    and backup.object_name = 'user_abilities'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_ot_answer_grading_alignment'
    and object_schema = 'public'
    and (
      (object_type = 'function' and object_name in (
        'submit_assessment_answer_v2',
        'obs_get_attempt_review'
      ))
      or
      (object_type = 'data' and object_name in (
        'assessment_answers',
        'assessment_attempts',
        'user_abilities'
      ))
    );

  if backup_count <> 5 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected five grading backups, found %s; no changes made.', backup_count);
  end if;
end
$$;

create or replace function public.submit_assessment_answer_v2(
  p_attempt_id uuid,
  p_user_id uuid,
  p_generated_question_id uuid,
  p_selected_choice_id text
)
returns table (
  answer_id uuid,
  out_generated_question_id uuid,
  is_correct boolean,
  correct_choice_id text,
  question_type text,
  prompt text,
  testament text,
  scope_key text,
  assessment_mode text,
  answered_count integer,
  total_count integer,
  is_complete boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_question public.v_question_bank%rowtype;
  v_delivery_payload jsonb;
  v_correct text;
  v_is_correct boolean;
  v_is_idk boolean;
  v_answer_id uuid;
  v_answered integer;
  v_correct_count integer;
  v_total integer;
  v_complete boolean;
  v_section text;
begin
  select *
  into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
    and auth.uid() = p_user_id
  for update;

  if not found then
    raise exception 'Assessment attempt not found or not authorized';
  end if;

  if v_attempt.is_complete then
    raise exception 'Assessment attempt is already complete';
  end if;

  select *
  into v_question
  from public.v_question_bank question
  where question.generated_question_id = p_generated_question_id;

  if not found then
    raise exception 'Question not found or inactive';
  end if;

  if not public.question_matches_assessment_scope(
    v_question.book_code,
    v_attempt.testament,
    v_attempt.scope_key
  ) then
    raise exception 'Question does not belong to attempt scope';
  end if;

  -- Persistent OT selectors return stored choices as-is. Older assessment
  -- flows returned this deterministic scramble and must retain that contract.
  v_delivery_payload := case
    when v_attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
      and upper(coalesce(v_attempt.testament, 'OT')) = 'OT'
      then v_question.payload
    else public.assessment_scramble_mcq(
      v_question.payload,
      p_attempt_id::text || ':' || p_generated_question_id::text
    )
  end;

  v_correct := coalesce(
    v_delivery_payload->>'correct_choice_id',
    v_delivery_payload->>'answer_id',
    v_delivery_payload->>'correctAnswerId'
  );

  if v_correct is null then
    raise exception 'Question has no resolvable correct answer';
  end if;

  v_is_idk := upper(coalesce(p_selected_choice_id, '')) = '__IDK__';

  if not v_is_idk and not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_delivery_payload->'choices') = 'array'
          then v_delivery_payload->'choices'
        else '[]'::jsonb
      end
    ) choice
    where choice->>'id' = p_selected_choice_id
  ) then
    raise exception 'Invalid choice id';
  end if;

  v_is_correct := not v_is_idk and p_selected_choice_id = v_correct;

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    question_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    answered_at
  ) values (
    p_attempt_id,
    p_user_id,
    p_generated_question_id,
    p_generated_question_id,
    p_selected_choice_id,
    v_is_correct,
    v_is_idk,
    now()
  )
  on conflict (attempt_id, question_id) do update set
    selected_choice_id = excluded.selected_choice_id,
    is_correct = excluded.is_correct,
    is_idk = excluded.is_idk,
    answered_at = excluded.answered_at,
    generated_question_id = excluded.generated_question_id,
    user_id = excluded.user_id
  returning id into v_answer_id;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id;

  v_complete := v_answered >= v_attempt.question_target;

  update public.assessment_attempts attempt
  set
    answered_count = v_answered,
    correct_count = v_correct_count,
    is_complete = v_complete,
    completed_at = case
      when v_complete then coalesce(attempt.completed_at, now())
      else null
    end
  where attempt.id = p_attempt_id
  returning attempt.total_count into v_total;

  if v_question.event_id is not null and not v_is_idk then
    v_section := public.canonical_assessment_scope(v_question.book_code);
    perform public.update_theta_internal(
      p_user_id,
      v_section,
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      p_user_id,
      v_attempt.testament,
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      p_user_id,
      'BIBLE',
      v_question.event_id,
      v_is_correct
    );
  end if;

  return query
  select
    v_answer_id,
    v_question.generated_question_id,
    v_is_correct,
    v_correct,
    v_question.question_type,
    coalesce(v_question.payload->>'prompt', v_question.prompt),
    v_attempt.testament,
    v_attempt.scope_key,
    v_attempt.assessment_mode,
    v_answered,
    v_total,
    v_complete;
end
$$;

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
      case
        when upper(coalesce(attempt.testament, 'OT')) = 'OT'
          and coalesce(attempt.assessment_kind, '') not in (
            'ot_adaptive',
            'ot_focused'
          )
        then public.assessment_scramble_mcq(
          evidence.payload,
          evidence.attempt_id::text || ':' || evidence.generated_question_id::text
        )
        else evidence.payload
      end as display_payload
    from public.obs_answer_evidence evidence
    join public.assessment_attempts attempt
      on attempt.id = evidence.attempt_id
    where evidence.user_id = p_user_id
      and evidence.attempt_id = p_attempt_id
      and public.obs_is_authorized_user(p_user_id)
  )
  select
    review.answer_id,
    review.answered_at,
    review.generated_question_id,
    review.prompt,
    coalesce(review.display_payload->'choices', '[]'::jsonb),
    review.selected_choice_id,
    (
      select choice->>'text'
      from jsonb_array_elements(
        case
          when jsonb_typeof(review.display_payload->'choices') = 'array'
            then review.display_payload->'choices'
          else '[]'::jsonb
        end
      ) choice
      where choice->>'id' = review.selected_choice_id
      limit 1
    ),
    coalesce(
      review.display_payload->>'correct_choice_id',
      review.display_payload->>'answer_id',
      review.display_payload->>'correctAnswerId'
    ),
    (
      select choice->>'text'
      from jsonb_array_elements(
        case
          when jsonb_typeof(review.display_payload->'choices') = 'array'
            then review.display_payload->'choices'
          else '[]'::jsonb
        end
      ) choice
      where choice->>'id' = coalesce(
        review.display_payload->>'correct_choice_id',
        review.display_payload->>'answer_id',
        review.display_payload->>'correctAnswerId'
      )
      limit 1
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
  from review_rows review
  order by review.answered_at, review.answer_id;
$$;

update public.assessment_answers answer
set is_correct = affected.corrected_is_correct
from obs_grading_affected_answers affected
where answer.id = affected.answer_id;

update public.assessment_attempts attempt
set
  answered_count = totals.answered_count,
  correct_count = totals.correct_count
from (
  select
    answer.attempt_id,
    count(*)::integer as answered_count,
    count(*) filter (where answer.is_correct)::integer as correct_count
  from public.assessment_answers answer
  where answer.attempt_id in (
    select distinct affected.attempt_id
    from obs_grading_affected_answers affected
  )
  group by answer.attempt_id
) totals
where attempt.id = totals.attempt_id;

do $$
declare
  affected record;
  scope_key text;
begin
  for affected in
    select user_id
    from obs_grading_affected_users
  loop
    foreach scope_key in array array[
      'BIBLE',
      'OT',
      'TORAH',
      'FORMER',
      'LATTER',
      'WRITINGS'
    ]
    loop
      perform public.update_theta_internal(
        affected.user_id,
        scope_key,
        null,
        false
      );
    end loop;
  end loop;
end
$$;

do $$
declare
  remaining_mismatches integer;
  affected_count integer;
  attempt_counter_mismatches integer;
begin
  select count(*)
  into affected_count
  from obs_grading_affected_answers;

  select count(*)
  into remaining_mismatches
  from public.assessment_answers answer
  join public.assessment_attempts attempt
    on attempt.id = answer.attempt_id
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and not coalesce(answer.is_idk, false)
    and answer.is_correct is distinct from (
      answer.selected_choice_id = coalesce(
        question.payload->>'correct_choice_id',
        question.payload->>'answer_id',
        question.payload->>'correctAnswerId'
      )
    );

  select count(*)
  into attempt_counter_mismatches
  from public.assessment_attempts attempt
  cross join lateral (
    select count(*) filter (where answer.is_correct)::integer as correct_count
    from public.assessment_answers answer
    where answer.attempt_id = attempt.id
  ) totals
  where attempt.id in (
    select distinct affected.attempt_id
    from obs_grading_affected_answers affected
  )
    and attempt.correct_count is distinct from totals.correct_count;

  if remaining_mismatches <> 0 or attempt_counter_mismatches <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Grading repair failed: corrected=%s remaining=%s counter_mismatches=%s.',
        affected_count,
        remaining_mismatches,
        attempt_counter_mismatches
      );
  end if;

  raise notice
    'PASS: corrected % persistent OT grading rows; current mismatches=0; attempt totals synchronized.',
    affected_count;
end
$$;

revoke all on function public.submit_assessment_answer_v2(
  uuid, uuid, uuid, text
) from public, anon;
grant execute on function public.submit_assessment_answer_v2(
  uuid, uuid, uuid, text
) to authenticated, service_role;

revoke all on function public.obs_get_attempt_review(uuid, uuid)
  from public, anon;
grant execute on function public.obs_get_attempt_review(uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
