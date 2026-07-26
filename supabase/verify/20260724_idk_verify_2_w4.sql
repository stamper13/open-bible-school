-- =====================================================================
-- IDK POST-APPLY VERIFICATION 2 OF 3: W4
-- =====================================================================
-- EXPECTED RESULT: a red error beginning:
--   W4 PASS (rolled back as designed)
--
-- The error is intentional. It rolls back both temporary function swaps
-- and every test recomputation. W4 FAILED is a real failure.
-- =====================================================================

do $$
declare
  v_new_def text;
  v_old_def text;
  v_frozen_moved int;
  v_expected_static int;
  v_n_changed int;
  v_theta_not_higher int;
  v_se_narrowed int;
  v_se_widened int;
  v_se_same int;
  v_moved int;
  v_expected_moved int;
  v_maxd double precision;
begin
  select pg_get_functiondef(oid) into v_new_def
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'update_theta_internal';

  select definition into v_old_def
  from public.obs_schema_backups
  where backup_tag = '20260724_idk_theta_weighting'
    and object_name = 'update_theta_internal';

  if v_old_def is null then
    raise exception using errcode = 'P0001',
      message = 'W4 CANNOT RUN: no backup for tag 20260724_idk_theta_weighting.';
  end if;

  if to_regclass('public.obs_idk_scope_census') is null then
    raise exception using errcode = 'P0001',
      message = 'W4 CANNOT RUN: obs_idk_scope_census is missing. Run W0 first.';
  end if;

  create temp table _w4_old (
    user_id uuid,
    scope text,
    theta double precision,
    theta_se double precision,
    n_responses int
  ) on commit drop;

  -- Freshly recompute under the backed-up old model.
  execute v_old_def;
  perform public.update_theta_internal(ua.user_id, ua.scope, null, null)
  from public.user_abilities ua;

  insert into _w4_old
  select ua.user_id, ua.scope, ua.theta, ua.theta_se, ua.n_responses
  from public.user_abilities ua;

  -- Restore the new model and freshly recompute again.
  execute v_new_def;
  perform public.update_theta_internal(ua.user_id, ua.scope, null, null)
  from public.user_abilities ua;

  -- Rows without in-scope IDK must remain exactly unchanged.
  select count(*) into v_frozen_moved
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope = 0
    and (
      o.theta is distinct from n.theta
      or o.theta_se is distinct from n.theta_se
    );

  -- Every row with in-scope IDK must change.
  select count(*) into v_moved
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and o.theta is distinct from n.theta;

  select count(*) into v_expected_moved
  from public.obs_idk_scope_census
  where idk_in_scope > 0;

  select count(*) into v_expected_static
  from public.obs_idk_scope_census
  where idk_in_scope = 0;

  -- Raw response counts must remain unchanged everywhere.
  select count(*) into v_n_changed
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  where o.n_responses is distinct from n.n_responses;

  -- Every affected theta must move strictly upward.
  select count(*) into v_theta_not_higher
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta <= o.theta;

  -- theta_se direction is informational rather than a pass condition.
  select count(*) into v_se_narrowed
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta_se < o.theta_se;

  select count(*) into v_se_widened
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta_se > o.theta_se;

  select count(*) into v_se_same
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope
  join public.obs_idk_scope_census c
    on c.user_id = o.user_id and c.scope = o.scope
  where c.idk_in_scope > 0
    and n.theta_se = o.theta_se;

  select coalesce(max(abs(n.theta - o.theta)), 0) into v_maxd
  from _w4_old o
  join public.user_abilities n
    on n.user_id = o.user_id and n.scope = o.scope;

  if v_frozen_moved <> 0
     or v_moved <> v_expected_moved
     or v_n_changed <> 0
     or v_theta_not_higher <> 0 then
    raise exception using errcode = 'P0001',
      message = format(
        'W4 FAILED (rolled back): frozen_rows_that_moved=%s (must be 0 of %s); rows_moved=%s (expected %s); n_responses_changed=%s (must be 0); theta_not_higher=%s (must be 0); SE report widened=%s narrowed=%s same=%s; max_abs_theta_delta=%s',
        v_frozen_moved,
        v_expected_static,
        v_moved,
        v_expected_moved,
        v_n_changed,
        v_theta_not_higher,
        v_se_widened,
        v_se_narrowed,
        v_se_same,
        v_maxd
      );
  end if;

  raise exception using errcode = 'P0001',
    message = format(
      'W4 PASS (rolled back as designed): %s rows without in-scope IDK unchanged; %s rows with in-scope IDK moved upward; n_responses preserved; SE report widened=%s narrowed=%s same=%s; max_abs_theta_delta=%s',
      v_expected_static,
      v_moved,
      v_se_widened,
      v_se_narrowed,
      v_se_same,
      v_maxd
    );
end $$;
