begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

update public.obs_question_ladder_metadata metadata
set review_status = 'needs_review',
    metadata_source = 'hybrid',
    metadata_confidence = least(metadata.metadata_confidence, 0.7200),
    review_notes = concat_ws(
      '; ',
      'Rolled back manual V7 review decision; rerun metadata backfill/review before V7 launch.',
      metadata.review_notes
    ),
    updated_at = now()
where metadata.generated_question_id in (
  '05381644-715a-4560-a9ad-52f22d6bc395'::uuid,
  '568abbc0-2e38-4b3d-a753-351d56c5b9f7'::uuid,
  '7b315a71-cd6d-47ef-aa41-db40144c4693'::uuid,
  '82de6030-86f0-4418-b9a0-2a09c843a844'::uuid,
  '7c2714e8-d2f8-4f2d-9f14-226bcab2a0c2'::uuid,
  '8f83678c-0f68-4cab-aac0-6fa70ecc2ec9'::uuid,
  '9f12502e-1b4c-40e6-9ed1-7e8b48bb1d43'::uuid,
  'acef0831-8f05-4702-a5eb-b2d5d963a990'::uuid,
  'b48eddbf-18fe-4bcf-91ad-44cf1e75bd3c'::uuid,
  'c912e8d1-e2f0-4619-b55a-aba4a241abf2'::uuid,
  'f1125b60-f3b5-4cb7-b1b4-af6a5b2b6241'::uuid,
  '9e7a693a-0773-439a-b2b5-323859722812'::uuid,
  'cc44530b-5b7e-4fc0-ba29-e10fc656ca59'::uuid,
  '033e38cc-81da-4470-8ebe-3a6822268308'::uuid,
  '03fb9053-9604-4cfd-863b-a99afe4c9693'::uuid,
  '01df1d7f-1dcb-4f08-b12e-bacfb155e9be'::uuid,
  '1b583062-717d-47c9-bdf9-5800c0728100'::uuid
);

commit;
