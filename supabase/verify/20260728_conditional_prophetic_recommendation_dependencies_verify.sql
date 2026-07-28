-- Fail-loud verification for conditional prophetic recommendation context.

do $$
declare
  universal_kings integer;
  conditional_history integer;
  dependency_rules integer;
  isaiah_rules integer;
  postexilic_rules integer;
  early_northern_extra_rules integer;
  dependency_rls_enabled boolean;
  recommendation_definition text;
begin
  select count(*)::integer
  into universal_kings
  from public.obs_learning_units
  where book_code in ('1KI', '2KI')
    and is_foundation
    and start_chapter = 1;

  select count(*)::integer
  into conditional_history
  from public.obs_learning_units
  where unit_key in (
    '1ch-1-29',
    '2ch-1-36',
    'ezr-1-10',
    'neh-1-13'
  )
    and not is_foundation;

  select count(*)::integer
  into dependency_rules
  from public.obs_prophetic_recommendation_dependencies;

  select count(*)::integer
  into isaiah_rules
  from public.obs_prophetic_recommendation_dependencies
  where target_book_code = 'ISA'
    and prerequisite_unit_key in ('1ch-1-29', '2ch-1-36');

  select count(*)::integer
  into postexilic_rules
  from public.obs_prophetic_recommendation_dependencies
  where (
      target_book_code in ('HAG', 'ZEC')
      and prerequisite_unit_key = 'ezr-1-10'
    )
    or (
      target_book_code = 'MAL'
      and prerequisite_unit_key in (
        'ezr-1-10',
        'neh-1-13'
      )
    );

  select count(*)::integer
  into early_northern_extra_rules
  from public.obs_prophetic_recommendation_dependencies
  where target_book_code in ('HOS', 'AMO', 'JON', 'NAM');

  select class.relrowsecurity
  into dependency_rls_enabled
  from pg_class class
  where class.oid =
    'public.obs_prophetic_recommendation_dependencies'::regclass;

  select pg_get_functiondef(
    'public.obs_get_user_recommendation_v2(uuid)'::regprocedure
  )
  into recommendation_definition;

  if universal_kings <> 2
     or conditional_history <> 4
     or dependency_rules <> 16
     or isaiah_rules <> 2
     or postexilic_rules <> 4
     or early_northern_extra_rules <> 0
     or not coalesce(dependency_rls_enabled, false)
     or recommendation_definition not like '%foundation_gap%'
     or recommendation_definition not like '%dependency_gap%'
     or recommendation_definition not like
       '%obs_prophetic_recommendation_dependencies%'
     or recommendation_definition not like
       '%Historical context needed before%'
     or recommendation_definition not like
       '%obs_get_unit_mastery_score%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Conditional prophetic dependency verification failed: kings=%s history=%s rules=%s Isaiah=%s postexilic=%s northern_extra=%s.',
        universal_kings,
        conditional_history,
        dependency_rules,
        isaiah_rules,
        postexilic_rules,
        early_northern_extra_rules
      );
  end if;

  raise notice
    'PASS: Kings remains universal; Chronicles and Ezra-Nehemiah are conditional, book-specific prophetic prerequisites.';
end
$$;

select
  dependency.target_book_code,
  string_agg(
    unit.label,
    ' -> '
    order by dependency.priority
  ) as conditional_historical_context
from public.obs_prophetic_recommendation_dependencies dependency
join public.obs_learning_units unit
  on unit.unit_key = dependency.prerequisite_unit_key
group by dependency.target_book_code
order by dependency.target_book_code;
