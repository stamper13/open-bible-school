-- Verify the NT expository-competence quality layer.
-- Every invariant is fail-loud; a successful run ends with the reports below.

do $$
declare
  reviewed_count integer;
  approved_count integer;
  provisional_count integer;
  rewrite_count integer;
  excluded_count integer;
  covered_books integer;
  approved_books integer;
  unreviewed_count integer;
  invalid_policy_count integer;
  backup_count integer;
  review_rls_enabled boolean;
  start_definition text;
  next_definition text;
  theta_definition text;
begin
  if to_regclass('public.obs_nt_expository_item_reviews') is null
     or to_regclass('public.obs_nt_expository_review_queue') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT expository review table or queue view is missing.';
  end if;

  select
    count(*),
    count(*) filter (where review.review_status = 'approved'),
    count(*) filter (where review.review_status = 'provisional'),
    count(*) filter (where review.review_status = 'rewrite'),
    count(*) filter (where review.review_status = 'excluded'),
    count(distinct question.book_code),
    count(distinct question.book_code) filter (
      where review.review_status = 'approved'
    )
  into
    reviewed_count,
    approved_count,
    provisional_count,
    rewrite_count,
    excluded_count,
    covered_books,
    approved_books
  from public.obs_nt_expository_item_reviews review
  join public.v_nt_question_bank question
    on question.generated_question_id = review.generated_question_id;

  select count(*)
  into unreviewed_count
  from public.v_nt_question_bank question
  left join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.generated_question_id is null;

  select count(*)
  into invalid_policy_count
  from public.obs_nt_expository_item_reviews review
  where not (
    (
      review.review_status = 'approved'
      and review.routing_priority = 3
      and review.scoring_weight = 1.0
    )
    or (
      review.review_status = 'provisional'
      and review.routing_priority = 1
      and review.scoring_weight = 0.55
    )
    or (
      review.review_status in ('rewrite', 'excluded')
      and review.routing_priority = 0
      and review.scoring_weight = 0.0
    )
  );

  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_expository_competence_quality_layer'
    and object_schema = 'public'
    and (
      (
        object_type = 'function'
        and object_name in (
          'obs_start_nt_assessment',
          'obs_get_next_nt_assessment_question',
          'update_theta_internal'
        )
      )
      or (
        object_type = 'data'
        and object_name = 'user_abilities'
      )
    );

  select class.relrowsecurity
  into review_rls_enabled
  from pg_class class
  where class.oid =
    'public.obs_nt_expository_item_reviews'::regclass;

  select pg_get_functiondef(
    'public.obs_start_nt_assessment(text,text,integer)'::regprocedure
  )
  into start_definition;

  select pg_get_functiondef(
    'public.obs_get_next_nt_assessment_question(uuid)'::regprocedure
  )
  into next_definition;

  select pg_get_functiondef(
    'public.update_theta_internal(uuid,text,uuid,boolean)'::regprocedure
  )
  into theta_definition;

  if reviewed_count <> 139
     or approved_count <> 68
     or provisional_count <> 59
     or rewrite_count <> 12
     or excluded_count <> 0
     or covered_books <> 27
     or approved_books <> 27
     or unreviewed_count <> 0
     or invalid_policy_count <> 0
     or backup_count <> 4
     or not coalesce(review_rls_enabled, false)
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT quality verification failed: reviewed=%s approved=%s provisional=%s rewrite=%s excluded=%s books=%s approved_books=%s unreviewed=%s invalid_policy=%s backups=%s rls=%s.',
        reviewed_count,
        approved_count,
        provisional_count,
        rewrite_count,
        excluded_count,
        covered_books,
        approved_books,
        unreviewed_count,
        invalid_policy_count,
        backup_count,
        review_rls_enabled
      );
  end if;

  if lower(start_definition) not like
       '%join public.obs_nt_expository_item_reviews review%'
     or lower(next_definition) not like
       '%join public.obs_nt_expository_item_reviews review%'
     or lower(next_definition) not like
       '%ranked.routing_priority desc%'
     or lower(theta_definition) not like
       '%review.scoring_weight%'
     or lower(theta_definition) not like
       '%coalesce(review.scoring_weight, 0.0) > 0.0%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'NT quality verification failed: one or more functions are not wired to the review policy.';
  end if;

  if has_table_privilege('anon', 'public.obs_nt_expository_item_reviews', 'SELECT')
     or has_table_privilege(
       'authenticated',
       'public.obs_nt_expository_item_reviews',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'public.obs_nt_expository_review_queue',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.obs_nt_expository_review_queue',
       'SELECT'
     )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'NT quality verification failed: private review objects are readable by client roles.';
  end if;
end
$$;

select
  review.review_status,
  count(*) as question_count,
  min(review.scoring_weight) as scoring_weight,
  min(review.routing_priority) as routing_priority
from public.obs_nt_expository_item_reviews review
group by review.review_status
order by min(review.routing_priority) desc;

select
  question.book_code,
  count(*) filter (
    where review.review_status = 'approved'
  ) as approved,
  count(*) filter (
    where review.review_status = 'provisional'
  ) as provisional,
  count(*) filter (
    where review.review_status = 'rewrite'
  ) as rewrite,
  count(*) filter (
    where review.review_status in ('approved', 'provisional')
  ) as routable
from public.v_nt_question_bank question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.generated_question_id
group by question.book_code
order by question.book_code;

select
  ability.scope,
  count(*) as ability_rows,
  round(avg(ability.theta)::numeric, 4) as mean_theta,
  sum(ability.n_responses) as scored_responses
from public.user_abilities ability
where ability.scope in (
  'NT', 'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
)
group by ability.scope
order by ability.scope;

select
  generated_question_id,
  book_code,
  prompt,
  review_status,
  review_notes
from public.obs_nt_expository_review_queue
where review_status = 'rewrite'
order by book_code, generated_question_id;
