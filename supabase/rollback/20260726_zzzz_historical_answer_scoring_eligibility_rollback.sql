-- Roll back historical answer scoring eligibility.
-- Run before rolling back any later migration that replaces these functions.

begin;

drop trigger if exists assessment_answers_set_scoring_eligibility
  on public.assessment_answers;
drop function if exists public.obs_set_answer_scoring_eligibility();

do $$
declare
  backup record;
  restored integer := 0;
begin
  for backup in
    select definition
    from public.obs_schema_backups
    where backup_tag =
        '20260726_historical_answer_scoring_eligibility'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in (
        'obs_compute_bli_internal',
        'obs_compute_scoped_bli',
        'obs_get_scope_summary',
        'obs_get_user_recommendation_v2',
        'update_theta_internal',
        'obs_capture_answer_delivery_snapshot'
      )
    order by id
  loop
    execute backup.definition;
    restored := restored + 1;
  end loop;

  if restored <> 6 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Eligibility rollback aborted: expected 6 function backups, restored %s.',
        restored
      );
  end if;
end
$$;

delete from public.user_abilities;
insert into public.user_abilities
select *
from public.obs_20260726_ability_before_answer_eligibility;

drop index if exists public.assessment_answers_scoring_eligible_user_idx;

alter table public.assessment_answers
  drop column if exists scoring_eligibility_reviewed_at,
  drop column if exists scoring_exclusion_reason,
  drop column if exists scoring_eligible;

drop table if exists
  public.obs_20260726_ability_before_answer_eligibility;

notify pgrst, 'reload schema';

commit;
