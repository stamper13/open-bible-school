-- =====================================================================
-- DATA ROLLBACK for 20260724_idk_theta_recompute
-- =====================================================================
-- Restores user_abilities to the values captured immediately before the
-- one-time IDK recomputation.
--
-- Run this BEFORE 20260724_idk_theta_weighting_rollback.sql.
--
-- Operational warning: this snapshot represents one point in time. Run
-- the rollback before accepting new assessment answers, or pause writes,
-- so newer ability updates are not intentionally replaced by older ones.
-- The snapshot is retained after rollback for audit and verification.
-- =====================================================================

do $$
declare
  v_snapshot_n integer;
  v_restored_n integer;
  v_mismatch_n integer;
begin
  if to_regclass('public.obs_idk_recompute_before') is null then
    raise exception using errcode = 'P0001',
      message = 'DATA ROLLBACK FAILED: obs_idk_recompute_before is missing. No changes made.';
  end if;

  select count(*) into v_snapshot_n
  from public.obs_idk_recompute_before;

  if v_snapshot_n = 0 then
    raise exception using errcode = 'P0001',
      message = 'DATA ROLLBACK FAILED: obs_idk_recompute_before is empty. No changes made.';
  end if;

  lock table public.user_abilities in share row exclusive mode;

  insert into public.user_abilities (
    user_id,
    scope,
    theta,
    theta_se,
    n_responses,
    updated_at
  )
  select
    b.user_id,
    b.scope,
    b.theta,
    b.theta_se,
    b.n_responses,
    b.updated_at
  from public.obs_idk_recompute_before b
  on conflict (user_id, scope) do update
  set theta = excluded.theta,
      theta_se = excluded.theta_se,
      n_responses = excluded.n_responses,
      updated_at = excluded.updated_at;

  get diagnostics v_restored_n = row_count;

  if v_restored_n <> v_snapshot_n then
    raise exception using errcode = 'P0001',
      message = format(
        'DATA ROLLBACK FAILED: restored %s rows; expected %s. All rollback writes were reverted.',
        v_restored_n, v_snapshot_n
      );
  end if;

  select count(*) into v_mismatch_n
  from public.obs_idk_recompute_before b
  join public.user_abilities a
    on a.user_id = b.user_id and a.scope = b.scope
  where a.theta is distinct from b.theta
     or a.theta_se is distinct from b.theta_se
     or a.n_responses is distinct from b.n_responses
     or a.updated_at is distinct from b.updated_at;

  if v_mismatch_n <> 0 then
    raise exception using errcode = 'P0001',
      message = format(
        'DATA ROLLBACK FAILED: %s restored rows differ from the snapshot. All rollback writes were reverted.',
        v_mismatch_n
      );
  end if;

  raise notice
    'DATA ROLLBACK PASS: % user_abilities rows restored exactly. Snapshot retained.',
    v_restored_n;
end $$;

select
  count(*) as snapshot_rows,
  count(*) filter (
    where a.user_id is not null
      and a.theta is not distinct from b.theta
      and a.theta_se is not distinct from b.theta_se
      and a.n_responses is not distinct from b.n_responses
      and a.updated_at is not distinct from b.updated_at
  ) as exactly_restored_rows
from public.obs_idk_recompute_before b
left join public.user_abilities a
  on a.user_id = b.user_id and a.scope = b.scope;
