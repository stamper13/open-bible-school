-- Add 30 manually reviewed NT questions in the three thinnest dimensions:
-- Characters & Lineage, Law & Commands, and Geography & Nations.
--
-- Each item is answerable from its cited literary context and is intended to
-- measure reading recall rather than systematic or confessional inference.

begin;

create temporary table obs_nt_beta_depth_batch (
  id uuid primary key,
  book_code text not null,
  reference text not null,
  chapter integer not null,
  dimension_key text not null,
  prompt text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct_choice_id text not null,
  correct_answer text not null,
  irt_b double precision not null,
  difficulty_estimate integer not null,
  importance_conceptual integer not null,
  importance_context integer not null,
  dedupe_key text unique not null
) on commit drop;

insert into obs_nt_beta_depth_batch values
-- Characters & Lineage
(
  '65712589-4af8-4bcd-8e41-135cb45b8f78', 'ROM', 'Romans 16:1-2', 16,
  'characters_lineage',
  'Whom does Paul commend as a servant of the church at Cenchreae in Romans 16?',
  'Phoebe', 'Priscilla', 'Junia', 'Lydia',
  'A', 'Phoebe', 0.35, 570, 72, 88,
  'nt_beta_depth|ROM|phoebe_cenchreae_rom16'
),
(
  '028ad3d2-96b4-478c-bea5-d101cb38367d', '1CO', '1 Corinthians 1:10-12', 1,
  'characters_lineage',
  'Whose people reported the quarrels in the Corinthian church to Paul?',
  'The household of Stephanas', 'The family of Aristobulus',
  'Chloe''s people', 'The brothers from Macedonia',
  'C', 'Chloe''s people', 0.50, 595, 76, 90,
  'nt_beta_depth|1CO|chloe_report_1co1'
),
(
  '18e3d191-5d01-43a1-b66e-0acde086a2c7', '2CO', '2 Corinthians 8:16-17', 8,
  'characters_lineage',
  'Who responded eagerly to Paul''s appeal and went to the Corinthians of his own accord?',
  'Timothy', 'Titus', 'Silvanus', 'Apollos',
  'B', 'Titus', 0.55, 605, 74, 88,
  'nt_beta_depth|2CO|titus_eager_appeal_2co8'
),
(
  'edb9c912-5861-46c5-90f6-e2e86a418e6b', 'GAL', 'Galatians 2:11-14', 2,
  'characters_lineage',
  'According to Galatians 2, who was carried away by the hypocrisy surrounding Peter''s withdrawal from Gentile believers?',
  'Titus', 'James', 'John', 'Barnabas',
  'D', 'Barnabas', 0.65, 625, 80, 92,
  'nt_beta_depth|GAL|barnabas_carried_away_gal2'
),
(
  '864212b9-2d8c-4d4e-a525-ea12b098a539', 'PHP', 'Philippians 2:25-30', 2,
  'characters_lineage',
  'Whom does Paul call his brother, fellow worker, fellow soldier, and the Philippians'' messenger?',
  'Epaphroditus', 'Epaphras', 'Tychicus', 'Onesimus',
  'A', 'Epaphroditus', 0.40, 580, 78, 91,
  'nt_beta_depth|PHP|epaphroditus_titles_php2'
),
(
  '527d04a3-46d6-46a1-83e1-4a3ec8816e50', 'COL', 'Colossians 4:14', 4,
  'characters_lineage',
  'Which coworker does Colossians identify as the beloved physician?',
  'Demas', 'Aristarchus', 'Luke', 'Mark',
  'C', 'Luke', 0.15, 535, 70, 84,
  'nt_beta_depth|COL|beloved_physician_col4'
),
(
  '45ba931c-b190-45c3-8d6c-a8d9bce87e0d', '1TI', '1 Timothy 1:18-20', 1,
  'characters_lineage',
  'Which two people does Paul name as having made shipwreck of their faith in 1 Timothy 1?',
  'Hymenaeus and Alexander', 'Phygelus and Hermogenes',
  'Jannes and Jambres', 'Demas and Crescens',
  'A', 'Hymenaeus and Alexander', 0.75, 645, 72, 88,
  'nt_beta_depth|1TI|hymenaeus_alexander_1ti1'
),
(
  '6b9fb34b-9d1c-4db7-8523-d93f058eb977', '2TI', '2 Timothy 4:9-10', 4,
  'characters_lineage',
  'Who deserted Paul because he loved the present world?',
  'Crescens', 'Titus', 'Tychicus', 'Demas',
  'D', 'Demas', 0.35, 570, 76, 88,
  'nt_beta_depth|2TI|demas_deserted_2ti4'
),
(
  '5863ed5e-38d0-4f5c-b082-2d1090c83a94', 'PHM', 'Philemon 10-16', 1,
  'characters_lineage',
  'Whom does Paul call his child, whose father he became while imprisoned?',
  'Archippus', 'Onesimus', 'Epaphras', 'Aristarchus',
  'B', 'Onesimus', 0.10, 520, 86, 94,
  'nt_beta_depth|PHM|onesimus_child_imprisonment_phm10'
),
(
  'a8cadd23-71e6-462f-8b7c-a5aa705e55b6', '3JN', '3 John 9-10', 1,
  'characters_lineage',
  'Who loves to be first, refuses to welcome the brothers, and puts others out of the church in 3 John?',
  'Gaius', 'Demetrius', 'Diotrephes', 'The elder',
  'C', 'Diotrephes', 0.25, 550, 84, 94,
  'nt_beta_depth|3JN|diotrephes_first_place_3jn9'
),

