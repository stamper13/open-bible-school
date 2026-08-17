do $$
declare
  active_mcqs integer;
  queued integer;
  imported integer;
begin
  if to_regclass('public.obs_semantic_distractor_reviews') is null
     or to_regclass(
       'public.obs_semantic_distractor_review_queue'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Semantic distractor objects are missing.';
  end if;

  select count(*)
  into active_mcqs
  from public.obs_semantic_distractor_review_queue;

  select count(*)
  into queued
  from public.obs_semantic_distractor_review_queue
  where requires_semantic_review;

  select count(*)
  into imported
  from public.obs_semantic_distractor_reviews
  where reviewed_by = '20260729_semantic_audit_import'
    and review_status = 'pass'
    and same_semantic_category
    and not obvious_elimination_present;

  if active_mcqs = 0
     or queued > active_mcqs
     or imported > active_mcqs
     or imported = 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Semantic distractor verification failed: active=%s queued=%s imported=%s.',
        active_mcqs,
        queued,
        imported
      );
  end if;

  if has_table_privilege(
       'anon',
       'public.obs_semantic_distractor_reviews',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.obs_semantic_distractor_reviews',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'public.obs_semantic_distractor_review_queue',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.obs_semantic_distractor_review_queue',
       'SELECT'
     )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Semantic distractor objects expose answer data.';
  end if;
end
$$;

select
  semantic_review_priority,
  count(*) as questions,
  count(*) filter (where requires_semantic_review) as queued
from public.obs_semantic_distractor_review_queue
group by semantic_review_priority
order by semantic_review_priority;
