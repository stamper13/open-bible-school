-- Assign canonical dimensions to the 33 routable NT questions that predate
-- dimension metadata. This changes classification only, never prompt, choices,
-- answer key, review status, routing priority, or scoring weight.

begin;

create temporary table obs_nt_dimension_map (
  generated_question_id uuid primary key,
  dimension_key text not null,
  expository_target text not null
) on commit drop;

insert into obs_nt_dimension_map values
  ('b757e745-b25f-4d52-a64d-01c64e599c5d', 'theological_reasoning', 'argument_flow'),
  ('4eb80dc9-ee47-4143-8f51-e88d0c3c2eb5', 'promise_prophecy', 'authorial_claim'),
  ('dc81ab74-1e95-4807-9366-b81441d5a5b0', 'theological_reasoning', 'authorial_claim'),
  ('94bf0a58-82ce-40e5-9438-e31bba67e1ef', 'law_commands', 'local_context'),
  ('51854e14-9905-4c3c-9640-28604fff748a', 'theological_reasoning', 'argument_flow'),
  ('9ecb7605-fef0-4e11-a006-13bdd5885565', 'law_commands', 'local_context'),
  ('d6356258-7f76-4e47-b672-5608bc22eac1', 'theological_reasoning', 'authorial_claim'),
  ('0a87c60f-d1ea-4420-bfd9-bce5667b956c', 'law_commands', 'local_context'),
  ('3dadc476-e97c-4944-a563-79dfab026bb3', 'promise_prophecy', 'authorial_claim'),
  ('89a7bce5-0c5d-4716-8496-9673e186445b', 'theological_reasoning', 'authorial_claim'),
  ('14ae4144-117f-4d2c-a628-204e2c3461d1', 'theological_reasoning', 'argument_flow'),
  ('10e93059-e3a5-4607-874d-f4894f2ff3c7', 'theological_reasoning', 'argument_flow'),
  ('2b1d8f97-db98-4bc9-9262-2a4ec6417c3d', 'theological_reasoning', 'argument_flow'),
  ('76e0d7ac-db26-4e1a-93f1-ce9d354ad20f', 'promise_prophecy', 'authorial_claim'),
  ('83c578ff-9664-4d58-bab4-f918d27c972a', 'events_timeline', 'narrative_sequence'),
  ('be5ee4be-5542-4c95-b0d7-3c7813bc4a3f', 'structure_cross_ref', 'book_structure'),
  ('e8c05dfc-4d2b-4f64-b31c-c5f758fcced9', 'structure_cross_ref', 'book_structure'),
  ('1848bf66-2792-433b-853e-84bcd6e12510', 'law_commands', 'local_context'),
  ('314eaf7d-f96c-4d78-8487-99021565fc95', 'promise_prophecy', 'authorial_claim'),
  ('a7f26fb1-2a33-4fab-a997-012d5959be33', 'events_timeline', 'narrative_sequence'),
  ('eb76e809-bc50-4011-b060-70b746e96d71', 'theological_reasoning', 'authorial_claim'),
  ('fce6ebb3-112a-4ba0-8316-bff5d6f3f8de', 'structure_cross_ref', 'book_structure'),
  ('07be7433-a7a5-481e-a4ba-9959ce248647', 'promise_prophecy', 'authorial_claim'),
  ('48852778-c418-4a86-b2fc-10e4a314d491', 'structure_cross_ref', 'book_structure'),
  ('69e256ea-e072-4576-a238-8c51b004538e', 'events_timeline', 'narrative_sequence'),
  ('72f38e9d-2a9e-42b4-8501-5a48459e2203', 'events_timeline', 'narrative_sequence'),
  ('92cfbff9-b99d-493a-b15b-980c783b079b', 'structure_cross_ref', 'book_structure'),
  ('a016c33f-e03b-4d8c-bd50-0bd61da4dd8e', 'theological_reasoning', 'authorial_claim'),
  ('e89eb3ae-9580-4fc0-89a1-380c430c906d', 'promise_prophecy', 'authorial_claim'),
  ('7592fbb8-3af1-4a74-abf4-5b3ac4553fe2', 'law_commands', 'local_context'),
  ('6cd55d33-1370-4190-952d-43375930ef50', 'theological_reasoning', 'argument_flow'),
  ('e9395170-db32-4923-b68c-6afc38666adc', 'events_timeline', 'narrative_sequence'),
  ('a04cbfce-f977-44e8-a60f-bec6b03fe746', 'law_commands', 'local_context');

