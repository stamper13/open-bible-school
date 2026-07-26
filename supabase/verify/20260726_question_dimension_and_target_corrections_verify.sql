do $$
declare
  active_count integer;
  eligible_count integer;
  blocker_count integer;
  corrected_override_count integer;
  corrected_target_count integer;
begin
  select
    count(*),
    count(*) filter (where router_eligible),
    count(*) filter (where cardinality(blocker_reasons) > 0)
  into active_count, eligible_count, blocker_count
  from public.obs_admin_question_bank_audit;

  select count(*)
  into corrected_override_count
  from public.obs_question_dimension_overrides
  where review_reason = '20260726 coverage audit: reviewed against the revised seven-dimension contract.';

  select count(*)
  into corrected_target_count
  from public.question_coverage_targets
  where (book_code, dimension_key) in (
    ('DEU', 'events_timeline'),
    ('JOB', 'characters_lineage'),
    ('JOB', 'events_timeline'),
    ('LEV', 'events_timeline'),
    ('SNG', 'characters_lineage'),
    ('SNG', 'events_timeline')
  )
    and target_active_questions > 0
    and minimum_active_questions > 0;

  if active_count <> eligible_count
     or blocker_count <> 0
     or corrected_override_count <> 40
     or corrected_target_count <> 6
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: active=%s eligible=%s blockers=%s overrides=%s/40 targets=%s/6.',
        active_count,
        eligible_count,
        blocker_count,
        corrected_override_count,
        corrected_target_count
      );
  end if;

  raise notice
    'PASS: % active questions are router-eligible; 40 dimensions corrected; 6 coverage cells activated.',
    active_count;
end
$$;

select
  book_code,
  dimension_key,
  count(*)::integer as active_questions,
  count(*) filter (where router_eligible)::integer as eligible_questions
from public.obs_admin_question_bank_audit
where book_code in ('DEU', 'ECC', 'JOB', 'LEV', 'PRO', 'PSA', 'SNG')
group by book_code, dimension_key
order by book_code, dimension_key;
