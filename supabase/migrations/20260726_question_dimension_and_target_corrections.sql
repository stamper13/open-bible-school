-- Correct dimension assignments exposed by the scoring coverage audit.
--
-- Forty questions were classified by legacy question-type rules rather than
-- by what they actually test. Six book/dimension cells also contained valid
-- questions but had zero targets, which prevented the router from using them.

begin;

do $$
begin
  if to_regclass('public.obs_question_dimension_overrides') is null
     or to_regclass('public.question_coverage_targets') is null
     or to_regclass('public.obs_admin_question_bank_audit') is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Required dimension, coverage, audit, or backup objects are missing; no changes made.';
  end if;
end
$$;

-- Preserve both changed datasets exactly once so rollback restores prior rows,
-- including the absence of an override where applicable.
insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_question_dimension_and_target_corrections',
  'public',
  'obs_question_dimension_overrides',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'generated_question_id', correction.generated_question_id,
      'had_override', override.generated_question_id is not null,
      'dimension_key', override.dimension_key,
      'review_reason', override.review_reason,
      'updated_at', override.updated_at,
      'updated_by', override.updated_by
    )
    order by correction.generated_question_id
  )::text
from (
  values
    ('0d98c4fe-bbc7-4db1-922a-726b7ad2adcf'::uuid),
    ('1d008a59-7a83-4ec1-8cc7-59f2be463001'::uuid),
    ('5b503ad3-b339-4f11-aa02-5d0df48cc7a5'::uuid),
    ('9d353e0f-3e54-4df8-86f6-3d1d92129a29'::uuid),
    ('bd1d324a-b3f7-4514-990d-a301a0de74e9'::uuid),
    ('db5360e1-9c7f-41e6-a791-e6b6f0ca4a06'::uuid),
    ('ed571812-47bd-4707-8565-1986a6585751'::uuid),
    ('9e7a693a-0773-439a-b2b5-323859722812'::uuid),
    ('3ec8772c-b029-4725-b271-a5f46eb85d0a'::uuid),
    ('0333e0aa-a164-4d1d-9401-1a26673b4681'::uuid),
    ('1b25b068-5198-4e8d-820f-a688a5dbe633'::uuid),
    ('f724cca4-1970-466b-a27d-f37a4d2df719'::uuid),
    ('44e7437b-fb2b-4439-87ad-1b44567bfdaa'::uuid),
    ('64a0104d-e608-4233-989c-ced030ed4699'::uuid),
    ('6c180749-5f40-4006-b070-dc7fa80ba013'::uuid),
    ('14b1b751-c5d7-465a-9659-fd85f2ffcf0d'::uuid),
    ('7f46da1b-a7c3-4451-b4da-1c5aaa7bf369'::uuid),
    ('2af80ee3-afaf-459a-ac31-ad8b69c4b4b6'::uuid),
    ('0d931199-b906-4344-859d-a4ea4354f202'::uuid),
    ('37699924-780f-423b-9da4-9cee05231651'::uuid),
    ('655d42ba-49e9-46e7-824f-912c5001d3fa'::uuid),
    ('ead2d026-51a4-458a-8c7a-aa7bea2ead33'::uuid),
    ('fa9d00e3-f701-4660-9d99-fa6690679890'::uuid),
    ('75e4d900-66d7-4b30-9617-8109b262075c'::uuid),
    ('3b80e1d9-7357-4f89-aa1d-5f16bc2e1f69'::uuid),
    ('7bb842c4-41c9-47e5-a041-f8d8e56d14f1'::uuid),
    ('3431ba76-1b97-484b-addb-b097de7129bf'::uuid),
    ('dc387dd5-d45b-4cce-bc50-862f77f4cf7a'::uuid),
    ('09634754-72d6-4213-8993-1a602341b6c4'::uuid),
    ('2e0ead6d-e1b6-4543-9802-02ae29c64105'::uuid),
    ('4a8f6203-4789-43db-8490-4f0c03707486'::uuid),
    ('533bade0-e578-4fe5-9e58-b6b9af1a4bcb'::uuid),
    ('736838d6-c5a9-4c61-b10a-c139b2d5a0d0'::uuid),
    ('866d0509-ffc4-4e5b-9cdc-c69afd7c6bc9'::uuid),
    ('deaf6153-cc7c-4dbf-bcd5-0f54ee5b84c1'::uuid),
    ('c852ce21-ca33-4871-a88e-72978ed385f0'::uuid),
    ('2ff8e63f-5128-47e8-925e-679f86e76860'::uuid),
    ('c3c1be94-b5a1-4ce7-a032-18cc8b58afd8'::uuid),
    ('af462004-ca24-41ee-a886-20c56ce20d44'::uuid),
    ('ad137f46-42f7-4b56-a887-5e101b1cda37'::uuid)
) correction(generated_question_id)
left join public.obs_question_dimension_overrides override
  using (generated_question_id)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_question_dimension_and_target_corrections'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_question_dimension_overrides'
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
  '20260726_question_dimension_and_target_corrections',
  'public',
  'question_coverage_targets',
  'data',
  jsonb_agg(to_jsonb(target) order by target.book_code, target.dimension_key)::text