do $$
declare
  map_count integer;
  matching_unclassified integer;
begin
  select count(*)
  into map_count
  from obs_nt_dimension_map;

  select count(*)
  into matching_unclassified
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  join obs_nt_dimension_map map
    on map.generated_question_id = question.generated_question_id
  where review.review_status in ('approved', 'provisional')
    and coalesce(
      nullif(question.payload->>'dimension_key', ''),
      nullif(question.payload->>'dimension', ''),
      'unclassified'
    ) = 'unclassified';

  if map_count <> 33 or matching_unclassified <> 33 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT dimension precondition failed: map=%s/33 matching_unclassified=%s/33.',
        map_count,
        matching_unclassified
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
  '20260729_nt_unclassified_dimension_canonicalization',
  'public',
  'ot_generated_questions_payloads_33',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'id', question.id,
      'payload', question.payload
    )
    order by question.id
  )::text
from public.ot_generated_questions question
join obs_nt_dimension_map map
  on map.generated_question_id = question.id
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_nt_unclassified_dimension_canonicalization'
    and backup.object_schema = 'public'
    and backup.object_name = 'ot_generated_questions_payloads_33'
    and backup.object_type = 'data'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_nt_unclassified_dimension_canonicalization',
  'public',
  'obs_nt_expository_item_reviews_33',
  'data',
  jsonb_agg(
    to_jsonb(review)
    order by review.generated_question_id
  )::text
from public.obs_nt_expository_item_reviews review
join obs_nt_dimension_map map
  on map.generated_question_id = review.generated_question_id
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_nt_unclassified_dimension_canonicalization'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_nt_expository_item_reviews_33'
    and backup.object_type = 'data'
);

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
        'NT dimension backup failed: expected 2 rows, found %s.',
        backup_count
      );
  end if;
end
$$;

update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      question.payload,
      '{dimension}',
      to_jsonb(map.dimension_key),
      true
    ),
    '{dimension_key}',
    to_jsonb(map.dimension_key),
    true
  )
from obs_nt_dimension_map map
where question.id = map.generated_question_id;

update public.obs_nt_expository_item_reviews review
set
  expository_target = map.expository_target,
  review_notes = review.review_notes
    || ' Canonical dimension assigned: '
    || map.dimension_key
    || '.',
  reviewed_by =
    '20260729_nt_unclassified_dimension_canonicalization',
  reviewed_at = now(),
  updated_at = now()
from obs_nt_dimension_map map
where review.generated_question_id = map.generated_question_id;

do $$
declare
  changed_count integer;
  routable_unclassified integer;
  invalid_dimensions integer;
  characters_count integer;
  events_count integer;
  geography_count integer;
  law_count integer;
  promise_count integer;
  reasoning_count integer;
  structure_count integer;
begin
  select count(*)
  into changed_count
  from public.v_nt_question_bank question
  join obs_nt_dimension_map map
    on map.generated_question_id = question.generated_question_id
  where question.payload->>'dimension_key' = map.dimension_key
    and question.payload->>'dimension' = map.dimension_key;

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

  select
    count(*) filter (
      where question.payload->>'dimension_key' = 'characters_lineage'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' = 'events_timeline'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' = 'geography_nations'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' = 'law_commands'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' = 'promise_prophecy'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' = 'theological_reasoning'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' = 'structure_cross_ref'
    )
  into
    characters_count,
    events_count,
    geography_count,
    law_count,
    promise_count,
    reasoning_count,
    structure_count
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.review_status in ('approved', 'provisional');

  if changed_count <> 33
     or routable_unclassified <> 0
     or invalid_dimensions <> 0
     or characters_count <> 6
     or events_count <> 14
     or geography_count <> 5
     or law_count <> 16
     or promise_count <> 26
     or reasoning_count <> 43
     or structure_count <> 29
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT dimension verification failed: changed=%s unclassified=%s invalid=%s characters=%s events=%s geography=%s law=%s promise=%s reasoning=%s structure=%s.',
        changed_count,
        routable_unclassified,
        invalid_dimensions,
        characters_count,
        events_count,
        geography_count,
        law_count,
        promise_count,
        reasoning_count,
        structure_count
      );
  end if;
end
$$;

commit;
