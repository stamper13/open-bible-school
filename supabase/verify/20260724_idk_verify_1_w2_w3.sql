-- =====================================================================
-- IDK POST-APPLY VERIFICATION 1 OF 3: W2 + W3
-- =====================================================================
-- Expected result: "Success. No rows returned."
-- Any error beginning W2 FAILED or W3 FAILED is a real failure.
-- =====================================================================

-- W2. Confirm exactly one pre-migration function backup was captured.
do $$
declare v_n int;
begin
  select count(*) into v_n
  from public.obs_schema_backups
  where backup_tag = '20260724_idk_theta_weighting'
    and object_type = 'function'
    and object_name = 'update_theta_internal';

  if v_n <> 1 then
    raise exception using errcode = 'P0001',
      message = format(
        'W2 FAILED: expected exactly 1 captured backup, found %s.',
        v_n
      );
  end if;

  raise notice 'W2 PASS: 1 function backup captured.';
end $$;

-- W3. Confirm the shared dial helpers and precision-fixed compute_bli
-- remain installed and untouched.
do $$
declare v_n int;
begin
  select count(*) into v_n
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in (
      'obs_payload_number',
      'obs_normalize_distractor_distance',
      'obs_effective_item_irt_a',
      'obs_effective_item_irt_b',
      'obs_item_information'
    );

  if v_n <> 5 then
    raise exception using errcode = 'P0001',
      message = format(
        'W3 FAILED: expected 5 dial helpers present, found %s.',
        v_n
      );
  end if;

  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'compute_bli'
      and pg_get_functiondef(oid) like '%)::numeric as b%'
  ) then
    raise exception using errcode = 'P0001',
      message = 'W3 FAILED: compute_bli has regained the ::numeric cast.';
  end if;

  raise notice 'W3 PASS: 5 helpers intact, compute_bli unchanged.';
end $$;
