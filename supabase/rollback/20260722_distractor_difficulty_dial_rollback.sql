-- Roll back the live distractor-distance dial and restore captured functions.

begin;

do $$
declare
  backup record;
begin
  for backup in
    select b.*
    from public.obs_schema_backups b
    where b.backup_tag = '20260722_distractor_difficulty_dial'
      and b.object_schema = 'public'
      and b.object_type = 'function'
    order by case b.object_name
      when 'compute_bli' then 10
      when 'update_theta_internal' then 20
      when 'get_next_assessment_question' then 30
      when 'obs_get_next_focused_question' then 40
      when 'obs_simulate_router_v2' then 50
      when 'nt_get_pilot_questions' then 60
      else 100
    end
  loop
    execute backup.definition;
  end loop;
end $$;

drop view if exists public.obs_question_distractor_profiles;
drop function if exists public.obs_item_information(
  double precision,
  double precision,
  double precision
);
drop function if exists public.obs_effective_item_irt_b(jsonb, double precision);
drop function if exists public.obs_effective_item_irt_a(jsonb, double precision);
drop function if exists public.obs_normalize_distractor_distance(text);
drop function if exists public.obs_payload_number(jsonb, text);
drop table if exists public.obs_distractor_distance_calibration;

notify pgrst, 'reload schema';

commit;
