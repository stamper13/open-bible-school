-- Complete the NT Law & Commands review.
--
-- Nine text-dependent provisional items are promoted in place. The John 8
-- item is retired because its textual history and OT-law framing make it a
-- poor NT command measurement; a John 15 command question replaces it.

begin;

create temporary table obs_nt_law_review_ids (
  generated_question_id uuid primary key,
  expository_target text not null
) on commit drop;

insert into obs_nt_law_review_ids values
  ('94bf0a58-82ce-40e5-9438-e31bba67e1ef', 'local_context'),
  ('9ecb7605-fef0-4e11-a006-13bdd5885565', 'argument_flow'),
  ('0a87c60f-d1ea-4420-bfd9-bce5667b956c', 'local_context'),
  ('63be1103-b005-46bb-b32d-03ea9a0f573b', 'local_context'),
  ('ed20cfb0-91ce-4bbe-b167-a261901c46b2', 'local_context'),
  ('1848bf66-2792-433b-853e-84bcd6e12510', 'local_context'),
  ('fdaf57f1-6b02-443d-952d-e97d77ce33f3', 'local_context'),
  ('980340a3-341c-4547-b6ba-79db8f7758aa', 'local_context'),
  ('a04cbfce-f977-44e8-a60f-bec6b03fe746', 'argument_flow');

do $$
declare
  provisional_count integer;
  replacement_conflicts integer;
begin
  select count(*)
  into provisional_count
  from public.obs_nt_expository_item_reviews review
  where review.generated_question_id in (
    select generated_question_id from obs_nt_law_review_ids
    union all
    select 'c8d74663-7344-4519-bb9b-48fc257d66e7'::uuid
  )
    and review.review_status = 'provisional';

  select count(*)
  into replacement_conflicts
  from public.ot_generated_questions
  where id = '7714c874-53ee-4149-91c2-07a3579d0830';

  if provisional_count <> 10 or replacement_conflicts <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Law & Commands precondition failed: provisional=%s/10 replacement_conflicts=%s/0.',
        provisional_count,
        replacement_conflicts
      );
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_nt_law_commands_expository_review',
  'public',
  'obs_nt_expository_item_reviews_original_10',
  'data',
  jsonb_agg(to_jsonb(review) order by review.generated_question_id)::text
from public.obs_nt_expository_item_reviews review
where review.generated_question_id in (
  select generated_question_id from obs_nt_law_review_ids
  union all
  select 'c8d74663-7344-4519-bb9b-48fc257d66e7'::uuid
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_nt_law_commands_expository_review'
    and backup.object_schema = 'public'
    and backup.object_name =
          'obs_nt_expository_item_reviews_original_10'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
  backup_rows integer;
begin
  select
    count(*),
    coalesce(jsonb_array_length(max(definition)::jsonb), 0)
  into backup_count, backup_rows
  from public.obs_schema_backups
  where backup_tag = '20260729_nt_law_commands_expository_review'
    and object_schema = 'public'
    and object_name = 'obs_nt_expository_item_reviews_original_10'
    and object_type = 'data';

  if backup_count <> 1 or backup_rows <> 10 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Law & Commands backup failed: backups=%s/1 rows=%s/10.',
        backup_count,
        backup_rows
      );
  end if;
end
$$;

update public.obs_nt_expository_item_reviews review
set
  review_status = 'approved',
  expository_target = approved.expository_target,
  text_dependence = 3,
  orthodoxy_guessability = 1,
  book_discrimination = 2,
  confessional_sensitivity = 'low',
  routing_priority = 3,
  scoring_weight = 1.0,
  review_basis = 'manual_law_commands_expository_review',
  review_notes =
    'Tests an explicit command, instruction, or named legal statement in its local NT context.',
  reviewed_by = '20260729_nt_law_commands_expository_review',
  reviewed_at = now(),
  updated_at = now()
from obs_nt_law_review_ids approved
where review.generated_question_id = approved.generated_question_id;

