-- Roll back the NT expository-competence quality layer.
--
-- Safety: ability estimates were recomputed by the up migration. Refuse to
-- restore their point-in-time snapshot if new NT answers have arrived since
-- that snapshot was captured.

begin;

do $$
declare
  function_backups integer;
  ability_backups integer;
  backup_time timestamptz;
  newer_nt_answers integer;
begin
  select
    count(*) filter (where object_type = 'function'),
    count(*) filter (
      where object_type = 'data'
        and object_name = 'user_abilities'
    ),
    min(created_at)
  into function_backups, ability_backups, backup_time
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_expository_competence_quality_layer'
    and object_schema = 'public';

  if function_backups <> 3 or ability_backups <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT quality rollback requires 3 function backups and 1 ability snapshot; found functions=%s data=%s.',
        function_backups,
        ability_backups
      );
  end if;

  select count(*)
  into newer_nt_answers
  from public.assessment_answers answer
  join public.assessment_attempts attempt
    on attempt.id = answer.attempt_id
  where upper(coalesce(attempt.testament, 'OT')) = 'NT'
    and answer.answered_at > backup_time;

  if newer_nt_answers <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT quality rollback refused: %s NT answers were recorded after the ability snapshot. Pause writes and reconcile those answers before restoring old ability values.',
        newer_nt_answers
      );
  end if;
end
$$;

do $$
declare
  saved record;
  restored integer := 0;
begin
  for saved in
    select definition
    from public.obs_schema_backups
    where backup_tag =
            '20260729_nt_expository_competence_quality_layer'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in (
        'obs_start_nt_assessment',
        'obs_get_next_nt_assessment_question',
        'update_theta_internal'
      )
    order by case object_name
      when 'obs_start_nt_assessment' then 1
      when 'obs_get_next_nt_assessment_question' then 2
      else 3
    end
  loop
    execute saved.definition;
    restored := restored + 1;
  end loop;

  if restored <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT quality rollback restored %s/3 functions; transaction reverted.',
        restored
      );
  end if;
end
$$;

delete from public.user_abilities
where scope in (
  'NT', 'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
);

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_expository_competence_quality_layer'
    and object_schema = 'public'
    and object_name = 'user_abilities'
    and object_type = 'data'
), saved as (
  select row.*
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    user_id uuid,
    scope text,
    theta double precision,
    theta_se double precision,
    n_responses integer,
    updated_at timestamptz
  )
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
from saved;

drop view if exists public.obs_nt_expository_review_queue;
drop table if exists public.obs_nt_expository_item_reviews;

delete from public.obs_schema_backups
where backup_tag =
        '20260729_nt_expository_competence_quality_layer'
  and object_schema = 'public';

notify pgrst, 'reload schema';

commit;