-- Law & Commands
(
  '472bad35-2286-4f98-91bb-2bd5da063708', 'ROM', 'Romans 12:17-21', 12,
  'law_commands',
  'What instruction concludes Paul''s teaching about responding to evil in Romans 12?',
  'Withdraw until the offender seeks peace',
  'Do not be overcome by evil, but overcome evil with good',
  'Return the same judgment in a measured way',
  'Leave every dispute for civil rulers to settle',
  'B', 'Do not be overcome by evil, but overcome evil with good',
  0.30, 560, 92, 95,
  'nt_beta_depth|ROM|overcome_evil_good_rom12'
),
(
  '0d3f9cf9-6d77-4eb8-b20d-0c3a4fd85f07', '1CO', '1 Corinthians 5:9-13', 5,
  'law_commands',
  'In 1 Corinthians 5, how does Paul clarify his command not to associate with sexually immoral people?',
  'It concerns someone bearing the name of brother who persists in such conduct',
  'It requires Christians to avoid every immoral person outside the church',
  'It applies only when Roman courts have first issued a judgment',
  'It forbids receiving any visitor whose past conduct is unknown',
  'A', 'It concerns someone bearing the name of brother who persists in such conduct',
  0.55, 605, 92, 96,
  'nt_beta_depth|1CO|association_clarified_1co5'
),
(
  '16b1e855-d3ef-4d15-9d21-7445dd6e0a83', 'GAL', 'Galatians 6:1-2', 6,
  'law_commands',
  'What paired instructions does Paul give concerning a believer caught in transgression in Galatians 6?',
  'Expose the person publicly and avoid sharing any burden',
  'Wait for the person to restore himself before offering help',
  'Restore him gently and bear one another''s burdens',
  'Refer the matter to the Jerusalem apostles for a ruling',
  'C', 'Restore him gently and bear one another''s burdens',
  0.35, 570, 91, 95,
  'nt_beta_depth|GAL|restore_bear_burdens_gal6'
),
(
  'b55e0ad0-4ecb-4cb3-a7a4-5486f7a84f80', 'EPH', 'Ephesians 4:25-27', 4,
  'law_commands',
  'What time-related limit does Ephesians place on anger?',
  'Keep silent for seven days before speaking',
  'Resolve anger before entering the assembly',
  'Delay any response until two witnesses are present',
  'Do not let the sun go down on your anger',
  'D', 'Do not let the sun go down on your anger',
  0.15, 535, 88, 92,
  'nt_beta_depth|EPH|sun_anger_eph4'
),
(
  '9e7baf29-7026-43e8-b898-0ea5d2ed8b97', 'PHP', 'Philippians 4:6-7', 4,
  'law_commands',
  'What practice does Philippians 4 set against anxiety?',
  'Present requests to God by prayer and supplication with thanksgiving',
  'Seek a confirming sign before making any request',
  'Entrust every decision to the leaders of the church',
  'Avoid speaking about the concern until peace returns',
  'A', 'Present requests to God by prayer and supplication with thanksgiving',
  0.10, 520, 91, 95,
  'nt_beta_depth|PHP|anxiety_prayer_thanksgiving_php4'
),
(
  '325b62ba-f9ff-4384-94dd-53a43c71778e', 'COL', 'Colossians 3:16', 3,
  'law_commands',
  'How does Colossians 3:16 say the word of Christ should dwell among believers?',
  'Privately, so that teaching remains separate from worship',
  'Only through appointed readers who avoid songs',
  'Richly, as they teach and admonish one another and sing with gratitude',
  'Silently, until every disagreement in the church has ended',
  'C', 'Richly, as they teach and admonish one another and sing with gratitude',
  0.40, 580, 88, 94,
  'nt_beta_depth|COL|word_dwell_richly_col3'
),
(
  '9eafacc1-fc52-484a-a604-f3333bc99214', '1TH', '1 Thessalonians 5:19-22', 5,
  'law_commands',
  'What sequence of instructions does 1 Thessalonians 5 give about prophecies?',
  'Record every prophecy, compare speakers, and preserve the oldest',
  'Accept public prophecies but reject those spoken in homes',
  'Do not despise prophecies; test everything, hold fast what is good, and abstain from evil',
  'Wait for an apostle to approve each prophecy before hearing it',
  'C', 'Do not despise prophecies; test everything, hold fast what is good, and abstain from evil',
  0.55, 605, 88, 95,
  'nt_beta_depth|1TH|test_prophecies_1th5'
),
(
  '6f5cd6ee-21b6-40fb-8ca9-08e234de85ae', '2TH', '2 Thessalonians 3:10-12', 3,
  'law_commands',
  'What rule had Paul given concerning a person who is unwilling to work?',
  'He should work only when an apostle is present',
  'He should receive food but not take part in worship',
  'He should be supported until the next gathering',
  'If anyone is not willing to work, let him not eat',
  'D', 'If anyone is not willing to work, let him not eat',
  0.25, 550, 86, 93,
  'nt_beta_depth|2TH|unwilling_work_eat_2th3'
),
(
  '3a1faecf-68a7-495c-a4fb-747908a3f2c2', 'HEB', 'Hebrews 10:24-25', 10,
  'law_commands',
  'What does Hebrews 10 tell believers not to neglect as the Day draws near?',
  'Meeting together and encouraging one another',
  'Traveling to Jerusalem for the annual feasts',
  'Learning the ancestry of every priest',
  'Separating from believers with weaker consciences',
  'A', 'Meeting together and encouraging one another',
  0.10, 520, 92, 96,
  'nt_beta_depth|HEB|not_neglect_meeting_heb10'
),
(
  '449439ac-f048-49ae-8004-06c8c7617c0e', 'JAS', 'James 1:22-25', 1,
  'law_commands',
  'What contrast does James 1 use to command an active response to the word?',
  'Be teachers of the word rather than students',
  'Be doers of the word and not hearers only',
  'Be guardians of the word rather than travelers',
  'Be judges of the word and not servants',
  'B', 'Be doers of the word and not hearers only',
  0.00, 500, 94, 96,
  'nt_beta_depth|JAS|doers_not_hearers_jas1'
),

