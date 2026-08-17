-- Replace 12 NT items that were answerable from generic Christian familiarity.
--
-- Historical integrity policy:
--   * Do not mutate the old question IDs; eight already have answer history.
--   * Retire those IDs as excluded, preserving their zero scoring weight.
--   * Add new context-dependent questions under new IDs and approve them.

begin;

create temporary table obs_nt_rewrite_batch_1 (
  old_id uuid primary key,
  new_id uuid unique not null,
  book_code text not null,
  dedupe_key text unique not null,
  prompt text not null,
  choices jsonb not null,
  correct_choice_id text not null,
  correct_answer text not null,
  reference text not null,
  chapter integer not null,
  dimension_key text not null,
  expository_target text not null,
  irt_b double precision not null,
  difficulty_estimate integer not null,
  importance_conceptual integer not null,
  importance_context integer not null
) on commit drop;

insert into obs_nt_rewrite_batch_1 values
(
  '302f9726-9faf-4218-a317-d9aaa1b95bf6',
  'ff13dfcd-c1f2-4232-bc10-532fb70ce909',
  '1JN',
  'nt_expository|1JN|love_response_1jn4',
  'In 1 John 4, what conclusion follows from the statement that God loved us and sent his Son?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Believers should withdraw from anyone who still sins'),
    jsonb_build_object('id', 'B', 'text', 'Believers ought to love one another'),
    jsonb_build_object('id', 'C', 'text', 'Believers no longer need anyone to teach them'),
    jsonb_build_object('id', 'D', 'text', 'Believers should ask for a confirming sign')
  ),
  'B',
  'Believers ought to love one another',
  '1 John 4:9-11',
  4,
  'theological_reasoning',
  'argument_flow',
  0.75,
  650,
  86,
  86
),
(
  'fb5605ab-043e-4fff-8712-79738a493056',
  '57a31e8e-5728-454f-8729-64e20a998858',
  '1PE',
  'nt_expository|1PE|living_hope_inheritance_1pe1',
  'In 1 Peter 1:3-5, the living hope is joined to what inheritance?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'An inheritance kept in heaven that cannot perish, spoil, or fade'),
    jsonb_build_object('id', 'B', 'text', 'A restored kingdom in Jerusalem protected by earthly rulers'),
    jsonb_build_object('id', 'C', 'text', 'A share of the collection being gathered for believers in Judea'),
    jsonb_build_object('id', 'D', 'text', 'A priestly office inherited through family descent')
  ),
  'A',
  'An inheritance kept in heaven that cannot perish, spoil, or fade',
  '1 Peter 1:3-5',
  1,
  'promise_prophecy',
  'authorial_claim',
  0.85,
  665,
  84,
  88
),
(
  'b9193244-913e-48d7-bc85-90ded4d86e23',
  '25b1f120-7450-4cc1-b544-a49846d3da9f',
  '1TI',
  'nt_expository|1TI|prayer_for_rulers_1ti2',
  'Why does 1 Timothy 2 say prayers should be made for kings and all who are in authority?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'So believers may live peaceful and quiet lives in godliness and dignity'),
    jsonb_build_object('id', 'B', 'text', 'So rulers will appoint elders in every congregation'),
    jsonb_build_object('id', 'C', 'text', 'So believers will be excused from supporting widows'),
    jsonb_build_object('id', 'D', 'text', 'So rulers will prohibit every form of physical training')
  ),
  'A',
  'So believers may live peaceful and quiet lives in godliness and dignity',
  '1 Timothy 2:1-2',
  2,
  'law_commands',
  'local_context',
  0.65,
  635,
  82,
  88
),
(
  'cc1152a0-5d1f-434c-80b3-68c3141553a6',
  'e31e4036-ac60-4af5-95dc-8117834a892e',
  '2CO',
  'nt_expository|2CO|new_creation_reconciliation_2co5',
  'After saying that anyone in Christ is a new creation, what work does Paul say God entrusted to the apostles?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The ministry and message of reconciliation'),
    jsonb_build_object('id', 'B', 'text', 'The administration of the collection for Jerusalem'),
    jsonb_build_object('id', 'C', 'text', 'The punishment of every person who opposed Paul'),
    jsonb_build_object('id', 'D', 'text', 'The construction of a new sanctuary in Corinth')
  ),
  'A',
  'The ministry and message of reconciliation',
  '2 Corinthians 5:17-20',
  5,
  'theological_reasoning',
  'argument_flow',
  0.95,
  680,
  88,
  90
),
(
  '610e11fb-c147-47f7-93fc-dff7069d7e88',
  'c7350f38-a24a-40be-87a3-a72854a8b1ae',
  '2TI',
  'nt_expository|2TI|grace_manifested_2ti1',
  'According to 2 Timothy 1:9-10, how was God''s grace, given before the ages, now revealed?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Through Timothy receiving the gift by the laying on of hands'),
    jsonb_build_object('id', 'B', 'text', 'Through faithful people teaching the message to others'),
    jsonb_build_object('id', 'C', 'text', 'Through the appearing of Christ, who abolished death and brought life to light'),
    jsonb_build_object('id', 'D', 'text', 'Through Paul completing his defense before the imperial court')
  ),
  'C',
  'Through the appearing of Christ, who abolished death and brought life to light',
  '2 Timothy 1:9-10',
  1,
  'theological_reasoning',
  'argument_flow',
  1.05,
  700,
  86,
  88
),
(
  '77925cb6-3419-4abe-9b89-904df8c546b1',
  '4cbee02c-19c8-4bf4-8462-094b4e16e26b',
  'ACT',
  'nt_expository|ACT|acts4_healing_context',
  'What event leads the Jerusalem council to ask Peter and John, "By what power or by what name did you do this?"',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The healing of the man who had been lame at the temple gate'),
    jsonb_build_object('id', 'B', 'text', 'The crowd hearing the apostles speak in many languages at Pentecost'),
    jsonb_build_object('id', 'C', 'text', 'The deaths of Ananias and Sapphira after they withheld money'),
    jsonb_build_object('id', 'D', 'text', 'The raising of Tabitha from death in Joppa')
  ),
  'A',
  'The healing of the man who had been lame at the temple gate',
  'Acts 3:1-10; 4:5-12',
  4,
  'events_timeline',
  'narrative_sequence',
  0.55,
  620,
  86,
  92
),
(
  '064a5034-9edf-4007-a452-3fcc264aa567',
  'c17778ec-dfa1-4535-b9b7-463c5d94c1b6',
  'EPH',
  'nt_expository|EPH|gentile_unity_temple_eph2',
  'Which image completes Ephesians 2''s explanation of how formerly alienated Gentiles are joined to God''s people?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Branches grafted into an ancient olive tree'),
    jsonb_build_object('id', 'B', 'text', 'Pilgrims seeking a city whose builder is God'),
    jsonb_build_object('id', 'C', 'text', 'Members of God''s household being built together into a holy temple'),
    jsonb_build_object('id', 'D', 'text', 'Sheep gathered from separate folds under one shepherd')
  ),
  'C',
  'Members of God''s household being built together into a holy temple',
  'Ephesians 2:11-22',
  2,
  'theological_reasoning',
  'argument_flow',
  0.9,
  675,
  88,
  92
),
(
  'ed5c4697-ef57-46d9-a542-5baa5d06f243',
  '8b2a5961-5f3b-4d73-9c42-d0d347cfb7e9',
  'JHN',
  'nt_expository|JHN|thomas_way_question_jhn14',
  'Which question from Thomas prompts Jesus to say, "I am the way, and the truth, and the life"?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Lord, where are you going?'),
    jsonb_build_object('id', 'B', 'text', 'Lord, show us the Father, and it is enough for us'),
    jsonb_build_object('id', 'C', 'text', 'Lord, why will you show yourself to us and not to the world?'),
    jsonb_build_object('id', 'D', 'text', 'Lord, we do not know where you are going; how can we know the way?')
  ),
  'D',
  'Lord, we do not know where you are going; how can we know the way?',
  'John 14:5-6',
  14,
  'characters_lineage',
  'local_context',
  0.8,
  660,
  82,
  92
),
(
  'fa36cffb-5c56-40a6-9206-18cdbf2d9d9e',
  '8a2833ed-b635-481e-9202-ec98178b9760',
  'MAT',
  'nt_expository|MAT|great_commands_sources_mat22',
  'Which two Old Testament commands does Jesus join when answering about the greatest commandment in Matthew 22?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Deuteronomy 6''s command to love God and Leviticus 19''s command to love one''s neighbor'),
    jsonb_build_object('id', 'B', 'text', 'Exodus 20''s Sabbath command and Leviticus 19''s call to holiness'),
    jsonb_build_object('id', 'C', 'text', 'Deuteronomy 24''s divorce law and Leviticus 25''s jubilee law'),
    jsonb_build_object('id', 'D', 'text', 'Leviticus 16''s atonement ritual and Numbers 6''s priestly blessing')
  ),
  'A',
  'Deuteronomy 6''s command to love God and Leviticus 19''s command to love one''s neighbor',
  'Matthew 22:34-40; Deuteronomy 6:5; Leviticus 19:18',
  22,
  'structure_cross_ref',
  'intertextual_use',
  0.95,
  685,
  88,
  90
),
(
  '75850444-2558-4ee7-a598-37eab64c9ffa',
  'b77106c0-cfc2-4257-a79c-8fc2e29fa233',
  'ROM',
  'nt_expository|ROM|human_love_contrast_rom5',
  'What comparison immediately precedes Paul''s statement that Christ died for us while we were still sinners?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'A person rarely dies for a righteous person, though someone might dare to die for a good person'),
    jsonb_build_object('id', 'B', 'text', 'Adam''s one trespass brought death, while Christ''s obedience brings life'),
    jsonb_build_object('id', 'C', 'text', 'There is no distinction between Jew and Gentile because all have sinned'),
    jsonb_build_object('id', 'D', 'text', 'The potter has authority over the clay to make different kinds of vessels')
  ),
  'A',
  'A person rarely dies for a righteous person, though someone might dare to die for a good person',
  'Romans 5:6-8',
  5,
  'theological_reasoning',
  'argument_flow',
  1.0,
  690,
  88,
  92
),
(
  'c120ab4e-6c48-4b57-958d-9152bbbd357a',
  '121a91b7-cdcd-423d-ba7f-2b15936d6dd8',
  'ROM',
  'nt_expository|ROM|boasting_excluded_rom3',
  'After presenting redemption in Christ in Romans 3, by what "law" or principle does Paul say boasting is excluded?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The law of works'),
    jsonb_build_object('id', 'B', 'text', 'The law of faith'),
    jsonb_build_object('id', 'C', 'text', 'The law of sin and death'),
    jsonb_build_object('id', 'D', 'text', 'The royal law')
  ),
  'B',
  'The law of faith',
  'Romans 3:21-28',
  3,
  'theological_reasoning',
  'argument_flow',
  0.85,
  670,
  90,
  92
),
(
  '9b9e2c5f-2adf-4c89-bc24-0e738ceba0f4',
  '6b80b146-b253-45fa-9ebb-c6b300b81669',
  'TIT',
  'nt_expository|TIT|gentleness_reason_tit3',
  'What reason does Titus 3 give for showing gentleness to everyone before describing God''s saving kindness?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The churches lacked elders able to silence rebellious teachers'),
    jsonb_build_object('id', 'B', 'text', 'Cretans were widely known as liars and lazy gluttons'),
    jsonb_build_object('id', 'C', 'text', 'Believers themselves were once foolish, disobedient, deceived, and enslaved to passions'),
    jsonb_build_object('id', 'D', 'text', 'False teachers were upsetting whole households for shameful gain')
  ),
  'C',
  'Believers themselves were once foolish, disobedient, deceived, and enslaved to passions',
  'Titus 3:1-5',
  3,
  'theological_reasoning',
  'argument_flow',
  0.9,
  680,
  86,
  92
);

