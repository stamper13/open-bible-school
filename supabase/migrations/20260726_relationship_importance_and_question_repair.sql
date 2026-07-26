-- Repair one self-answering Genesis promise question and establish a reviewed
-- importance contract for direct kinship questions.
--
-- Global importance measures how much a relationship matters to the Bible's
-- main narrative and covenant structure. Context importance remains higher for
-- details that are useful in a focused book or chapter retest.

begin;

do $$
declare
  question_count integer;
  significance_count integer;
  direct_kinship_count integer;
begin
  if to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.person_significance') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.v_question_bank') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Required question, significance, backup, or bank objects are missing; no changes made.';
  end if;

  select count(*)
  into question_count
  from public.ot_generated_questions
  where id in (
    '6e0c61e8-6e2a-47f1-be70-b27ce44c0831'::uuid,
    'cb250392-93f9-4e64-9d61-228465653e4d'::uuid,
    'bc49dad9-03a7-4748-97ce-3a01a9d9ea07'::uuid,
    '056c7c03-c66b-44d7-a56c-a265e290ba7b'::uuid,
    '5093f6eb-0809-4830-a1e8-060289093cd6'::uuid,
    'f625e17b-2357-43fa-a620-64727ee0f473'::uuid,
    'a5c614ac-acee-4cb2-8005-c9e8c05ebf61'::uuid,
    '541a1c66-3678-4309-8b25-66c8b74e0256'::uuid,
    '339ac7f4-4019-4fb4-96f8-4d27bd6349fa'::uuid,
    'b6a15bdd-384c-43b1-9a05-c077348e015c'::uuid,
    '9eb43b48-8a10-421d-b31e-eacd636fefbf'::uuid,
    '94dba637-5e99-4542-8786-3abaad8832b8'::uuid,
    'ebdb5a0e-d308-4464-8b55-4ad880962bec'::uuid
  );

  select count(*)
  into significance_count
  from public.person_significance
  where generated_question_id in (
    'cb250392-93f9-4e64-9d61-228465653e4d'::uuid,
    'bc49dad9-03a7-4748-97ce-3a01a9d9ea07'::uuid,
    '056c7c03-c66b-44d7-a56c-a265e290ba7b'::uuid,
    '5093f6eb-0809-4830-a1e8-060289093cd6'::uuid,
    'f625e17b-2357-43fa-a620-64727ee0f473'::uuid,
    'a5c614ac-acee-4cb2-8005-c9e8c05ebf61'::uuid,
    '541a1c66-3678-4309-8b25-66c8b74e0256'::uuid,
    '339ac7f4-4019-4fb4-96f8-4d27bd6349fa'::uuid,
    'b6a15bdd-384c-43b1-9a05-c077348e015c'::uuid,
    '9eb43b48-8a10-421d-b31e-eacd636fefbf'::uuid,
    '94dba637-5e99-4542-8786-3abaad8832b8'::uuid,
    'ebdb5a0e-d308-4464-8b55-4ad880962bec'::uuid
  );

  select count(*)
  into direct_kinship_count
  from public.ot_generated_questions
  where question_type = 'relationship_curated_mcq_v1'
    and payload->>'prompt' ~* '^Who was the (father|mother|wife|husband|brother|sister|son|daughter) of ';

  if question_count <> 13
     or significance_count <> 12
     or direct_kinship_count <> 12
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected 13 questions, 12 significance rows, and 12 direct kinship questions; found %s, %s, and %s.',
        question_count,
        significance_count,
        direct_kinship_count
      );
  end if;

  if not exists (
    select 1
    from public.ot_generated_questions question
    cross join lateral jsonb_array_elements(question.payload->'choices') choice
    where question.id = '6e0c61e8-6e2a-47f1-be70-b27ce44c0831'::uuid
      and choice->>'id' = question.payload->>'correct_choice_id'
      and choice->>'text' = 'Sarah will have a son'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'The Genesis 18 answer key no longer points to "Sarah will have a son"; no changes made.';
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
  '20260726_relationship_importance_and_question_repair',
  'public',
  'ot_generated_questions',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'id', question.id,
      'payload', question.payload
    )
    order by question.id
  )::text
