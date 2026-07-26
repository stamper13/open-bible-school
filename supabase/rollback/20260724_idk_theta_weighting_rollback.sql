-- =====================================================================
-- ROLLBACK for 20260724_idk_theta_weighting
-- =====================================================================
-- Restores update_theta_internal to its pre-IDK-weighting definition
-- (the version installed by obs_distractor_dial_core + precision fix).
--
-- Requires exactly one captured backup. Drops nothing: the dial helpers
-- and calibration table are shared contracts and are left intact.
--
-- NOTE ON DATA. If 20260724_idk_theta_recompute has already been run,
-- restoring the function does NOT restore stored theta. Roll the data
-- back first using obs_idk_recompute_before, then run this file.
-- =====================================================================

do $$
declare
  v_def text;
  v_n integer;
begin
  select count(*) into v_n
  from public.obs_schema_backups
  where backup_tag = '20260724_idk_theta_weighting'
    and object_schema = 'public'
    and object_name = 'update_theta_internal'
    and object_type = 'function';

  if v_n <> 1 then
    raise exception using errcode = 'P0001',
      message = format(
        'Refusing to roll back: expected exactly 1 update_theta_internal backup for tag 20260724_idk_theta_weighting, found %s. No changes made.',
        v_n
      );
  end if;

  select definition into v_def
  from public.obs_schema_backups
  where backup_tag = '20260724_idk_theta_weighting'
    and object_schema = 'public'
    and object_name = 'update_theta_internal'
    and object_type = 'function';

  execute v_def;
  raise notice 'update_theta_internal restored to pre-IDK-weighting definition.';
end $$;

notify pgrst, 'reload schema';

-- Confirm idk_weight is gone (expect 0).
select count(*) as idk_weight_present
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'update_theta_internal'
  and pg_get_functiondef(oid) like '%idk_weight%';
