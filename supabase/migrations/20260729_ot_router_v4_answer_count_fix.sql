-- Fix an ambiguous PL/pgSQL identifier in the live OT router wrapper.
-- The local answer count must not share the shadow-log column name.

begin;

do $$
begin
  if to_regprocedure(
       'public.get_next_assessment_question(uuid,uuid)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_router_policy_config') is null
     or to_regclass('public.obs_router_shadow_log') is null
     or to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router v4 answer-count fix prerequisites are missing.';
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
  '20260729_ot_router_v4_answer_count_fix',
  'public',
  'get_next_assessment_question',
  'function',
  pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_ot_router_v4_answer_count_fix'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups
  where backup_tag = '20260729_ot_router_v4_answer_count_fix'
    and object_schema = 'public'
    and object_name = 'get_next_assessment_question'
    and object_type = 'function';

  if captured <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT router answer-count backup failed; found %s rows.',
        captured
      );
  end if;
end
$$;

create or replace function public.get_next_assessment_question(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row record;
  policy_row record;
  active_row record;
  shadow_row record;
  v_answer_count integer;
begin
  select attempt.*
  into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
    and auth.uid() = p_user_id
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null;

  if not found then
    return;
  end if;

  select *
  into policy_row
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  select *
  into active_row
  from public.obs_rank_ot_assessment_candidates_v4(
    p_attempt_id,
    p_user_id,
    policy_row.active_version,
    null,
    now(),
    1
  );

  if not found then
    return;
  end if;

  select count(*)::integer
  into v_answer_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  if policy_row.shadow_enabled
     and policy_row.shadow_sample_every_n > 0
     and mod(v_answer_count, policy_row.shadow_sample_every_n) = 0
     and not exists (
       select 1
       from public.obs_router_shadow_log log
       where log.attempt_id = p_attempt_id
         and log.answer_count = v_answer_count
         and log.active_version = policy_row.active_version
         and log.shadow_version = policy_row.shadow_version
     )
  then
    select *
    into shadow_row
    from public.obs_rank_ot_assessment_candidates_v4(
      p_attempt_id,
      p_user_id,
      policy_row.shadow_version,
      null,
      now(),
      1
    );

    insert into public.obs_router_shadow_log (
      attempt_id,
      user_id,
      answer_count,
      active_version,
      shadow_version,
      active_question_id,
      shadow_question_id,
      active_book_code,
      shadow_book_code,
      active_stage,
      shadow_stage,
      active_target_theta,
      shadow_target_theta,
      active_lane,
      shadow_lane
    )
    values (
      p_attempt_id,
      p_user_id,
      v_answer_count,
      policy_row.active_version,
      policy_row.shadow_version,
      active_row.generated_question_id,
      shadow_row.generated_question_id,
      active_row.book_code,
      shadow_row.book_code,
      active_row.candidate_stage,
      shadow_row.candidate_stage,
      active_row.target_theta,
      shadow_row.target_theta,
      active_row.selection_lane,
      shadow_row.selection_lane
    )
    on conflict (
      attempt_id,
      answer_count,
      active_version,
      shadow_version
    ) do nothing;
  end if;

  return query
  select
    active_row.generated_question_id::uuid,
    active_row.prompt::text,
    active_row.question_type::text,
    active_row.payload->'choices',
    active_row.event_title::text,
    active_row.book_code::text,
    active_row.importance_tier::integer,
    active_row.section::text;
end;
$$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into definition;

  if definition not like '%v_answer_count integer%'
     or definition not like
       '%log.answer_count = v_answer_count%'
     or definition ~ E'\\n\\s*answer_count\\s+integer;'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router answer-count identifier fix was not installed.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
