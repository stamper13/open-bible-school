-- Authorize anonymous-progress transfer against the authenticated destination.
-- The source must be a real anonymous auth user; registered-user data can never
-- be claimed through this function.

begin;

do $$
declare
  v_function_oid oid;
begin
  v_function_oid := to_regprocedure(
    'public.migrate_anonymous_data(uuid,uuid)'
  );

  if v_function_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'migrate_anonymous_data(uuid,uuid) is missing';
  end if;

  insert into public.obs_schema_backups (
    backup_tag,
    object_schema,
    object_name,
    object_type,
    definition
  )
  select
    '20260730_anonymous_progress_transfer_hardening',
    'public',
    'migrate_anonymous_data',
    'function',
    pg_get_functiondef(v_function_oid)
  where not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag
      = '20260730_anonymous_progress_transfer_hardening'
      and backup.object_schema = 'public'
      and backup.object_name = 'migrate_anonymous_data'
      and backup.object_type = 'function'
  );
end;
$$;

create or replace function public.migrate_anonymous_data(
  p_anonymous_user_id uuid,
  p_new_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_is_service_role boolean :=
    coalesce(
      current_setting('request.jwt.claim.role', true),
      ''
    ) = 'service_role';
  v_source_is_anonymous boolean;
  v_destination_is_anonymous boolean;
  v_attempts_updated integer := 0;
  v_answers_updated integer := 0;
  v_abilities_updated integer := 0;
  v_snapshots_updated integer := 0;
  v_study_events_updated integer := 0;
  v_reports_updated integer := 0;
begin
  if p_anonymous_user_id is null or p_new_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Both source and destination user IDs are required';
  end if;

  if p_anonymous_user_id = p_new_user_id then
    return jsonb_build_object(
      'ok', true,
      'message', 'Same user, no migration needed'
    );
  end if;

  if not v_is_service_role
    and (v_caller_id is null or v_caller_id <> p_new_user_id)
  then
    raise exception using
      errcode = '42501',
      message = 'Progress can only be transferred to the signed-in user';
  end if;

  select user_row.is_anonymous
  into v_source_is_anonymous
  from auth.users user_row
  where user_row.id = p_anonymous_user_id
  for update;

  if not coalesce(v_source_is_anonymous, false) then
    raise exception using
      errcode = '42501',
      message = 'The source user is not an anonymous account';
  end if;

  select user_row.is_anonymous
  into v_destination_is_anonymous
  from auth.users user_row
  where user_row.id = p_new_user_id
  for update;

  if v_destination_is_anonymous is null then
    raise exception using
      errcode = '22023',
      message = 'The destination user does not exist';
  end if;

  if not v_is_service_role and v_destination_is_anonymous then
    raise exception using
      errcode = '42501',
      message = 'The destination must be a registered account';
  end if;

  update public.assessment_attempts
  set user_id = p_new_user_id
  where user_id = p_anonymous_user_id;
  get diagnostics v_attempts_updated = row_count;

  update public.assessment_answers
  set user_id = p_new_user_id
  where user_id = p_anonymous_user_id;
  get diagnostics v_answers_updated = row_count;

  insert into public.user_abilities (
    user_id,
    scope,
    theta,
    updated_at,
    theta_se,
    n_responses
  )
  select
    p_new_user_id,
    ability.scope,
    ability.theta,
    ability.updated_at,
    ability.theta_se,
    ability.n_responses
  from public.user_abilities ability
  where ability.user_id = p_anonymous_user_id
  on conflict (user_id, scope) do update
  set
    theta = case
      when excluded.n_responses
        > public.user_abilities.n_responses
        then excluded.theta
      else public.user_abilities.theta
    end,
    theta_se = case
      when excluded.n_responses
        > public.user_abilities.n_responses
        then excluded.theta_se
      else public.user_abilities.theta_se
    end,
    n_responses = greatest(
      public.user_abilities.n_responses,
      excluded.n_responses
    ),
    updated_at = greatest(
      public.user_abilities.updated_at,
      excluded.updated_at
    );
  get diagnostics v_abilities_updated = row_count;

  delete from public.user_abilities
  where user_id = p_anonymous_user_id;

  update public.obs_assessment_snapshots
  set user_id = p_new_user_id
  where user_id = p_anonymous_user_id;
  get diagnostics v_snapshots_updated = row_count;

  update public.obs_study_plan_events
  set user_id = p_new_user_id
  where user_id = p_anonymous_user_id;
  get diagnostics v_study_events_updated = row_count;

  update public.question_reports
  set user_id = p_new_user_id
  where user_id = p_anonymous_user_id;
  get diagnostics v_reports_updated = row_count;

  return jsonb_build_object(
    'ok', true,
    'attempts_migrated', v_attempts_updated,
    'answers_migrated', v_answers_updated,
    'abilities_merged', v_abilities_updated,
    'snapshots_migrated', v_snapshots_updated,
    'study_events_migrated', v_study_events_updated,
    'reports_migrated', v_reports_updated
  );
end;
$$;

revoke all on function public.migrate_anonymous_data(uuid, uuid)
  from public, anon;
grant execute on function public.migrate_anonymous_data(uuid, uuid)
  to authenticated, service_role;

comment on function public.migrate_anonymous_data(uuid, uuid) is
  'Transfers a verified anonymous account into the authenticated destination account.';

commit;