insert into public.ot_generated_questions (
  id,
  event_id,
  question_type,
  payload,
  dedupe_key
) values (
  '7714c874-53ee-4149-91c2-07a3579d0830',
  null,
  'nt_expository_mcq_v2',
  jsonb_build_object(
    'question_id', '7714c874-53ee-4149-91c2-07a3579d0830',
    'question_format', 'mcq',
    'question_layer', 'expository_rewrite',
    'source_batch', '20260729_nt_law_commands_expository_review',
    'testament', 'NT',
    'book_code', 'JHN',
    'chapter', 15,
    'reference', 'John 15:12-14',
    'source_ref', 'John 15:12-14',
    'prompt', 'How does Jesus state the command to love one another in John 15:12-14?',
    'choices', jsonb_build_array(
      jsonb_build_object(
        'id', 'A',
        'text', 'Love one another as I have loved you, with laying down one''s life named as the greatest love'
      ),
      jsonb_build_object(
        'id', 'B',
        'text', 'Love others only after they have kept every command without failure'
      ),
      jsonb_build_object(
        'id', 'C',
        'text', 'Love friends by withdrawing them from every conflict in the world'
      ),
      jsonb_build_object(
        'id', 'D',
        'text', 'Love is chiefly shown by asking the Father for public signs'
      )
    ),
    'correct_choice_id', 'A',
    'correct_answer',
      'Love one another as I have loved you, with laying down one''s life named as the greatest love',
    'dimension', 'law_commands',
    'dimension_key', 'law_commands',
    'expository_target', 'local_context',
    'irt_b', 0.55,
    'difficulty_estimate', 620,
    'importance_conceptual', 90,
    'importance_context', 92,
    'interpretation_policy', 'explicit_local_context_no_systematic_inference'
  ),
  'nt_expository|JHN|love_as_jesus_loved_jhn15'
);

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
  updated_at
) values (
  '7714c874-53ee-4149-91c2-07a3579d0830',
  'approved',
  'local_context',
  3,
  1,
  2,
  'low',
  3,
  1.0,
  'manual_law_commands_expository_rewrite',
  'Tests the wording and stated pattern of Jesus'' command in John 15:12-14.',
  '20260729_nt_law_commands_expository_review',
  now(),
  now()
);

update public.obs_nt_expository_item_reviews
set
  review_status = 'excluded',
  routing_priority = 0,
  scoring_weight = 0.0,
  review_notes =
    'Retired without mutating historical answers; text-critical and OT-law framing make this a poor NT command item. Replaced by 7714c874-53ee-4149-91c2-07a3579d0830.',
  reviewed_by = '20260729_nt_law_commands_expository_review',
  reviewed_at = now(),
  updated_at = now()
where generated_question_id =
        'c8d74663-7344-4519-bb9b-48fc257d66e7';

do $$
declare
  approved_originals integer;
  replacement_approved integer;
  retired_original integer;
  remaining_provisional integer;
  law_routable integer;
  law_approved integer;
  invalid_replacement integer;
begin
  select count(*)
  into approved_originals
  from public.obs_nt_expository_item_reviews
  where generated_question_id in (
    select generated_question_id from obs_nt_law_review_ids
  )
    and review_status = 'approved'
    and scoring_weight = 1.0;

  select count(*)
  into replacement_approved
  from public.obs_nt_expository_item_reviews
  where generated_question_id =
          '7714c874-53ee-4149-91c2-07a3579d0830'
    and review_status = 'approved'
    and scoring_weight = 1.0;

  select count(*)
  into retired_original
  from public.obs_nt_expository_item_reviews
  where generated_question_id =
          'c8d74663-7344-4519-bb9b-48fc257d66e7'
    and review_status = 'excluded'
    and scoring_weight = 0.0;

  select count(*)
  into remaining_provisional
  from public.obs_nt_expository_item_reviews
  where review_status = 'provisional';

  select
    count(*),
    count(*) filter (where review.review_status = 'approved')
  into law_routable, law_approved
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'dimension_key' = 'law_commands'
    and review.review_status in ('approved', 'provisional')
    and review.scoring_weight > 0.0;

  select count(*)
  into invalid_replacement
  from public.ot_generated_questions question
  where question.id = '7714c874-53ee-4149-91c2-07a3579d0830'
    and (
      not public.obs_q_correct_resolves(question.payload)
      or public.obs_q_choice_count(question.payload) <> 4
      or public.obs_q_distinct_choice_count(question.payload) <> 4
      or question.payload->>'dimension_key' <> 'law_commands'
    );

  if approved_originals <> 9
     or replacement_approved <> 1
     or retired_original <> 1
     or remaining_provisional <> 3
     or law_routable <> 16
     or law_approved <> 16
     or invalid_replacement <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Law & Commands verification failed: originals=%s/9 replacement=%s/1 retired=%s/1 provisional=%s/3 law_routable=%s/16 law_approved=%s/16 invalid=%s/0.',
        approved_originals,
        replacement_approved,
        retired_original,
        remaining_provisional,
        law_routable,
        law_approved,
        invalid_replacement
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
