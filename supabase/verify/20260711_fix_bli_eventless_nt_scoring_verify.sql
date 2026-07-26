-- Post-migration verification for 20260711_fix_bli_eventless_nt_scoring.sql.
-- Read only: run each result set in staging immediately after applying the fix.

begin transaction read only;

-- Both definitions should contain LEFT JOINs to bible_events/v_question_bank;
-- update_theta_internal should contain explicit NT scopes and SQLSTATE 22023.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) ~* 'left[[:space:]]+join[[:space:]]+public[.]bible_events' as event_join_is_left,
  pg_get_functiondef(p.oid) ~* 'left[[:space:]]+join[[:space:]]+public[.]v_question_bank' as bank_join_is_left,
  pg_get_functiondef(p.oid) ~* 'GOSPELS_ACTS' as has_nt_scopes,
  pg_get_functiondef(p.oid) ~* '22023' as rejects_unknown_scope
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('compute_bli', 'update_theta_internal')
order by p.proname;

-- Every active answer should be classified as scorable or have one explicit
-- reason. Any nonzero exclusion count needs review before production release.
with classified as (
  select
    aa.user_id,
    aa.generated_question_id,
    upper(coalesce(be.book_code, qb.book_code)) as resolved_book_code,
    case
      when oq.id is null then 'missing_question'
      when oq.question_type like 'quarantined%' then 'quarantined'
      when coalesce(be.book_code, qb.book_code) is null then 'missing_book'
      when bw.book_code is null then 'missing_book_weight'
      else 'scorable'
    end as status
  from public.assessment_answers aa
  left join public.ot_generated_questions oq
    on oq.id = aa.generated_question_id
  left join public.bible_events be
    on be.id = oq.event_id
  left join public.v_question_bank qb
    on qb.generated_question_id = oq.id
  left join public.book_bli_weights bw
    on upper(bw.book_code) = upper(coalesce(be.book_code, qb.book_code))
)
select status, count(*) as answers, count(distinct user_id) as users
from classified
group by status
order by status;

-- Quantify newly included answers by book. These were previously removed by
-- the event INNER JOIN and should now resolve through v_question_bank.
select
  upper(qb.book_code) as book_code,
  count(*) as newly_included_answers,
  count(distinct aa.user_id) as affected_users,
  count(*) filter (
    where (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
  ) as answers_with_payload_b,
  count(*) filter (
    where not ((qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$')
       or qb.payload->>'irt_b' is null
  ) as answers_defaulting_b_zero
from public.assessment_answers aa
join public.ot_generated_questions oq
  on oq.id = aa.generated_question_id
left join public.bible_events be
  on be.id = oq.event_id
left join public.v_question_bank qb
  on qb.generated_question_id = oq.id
where be.id is null
  and oq.question_type not like 'quarantined%'
group by upper(qb.book_code)
order by newly_included_answers desc, book_code;

-- Confirm that all canonical books used by questions have BLI weights.
select distinct upper(qb.book_code) as missing_weight_book_code
from public.v_question_bank qb
left join public.book_bli_weights bw
  on upper(bw.book_code) = upper(qb.book_code)
where qb.book_code is not null
  and bw.book_code is null
order by missing_weight_book_code;

-- The migration must have captured both rollback definitions.
select object_name, count(*) as backups
from public.obs_schema_backups
where backup_tag = '20260711_fix_bli_eventless_nt_scoring'
  and object_schema = 'public'
  and object_type = 'function'
group by object_name
order by object_name;

rollback;