from public.question_coverage_targets target
join (
  values
    ('DEU', 'events_timeline'),
    ('JOB', 'characters_lineage'),
    ('JOB', 'events_timeline'),
    ('LEV', 'events_timeline'),
    ('SNG', 'characters_lineage'),
    ('SNG', 'events_timeline')
) correction(book_code, dimension_key)
  using (book_code, dimension_key)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_question_dimension_and_target_corrections'
    and backup.object_schema = 'public'
    and backup.object_name = 'question_coverage_targets'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_question_dimension_and_target_corrections'
    and object_schema = 'public'
    and object_name in (
      'obs_question_dimension_overrides',
      'question_coverage_targets'
    )
    and object_type = 'data';

  if backup_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected two data backups, found %s; no changes made.', backup_count);
  end if;
end
$$;

insert into public.obs_question_dimension_overrides (
  generated_question_id,
  dimension_key,
  review_reason,
  updated_at,
  updated_by
)
select
  correction.generated_question_id,
  correction.dimension_key,
  '20260726 coverage audit: reviewed against the revised seven-dimension contract.',
  now(),
  null
from (
  values
    ('0d98c4fe-bbc7-4db1-922a-726b7ad2adcf'::uuid, 'law_commands'),
    ('1d008a59-7a83-4ec1-8cc7-59f2be463001'::uuid, 'law_commands'),
    ('5b503ad3-b339-4f11-aa02-5d0df48cc7a5'::uuid, 'law_commands'),
    ('9d353e0f-3e54-4df8-86f6-3d1d92129a29'::uuid, 'law_commands'),
    ('bd1d324a-b3f7-4514-990d-a301a0de74e9'::uuid, 'law_commands'),
    ('db5360e1-9c7f-41e6-a791-e6b6f0ca4a06'::uuid, 'law_commands'),
    ('ed571812-47bd-4707-8565-1986a6585751'::uuid, 'law_commands'),
    ('9e7a693a-0773-439a-b2b5-323859722812'::uuid, 'theological_reasoning'),
    ('3ec8772c-b029-4725-b271-a5f46eb85d0a'::uuid, 'theological_reasoning'),
    ('0333e0aa-a164-4d1d-9401-1a26673b4681'::uuid, 'theological_reasoning'),
    ('1b25b068-5198-4e8d-820f-a688a5dbe633'::uuid, 'theological_reasoning'),
    ('f724cca4-1970-466b-a27d-f37a4d2df719'::uuid, 'theological_reasoning'),
    ('44e7437b-fb2b-4439-87ad-1b44567bfdaa'::uuid, 'theological_reasoning'),
    ('64a0104d-e608-4233-989c-ced030ed4699'::uuid, 'theological_reasoning'),
    ('6c180749-5f40-4006-b070-dc7fa80ba013'::uuid, 'theological_reasoning'),
    ('14b1b751-c5d7-465a-9659-fd85f2ffcf0d'::uuid, 'theological_reasoning'),
    ('7f46da1b-a7c3-4451-b4da-1c5aaa7bf369'::uuid, 'theological_reasoning'),
    ('2af80ee3-afaf-459a-ac31-ad8b69c4b4b6'::uuid, 'theological_reasoning'),
    ('0d931199-b906-4344-859d-a4ea4354f202'::uuid, 'law_commands'),
    ('37699924-780f-423b-9da4-9cee05231651'::uuid, 'law_commands'),
    ('655d42ba-49e9-46e7-824f-912c5001d3fa'::uuid, 'law_commands'),
    ('ead2d026-51a4-458a-8c7a-aa7bea2ead33'::uuid, 'law_commands'),
    ('fa9d00e3-f701-4660-9d99-fa6690679890'::uuid, 'theological_reasoning'),
    ('75e4d900-66d7-4b30-9617-8109b262075c'::uuid, 'theological_reasoning'),
    ('3b80e1d9-7357-4f89-aa1d-5f16bc2e1f69'::uuid, 'theological_reasoning'),
    ('7bb842c4-41c9-47e5-a041-f8d8e56d14f1'::uuid, 'theological_reasoning'),
    ('3431ba76-1b97-484b-addb-b097de7129bf'::uuid, 'theological_reasoning'),
    ('dc387dd5-d45b-4cce-bc50-862f77f4cf7a'::uuid, 'theological_reasoning'),
    ('09634754-72d6-4213-8993-1a602341b6c4'::uuid, 'theological_reasoning'),
    ('2e0ead6d-e1b6-4543-9802-02ae29c64105'::uuid, 'theological_reasoning'),
    ('4a8f6203-4789-43db-8490-4f0c03707486'::uuid, 'theological_reasoning'),
    ('533bade0-e578-4fe5-9e58-b6b9af1a4bcb'::uuid, 'promise_prophecy'),
    ('736838d6-c5a9-4c61-b10a-c139b2d5a0d0'::uuid, 'theological_reasoning'),
    ('866d0509-ffc4-4e5b-9cdc-c69afd7c6bc9'::uuid, 'promise_prophecy'),
    ('deaf6153-cc7c-4dbf-bcd5-0f54ee5b84c1'::uuid, 'theological_reasoning'),
    ('c852ce21-ca33-4871-a88e-72978ed385f0'::uuid, 'theological_reasoning'),
    ('2ff8e63f-5128-47e8-925e-679f86e76860'::uuid, 'theological_reasoning'),
    ('c3c1be94-b5a1-4ce7-a032-18cc8b58afd8'::uuid, 'theological_reasoning'),
    ('af462004-ca24-41ee-a886-20c56ce20d44'::uuid, 'theological_reasoning'),
    ('ad137f46-42f7-4b56-a887-5e101b1cda37'::uuid, 'theological_reasoning')
) correction(generated_question_id, dimension_key)
on conflict (generated_question_id) do update set
  dimension_key = excluded.dimension_key,
  review_reason = excluded.review_reason,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