-- Geography & Nations
(
  'c2d18273-9c7b-4348-98fd-594bcd6dd893', 'ROM', 'Romans 15:22-28', 15,
  'geography_nations',
  'Which destination does Paul hope to reach after delivering the collection to Jerusalem and visiting Rome?',
  'Alexandria', 'Antioch', 'Spain', 'Cyprus',
  'C', 'Spain', 0.50, 595, 76, 91,
  'nt_beta_depth|ROM|planned_destination_spain_rom15'
),
(
  'bc4ed6aa-1eff-4b81-8fd0-e7e6cb9bc710', '1CO', '1 Corinthians 16:5-9', 16,
  'geography_nations',
  'Where does Paul say he will remain until Pentecost because a wide door for effective work has opened?',
  'Ephesus', 'Corinth', 'Troas', 'Philippi',
  'A', 'Ephesus', 0.55, 605, 72, 90,
  'nt_beta_depth|1CO|remain_ephesus_1co16'
),
(
  '22428d1f-a89d-4003-b9ac-fb55dedd112c', '2CO', '2 Corinthians 1:8-11', 1,
  'geography_nations',
  'In what region did Paul experience the affliction described near the opening of 2 Corinthians?',
  'Achaia', 'Macedonia', 'Galatia', 'Asia',
  'D', 'Asia', 0.65, 625, 68, 88,
  'nt_beta_depth|2CO|affliction_asia_2co1'
),
(
  'a414e638-1fb9-4e5f-ac57-bd116b866212', 'GAL', 'Galatians 1:15-18', 1,
  'geography_nations',
  'Where did Paul go before returning again to Damascus, according to Galatians 1?',
  'Cilicia', 'Arabia', 'Judea', 'Macedonia',
  'B', 'Arabia', 0.65, 625, 74, 91,
  'nt_beta_depth|GAL|arabia_return_damascus_gal1'
),
(
  '46146722-9835-41f2-8fc1-dbc31cd90436', 'COL', 'Colossians 4:15-16', 4,
  'geography_nations',
  'With which neighboring church were the Colossians instructed to exchange letters?',
  'The church in Hierapolis', 'The church in Ephesus',
  'The church in Laodicea', 'The church in Troas',
  'C', 'The church in Laodicea', 0.40, 580, 72, 92,
  'nt_beta_depth|COL|letter_exchange_laodicea_col4'
),
(
  'd27597de-6467-4b3a-b892-2953a2fa4ae2', '1TH', '1 Thessalonians 1:6-8', 1,
  'geography_nations',
  'In which two regions did the Thessalonians become an example to other believers?',
  'Macedonia and Achaia', 'Galatia and Asia',
  'Judea and Samaria', 'Pontus and Bithynia',
  'A', 'Macedonia and Achaia', 0.45, 590, 72, 91,
  'nt_beta_depth|1TH|example_macedonia_achaia_1th1'
),
(
  '6883f7c2-d6e8-4bc3-bc15-50ce6b563f80', 'TIT', 'Titus 1:5', 1,
  'geography_nations',
  'Where did Paul leave Titus to put what remained in order and appoint elders?',
  'Cyprus', 'Malta', 'Achaia', 'Crete',
  'D', 'Crete', 0.00, 500, 84, 94,
  'nt_beta_depth|TIT|left_titus_crete_tit1'
),
(
  '4bb14e20-163c-4a41-905a-fd2e8d18cd61', '1PE', '1 Peter 1:1', 1,
  'geography_nations',
  'Which set of regions is named in 1 Peter''s address to the elect exiles?',
  'Macedonia, Achaia, Crete, Cyprus, and Malta',
  'Pontus, Galatia, Cappadocia, Asia, and Bithynia',
  'Judea, Samaria, Galilee, Idumea, and Perea',
  'Syria, Cilicia, Lycia, Pamphylia, and Pisidia',
  'B', 'Pontus, Galatia, Cappadocia, Asia, and Bithynia',
  0.45, 590, 76, 93,
  'nt_beta_depth|1PE|address_regions_1pe1'
),
(
  'efc1da96-4c91-418e-a8b0-51fbcefdbdb8', 'REV', 'Revelation 1:9-11', 1,
  'geography_nations',
  'On what island was John when he received the vision addressed to the seven churches?',
  'Crete', 'Cyprus', 'Patmos', 'Malta',
  'C', 'Patmos', 0.00, 500, 90, 96,
  'nt_beta_depth|REV|john_patmos_rev1'
),
(
  '687b9ad5-6c12-49cf-8868-04e64a1f9973', '2TI', '2 Timothy 4:13', 4,
  'geography_nations',
  'At what city had Paul left his cloak with Carpus?',
  'Troas', 'Miletus', 'Corinth', 'Nicopolis',
  'A', 'Troas', 0.55, 605, 64, 86,
  'nt_beta_depth|2TI|cloak_carpus_troas_2ti4'
);