do $$
declare
  old_rewrite_count integer;
  conflicting_new_ids integer;
begin
  select count(*)
  into old_rewrite_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_rewrite_batch_1 batch
    on batch.old_id = review.generated_question_id
  where review.review_status = 'rewrite'
    and review.routing_priority = 0
    and review.scoring_weight = 0.0;

  select count(*)
  into conflicting_new_ids
  from public.ot_generated_questions question
  join obs_nt_rewrite_batch_1 batch
    on batch.new_id = question.id;

  if old_rewrite_count <> 12 or conflicting_new_ids <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT rewrite precondition failed: retired_candidates=%s/12 conflicting_new_ids=%s/0.',
        old_rewrite_count,
        conflicting_new_ids
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
  '20260729_nt_expository_rewrite_batch_1',
  'public',
  'obs_nt_expository_item_reviews_retired_12',
  'data',
  jsonb_agg(
    to_jsonb(review)
    order by review.generated_question_id
  )::text
from public.obs_nt_expository_item_reviews review
join obs_nt_rewrite_batch_1 batch
  on batch.old_id = review.generated_question_id
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_nt_expository_rewrite_batch_1'
    and backup.object_schema = 'public'
    and backup.object_name =
          'obs_nt_expository_item_reviews_retired_12'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_nt_expository_rewrite_batch_1'
    and object_schema = 'public'
    and object_name = 'obs_nt_expository_item_reviews_retired_12'
    and object_type = 'data';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT rewrite backup failed: expected 1 row, found %s.',
        backup_count
      );
  end if;
