-- No-op probe migration created while verifying the Supabase migration API.
-- The follow-up migration creates the actual section-sort submit RPC.

create or replace function public.__codex_apply_probe()
returns integer
language sql
as $$
  select 1;
$$;

drop function public.__codex_apply_probe();
