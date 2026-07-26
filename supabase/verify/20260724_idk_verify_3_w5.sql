-- =====================================================================
-- IDK POST-APPLY VERIFICATION 3 OF 3: W5
-- =====================================================================
-- Run after W4 reports "W4 PASS (rolled back as designed)".
-- Expected result: "Success. No rows returned."
-- =====================================================================

do $$
declare v_n int;
begin
  if to_regclass('public.obs_idk_scope_census') is null then
    raise exception using errcode = 'P0001',
      message = 'W5 CANNOT RUN: obs_idk_scope_census is missing.';
  end if;

  select count(*) into v_n
  from public.obs_idk_scope_census c
  join public.user_abilities ua
    on ua.user_id = c.user_id and ua.scope = c.scope
  where ua.theta is distinct from c.theta_before
     or ua.theta_se is distinct from c.theta_se_before
     or ua.n_responses is distinct from c.n_before;

  if v_n <> 0 then
    raise exception using errcode = 'P0001',
      message = format(
        'W5 FAILED: %s ability rows drifted from the W0 census. Verification was supposed to roll back.',
        v_n
      );
  end if;

  raise notice 'W5 PASS: user_abilities identical to the W0 census; nothing persisted.';
end $$;