from public.ot_generated_questions question
where question.id in (
  '6e0c61e8-6e2a-47f1-be70-b27ce44c0831'::uuid,
  'cb250392-93f9-4e64-9d61-228465653e4d'::uuid,
  'bc49dad9-03a7-4748-97ce-3a01a9d9ea07'::uuid,
  '056c7c03-c66b-44d7-a56c-a265e290ba7b'::uuid,
  '5093f6eb-0809-4830-a1e8-060289093cd6'::uuid,
  'f625e17b-2357-43fa-a620-64727ee0f473'::uuid,
  'a5c614ac-acee-4cb2-8005-c9e8c05ebf61'::uuid,
  '541a1c66-3678-4309-8b25-66c8b74e0256'::uuid,
  '339ac7f4-4019-4fb4-96f8-4d27bd6349fa'::uuid,
  'b6a15bdd-384c-43b1-9a05-c077348e015c'::uuid,
  '9eb43b48-8a10-421d-b31e-eacd636fefbf'::uuid,
  '94dba637-5e99-4542-8786-3abaad8832b8'::uuid,
  'ebdb5a0e-d308-4464-8b55-4ad880962bec'::uuid
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_relationship_importance_and_question_repair'
    and backup.object_schema = 'public'
    and backup.object_name = 'ot_generated_questions'
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
  '20260726_relationship_importance_and_question_repair',
  'public',
  'person_significance',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'generated_question_id', significance.generated_question_id,
      'importance_score', significance.importance_score,
      'importance_tier', significance.importance_tier
    )
    order by significance.generated_question_id
  )::text
