-- =====================================================================
-- 20260724_idk_theta_recompute
-- =====================================================================
-- SEPARATE, EXPLICIT, POST-APPROVAL STEP. This is the only script in the
-- IDK sequence that intentionally persists changes to user_abilities.
--
-- Run only after 20260724_idk_theta_weighting_up.sql is applied and
-- W2-W5 in 20260724_idk_theta_weighting_verify.sql pass.
--
-- Safety model:
--   * obs_idk_recompute_before stores the current persisted rows solely
--     for operational rollback.
--   * obs_idk_recompute_old_model stores a FRESH recomputation under the
--     backed-up pre-IDK function. It is the statistical comparison point.
--   * the new function is restored and freshly recomputed before checks.
--   * all work occurs in one DO statement. Any failed assertion rolls
--     back the snapshots, function swap, and ability writes together.
--   * user_abilities is locked during the short recomputation to prevent
--     concurrent assessment writes from mixing the two model versions.
--
-- The script refuses to overwrite either retained snapshot. After the
-- results are accepted, keep obs_idk_recompute_before until the rollback
-- window closes.
-- =====================================================================

do $$
declare
  v_new_def text;
  v_old_def text;
  v_backup_n integer;
  v_census_n integer;
  v_ability_n integer;
  v_missing_census integer;
  v_before_n integer;
  v_old_model_n integer;
  v_frozen_moved integer;
  v_expected_static integer;
  v_moved integer;
  v_expected_moved integer;
  v_n_changed integer;
  v_theta_not_higher integer;
  v_se_narrowed integer;
  v_se_widened integer;
  v_se_same integer;
