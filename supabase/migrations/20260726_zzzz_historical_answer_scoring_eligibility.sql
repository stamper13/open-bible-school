-- Keep unverifiable pre-contract OT answers in history without letting them
-- affect psychometric scores.

begin;

do $$
declare
  missing text[];
begin
  select array_agg(expected.signature order by expected.signature)
  into missing
  from (
    values
      ('public.obs_compute_bli_internal(uuid)'),
      ('public.obs_compute_scoped_bli(uuid,text,timestamptz)'),
      ('public.obs_get_scope_summary(uuid,text,text)'),
      ('public.obs_get_user_recommendation_v2(uuid)'),
      ('public.update_theta_internal(uuid,text,uuid,boolean)'),
      ('public.obs_capture_answer_delivery_snapshot()')
  ) expected(signature)
  where to_regprocedure(expected.signature) is null;

  if missing is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Historical answer eligibility preflight failed; missing functions: %s',
        array_to_string(missing, ', ')
      );
  end if;

  if to_regclass('public.assessment_answers') is null
     or to_regclass('public.assessment_attempts') is null
     or to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.user_abilities') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Historical answer eligibility preflight failed; required tables are missing.';
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
  '20260726_historical_answer_scoring_eligibility',
  'public',
  object_row.object_name,
  'function',
  pg_get_functiondef(object_row.signature::regprocedure)
from (
  values
    (
      'obs_compute_bli_internal',
      'public.obs_compute_bli_internal(uuid)'
    ),
    (
      'obs_compute_scoped_bli',
      'public.obs_compute_scoped_bli(uuid,text,timestamptz)'
    ),
    (
      'obs_get_scope_summary',
      'public.obs_get_scope_summary(uuid,text,text)'
    ),
    (
      'obs_get_user_recommendation_v2',
      'public.obs_get_user_recommendation_v2(uuid)'
    ),
    (
      'update_theta_internal',
      'public.update_theta_internal(uuid,text,uuid,boolean)'
    ),
    (
      'obs_capture_answer_delivery_snapshot',
      'public.obs_capture_answer_delivery_snapshot()'
    )
) object_row(object_name, signature)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_historical_answer_scoring_eligibility'
    and backup.object_schema = 'public'
    and backup.object_name = object_row.object_name
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_historical_answer_scoring_eligibility'
    and backup.object_schema = 'public'
    and backup.object_type = 'function'
    and backup.object_name in (
      'obs_compute_bli_internal',
      'obs_compute_scoped_bli',
      'obs_get_scope_summary',
      'obs_get_user_recommendation_v2',
      'update_theta_internal',
      'obs_capture_answer_delivery_snapshot'
    );

  if captured <> 6 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Historical answer eligibility backup failed; expected 6 function definitions, found %s.',
        captured
      );
  end if;
end
$$;

create table if not exists
  public.obs_20260726_ability_before_answer_eligibility
as
select *
from public.user_abilities;

alter table public.obs_20260726_ability_before_answer_eligibility
  enable row level security;
revoke all on table
  public.obs_20260726_ability_before_answer_eligibility
  from public, anon, authenticated;

alter table public.assessment_answers
  add column if not exists scoring_eligible boolean not null default true,
  add column if not exists scoring_exclusion_reason text,
  add column if not exists scoring_eligibility_reviewed_at timestamptz;

update public.assessment_answers answer
set
  scoring_eligible = case
    when upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
      and question.question_type <> 'sequence_order_v1'
      and coalesce(answer.delivery_contract, '') <>
        'client_confirmed_v2'
      then false
    else true
  end,
  scoring_exclusion_reason = case
    when upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
      and question.question_type <> 'sequence_order_v1'
      and coalesce(answer.delivery_contract, '') <>
        'client_confirmed_v2'
      then 'unverifiable_pre_contract_choice_delivery'
    else null
  end,
  scoring_eligibility_reviewed_at = now()
from public.assessment_attempts attempt,
     public.ot_generated_questions question
where attempt.id = answer.attempt_id
  and question.id = answer.generated_question_id;

create index if not exists assessment_answers_scoring_eligible_user_idx
  on public.assessment_answers (user_id, answered_at)
  where scoring_eligible;

