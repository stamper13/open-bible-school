-- Quarantine the current learner-flagged/low-rated question set and resolve
-- matching feedback reports while preserving the audit trail.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table feedback_question_repair_targets (
  id uuid primary key
) on commit drop;

insert into feedback_question_repair_targets (id)
values
  ('03fb9053-9604-4cfd-863b-a99afe4c9693'::uuid),
  ('055113eb-024f-4fe8-ab62-ba78dc2c92bc'::uuid),
  ('0d931199-b906-4344-859d-a4ea4354f202'::uuid),
  ('0eb40eb8-3fd3-4c02-96b4-a49e8028b54c'::uuid),
  ('18b87ce5-45a7-44ab-9254-72b219ba279a'::uuid),
  ('1e88d045-479b-4378-bc34-7ff8d5b63c24'::uuid),
  ('1f3cb45f-587e-42d0-b0aa-3b91bbce82ed'::uuid),
  ('26ca61ee-ff36-4497-b38e-988672896c25'::uuid),
  ('2ebea6e4-18bc-4c3d-9271-a318abcf5c4e'::uuid),
  ('39f7b9c8-d1b3-4492-ac54-ab90e18441b8'::uuid),
  ('41d86a63-dc6f-4998-8282-07fe7c6f4c36'::uuid),
  ('519d832e-5122-449b-8691-1579f232c6cd'::uuid),
  ('55811768-6959-4c26-9e4a-30433f4885ee'::uuid),
  ('58010487-586b-41fc-83c0-22f42a2d739b'::uuid),
  ('7a7dd77d-cc32-449d-9611-8a52aa4005e0'::uuid),
  ('83597f01-4278-4232-ad96-b302d6dccfa8'::uuid),
  ('9a6ee002-696a-449c-a1ff-02d897db8acf'::uuid),
  ('9cfc4cd8-0f12-4020-a851-8ea08109e19f'::uuid),
  ('a6d83922-dc39-488d-80d3-4c50cd4b1ceb'::uuid),
  ('abb78955-5008-473c-af54-14b13208ae94'::uuid),
  ('adf7c9ef-07e2-4a77-9503-17b4578173c8'::uuid),
  ('b85ab814-fb62-425d-85f4-f61d4dc2ae38'::uuid),
  ('c8dbdb71-4bb8-47af-aa49-09c7eb5c6800'::uuid),
  ('cfdd82fe-85a6-4104-aeb0-e48ee145ed56'::uuid),
  ('d57fa1df-b400-4af0-9194-b3b209135dfb'::uuid),
  ('dc261725-b21e-4d8f-988c-ea20cefe6c7e'::uuid),
  ('dc7d6593-e40a-4c73-9ca9-2fd2a6903e01'::uuid),
  ('e0aff110-27bf-4bfd-9b4b-82bc7e884616'::uuid),
  ('f4cfa226-32ff-4a7d-8f61-2b7ad870bde7'::uuid);

update public.ot_generated_questions question
set
  question_type = case
    when question.question_type like 'quarantined%' then question.question_type
    else 'quarantined_' || question.question_type
  end,
  dedupe_key = case
    when question.dedupe_key like 'quarantined|%' then question.dedupe_key
    else 'quarantined|' || coalesce(question.dedupe_key, question.id::text)
  end,
  payload = question.payload || jsonb_build_object(
    'quarantine_reason',
    'Removed from active service after learner feedback/flags review on 2026-08-30; preserve row for audit and replacement authoring.',
    'distractor_quality_reviewed',
    true
  )
from feedback_question_repair_targets target
where question.id = target.id;

update public.question_reports report
set
  status = 'resolved',
  resolved_at = now()
where report.status = 'open'
  and (
    report.generated_question_id in (
      select target.id
      from feedback_question_repair_targets target
    )
    or not exists (
      select 1
      from public.v_question_bank bank
      where bank.generated_question_id = report.generated_question_id
    )
  );

do $verify$
declare
  v_open_reports integer;
  v_unquarantined_targets integer;
  v_targets_still_in_bank integer;
begin
  select count(*)
  into v_open_reports
  from public.question_reports
  where status = 'open';

  select count(*)
  into v_unquarantined_targets
  from public.ot_generated_questions question
  join feedback_question_repair_targets target
    on target.id = question.id
  where question.question_type not like 'quarantined%';

  select count(*)
  into v_targets_still_in_bank
  from public.v_question_bank bank
  join feedback_question_repair_targets target
    on target.id = bank.generated_question_id;

  if v_open_reports <> 0
     or v_unquarantined_targets <> 0
     or v_targets_still_in_bank <> 0 then
    raise exception
      'Feedback quarantine verification failed: open_reports=%, unquarantined_targets=%, targets_still_in_bank=%',
      v_open_reports,
      v_unquarantined_targets,
      v_targets_still_in_bank;
  end if;
end
$verify$;

select public.obs_refresh_router_candidate_facts();
select public.obs_refresh_router_question_facts();

notify pgrst, 'reload schema';

commit;