do $$
declare
  id_conflicts integer;
  dedupe_conflicts integer;
  invalid_dimensions integer;
begin
  select count(*)
  into id_conflicts
  from public.ot_generated_questions question
  join obs_nt_beta_depth_batch batch on batch.id = question.id;

  select count(*)
  into dedupe_conflicts
  from public.ot_generated_questions question
  join obs_nt_beta_depth_batch batch
    on batch.dedupe_key = question.dedupe_key;

  select count(*)
  into invalid_dimensions
  from obs_nt_beta_depth_batch
  where dimension_key not in (
    'characters_lineage',
    'law_commands',
    'geography_nations'
  );

  if id_conflicts <> 0
     or dedupe_conflicts <> 0
     or invalid_dimensions <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT beta depth precondition failed: id_conflicts=%s dedupe_conflicts=%s invalid_dimensions=%s.',
        id_conflicts,
        dedupe_conflicts,
        invalid_dimensions
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
  batch.id,
  null,
  'nt_expository_mcq_v2',
  jsonb_build_object(
    'question_id', batch.id,
    'question_format', 'mcq',
    'question_layer', 'expository_depth',
    'source_batch', '20260729_nt_beta_depth_expansion',
    'testament', 'NT',
    'book_code', batch.book_code,
    'chapter', batch.chapter,
    'reference', batch.reference,
    'source_ref', batch.reference,
    'prompt', batch.prompt,
    'choices', jsonb_build_array(
      jsonb_build_object('id', 'A', 'text', batch.choice_a),
      jsonb_build_object('id', 'B', 'text', batch.choice_b),
      jsonb_build_object('id', 'C', 'text', batch.choice_c),
      jsonb_build_object('id', 'D', 'text', batch.choice_d)
    ),
    'correct_choice_id', batch.correct_choice_id,
    'correct_answer', batch.correct_answer,
    'dimension', batch.dimension_key,
    'dimension_key', batch.dimension_key,
    'expository_target', 'local_context',
    'irt_b', batch.irt_b,
    'difficulty_estimate', batch.difficulty_estimate,
    'importance_conceptual', batch.importance_conceptual,
    'importance_context', batch.importance_context,
    'interpretation_policy', 'explicit_local_context_no_systematic_inference'
  ),
  batch.dedupe_key
