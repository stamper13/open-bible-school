-- Standard assessment target: 25 questions.
--
-- The app now starts both main OT and NT assessments at 25 questions instead
-- of 20. Patch the backend RPC defaults too so direct callers and omitted
-- target arguments match the frontend. This does not change scoring, routing,
-- answer submission, or focused-retake completion logic for existing attempts.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)'
     ) is null
     or to_regprocedure(
       'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'
     ) is null
     or to_regprocedure('public.obs_start_nt_assessment(text,text,integer)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Standard assessment target-25 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  object_type,
  object_schema,
  object_name,
  backup_tag,
  definition
)
select
  'function',
  'public',
  backup.object_name,
  '20260827117000_standard_assessment_target_25',
  backup.definition
from (
  values
    (
      'obs_start_or_resume_ot_assessment',
      pg_get_functiondef(
        'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)'::regprocedure
      )
    ),
    (
      'obs_start_or_resume_ot_assessment_v2',
      pg_get_functiondef(
        'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure
      )
    ),
    (
      'obs_start_nt_assessment',
      pg_get_functiondef(
        'public.obs_start_nt_assessment(text,text,integer)'::regprocedure
      )
    )
) as backup(object_name, definition)
where not exists (
  select 1
  from public.obs_schema_backups existing
  where existing.object_type = 'function'
    and existing.object_schema = 'public'
    and existing.object_name = backup.object_name
    and existing.backup_tag = '20260827117000_standard_assessment_target_25'
);

do $migration$
declare
  v_ot_start text;
  v_ot_start_v2 text;
  v_nt_start text;
begin
  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)'::regprocedure
  )
  into v_ot_start;

  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure
  )
  into v_ot_start_v2;

  select pg_get_functiondef(
    'public.obs_start_nt_assessment(text,text,integer)'::regprocedure
  )
  into v_nt_start;

  if v_ot_start like '%p_target_question_count integer DEFAULT 25%'
     and v_ot_start like '%coalesce(p_target_question_count, 25)%'
     and v_ot_start_v2 like '%p_target_question_count integer DEFAULT 25%'
     and v_nt_start like '%p_target_question_count integer DEFAULT 25%'
     and v_nt_start like '%coalesce(p_target_question_count, 25)%' then
    raise notice 'Standard assessment target-25 defaults are already installed.';
    return;
  end if;

  if v_ot_start not like '%p_target_question_count integer DEFAULT 20%'
     or v_ot_start not like '%coalesce(p_target_question_count, 20)%'
     or v_ot_start_v2 not like '%p_target_question_count integer DEFAULT 20%'
     or v_nt_start not like '%p_target_question_count integer DEFAULT 20%'
     or v_nt_start not like '%coalesce(p_target_question_count, 20)%' then
    raise exception using
      errcode = 'P0001',
      message = 'Expected 20-question defaults were not found in start RPC definitions.';
  end if;

  v_ot_start := replace(
    v_ot_start,
    'p_target_question_count integer DEFAULT 20',
    'p_target_question_count integer DEFAULT 25'
  );
  v_ot_start := replace(
    v_ot_start,
    'coalesce(p_target_question_count, 20)',
    'coalesce(p_target_question_count, 25)'
  );

  v_ot_start_v2 := replace(
    v_ot_start_v2,
    'p_target_question_count integer DEFAULT 20',
    'p_target_question_count integer DEFAULT 25'
  );

  v_nt_start := replace(
    v_nt_start,
    'p_target_question_count integer DEFAULT 20',
    'p_target_question_count integer DEFAULT 25'
  );
  v_nt_start := replace(
    v_nt_start,
    'coalesce(p_target_question_count, 20)',
    'coalesce(p_target_question_count, 25)'
  );

  if v_ot_start not like '%p_target_question_count integer DEFAULT 25%'
     or v_ot_start not like '%coalesce(p_target_question_count, 25)%'
     or v_ot_start_v2 not like '%p_target_question_count integer DEFAULT 25%'
     or v_nt_start not like '%p_target_question_count integer DEFAULT 25%'
     or v_nt_start not like '%coalesce(p_target_question_count, 25)%' then
    raise exception using
      errcode = 'P0001',
      message = 'Standard assessment target-25 patch did not produce expected function bodies.';
  end if;

  execute v_ot_start;
  execute v_ot_start_v2;
  execute v_nt_start;
end
$migration$;

comment on function public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
) is
  'Starts or resumes a persistent adaptive or learning-unit-focused OT assessment. Default target is 25 questions for standard app starts.';

comment on function public.obs_start_or_resume_ot_assessment_v2(
  text, text, integer, integer, integer, boolean, text
) is
  'Starts or resumes a persistent OT assessment, including optional dimension-focused starts. Default target is 25 questions for standard app starts.';

comment on function public.obs_start_nt_assessment(text, text, integer) is
  'Starts a persistent adaptive NT assessment. Default target is 25 questions.';

notify pgrst, 'reload schema';

commit;
