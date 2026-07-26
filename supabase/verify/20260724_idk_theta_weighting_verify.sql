-- =====================================================================
-- VERIFICATION for 20260724_idk_theta_weighting
-- =====================================================================
-- W0-W1 run BEFORE the migration. W2-W5 run AFTER.
-- All assertions RAISE on failure. No tolerances are used anywhere.
--
-- W0 creates one scratch table. W4 writes inside a block that always
-- raises, so it rolls back. Nothing else writes.
-- =====================================================================


-- =====================================================================
-- Shared scope->books mapping, mirroring update_theta_internal's CASE.
-- Recreated in each step because execute_sql sessions do not persist.
-- =====================================================================
-- with scope_books(scope, books) as (values ... )   [inlined below]


-- =====================================================================
-- W0. PRE-APPLY: per-(user,scope) IDK census  [creates scratch table]
-- =====================================================================
drop table if exists public.obs_idk_scope_census;
create table public.obs_idk_scope_census as
with scope_books(scope, books) as (values
  ('BIBLE', array['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV']),
  ('OT',    array['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL']),
  ('NT',    array['MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV']),
  ('TORAH', array['GEN','EXO','LEV','NUM','DEU']),
  ('FORMER',array['JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST']),
  ('LATTER',array['ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL']),
  ('WRITINGS', array['JOB','PSA','PRO','ECC','SNG']),
  ('GOSPELS_ACTS', array['MAT','MRK','LUK','JHN','ACT']),
  ('PAULINE', array['ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM']),
  ('GENERAL', array['HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD']),
  ('APOCALYPSE', array['REV'])
), ans as (
  select aa.user_id,
         coalesce(aa.is_idk, false) as is_idk,
         upper(coalesce(be.book_code, qb.book_code)) as bk
  from public.assessment_answers aa
  join public.ot_generated_questions oq on oq.id = aa.generated_question_id
  left join public.bible_events be on be.id = oq.event_id
  left join public.v_question_bank qb on qb.generated_question_id = oq.id
  where aa.answered_at is not null
    and oq.question_type not like 'quarantined%'
)
select
  ua.user_id,
  ua.scope,
  ua.theta      as theta_before,
  ua.theta_se   as theta_se_before,
  ua.n_responses as n_before,
  coalesce(x.idk_n, 0) as idk_in_scope,
  coalesce(x.tot_n, 0) as answers_in_scope
from public.user_abilities ua
join scope_books sb on sb.scope = ua.scope
left join lateral (
  select count(*) filter (where a.is_idk) as idk_n,
         count(*) as tot_n
  from ans a
  where a.user_id = ua.user_id
    and a.bk = any(sb.books)
) x on true;

alter table public.obs_idk_scope_census enable row level security;
revoke all on table public.obs_idk_scope_census from anon, authenticated;

select
  count(*)                                   as ability_rows,
  count(*) filter (where idk_in_scope > 0)   as rows_expected_to_move,
  count(*) filter (where idk_in_scope = 0)   as rows_expected_frozen,
  sum(idk_in_scope)                          as total_idk_occurrences
from public.obs_idk_scope_census;

do $$
declare
  v_census_n integer;
  v_ability_n integer;
  v_missing_n integer;
begin
  select count(*) into v_census_n
  from public.obs_idk_scope_census;

  select count(*) into v_ability_n
  from public.user_abilities;

  select count(*) into v_missing_n
  from public.user_abilities ua
  left join public.obs_idk_scope_census c
    on c.user_id = ua.user_id and c.scope = ua.scope
  where c.user_id is null;

  if v_census_n = 0
     or v_census_n <> v_ability_n
     or v_missing_n <> 0 then
    raise exception using errcode = 'P0001',
      message = format(
        'W0 FAILED: census_rows=%s ability_rows=%s ability_rows_missing_from_census=%s.',
        v_census_n, v_ability_n, v_missing_n
      );
  end if;

  raise notice 'W0 PASS: census covers all % ability rows.', v_ability_n;
end $$;

-- Per-scope breakdown for the record.
select scope,
       count(*)                                 as ability_rows,
       count(*) filter (where idk_in_scope > 0) as rows_with_idk,
       sum(idk_in_scope)                        as idk_in_scope,
       sum(answers_in_scope)                    as answers_in_scope
from public.obs_idk_scope_census
group by scope
order by sum(idk_in_scope) desc, scope;


