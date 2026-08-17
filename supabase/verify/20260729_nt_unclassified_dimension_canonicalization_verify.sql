-- Verify canonical NT dimensions and report the corrected coverage totals.

do $$
declare
  routable_count integer;
  routable_unclassified integer;
  invalid_dimensions integer;
  canonicalized_count integer;
  backup_count integer;
begin
  select count(*)
  into routable_count
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.review_status in ('approved', 'provisional');

  select count(*)
  into routable_unclassified
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.review_status in ('approved', 'provisional')
    and coalesce(
      nullif(question.payload->>'dimension_key', ''),
      nullif(question.payload->>'dimension', ''),
      'unclassified'
    ) = 'unclassified';

  select count(*)
  into invalid_dimensions
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.review_status in ('approved', 'provisional')
    and question.payload->>'dimension_key' not in (
      'characters_lineage',
      'events_timeline',
      'geography_nations',
      'law_commands',
      'promise_prophecy',
      'theological_reasoning',
      'structure_cross_ref'
    );

  select count(*)
  into canonicalized_count
  from public.obs_nt_expository_item_reviews review
  where review.reviewed_by =
          '20260729_nt_unclassified_dimension_canonicalization';

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

  if routable_count <> 139
     or routable_unclassified <> 0
     or invalid_dimensions <> 0
     or canonicalized_count <> 33
     or backup_count <> 2
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT dimension verify failed: routable=%s unclassified=%s invalid=%s canonicalized=%s backups=%s.',
        routable_count,
        routable_unclassified,
        invalid_dimensions,
        canonicalized_count,
        backup_count
      );
  end if;
end
$$;

select
  question.payload->>'dimension_key' as dimension,
  count(*) filter (
    where review.review_status = 'approved'
  ) as approved,
  count(*) filter (
    where review.review_status = 'provisional'
  ) as provisional,
  count(*) as routable
from public.v_nt_question_bank question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.generated_question_id
where review.review_status in ('approved', 'provisional')
group by question.payload->>'dimension_key'
order by question.payload->>'dimension_key';