from public.person_significance significance
where significance.generated_question_id in (
  'cb250392-93f9-4e64-9d61-228465653e4d'::uuid,
  'bc49dad9-03a7-4748-97ce-3a01a9d9ea07'::uuid,
  '056c7c03-c66b-44d7-a56c-a265e290ba7b'::uuid,
  '5093f6eb-0809-4830-a1e8-060289093cd6'::uuid,
  'f625e17b-2357-43fa-a620-64727ee0f473'::uuid,
  'a5c614ac-acee-4cb2-8005-c9e8c05ebf61'::uuid,
  '541a1c66-3678-4309-8b25-66c8b74e0256'::uuid,
  '339ac7f4-4019-4fb4-96f8-4d27bd6349fa'::uuid,
  'b6a15bdd-384c-43b1-9a05-c077348e015c'::uuid,
  '9eb43b48-8a10-421d-b31e-eacd636fefbf'::uuid,
  '94dba637-5e99-4542-8786-3abaad8832b8'::uuid,
  'ebdb5a0e-d308-4464-8b55-4ad880962bec'::uuid
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_relationship_importance_and_question_repair'
    and backup.object_schema = 'public'
    and backup.object_name = 'person_significance'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_relationship_importance_and_question_repair'
    and object_schema = 'public'
    and object_name in ('ot_generated_questions', 'person_significance')
    and object_type = 'data';

  if backup_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected two data backups, found %s; no changes made.', backup_count);
  end if;
end
$$;

create table public.obs_relationship_importance_rubric (
  relationship_class text primary key,
  default_global_score integer not null check (default_global_score between 0 and 100),
  default_context_score integer not null check (default_context_score between 0 and 100),
  importance_tier integer not null check (importance_tier between 1 and 3),
  description text not null,
  example text not null
);

create table public.obs_relationship_question_reviews (
  generated_question_id uuid primary key
    references public.ot_generated_questions(id) on delete cascade,
  relationship_class text not null
    references public.obs_relationship_importance_rubric(relationship_class),
  global_score integer not null check (global_score between 0 and 100),
  context_score integer not null check (context_score between 0 and 100),
  importance_tier integer not null check (importance_tier between 1 and 3),
  rationale text not null,
  reviewed_at timestamptz not null default now()
);

alter table public.obs_relationship_importance_rubric enable row level security;
alter table public.obs_relationship_question_reviews enable row level security;

insert into public.obs_relationship_importance_rubric (
  relationship_class,
  default_global_score,
  default_context_score,
  importance_tier,
  description,
  example
)
values
  (
    'narrative_defining',
    95,
    97,
    1,
    'Required to follow a major narrative, covenant line, rivalry, succession, or turning point.',
    'Jacob and Esau are brothers.'
  ),
  (
    'covenant_lineage',
    82,
    90,
    2,
    'Important for tracing covenant or tribal continuity, but not itself a central plot movement.',
    'Joseph is the father of Ephraim.'
  ),
  (
    'supporting_identity',
    68,
    82,
    2,
    'Helps situate a major person or family without being necessary to follow the main narrative.',
    'Terah is the father of Abraham.'
  ),
  (
    'genealogical_detail',
    55,
    74,
    3,
    'A valid textual detail whose global BLI weight should stay low unless the focused passage tests that genealogy.',
    'Bethuel is the father of Rebekah; Amram and Jochebed are Moses'' parents.'
  );

insert into public.obs_relationship_question_reviews (
  generated_question_id,
  relationship_class,
  global_score,
  context_score,
  importance_tier,
  rationale
)
values
  (
    'cb250392-93f9-4e64-9d61-228465653e4d',
    'narrative_defining',
    94,
    96,
    1,
    'Isaac and Rebekah form the next covenant household and their marriage drives Genesis 24.'
  ),
  (
    'bc49dad9-03a7-4748-97ce-3a01a9d9ea07',
    'supporting_identity',
    72,
    85,
    2,
    'Rachel helps explain Joseph''s place in Jacob''s household, but the maternal name is not required to follow Joseph''s main story.'
  ),
  (
    '056c7c03-c66b-44d7-a56c-a265e290ba7b',
    'supporting_identity',
    68,
    80,
    2,
    'Leah situates Judah within Jacob''s family; this matters more in focused lineage study than in the global narrative.'
  ),
  (
    '5093f6eb-0809-4830-a1e8-060289093cd6',
    'narrative_defining',
    96,
    98,
    1,
    'Jacob and Esau''s brotherhood and rivalry structure the patriarchal narrative and later national relationship.'
  ),
  (
    'f625e17b-2357-43fa-a620-64727ee0f473',
    'supporting_identity',
    70,
    82,
    2,
    'Terah identifies Abraham''s family of origin but is not central to the covenant narrative after Genesis 12.'
  ),
  (
    'a5c614ac-acee-4cb2-8005-c9e8c05ebf61',
    'covenant_lineage',
    82,
    90,
    2,
    'Joseph''s fatherhood of Ephraim explains a major tribal line and the later Joseph allotment.'
  ),
  (
    '541a1c66-3678-4309-8b25-66c8b74e0256',
    'narrative_defining',
    98,
    98,
    1,
    'Abraham''s fatherhood of Isaac is indispensable to the covenant promise and patriarchal narrative.'
  ),
  (
    '339ac7f4-4019-4fb4-96f8-4d27bd6349fa',
    'covenant_lineage',
    86,
    92,
    2,
    'Jacob''s fatherhood of Judah anchors the royal and covenant line.'
  ),
  (
    'b6a15bdd-384c-43b1-9a05-c077348e015c',
    'genealogical_detail',
    55,
    75,
    3,
    'Bethuel is a legitimate Genesis detail, but knowing his name is not necessary to follow Rebekah''s role or the main narrative.'
  ),
  (
    '9eb43b48-8a10-421d-b31e-eacd636fefbf',
    'supporting_identity',
    66,
    82,
    2,
    'Rachel''s death in Benjamin''s birth gives the relationship local narrative relevance, but it is secondary globally.'
  ),
  (
    '94dba637-5e99-4542-8786-3abaad8832b8',
    'narrative_defining',
    98,
    98,
    1,
    'Sarah''s motherhood of Isaac fulfills the central promised-son narrative.'
  ),
  (
    'ebdb5a0e-d308-4464-8b55-4ad880962bec',
    'narrative_defining',
    98,
    98,
    1,
    'Abraham and Sarah are the foundational covenant household throughout the patriarchal narrative.'
  );

update public.ot_generated_questions question
set payload = question.payload || jsonb_build_object(
  'importance', review.global_score,
  'importance_conceptual', review.global_score,
  'importance_context', review.context_score,
  'importance_tier', review.importance_tier,
  'relationship_importance_class', review.relationship_class,
  'importance_review_version', '20260726_relationship_rubric_v1'
)
from public.obs_relationship_question_reviews review
where question.id = review.generated_question_id;

update public.person_significance significance
set
  importance_score = review.global_score,
  importance_tier = review.importance_tier
from public.obs_relationship_question_reviews review
where significance.generated_question_id = review.generated_question_id;

update public.ot_generated_questions
set payload = payload || jsonb_build_object(
  'prompt',
  'According to Genesis 18, what did the LORD promise would happen when he returned at the appointed time?',
  'source_ref',
  'Gen 18:10-14',
  'quality_review_version',
  '20260726_self_answering_prompt_repair'
)
where id = '6e0c61e8-6e2a-47f1-be70-b27ce44c0831'::uuid;

create view public.obs_admin_relationship_importance_audit as
select
  question.id as generated_question_id,
  question.payload->>'prompt' as prompt,
  question.payload->>'source_ref' as source_ref,
  review.relationship_class,
  review.global_score,
  review.context_score,
  review.importance_tier,
  significance.importance_score as significance_score,
  significance.importance_tier as significance_tier,
  bank.importance_conceptual as effective_global_score,
  bank.importance_context as effective_context_score,
  review.rationale
from public.ot_generated_questions question
left join public.obs_relationship_question_reviews review
  on review.generated_question_id = question.id
left join public.person_significance significance
  on significance.generated_question_id = question.id
left join public.v_question_bank bank
  on bank.generated_question_id = question.id
where question.question_type = 'relationship_curated_mcq_v1'
  and question.payload->>'prompt' ~* '^Who was the (father|mother|wife|husband|brother|sister|son|daughter) of ';

revoke all on table public.obs_relationship_importance_rubric from public, anon, authenticated;
revoke all on table public.obs_relationship_question_reviews from public, anon, authenticated;
revoke all on table public.obs_admin_relationship_importance_audit from public, anon, authenticated;

grant select on table public.obs_relationship_importance_rubric to service_role;
grant select on table public.obs_relationship_question_reviews to service_role;
grant select on table public.obs_admin_relationship_importance_audit to service_role;

do $$
declare
  review_count integer;
  synchronized_count integer;
  repaired_count integer;
begin
  select count(*)
  into review_count
  from public.obs_relationship_question_reviews;

  select count(*)
  into synchronized_count
  from public.obs_admin_relationship_importance_audit
  where relationship_class is not null
    and global_score = significance_score
    and importance_tier = significance_tier
    and global_score = effective_global_score
    and context_score = effective_context_score;

  select count(*)
  into repaired_count
  from public.ot_generated_questions question
  cross join lateral jsonb_array_elements(question.payload->'choices') choice
  where question.id = '6e0c61e8-6e2a-47f1-be70-b27ce44c0831'::uuid
    and question.payload->>'prompt' =
      'According to Genesis 18, what did the LORD promise would happen when he returned at the appointed time?'
    and question.payload->>'source_ref' = 'Gen 18:10-14'
    and choice->>'id' = question.payload->>'correct_choice_id'
    and choice->>'text' = 'Sarah will have a son';

  if review_count <> 12
     or synchronized_count <> 12
     or repaired_count <> 1
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Postcondition failed: reviews=%s/12 synchronized=%s/12 repaired=%s/1.',
        review_count,
        synchronized_count,
        repaired_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
