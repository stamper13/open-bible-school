-- Verifies the evidence-weighted mastery and foundation guard migration.
-- Read-only; the transaction is rolled back.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $assertion$
declare
  v_score numeric;
  v_has_foundation boolean;
  v_function_count integer;
begin
  select count(*)
  into v_function_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'obs_focused_mastery_raw',
      'obs_unit_has_foundation_items',
      'obs_get_ladder_state_v1',
      'obs_get_user_recommendation_v2',
      'obs_get_current_focus_path'
    );

  if v_function_count < 5 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected five mastery/foundation functions, found %s.', v_function_count);
  end if;

  select public.obs_focused_mastery_raw(
    null, 0.85, 0.85,
    true, true, true
  )
  into v_score;

  if v_score is null or v_score < 79 or v_score > 81 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Evidence-weighted mastery did not redistribute over answered stages; got %s.',
        v_score
      );
  end if;

  select public.obs_unit_has_foundation_items('gen-12-50')
  into v_has_foundation;

  if not coalesce(v_has_foundation, false) then
    raise exception using
      errcode = 'P0001',
      message = 'Expected gen-12-50 to have at least one foundation item.';
  end if;
end
$assertion$;

rollback;