from obs_nt_beta_depth_batch batch;

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
  batch.id,
  'approved',
  'local_context',
  3,
  1,
  3,
  'low',
  3,
  1.0,
  'manual_nt_beta_depth_expansion',
  'Tests explicit people, instructions, or locations in the cited NT context with plausible textual distractors.',
  '20260729_nt_beta_depth_expansion',
  now(),
  now()
from obs_nt_beta_depth_batch batch;

do $$
declare
  inserted_questions integer;
  approved_reviews integer;
  invalid_questions integer;
  answer_collisions integer;
  character_count integer;
  command_count integer;
  geography_count integer;
begin
  select count(*)
  into inserted_questions
  from public.ot_generated_questions
  where payload->>'source_batch' =
        '20260729_nt_beta_depth_expansion';

  select count(*)
  into approved_reviews
  from public.obs_nt_expository_item_reviews review
  join obs_nt_beta_depth_batch batch
    on batch.id = review.generated_question_id
  where review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into invalid_questions
  from public.ot_generated_questions question
  join obs_nt_beta_depth_batch batch on batch.id = question.id
  where not public.obs_q_correct_resolves(question.payload)
    or public.obs_q_choice_count(question.payload) <> 4
    or public.obs_q_distinct_choice_count(question.payload) <> 4
    or question.payload->>'interpretation_policy' <>
       'explicit_local_context_no_systematic_inference';

  select count(*)
  into answer_collisions
  from public.assessment_answers answer
  join obs_nt_beta_depth_batch batch
    on batch.id = answer.generated_question_id;

  select
    count(*) filter (where dimension_key = 'characters_lineage'),
    count(*) filter (where dimension_key = 'law_commands'),
    count(*) filter (where dimension_key = 'geography_nations')
  into character_count, command_count, geography_count
  from obs_nt_beta_depth_batch;

  if inserted_questions <> 30
     or approved_reviews <> 30
     or invalid_questions <> 0
     or answer_collisions <> 0
     or character_count <> 10
     or command_count <> 10
     or geography_count <> 10
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT beta depth verification failed: questions=%s/30 approved=%s/30 invalid=%s/0 answers=%s/0 characters=%s/10 commands=%s/10 geography=%s/10.',
        inserted_questions,
        approved_reviews,
        invalid_questions,
        answer_collisions,
        character_count,
        command_count,
        geography_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