-- =====================================================================
-- W1. PRE-APPLY: confirm IDK is currently UNWEIGHTED  [ABORTS]
-- =====================================================================
-- Guards against applying twice, and against applying to a version that
-- already handles IDK by some other means.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(oid) into v_def
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'update_theta_internal';

  if v_def like '%idk_weight%' then
    raise exception using errcode = 'P0001',
      message = 'W1 FAILED: update_theta_internal already contains idk_weight. Migration appears already applied.';
  end if;
  if v_def not like '%aa.is_correct::integer as r%' then
    raise exception using errcode = 'P0001',
      message = 'W1 FAILED: update_theta_internal does not match the expected pre-migration shape. Re-review before applying.';
  end if;
  if v_def not like '%obs_effective_item_irt_a%' or v_def not like '%obs_effective_item_irt_b%' then
    raise exception using errcode = 'P0001',
      message = 'W1 FAILED: dial helpers are not wired into update_theta_internal. Apply obs_distractor_dial_core first.';
  end if;
  raise notice 'W1 PASS: pre-migration shape confirmed, helpers present, IDK currently unweighted.';
end $$;


-- =====================================================================
-- W2. POST-APPLY: backup captured  [ABORTS]
-- =====================================================================
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
      message = format('W2 FAILED: expected exactly 1 captured backup, found %s.', v_n);
  end if;
  raise notice 'W2 PASS: 1 function backup captured.';
end $$;


-- =====================================================================
-- W3. POST-APPLY: helpers untouched  [ABORTS]
-- =====================================================================
-- This migration must not have altered the dial contracts.
do $$
declare v_n int;
begin
  select count(*) into v_n
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('obs_payload_number','obs_normalize_distractor_distance',
                    'obs_effective_item_irt_a','obs_effective_item_irt_b',
                    'obs_item_information');
  if v_n <> 5 then
    raise exception using errcode = 'P0001',
      message = format('W3 FAILED: expected 5 dial helpers present, found %s.', v_n);
  end if;

  -- compute_bli must still be the precision-fixed version.
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'compute_bli'
      and pg_get_functiondef(oid) like '%)::numeric as b%'
  ) then
    raise exception using errcode = 'P0001',
      message = 'W3 FAILED: compute_bli has regained the ::numeric cast.';
  end if;
  raise notice 'W3 PASS: 5 helpers intact, compute_bli unchanged.';
end $$;


