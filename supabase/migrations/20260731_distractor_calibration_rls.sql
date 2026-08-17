begin;

alter table public.obs_distractor_distance_calibration
  enable row level security;

revoke all on table public.obs_distractor_distance_calibration
  from public, anon, authenticated;

comment on table public.obs_distractor_distance_calibration is
  'Internal distractor-distance calibration data. Client access is intentionally disabled.';

commit;