end
$$;

insert into public.ot_generated_questions (
  id,
  event_id,
  question_type,
  payload,
  dedupe_key
)
select
  batch.new_id,
  null,
  'nt_expository_mcq_v1',
  jsonb_build_object(
    'question_id', batch.new_id,
    'question_format', 'mcq',
    'question_layer', 'expository_rewrite',
    'source_batch', '20260729_nt_expository_rewrite_batch_1',
    'testament', 'NT',
    'book_code', batch.book_code,
    'chapter', batch.chapter,
    'reference', batch.reference,
    'source_ref', batch.reference,
    'prompt', batch.prompt,
    'choices', batch.choices,
    'correct_choice_id', batch.correct_choice_id,
    'correct_answer', batch.correct_answer,
    'dimension', batch.dimension_key,
    'dimension_key', batch.dimension_key,
    'irt_b', batch.irt_b,
    'difficulty_estimate', batch.difficulty_estimate,
    'importance_conceptual', batch.importance_conceptual,
    'importance_context', batch.importance_context,
    'position_rebalanced', true
  ),
  batch.dedupe_key
from obs_nt_rewrite_batch_1 batch;

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
)
select
  batch.new_id,
  'approved',
  batch.expository_target,
  3,
  1,
  3,
  'low',
  3,
  1.0,
  'manual_expository_rewrite_batch_1',
  'Context-dependent replacement for retired item '
    || batch.old_id::text
    || '; distractors use nearby or book-relevant alternatives.',
  '20260729_nt_expository_rewrite_batch_1',
  now(),
  now()