create or replace function public.obs_set_answer_scoring_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row record;
  question_type_value text;
begin
  select
    upper(coalesce(attempt.testament, 'OT')) as testament,
    attempt.assessment_kind
  into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = new.attempt_id;

  select question.question_type
  into question_type_value
  from public.ot_generated_questions question
  where question.id = new.generated_question_id;

  if attempt_row.testament = 'OT'
     and attempt_row.assessment_kind in ('ot_adaptive', 'ot_focused')
     and coalesce(question_type_value, '') <> 'sequence_order_v1'
     and coalesce(new.delivery_contract, '') <> 'client_confirmed_v2'
  then
    new.scoring_eligible := false;
    new.scoring_exclusion_reason :=
      'unverifiable_pre_contract_choice_delivery';
  else
    new.scoring_eligible := true;
    new.scoring_exclusion_reason := null;
  end if;

  new.scoring_eligibility_reviewed_at := now();
  return new;
end;
$$;

drop trigger if exists assessment_answers_set_scoring_eligibility
  on public.assessment_answers;

create trigger assessment_answers_set_scoring_eligibility
before insert or update of
  selected_choice_id,
  generated_question_id,
  delivery_contract
on public.assessment_answers
for each row
execute function public.obs_set_answer_scoring_eligibility();

do $$
declare
  patch record;
  definition text;
  anchor_count integer;
begin
  for patch in
    select *
    from (
      values
        (
          'public.obs_compute_bli_internal(uuid)',
          'where aa.user_id = p_user_id',
          E'where aa.user_id = p_user_id\n      and aa.scoring_eligible',
          2
        ),
        (
          'public.update_theta_internal(uuid,text,uuid,boolean)',
          'where aa.user_id = p_user_id',
          E'where aa.user_id = p_user_id\n      and aa.scoring_eligible',
          2
        ),
        (
          'public.obs_compute_scoped_bli(uuid,text,timestamptz)',
          'where evidence.user_id = p_user_id',
          E'where evidence.user_id = p_user_id\n      and exists (\n        select 1\n        from public.assessment_answers eligible_answer\n        where eligible_answer.id = evidence.answer_id\n          and eligible_answer.scoring_eligible\n      )',
          1
        ),
        (
          'public.obs_get_scope_summary(uuid,text,text)',
          'where evidence.user_id = p_user_id',
          E'where evidence.user_id = p_user_id\n      and exists (\n        select 1\n        from public.assessment_answers eligible_answer\n        where eligible_answer.id = evidence.answer_id\n          and eligible_answer.scoring_eligible\n      )',
          1
        ),
        (
          'public.obs_get_user_recommendation_v2(uuid)',
          'and answer.user_id = p_user_id',
          E'and answer.user_id = p_user_id\n     and answer.scoring_eligible',
          2
        )
    ) value(
      signature,
      anchor,
      replacement,
      expected_anchor_count
    )
  loop
    select pg_get_functiondef(patch.signature::regprocedure)
    into definition;

    anchor_count :=
      (
        length(definition)
        - length(replace(definition, patch.anchor, ''))
      ) / length(patch.anchor);

    if anchor_count <> patch.expected_anchor_count then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Refusing to patch %s: expected %s scoring anchors, found %s.',
          patch.signature,
          patch.expected_anchor_count,
          anchor_count
        );
    end if;

    execute replace(definition, patch.anchor, patch.replacement);
  end loop;
end
$$;

do $$
declare
  ability_row record;
begin
  for ability_row in
    select ability.user_id, ability.scope
    from public.user_abilities ability
  loop
    perform public.update_theta_internal(
      ability_row.user_id,
      ability_row.scope,
      null,
      null
    );
  end loop;
end
$$;

revoke all on function public.obs_set_answer_scoring_eligibility()
  from public, anon, authenticated;
grant execute on function public.obs_set_answer_scoring_eligibility()
  to service_role;

comment on column public.assessment_answers.scoring_eligible is
  'False only when an answer remains visible in history but cannot safely contribute to psychometric scoring.';
comment on column public.assessment_answers.scoring_exclusion_reason is
  'Machine-readable reason an answer is excluded from scoring.';

notify pgrst, 'reload schema';

commit;