update public.question_coverage_targets target
set
  minimum_active_questions = correction.minimum_active_questions,
  target_active_questions = correction.target_active_questions,
  priority = correction.priority,
  rationale = correction.rationale,
  updated_at = now()
from (
  values
    (
      'DEU',
      'events_timeline',
      3,
      6,
      'standard',
      'Deuteronomy narrative coverage includes Israel''s review, leadership succession, and Moses'' death.'
    ),
    (
      'JOB',
      'characters_lineage',
      2,
      4,
      'standard',
      'Job''s argument depends on recognizing Job, his accuser, his friends, and Elihu.'
    ),
    (
      'JOB',
      'events_timeline',
      2,
      4,
      'standard',
      'The opening test, the friends'' response, and Job''s restoration form the book''s narrative frame.'
    ),
    (
      'LEV',
      'events_timeline',
      1,
      3,
      'standard',
      'Priestly consecration and the judgment of Nadab and Abihu are important narrative anchors in Leviticus.'
    ),
    (
      'SNG',
      'characters_lineage',
      1,
      2,
      'standard',
      'Recognizing the principal speakers and the daughters of Jerusalem supports basic textual familiarity.'
    ),
    (
      'SNG',
      'events_timeline',
      1,
      2,
      'standard',
      'The woman''s search sequence is a concrete narrative movement within Song of Songs.'
    )
) correction(
  book_code,
  dimension_key,
  minimum_active_questions,
  target_active_questions,
  priority,
  rationale
)
where target.book_code = correction.book_code
  and target.dimension_key = correction.dimension_key;

do $$
declare
  corrected_override_count integer;
  corrected_target_count integer;
  blocker_count integer;
  ineligible_count integer;
begin
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

  select
    count(*) filter (where cardinality(blocker_reasons) > 0),
    count(*) filter (where not router_eligible)
  into blocker_count, ineligible_count
  from public.obs_admin_question_bank_audit;

  if corrected_override_count <> 40
     or corrected_target_count <> 6
     or blocker_count <> 0
     or ineligible_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Correction verification failed: overrides=%s/40 targets=%s/6 blockers=%s ineligible=%s.',
        corrected_override_count,
        corrected_target_count,
        blocker_count,
        ineligible_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