from obs_nt_rewrite_batch_1 batch;

update public.obs_nt_expository_item_reviews review
set
  review_status = 'excluded',
  review_notes =
    'Retired without mutation to preserve historical answers; replaced by '
    || batch.new_id::text
    || '.',
  reviewed_by = '20260729_nt_expository_rewrite_batch_1',
  reviewed_at = now(),
  updated_at = now()
from obs_nt_rewrite_batch_1 batch
where review.generated_question_id = batch.old_id;

do $$
declare
  active_nt_count integer;
  reviewed_count integer;
  approved_count integer;
  provisional_count integer;
  excluded_count integer;
  rewrite_count integer;
  new_approved_count integer;
  retired_excluded_count integer;
  invalid_new_questions integer;
  covered_books integer;
  approved_books integer;
begin
  select count(*)
  into active_nt_count
  from public.v_nt_question_bank;

  select
    count(*),
    count(*) filter (where review_status = 'approved'),
    count(*) filter (where review_status = 'provisional'),
    count(*) filter (where review_status = 'excluded'),
    count(*) filter (where review_status = 'rewrite')
  into
    reviewed_count,
    approved_count,
    provisional_count,
    excluded_count,
    rewrite_count
  from public.obs_nt_expository_item_reviews;

  select count(*)
  into new_approved_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_rewrite_batch_1 batch
    on batch.new_id = review.generated_question_id
  where review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into retired_excluded_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_rewrite_batch_1 batch
    on batch.old_id = review.generated_question_id
  where review.review_status = 'excluded'
    and review.routing_priority = 0
    and review.scoring_weight = 0.0;

  select count(*)
  into invalid_new_questions
  from public.ot_generated_questions question
  join obs_nt_rewrite_batch_1 batch
    on batch.new_id = question.id
  where not public.obs_q_correct_resolves(question.payload)
    or public.obs_q_choice_count(question.payload) <> 4
    or public.obs_q_distinct_choice_count(question.payload) <> 4
    or question.payload->>'dimension_key' not in (
      'characters_lineage',
      'events_timeline',
      'geography_nations',
      'law_commands',
      'promise_prophecy',
      'theological_reasoning',
      'structure_cross_ref'
    );

  select
    count(distinct question.book_code),
    count(distinct question.book_code) filter (
      where review.review_status = 'approved'
    )
  into covered_books, approved_books
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id;

  if active_nt_count <> 151
     or reviewed_count <> 151
     or approved_count <> 80
     or provisional_count <> 59
     or excluded_count <> 12
     or rewrite_count <> 0
     or new_approved_count <> 12
     or retired_excluded_count <> 12
     or invalid_new_questions <> 0
     or covered_books <> 27
     or approved_books <> 27
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT rewrite verification failed: active=%s reviewed=%s approved=%s provisional=%s excluded=%s rewrite=%s new_approved=%s retired=%s invalid=%s books=%s approved_books=%s.',
        active_nt_count,
        reviewed_count,
        approved_count,
        provisional_count,
        excluded_count,
        rewrite_count,
        new_approved_count,
        retired_excluded_count,
        invalid_new_questions,
        covered_books,
        approved_books
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
