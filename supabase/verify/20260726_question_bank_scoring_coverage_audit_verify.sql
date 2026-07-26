-- Fail-loud verification for the question-bank scoring and coverage audit.

do $$
declare
  v_missing integer;
  v_bank_count integer;
  v_audit_count integer;
  v_summary_count integer;
  v_readiness_count integer;
  v_bad_privileges integer;
begin
  select count(*)
  into v_missing
  from unnest(array[
    'obs_admin_question_bank_audit',
    'obs_admin_coverage_audit',
    'obs_admin_repetition_audit',
    'obs_admin_difficulty_audit',
    'obs_admin_distractor_audit',
    'obs_admin_assessment_readiness',
    'obs_admin_question_bank_audit_summary'
  ]) object_name
  where to_regclass('public.' || object_name) is null;

  if v_missing <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format('%s audit views are missing.', v_missing);
  end if;

  select count(*) into v_bank_count from public.v_question_bank;
  select count(*) into v_audit_count from public.obs_admin_question_bank_audit;
  if v_audit_count <> v_bank_count then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Question audit row count %s does not match active bank count %s.',
        v_audit_count,
        v_bank_count
      );
  end if;

  if exists (
    select 1
    from public.obs_admin_question_bank_audit
    where router_eligible
      and cardinality(blocker_reasons) > 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A router-eligible question still has a blocker.';
  end if;

  if exists (
    select 1
    from public.obs_admin_difficulty_audit
    where calibration_answer_count < 12
      and difficulty_status <> 'insufficient_data'
  ) or exists (
    select 1
    from public.obs_admin_distractor_audit
    where exposure_count < 12
      and distractor_status <> 'insufficient_data'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A statistical quality flag bypassed its 12-response evidence gate.';
  end if;

  select count(*)
  into v_summary_count
  from public.obs_admin_question_bank_audit_summary;
  select count(*)
  into v_readiness_count
  from public.obs_admin_assessment_readiness;

  if v_summary_count <> 8 or v_readiness_count <> 11 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Unexpected summary/readiness counts: summary=%s readiness=%s.',
        v_summary_count,
        v_readiness_count
      );
  end if;

  select count(*)
  into v_bad_privileges
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in (
      'obs_admin_question_bank_audit',
      'obs_admin_coverage_audit',
      'obs_admin_repetition_audit',
      'obs_admin_difficulty_audit',
      'obs_admin_distractor_audit',
      'obs_admin_assessment_readiness',
      'obs_admin_question_bank_audit_summary'
    )
    and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated');

  if v_bad_privileges <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format('%s unsafe audit-view grants remain.', v_bad_privileges);
  end if;

  raise notice
    'PASS: % active questions audited; evidence gates and service-only privileges verified.',
    v_audit_count;
end
$$;

select *
from public.obs_admin_question_bank_audit_summary
order by
  case severity when 'high' then 1 when 'review' then 2 else 3 end,
  audit_group,
  metric_key;

select *
from public.obs_admin_assessment_readiness
order by
  case scope_key
    when 'BIBLE' then 1
    when 'OT' then 2
    when 'NT' then 3
    else 4
  end,
  scope_name;
