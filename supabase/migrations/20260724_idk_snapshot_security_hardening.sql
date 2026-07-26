-- =====================================================================
-- IDK VERIFICATION SNAPSHOT SECURITY
-- =====================================================================
-- Run once after W5 and before the persistent recomputation.
-- The census contains user identifiers and ability estimates. It is an
-- administrative verification table and must not be client-readable.
-- =====================================================================

do $$
begin
  if to_regclass('public.obs_idk_scope_census') is null then
    raise exception using errcode = 'P0001',
      message = 'SECURITY HARDENING FAILED: obs_idk_scope_census is missing.';
  end if;

  alter table public.obs_idk_scope_census enable row level security;
  revoke all on table public.obs_idk_scope_census from anon, authenticated;

  raise notice 'SECURITY HARDENING PASS: census RLS enabled and client access revoked.';
end $$;