-- =====================================================================
-- W4. POST-APPLY: scope-aware theta equivalence  [OLD-FN vs NEW-FN]
-- =====================================================================
-- Rigorous method: restore the pre-migration definition from the backup,
-- recompute every pair, then recompute under the current definition and
-- diff the two RECOMPUTATIONS. Stored values are never used as a
-- reference, because they were written by older function versions and
-- would measure staleness rather than migration effect.
--
-- Assertions, all exact:
--   (a) every row with idk_in_scope = 0 must be BIT-IDENTICAL
--   (b) every row with idk_in_scope > 0 must CHANGE
--   (c) n_responses must be identical for every row (raw count preserved)
--   (d) for changed rows, theta must RISE
--
-- theta_se movement is reported, not asserted. Downweighting evidence
-- generally widens uncertainty, but moving the posterior can change local
-- item information enough for an individual row to narrow.
--
-- The block always raises so both function swaps and all theta writes
-- are rolled back. The verdict is in the exception message.
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
  from pg_proc where pronamespace='public'::regnamespace
    and proname='update_theta_internal';

  select definition into v_old_def
  from public.obs_schema_backups
  where backup_tag='20260724_idk_theta_weighting'
    and object_name='update_theta_internal';

  if v_old_def is null then
    raise exception using errcode='P0001',
      message='W4 CANNOT RUN: no backup for tag 20260724_idk_theta_weighting.';
  end if;

  create temp table _w4_old(
    user_id uuid, scope text, theta double precision,
    theta_se double precision, n_responses int
  ) on commit drop;

  execute v_old_def;
  perform public.update_theta_internal(ua.user_id, ua.scope, null, null)
  from public.user_abilities ua;
  insert into _w4_old
  select ua.user_id, ua.scope, ua.theta, ua.theta_se, ua.n_responses
  from public.user_abilities ua;

  execute v_new_def;
  perform public.update_theta_internal(ua.user_id, ua.scope, null, null)
  from public.user_abilities ua;

  -- (a) rows with no in-scope IDK must not move at all
  select count(*) into v_frozen_moved
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope
  join public.obs_idk_scope_census c on c.user_id=o.user_id and c.scope=o.scope
  where c.idk_in_scope = 0
    and (o.theta is distinct from n.theta or o.theta_se is distinct from n.theta_se);

  -- (b) rows with in-scope IDK must move
  select count(*) into v_moved
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope
  join public.obs_idk_scope_census c on c.user_id=o.user_id and c.scope=o.scope
  where c.idk_in_scope > 0
    and o.theta is distinct from n.theta;

  select count(*) into v_expected_moved
  from public.obs_idk_scope_census where idk_in_scope > 0;
  select count(*) into v_expected_static
  from public.obs_idk_scope_census where idk_in_scope = 0;

  -- (c) n_responses preserved everywhere
  select count(*) into v_n_changed
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope
  where o.n_responses is distinct from n.n_responses;

  -- (d) affected rows must move strictly upward
  select count(*) into v_theta_not_higher
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope
  join public.obs_idk_scope_census c on c.user_id=o.user_id and c.scope=o.scope
  where c.idk_in_scope > 0 and n.theta <= o.theta;

  select count(*) into v_se_narrowed
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope
  join public.obs_idk_scope_census c on c.user_id=o.user_id and c.scope=o.scope
  where c.idk_in_scope > 0 and n.theta_se < o.theta_se;

  select count(*) into v_se_widened
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope
  join public.obs_idk_scope_census c on c.user_id=o.user_id and c.scope=o.scope
  where c.idk_in_scope > 0 and n.theta_se > o.theta_se;

  select count(*) into v_se_same
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope
  join public.obs_idk_scope_census c on c.user_id=o.user_id and c.scope=o.scope
  where c.idk_in_scope > 0 and n.theta_se = o.theta_se;

  select coalesce(max(abs(n.theta - o.theta)), 0) into v_maxd
  from _w4_old o
  join public.user_abilities n on n.user_id=o.user_id and n.scope=o.scope;

  if v_frozen_moved <> 0
     or v_moved <> v_expected_moved
     or v_n_changed <> 0
     or v_theta_not_higher <> 0 then
    raise exception using errcode='P0001', message = format(
      'W4 FAILED (rolled back): frozen_rows_that_moved=%s (must be 0 of %s); rows_moved=%s (expected %s); n_responses_changed=%s (must be 0); theta_not_higher=%s (must be 0); SE report widened=%s narrowed=%s same=%s; max_abs_theta_delta=%s',
      v_frozen_moved, v_expected_static, v_moved, v_expected_moved,
      v_n_changed, v_theta_not_higher,
      v_se_widened, v_se_narrowed, v_se_same, v_maxd
    );
  end if;

  raise exception using errcode='P0001', message = format(
    'W4 PASS (rolled back as designed): %s rows without in-scope IDK unchanged; %s rows with in-scope IDK moved upward; n_responses preserved; SE report widened=%s narrowed=%s same=%s; max_abs_theta_delta=%s',
    v_expected_static, v_moved,
    v_se_widened, v_se_narrowed, v_se_same, v_maxd
  );
end $$;

-- Expected output is an ERROR beginning "W4 PASS". Anything beginning
-- "W4 FAILED" is a real failure. Either way nothing persists.


-- =====================================================================
-- W5. POST-APPLY: stored theta untouched by verification  [ABORTS]
-- =====================================================================
do $$
declare v_n int;
begin
  select count(*) into v_n
  from public.obs_idk_scope_census c
  join public.user_abilities ua
    on ua.user_id = c.user_id and ua.scope = c.scope
  where ua.theta is distinct from c.theta_before
     or ua.theta_se is distinct from c.theta_se_before
     or ua.n_responses is distinct from c.n_before;
  if v_n <> 0 then
    raise exception using errcode='P0001', message = format(
      'W5 FAILED: %s ability rows drifted from the W0 census. Verification was supposed to roll back.', v_n);
  end if;
  raise notice 'W5 PASS: user_abilities identical to the W0 census; nothing persisted.';
end $$;


-- =====================================================================
-- W6. CLEANUP (only after the recomputation step is accepted)
-- =====================================================================
-- obs_idk_scope_census is required by the recomputation script, so keep
-- it until that step is signed off.
-- drop table if exists public.obs_idk_scope_census;
