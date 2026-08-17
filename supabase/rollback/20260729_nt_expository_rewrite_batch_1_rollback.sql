-- Roll back the first NT expository rewrite batch.
-- Refuse if any replacement item has already received an answer.

begin;

do $$
declare
  backup_count integer;
  replacement_answers integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_nt_expository_rewrite_batch_1'
    and object_schema = 'public'
    and object_name = 'obs_nt_expository_item_reviews_retired_12'
    and object_type = 'data';

  select count(*)
  into replacement_answers
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_expository_rewrite_batch_1';

  if backup_count <> 1 or replacement_answers <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT rewrite rollback refused: backups=%s/1 replacement_answers=%s/0.',
        backup_count,
        replacement_answers
      );
  end if;
end
$$;

delete from public.ot_generated_questions
where payload->>'source_batch' =
        '20260729_nt_expository_rewrite_batch_1';

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '20260729_nt_expository_rewrite_batch_1'
    and object_schema = 'public'
    and object_name = 'obs_nt_expository_item_reviews_retired_12'
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
where backup_tag = '20260729_nt_expository_rewrite_batch_1'
  and object_schema = 'public'
  and object_name = 'obs_nt_expository_item_reviews_retired_12'
  and object_type = 'data';

notify pgrst, 'reload schema';

commit;
