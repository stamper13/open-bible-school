-- Restore the 33 NT payloads and review records exactly as they were before
-- canonical dimension assignment.

begin;

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_unclassified_dimension_canonicalization'
    and object_schema = 'public'
    and object_type = 'data'
    and object_name in (
      'ot_generated_questions_payloads_33',
      'obs_nt_expository_item_reviews_33'
    );

  if backup_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT dimension rollback requires 2 backups; found %s.',
        backup_count
      );
  end if;
end
$$;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_unclassified_dimension_canonicalization'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions_payloads_33'
    and object_type = 'data'
), saved as (
  select row.*
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    id uuid,
    payload jsonb
  )
)
update public.ot_generated_questions question
set payload = saved.payload
from saved
where question.id = saved.id;

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_unclassified_dimension_canonicalization'
    and object_schema = 'public'
    and object_name = 'obs_nt_expository_item_reviews_33'
    and object_type = 'data'
), saved as (
  select row.*
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    generated_question_id uuid,
    review_status text,
    expository_target text,
    text_dependence smallint,
    orthodoxy_guessability smallint,
    book_discrimination smallint,
    confessional_sensitivity text,
    routing_priority smallint,
    scoring_weight double precision,
    review_basis text,
    review_notes text,
    reviewed_by text,
    reviewed_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  )
)
insert into public.obs_nt_expository_item_reviews (
  generated_question_id,
  review_status,
  expository_target,
  text_dependence,
  orthodoxy_guessability,
  book_discrimination,
  confessional_sensitivity,
  routing_priority,
  scoring_weight,
  review_basis,
  review_notes,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
)
select
  generated_question_id,
  review_status,
  expository_target,
  text_dependence,
  orthodoxy_guessability,
  book_discrimination,
  confessional_sensitivity,
  routing_priority,
  scoring_weight,
  review_basis,
  review_notes,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
from saved
on conflict (generated_question_id) do update
set
  review_status = excluded.review_status,
  expository_target = excluded.expository_target,
  text_dependence = excluded.text_dependence,
  orthodoxy_guessability = excluded.orthodoxy_guessability,
  book_discrimination = excluded.book_discrimination,
  confessional_sensitivity = excluded.confessional_sensitivity,
  routing_priority = excluded.routing_priority,
  scoring_weight = excluded.scoring_weight,
  review_basis = excluded.review_basis,
  review_notes = excluded.review_notes,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

delete from public.obs_schema_backups
where backup_tag =
        '20260729_nt_unclassified_dimension_canonicalization'
  and object_schema = 'public'
  and object_type = 'data'
  and object_name in (
    'ot_generated_questions_payloads_33',
    'obs_nt_expository_item_reviews_33'
  );

commit;
