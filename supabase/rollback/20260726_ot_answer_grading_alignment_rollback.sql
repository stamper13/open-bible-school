begin;

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
      message = format('Rollback requires five grading backups; found %s.', backup_count);
  end if;
end
$$;

do $$
declare
  saved record;
begin
  for saved in
    select definition
    from public.obs_schema_backups
    where backup_tag = '20260726_ot_answer_grading_alignment'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in (
        'submit_assessment_answer_v2',
        'obs_get_attempt_review'
      )
    order by case object_name
      when 'submit_assessment_answer_v2' then 1
      else 2
    end
  loop
    execute saved.definition;
  end loop;
end
$$;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260726_ot_answer_grading_alignment'
    and object_schema = 'public'
    and object_name = 'assessment_answers'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    id uuid,
    is_correct boolean
  )
)
update public.assessment_answers answer
set is_correct = saved.is_correct
from saved
where answer.id = saved.id;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260726_ot_answer_grading_alignment'
    and object_schema = 'public'
    and object_name = 'assessment_attempts'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    id uuid,
    answered_count integer,
    correct_count integer,
    is_complete boolean,
    completed_at timestamptz
  )
)
update public.assessment_attempts attempt
set
  answered_count = saved.answered_count,
  correct_count = saved.correct_count,
  is_complete = saved.is_complete,
  completed_at = saved.completed_at
from saved
where attempt.id = saved.id;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260726_ot_answer_grading_alignment'
    and object_schema = 'public'
    and object_name = 'user_abilities'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    user_id uuid,
    scope text,
    had_row boolean,
    theta double precision,
    theta_se double precision,
    n_responses integer,
    updated_at timestamptz
  )
), removed as (
  delete from public.user_abilities ability
  using saved
  where ability.user_id = saved.user_id
    and ability.scope = saved.scope
)
insert into public.user_abilities (
  user_id,
  scope,
  theta,
  theta_se,
  n_responses,
  updated_at
)
select
  user_id,
  scope,
  theta,
  theta_se,
  n_responses,
  updated_at
from saved
where had_row;

delete from public.obs_schema_backups
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

notify pgrst, 'reload schema';

commit;
