-- Router v6, step 2 of 6: recording a reread claim.
--
-- Read side shipped in step 1 (obs_unit_antievidence). This is the write side:
-- one named RPC so the dashboard's "I reread it" control has an entry point
-- that is not the client passing a magic event-type string.
--
-- obs_study_plan_events already permits 'reading_completed' in its type check,
-- so no constraint changes here and no existing writer changes behavior.
--
-- Scores are untouched by design. A reread claim is a statement about study,
-- not about knowledge; it makes the router retest a cell, never award it. See
-- the header of web/lib/readingLog.ts for the same argument made to users.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.obs_study_plan_events') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regprocedure('public.obs_is_authorized_user(uuid)') is null
     or to_regprocedure('public.obs_unit_antievidence(uuid)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 2 prerequisites are missing; nothing was changed.';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    where table_row.relname = 'obs_study_plan_events'
      and constraint_row.conname = 'obs_study_plan_events_type_ck'
      and pg_get_constraintdef(constraint_row.oid) like '%reading_completed%'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'obs_study_plan_events does not accept reading_completed; '
        'router v6 step 2 will not widen the constraint implicitly.';
  end if;
end
$$;

create or replace function public.obs_mark_unit_reread(
  p_user_id uuid,
  p_unit_key text,
  p_source text default 'dashboard'
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recorded_at timestamptz;
  v_recent timestamptz;
begin
  -- coalesce, because obs_is_authorized_user returns NULL (not false) when
  -- there is no JWT: `if not null then` is false, so a bare guard would fall
  -- through instead of rejecting. Unreachable via PostgREST as `authenticated`,
  -- but the guard should not depend on that.
  if not coalesce(public.obs_is_authorized_user(p_user_id), false) then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if p_unit_key is null
     or not exists (
       select 1
       from public.obs_learning_units unit
       where unit.unit_key = p_unit_key
     )
  then
    raise exception using
      errcode = '22023',
      message = format('Unknown learning unit: %s', coalesce(p_unit_key, '<null>'));
  end if;

  -- One reread claim per unit per hour. Double-clicking the interstitial is
  -- one statement about study, and repeated marks must not be able to hold a
  -- cell permanently stale and starve the rest of the ledger.
  select max(event.created_at)
  into v_recent
  from public.obs_study_plan_events event
  where event.user_id = p_user_id
    and event.unit_key = p_unit_key
    and event.event_type = 'reading_completed'
    and event.created_at > now() - interval '1 hour';

  if v_recent is not null then
    return v_recent;
  end if;

  insert into public.obs_study_plan_events (
    user_id,
    unit_key,
    event_type,
    attempt_id,
    metadata
  ) values (
    p_user_id,
    p_unit_key,
    'reading_completed',
    null,
    jsonb_build_object(
      'source', coalesce(nullif(btrim(p_source), ''), 'dashboard'),
      'router_contract', 'v6_antievidence'
    )
  )
  returning created_at into v_recorded_at;

  return v_recorded_at;
end;
$$;

comment on function public.obs_mark_unit_reread(uuid, text, text) is
  'Records a learner reread claim for one learning unit. Never changes a '
  'score; it marks the router thesis for that unit stale so v6 retests it. '
  'Rate limited to one claim per unit per hour.';

revoke all on function public.obs_mark_unit_reread(uuid, text, text) from public;
grant execute on function public.obs_mark_unit_reread(uuid, text, text) to authenticated, service_role;

commit;
