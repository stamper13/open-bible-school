-- Read-only verification for 20260722_distractor_difficulty_dial.sql.

begin transaction read only;

-- Four canonical dial positions should be present.
select
  distance,
  distance_key,
  label,
  default_irt_b,
  min_irt_b,
  max_irt_b
from public.obs_distractor_distance_calibration
order by distance;

-- Show how much of the active bank is dial-ready.
select
  metadata_status,
  count(*) as active_questions,
  count(*) filter (where distractor_distance is not null) as distance_tagged,
  count(*) filter (where stem_family is not null) as family_tagged,
  round(avg(effective_irt_b)::numeric, 3) as mean_effective_b
from public.obs_question_distractor_profiles
group by metadata_status
order by metadata_status;

-- Review malformed or incomplete metadata before authoring more variants.
select
  generated_question_id,
  book_code,
  question_type,
  stem_family,
  authored_distance,
  authored_irt_b,
  effective_irt_b,
  metadata_status
from public.obs_question_distractor_profiles
where metadata_status not in ('ready', 'legacy_fallback')
order by metadata_status, book_code, generated_question_id
limit 200;

-- Confirm live scoring and routing use the shared item-level helpers.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) ~* 'obs_effective_item_irt_b' as uses_item_b,
  pg_get_functiondef(p.oid) ~* 'obs_item_information' as uses_information,
  pg_get_functiondef(p.oid) ~* 'stem_family' as excludes_stem_family
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'compute_bli',
    'update_theta_internal',
    'get_next_assessment_question',
    'obs_get_next_focused_question',
    'obs_simulate_router_v2',
    'nt_get_pilot_questions'
  )
order by p.proname;

-- Verify that each difficulty position peaks nearest its intended theta.
with theta_grid as (
  select generate_series(-20, 25)::double precision / 10.0 as theta
)
select
  calibration.distance_key,
  calibration.default_irt_b,
  (
    array_agg(
      theta_grid.theta
      order by public.obs_item_information(
        theta_grid.theta,
        1.0,
        calibration.default_irt_b
      ) desc
    )
  )[1] as peak_information_theta
from public.obs_distractor_distance_calibration calibration
cross join theta_grid
group by calibration.distance_key, calibration.default_irt_b
order by calibration.default_irt_b;

rollback;