begin
  -- R0. Preflight before any table or ability write.
  select pg_get_functiondef(oid)
  into v_new_def
  from pg_proc
  where oid = to_regprocedure(
    'public.update_theta_internal(uuid,text,uuid,boolean)'
  );

  if v_new_def is null or v_new_def not like '%idk_weight%' then
    raise exception using errcode = 'P0001',
      message = 'R0 FAILED: the live update_theta_internal is not the IDK-weighted version.';
  end if;

  select count(*), min(definition)
  into v_backup_n, v_old_def
  from public.obs_schema_backups
  where backup_tag = '20260724_idk_theta_weighting'
    and object_schema = 'public'
    and object_name = 'update_theta_internal'
    and object_type = 'function';

  if v_backup_n <> 1 or v_old_def is null then
    raise exception using errcode = 'P0001',
      message = format(
        'R0 FAILED: expected exactly 1 pre-IDK function backup, found %s.',
        v_backup_n
      );
  end if;

  if to_regclass('public.obs_idk_scope_census') is null then
    raise exception using errcode = 'P0001',
      message = 'R0 FAILED: obs_idk_scope_census is missing. Run W0 first.';
  end if;

  if to_regclass('public.obs_idk_recompute_before') is not null
     or to_regclass('public.obs_idk_recompute_old_model') is not null then
    raise exception using errcode = 'P0001',
      message = 'R0 FAILED: a retained IDK recomputation snapshot already exists. Refusing to overwrite rollback evidence.';
  end if;

  select count(*) into v_census_n
  from public.obs_idk_scope_census;

  select count(*) into v_ability_n
  from public.user_abilities;

  select count(*) into v_missing_census
  from public.user_abilities ua
  left join public.obs_idk_scope_census c
    on c.user_id = ua.user_id and c.scope = ua.scope
  where c.user_id is null;

  if v_census_n = 0
     or v_census_n <> v_ability_n
     or v_missing_census <> 0 then
    raise exception using errcode = 'P0001',
      message = format(
        'R0 FAILED: census coverage mismatch. census_rows=%s ability_rows=%s ability_rows_missing_from_census=%s.',
        v_census_n, v_ability_n, v_missing_census
      );
  end if;

  -- Keep the ability population stable while old and new models run.
  lock table public.user_abilities in share row exclusive mode;

  -- R1. Operational rollback snapshot. This is deliberately not the
  -- old-model comparison point because persisted values may be stale.
  create table public.obs_idk_recompute_before as
  select user_id, scope, theta, theta_se, n_responses, updated_at
  from public.user_abilities;

  alter table public.obs_idk_recompute_before enable row level security;
  revoke all on table public.obs_idk_recompute_before from anon, authenticated;

  select count(*) into v_before_n
  from public.obs_idk_recompute_before;

  if v_before_n <> v_ability_n then
    raise exception using errcode = 'P0001',
      message = format(
        'R1 FAILED: rollback snapshot has %s rows; expected %s.',
        v_before_n, v_ability_n
      );
  end if;

  -- R2. Fresh old-model baseline.
  execute v_old_def;

  perform public.update_theta_internal(ua.user_id, ua.scope, null, null)
  from public.user_abilities ua;

  create table public.obs_idk_recompute_old_model as
  select user_id, scope, theta, theta_se, n_responses
  from public.user_abilities;

  alter table public.obs_idk_recompute_old_model enable row level security;
  revoke all on table public.obs_idk_recompute_old_model from anon, authenticated;

  select count(*) into v_old_model_n
  from public.obs_idk_recompute_old_model;

  if v_old_model_n <> v_ability_n then
    raise exception using errcode = 'P0001',
      message = format(
        'R2 FAILED: fresh old-model snapshot has %s rows; expected %s.',
        v_old_model_n, v_ability_n
      );
  end if;

  -- R3. Restore the new definition and persist a fresh new-model result.
  execute v_new_def;

  perform public.update_theta_internal(ua.user_id, ua.scope, null, null)
  from public.user_abilities ua;

  -- R4. Exact old-model vs new-model assertions.
  select count(*) into v_expected_static
  from public.obs_idk_scope_census
  where idk_in_scope = 0;

  select count(*) into v_expected_moved
  from public.obs_idk_scope_census
  where idk_in_scope > 0;

  select count(*) into v_frozen_moved
  from public.obs_idk_recompute_old_model o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope = 0
    and (
      o.theta is distinct from n.theta
      or o.theta_se is distinct from n.theta_se
    );

  select count(*) into v_moved
  from public.obs_idk_recompute_old_model o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta > o.theta;

  select count(*) into v_n_changed
  from public.obs_idk_recompute_old_model o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  where o.n_responses is distinct from n.n_responses;

  select count(*) into v_theta_not_higher
  from public.obs_idk_recompute_old_model o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta <= o.theta;

  select count(*) into v_se_narrowed
  from public.obs_idk_recompute_old_model o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta_se < o.theta_se;

  select count(*) into v_se_widened
  from public.obs_idk_recompute_old_model o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta_se > o.theta_se;

  select count(*) into v_se_same
  from public.obs_idk_recompute_old_model o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta_se = o.theta_se;

  if v_frozen_moved <> 0
     or v_moved <> v_expected_moved
     or v_n_changed <> 0
     or v_theta_not_higher <> 0 then
    raise exception using errcode = 'P0001',
      message = format(
        'R4 FAILED: frozen_rows_that_moved=%s (must be 0 of %s); upward_rows=%s (expected %s); n_responses_changed=%s (must be 0); theta_not_higher=%s (must be 0). All recomputation work was rolled back.',
        v_frozen_moved, v_expected_static, v_moved, v_expected_moved,
        v_n_changed, v_theta_not_higher
      );
  end if;

  raise notice
    'R4 PASS: % rows without IDK stayed exact; % IDK rows moved upward; n_responses stayed exact. SE report: widened %, narrowed %, unchanged %.',
    v_expected_static, v_moved, v_se_widened, v_se_narrowed, v_se_same;
end $$;

-- R5. Report the committed new-model effect against the freshly computed
-- old model. theta_se direction is intentionally informational.
select
  c.scope,
  count(*) as rows_in_scope,
  count(*) filter (where c.idk_in_scope > 0) as rows_with_idk,
  round(max(abs(n.theta - o.theta))::numeric, 6) as max_abs_theta_delta,
  round(
    avg(n.theta - o.theta) filter (where c.idk_in_scope > 0)::numeric,
    6
  ) as mean_theta_rise,
  round(
    avg(n.theta_se - o.theta_se) filter (where c.idk_in_scope > 0)::numeric,
    6
  ) as mean_se_change
from public.obs_idk_recompute_old_model o
join public.user_abilities n
  on n.user_id = o.user_id and n.scope = o.scope
join public.obs_idk_scope_census c
  on c.user_id = o.user_id and c.scope = o.scope
group by c.scope
order by max_abs_theta_delta desc nulls last, c.scope;

-- Cleanup only after the rollback window closes:
-- drop table if exists public.obs_idk_recompute_old_model;
-- drop table if exists public.obs_idk_recompute_before;
-- drop table if exists public.obs_idk_scope_census;
