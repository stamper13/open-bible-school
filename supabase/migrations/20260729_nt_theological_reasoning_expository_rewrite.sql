-- Replace all 21 provisional NT Theological Reasoning items with questions
-- that require following the cited passage's argument, sequence, or contrast.
--
-- Historical integrity:
--   * Old IDs and their four existing answers remain intact.
--   * Old IDs become excluded from routing and scoring.
--   * Replacement questions receive new IDs and no inherited history.
--
-- Interpretation policy:
--   * James 2: test James's examples and stated sequence, not a later
--     confessional definition of justification.
--   * Matthew 5: test claims surrounding "fulfill," not a theory of how the
--     Mosaic law applies after Christ.
--   * Colossians 1: test the hymn's repeated claims, not a definition of
--     "firstborn."
--   * Philippians 3: test Paul's loss/gain contrast without adjudicating the
--     debated genitive construction often translated "faith in Christ."

begin;

create temporary table obs_nt_theology_rewrite (
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
  expository_target text not null,
  irt_b double precision not null,
  difficulty_estimate integer not null,
  importance_conceptual integer not null,
  importance_context integer not null
) on commit drop;

insert into obs_nt_theology_rewrite values
(
  'e1b173c4-bfcd-4835-91e0-e947ee021a67',
  '16878c99-db95-4de0-b689-04eaaa83be70',
  '1JN',
  'nt_expository|1JN|sin_denial_confession_advocate_1jn1',
  'In 1 John 1:8-2:2, what two provisions answer the reality of believers'' sin?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Confession is met with forgiveness and cleansing, and Jesus Christ is the advocate for anyone who sins'),
    jsonb_build_object('id', 'B', 'text', 'Sin is removed by claiming to have no sin and separating from everyone who confesses weakness'),
    jsonb_build_object('id', 'C', 'text', 'Forgiveness depends on discovering hidden knowledge and receiving a second anointing'),
    jsonb_build_object('id', 'D', 'text', 'Sin is treated only as ignorance, so confession and advocacy are unnecessary')
  ),
  'A',
  'Confession is met with forgiveness and cleansing, and Jesus Christ is the advocate for anyone who sins',
  '1 John 1:8-2:2',
  1,
  'argument_flow',
  0.75,
  650,
  88,
  92
),
(
  '1776a642-ddf8-4209-b96a-b395e379ae89',
  'e45671c7-9d61-46f5-8833-f7e4b484c1bf',
  '1PE',
  'nt_expository|1PE|chosen_people_proclamation_conduct_1pe2',
  'Why does 1 Peter 2:9-12 apply the titles "chosen race," "royal priesthood," and "holy nation" to believers?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'To proclaim God''s excellencies and live honorably among the Gentiles'),
    jsonb_build_object('id', 'B', 'text', 'To establish a hereditary priesthood that replaces every church elder'),
    jsonb_build_object('id', 'C', 'text', 'To withdraw from Gentile neighbors until civil authorities become friendly'),
    jsonb_build_object('id', 'D', 'text', 'To claim an earthly kingdom exempt from suffering and accusation')
  ),
  'A',
  'To proclaim God''s excellencies and live honorably among the Gentiles',
  '1 Peter 2:9-12',
  2,
  'argument_flow',
  0.7,
  640,
  88,
  92
),
(
  '42db5baf-13c6-4902-8b7b-a24e1972fb62',
  '1de2cd47-31a0-4c9c-b347-dcece9d0cfd7',
  '1PE',
  'nt_expository|1PE|suffering_destination_authority_1pe3',
  'What destination and status close Peter''s account of Christ''s suffering in 1 Peter 3:18-22?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'He has gone into heaven, is at God''s right hand, and spiritual powers are subject to him'),
    jsonb_build_object('id', 'B', 'text', 'He remains among the imprisoned spirits until every generation has heard him'),
    jsonb_build_object('id', 'C', 'text', 'He returns to the Jerusalem temple to resume the sacrifices of the priests'),
    jsonb_build_object('id', 'D', 'text', 'He withdraws from authority so angels can govern the churches in his place')
  ),
  'A',
  'He has gone into heaven, is at God''s right hand, and spiritual powers are subject to him',
  '1 Peter 3:18-22',
  3,
  'local_context',
  0.85,
  665,
  86,
  92
),
(
  '26d79ac6-fcc3-4cca-9dd1-f9a95128f047',
  'd66052be-3419-41eb-9911-758b92b722d8',
  '1TH',
  'nt_expository|1TH|day_lord_wake_encourage_1th5',
  'What reason supports the commands to stay awake, be sober, and encourage one another in 1 Thessalonians 5:1-11?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'God appointed believers for salvation through Christ rather than wrath, so they may live with him'),
    jsonb_build_object('id', 'B', 'text', 'The Thessalonians had calculated the day of the Lord and needed to announce its date'),
    jsonb_build_object('id', 'C', 'text', 'Roman officials had promised the church protection from every future affliction'),
    jsonb_build_object('id', 'D', 'text', 'Only church leaders would remain awake while the rest of the congregation slept')
  ),
  'A',
  'God appointed believers for salvation through Christ rather than wrath, so they may live with him',
  '1 Thessalonians 5:1-11',
  5,
  'argument_flow',
  0.7,
  640,
  90,
  93
),
(
  '5585b768-6718-44da-b398-8e0a724cfc2f',
  '2a3f5763-aa37-4e7d-b06f-80004ecd0d82',
  '1TH',
  'nt_expository|1TH|conversion_report_three_movements_1th1',
  'Which three movements make up the report about the Thessalonians in 1 Thessalonians 1:9-10?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'They welcomed the messengers, turned from idols to serve God, and waited for his Son from heaven'),
    jsonb_build_object('id', 'B', 'text', 'They left Macedonia, observed the feasts in Jerusalem, and joined the temple priesthood'),
    jsonb_build_object('id', 'C', 'text', 'They rejected manual work, sold their property, and waited for Paul to govern the city'),
    jsonb_build_object('id', 'D', 'text', 'They defeated their persecutors, appointed civic rulers, and ended opposition to the gospel')
  ),
  'A',
  'They welcomed the messengers, turned from idols to serve God, and waited for his Son from heaven',
  '1 Thessalonians 1:9-10',
  1,
  'narrative_sequence',
  0.65,
  635,
  84,
  91
),
(
  'dc81ab74-1e95-4807-9366-b81441d5a5b0',
  '32d44e55-6b7e-4201-9245-5bfedca1591c',
  '1TI',
  'nt_expository|1TI|charge_love_vain_discussion_1ti1',
  'What contrast explains the aim of Paul''s charge in 1 Timothy 1:3-7?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Love from a pure heart, good conscience, and sincere faith contrasts with wandering into vain discussion'),
    jsonb_build_object('id', 'B', 'text', 'Public debate contrasts with private study because only public speakers can understand the law'),
    jsonb_build_object('id', 'C', 'text', 'Gentile instruction contrasts with Jewish instruction because they require different gospels'),
    jsonb_build_object('id', 'D', 'text', 'Civic leadership contrasts with church leadership because rulers determine sound teaching')
  ),
  'A',
  'Love from a pure heart, good conscience, and sincere faith contrasts with wandering into vain discussion',
  '1 Timothy 1:3-7',
  1,
  'argument_flow',
  0.7,
  640,
  86,
  92
),
(
  'a5f0253c-2d48-4d41-b52a-ae0a5e12d7f3',
  '8bde2f40-f07b-4f5c-be04-45cadf01b1a4',
  '2CO',
  'nt_expository|2CO|one_died_new_life_2co5',
  'What conclusion does Paul draw from "one died for all" in 2 Corinthians 5:14-17?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Those who live should no longer live for themselves but for Christ, and anyone in Christ is a new creation'),
    jsonb_build_object('id', 'B', 'text', 'Only the apostles share in Christ''s death, so ordinary believers continue living for themselves'),
    jsonb_build_object('id', 'C', 'text', 'Christ''s death makes bodily life irrelevant, so creation and conduct no longer matter'),
    jsonb_build_object('id', 'D', 'text', 'The Corinthians should judge everyone by outward appearance to identify the new creation')
  ),
  'A',
  'Those who live should no longer live for themselves but for Christ, and anyone in Christ is a new creation',
  '2 Corinthians 5:14-17',
  5,
  'argument_flow',
  0.85,
  665,
  92,
  94
),
(
  '87c87037-7dc6-450b-9ba8-9c1a8e4f5e49',
  'f0ff6fdf-d7c0-40d1-b80d-9a43d5428f7e',
  '2JN',
  'nt_expository|2JN|deceivers_teaching_boundary_2jn7',
  'How do 2 John 7-9 connect the deceivers with the warning about not remaining in Christ''s teaching?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The deceivers deny Jesus Christ coming in the flesh, and leaving his teaching means not having God'),
    jsonb_build_object('id', 'B', 'text', 'The deceivers refuse hospitality, and leaving the teaching means traveling without a letter'),
    jsonb_build_object('id', 'C', 'text', 'The deceivers misunderstand food laws, and leaving the teaching means eating with Gentiles'),
    jsonb_build_object('id', 'D', 'text', 'The deceivers oppose Roman rule, and leaving the teaching means rejecting civic authority')
  ),
  'A',
  'The deceivers deny Jesus Christ coming in the flesh, and leaving his teaching means not having God',
  '2 John 7-9',
  1,
  'local_context',
  0.75,
  650,
  82,
  92
),
(
  '0d981696-ce77-4926-8f01-a84a492f1115',
  '52d7af02-a360-4fbd-b488-604586fba0bc',
  '2PE',
  'nt_expository|2PE|eyewitness_prophetic_word_2pe1',
  'Which two witnesses support the apostolic message about Christ''s power and coming in 2 Peter 1:16-21?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The apostles witnessed Christ''s majesty on the holy mountain, and the prophetic word was spoken from God by the Spirit'),
    jsonb_build_object('id', 'B', 'text', 'Roman officials recorded the event, and later councils supplied the prophetic interpretation'),
    jsonb_build_object('id', 'C', 'text', 'The apostles inherited secret traditions, and angels dictated a new prophecy after Christ''s ascension'),
    jsonb_build_object('id', 'D', 'text', 'The churches voted to accept the account, and Peter confirmed it through a private vision')
  ),
  'A',
  'The apostles witnessed Christ''s majesty on the holy mountain, and the prophetic word was spoken from God by the Spirit',
  '2 Peter 1:16-21',
  1,
  'argument_flow',
  0.9,
  675,
  88,
  94
),
(
  '7d12ef70-34fa-4427-8e14-67af62ad1036',
  'fe7504a6-ebf2-41b9-a27c-ff93db9691c3',
  '2TH',
  'nt_expository|2TH|salvation_thanksgiving_stand_firm_2th2',
  'What response follows Paul''s thanksgiving for salvation through the Spirit''s sanctifying work and belief in the truth in 2 Thessalonians 2:13-17?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Stand firm and hold to the teaching received, while looking to God for comfort and strength'),
    jsonb_build_object('id', 'B', 'text', 'Determine the identity of the lawless one before continuing any ordinary work'),
    jsonb_build_object('id', 'C', 'text', 'Abandon Paul''s oral teaching and retain only messages delivered by unnamed spirits'),
    jsonb_build_object('id', 'D', 'text', 'Return to Thessalonica''s temples so persecution will no longer trouble the congregation')
  ),
  'A',
  'Stand firm and hold to the teaching received, while looking to God for comfort and strength',
  '2 Thessalonians 2:13-17',
  2,
  'argument_flow',
  0.8,
  660,
  88,
  93
),
(
  'd6356258-7f76-4e47-b672-5608bc22eac1',
  'f2530d50-7784-4039-8175-2c2ab7dbe0c0',
  '2TI',
  'nt_expository|2TI|scripture_salvation_equipment_2ti3',
  'What progression gives Scripture its role in 2 Timothy 3:14-17?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The sacred writings make one wise for salvation, and God-breathed Scripture equips God''s servant for every good work'),
    jsonb_build_object('id', 'B', 'text', 'Scripture supplies hidden dates, and those calculations equip teachers to avoid all suffering'),
    jsonb_build_object('id', 'C', 'text', 'Childhood familiarity makes Scripture sufficient without teaching, correction, or training'),
    jsonb_build_object('id', 'D', 'text', 'Scripture authorizes only public reading, while practical training comes from Roman education')
  ),
  'A',
  'The sacred writings make one wise for salvation, and God-breathed Scripture equips God''s servant for every good work',
  '2 Timothy 3:14-17',
  3,
  'argument_flow',
  0.75,
  650,
  90,
  94
),
(
  '89a7bce5-0c5d-4716-8496-9673e186445b',
  '11ca91a4-2e15-4bd8-a310-62f0600ac9ce',
  'COL',
  'nt_expository|COL|son_supremacy_repeated_scope_col1',
  'Which repeated claims establish the Son''s supremacy in Colossians 1:15-20?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'All things were created through and for him; he is before all things, head of the church, and the one through whom God reconciles'),
    jsonb_build_object('id', 'B', 'text', 'He governs one nation, inherits the Levitical priesthood, and reconciles only heavenly beings'),
    jsonb_build_object('id', 'C', 'text', 'He is the first angel created, receives authority from the church, and holds creation together temporarily'),
    jsonb_build_object('id', 'D', 'text', 'He replaces the Father, abolishes creation, and removes every distinction between heaven and earth')
  ),
  'A',
  'All things were created through and for him; he is before all things, head of the church, and the one through whom God reconciles',
  'Colossians 1:15-20',
  1,
  'local_context',
  0.85,
  665,
  94,
  95
),
(
  'b1498f45-2d54-4eb8-aa04-15dc51604fec',
  '3c0e9f83-249c-41da-91a5-9c4cd855ae17',
  'COL',
  'nt_expository|COL|alive_debt_powers_sequence_col2',
  'Which sequence describes God''s action in Colossians 2:13-15?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'He made believers alive with Christ, forgave them, canceled the hostile record, and disarmed the rulers and authorities'),
    jsonb_build_object('id', 'B', 'text', 'He postponed forgiveness, transferred the debt to Gentiles, and placed believers under the rulers'),
    jsonb_build_object('id', 'C', 'text', 'He erased bodily life, confirmed the written regulations, and honored the spiritual powers'),
    jsonb_build_object('id', 'D', 'text', 'He made the rulers alive, forgave their hostility, and nailed the Colossian church to the cross')
  ),
  'A',
  'He made believers alive with Christ, forgave them, canceled the hostile record, and disarmed the rulers and authorities',
  'Colossians 2:13-15',
  2,
  'narrative_sequence',
  0.85,
  665,
  92,
  94
),
(
  '09f9da7a-98a9-42a8-9c30-a483be0ddec8',
  '406b2b25-c984-4133-8309-b444531da9fe',
  'GAL',
  'nt_expository|GAL|curse_redemption_abraham_blessing_gal3',
  'How does Paul move from the law''s curse to the blessing of Abraham in Galatians 3:10-14?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Christ redeems from the curse by becoming a curse, so Abraham''s blessing reaches the Gentiles and the promised Spirit is received'),
    jsonb_build_object('id', 'B', 'text', 'Gentiles accept the curse voluntarily, so Israel can retain Abraham''s blessing without Christ'),
    jsonb_build_object('id', 'C', 'text', 'The law withdraws its curse after enough commands are kept, making the promise to Abraham unnecessary'),
    jsonb_build_object('id', 'D', 'text', 'Paul transfers the curse to persecutors, so the Galatians receive Abraham''s land immediately')
  ),
  'A',
  'Christ redeems from the curse by becoming a curse, so Abraham''s blessing reaches the Gentiles and the promised Spirit is received',
  'Galatians 3:10-14',
  3,
  'argument_flow',
  0.9,
  675,
  94,
  95
),
(
  '14ae4144-117f-4d2c-a628-204e2c3461d1',
  '52a5eaa1-6b12-4194-886a-a928cc3b1d93',
  'GAL',
  'nt_expository|GAL|flesh_spirit_list_conclusion_gal5',
  'What conclusion follows the contrast between the works of the flesh and the fruit of the Spirit in Galatians 5:16-26?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Those who belong to Christ have crucified the flesh, and those who live by the Spirit should keep in step with the Spirit'),
    jsonb_build_object('id', 'B', 'text', 'Those who know the lists may continue gratifying the flesh because knowledge replaces conduct'),
    jsonb_build_object('id', 'C', 'text', 'Those led by the Spirit must adopt circumcision to keep the flesh under control'),
    jsonb_build_object('id', 'D', 'text', 'Those who display one spiritual fruit are free to provoke and envy one another')
  ),
  'A',
  'Those who belong to Christ have crucified the flesh, and those who live by the Spirit should keep in step with the Spirit',
  'Galatians 5:16-26',
  5,
  'argument_flow',
  0.75,
  650,
  90,
  93
),
(
  '10e93059-e3a5-4607-874d-f4894f2ff3c7',
  '7f04ea44-8aa2-4703-b191-bb2fdf26d70d',
  'HEB',
  'nt_expository|HEB|sympathetic_priest_throne_invitation_heb4',
  'What invitation follows the description of Jesus as a high priest who sympathizes with weakness in Hebrews 4:14-16?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Hold firmly to the confession and approach the throne of grace confidently for mercy and timely help'),
    jsonb_build_object('id', 'B', 'text', 'Avoid approaching God until every temptation has been permanently removed'),
    jsonb_build_object('id', 'C', 'text', 'Seek mercy through priests who serve at the Jerusalem altar'),
    jsonb_build_object('id', 'D', 'text', 'Abandon confession whenever weakness makes confidence difficult')
  ),
  'A',
  'Hold firmly to the confession and approach the throne of grace confidently for mercy and timely help',
  'Hebrews 4:14-16',
  4,
  'argument_flow',
  0.7,
  640,
  92,
  94
),
(
  '2b1d8f97-db98-4bc9-9262-2a4ec6417c3d',
  '0bd8073c-0111-4fd3-896e-07faf8ae9cff',
  'JAS',
  'nt_expository|JAS|abraham_rahab_active_faith_jas2',
  'What do James'' examples of Abraham and Rahab show within the argument of James 2:14-26?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Faith acted together with their deeds and was brought to completion through action, unlike a merely stated faith'),
    jsonb_build_object('id', 'B', 'text', 'Their ancestry made action unnecessary once they had verbally agreed with correct teaching'),
    jsonb_build_object('id', 'C', 'text', 'Their actions replaced faith entirely, so belief in God has no role in James'' argument'),
    jsonb_build_object('id', 'D', 'text', 'Their political loyalty demonstrated that works concern civic law rather than care for people')
  ),
  'A',
  'Faith acted together with their deeds and was brought to completion through action, unlike a merely stated faith',
  'James 2:14-26',
  2,
  'argument_flow',
  0.9,
  675,
  92,
  95
),
(
  'eb76e809-bc50-4011-b060-70b746e96d71',
  'e116dba6-39dd-4e0c-aeb1-1eb0cab48764',
  'LUK',
  'nt_expository|LUK|zacchaeus_salvation_mission_sequence_luk19',
  'Which sequence leads to Jesus'' mission statement in the Zacchaeus account of Luke 19:1-10?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Zacchaeus receives Jesus joyfully, pledges restitution, and Jesus declares salvation before saying he came to seek and save the lost'),
    jsonb_build_object('id', 'B', 'text', 'Zacchaeus refuses Jesus entry, the crowd praises him, and Jesus calls him a model tax collector'),
    jsonb_build_object('id', 'C', 'text', 'Jesus commands Zacchaeus to leave Jericho, after which the disciples collect his taxes'),
    jsonb_build_object('id', 'D', 'text', 'The crowd restores Zacchaeus'' money, and Jesus declares that wealth itself has saved his house')
  ),
  'A',
  'Zacchaeus receives Jesus joyfully, pledges restitution, and Jesus declares salvation before saying he came to seek and save the lost',
  'Luke 19:1-10',
  19,
  'narrative_sequence',
  0.65,
  635,
  86,
  93
),
(
  '30fe04eb-ebda-4054-b8e9-5b236992cedf',
  '3f2d4588-428b-4c7d-ba3d-88474cf71550',
  'MAT',
  'nt_expository|MAT|law_prophets_surrounding_claims_mat5',
  'Which claims surround Jesus'' statement that he came not to abolish the Law and Prophets but to fulfill them in Matthew 5:17-20?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Nothing passes from the Law until all is accomplished, and entry into the kingdom requires righteousness exceeding that of the scribes and Pharisees'),
    jsonb_build_object('id', 'B', 'text', 'Every command immediately expires, and kingdom entry depends on holding a teaching office'),
    jsonb_build_object('id', 'C', 'text', 'Only ceremonial commands remain, and Gentiles enter the kingdom by avoiding Jewish teachers'),
    jsonb_build_object('id', 'D', 'text', 'The Prophets replace the Law, and the scribes determine which commands Jesus preserves')
  ),
  'A',
  'Nothing passes from the Law until all is accomplished, and entry into the kingdom requires righteousness exceeding that of the scribes and Pharisees',
  'Matthew 5:17-20',
  5,
  'local_context',
  0.8,
  660,
  94,
  95
),
(
  'a016c33f-e03b-4d8c-bd50-0bd61da4dd8e',
  '90a33066-b6cf-46e8-bfb6-134a1c1e997d',
  'MRK',
  'nt_expository|MRK|greatness_service_ransom_mrk10',
  'How does Jesus answer James and John''s request for status in Mark 10:35-45?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Greatness means serving rather than ruling over others, as the Son of Man serves and gives his life as a ransom for many'),
    jsonb_build_object('id', 'B', 'text', 'Greatness belongs to the first disciple who can accept Jesus'' cup without suffering'),
    jsonb_build_object('id', 'C', 'text', 'Greatness follows the pattern of Gentile rulers who exercise authority over their subjects'),
    jsonb_build_object('id', 'D', 'text', 'Greatness is assigned by family rank, so James and John receive the places they request')
  ),
  'A',
  'Greatness means serving rather than ruling over others, as the Son of Man serves and gives his life as a ransom for many',
  'Mark 10:35-45',
  10,
  'argument_flow',
  0.65,
  635,
  92,
  95
),
(
  'a1ece8e1-c395-4217-90ec-b93371602f92',
  '10c7688c-5a88-4880-9f7c-2dd093f9dfd0',
  'PHP',
  'nt_expository|PHP|credentials_loss_gain_christ_php3',
  'What contrast structures Paul''s account of his former credentials in Philippians 3:4-11?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'He counts former status and legal achievement as loss in order to gain Christ and be found in him rather than rely on his own righteousness'),
    jsonb_build_object('id', 'B', 'text', 'He treats his Pharisaic status as the foundation that makes gaining Christ possible'),
    jsonb_build_object('id', 'C', 'text', 'He abandons knowing Christ so he can recover the social honor attached to his ancestry'),
    jsonb_build_object('id', 'D', 'text', 'He contrasts Jewish ancestry with Roman citizenship and chooses citizenship as his righteousness')
  ),
  'A',
  'He counts former status and legal achievement as loss in order to gain Christ and be found in him rather than rely on his own righteousness',
  'Philippians 3:4-11',
  3,
  'argument_flow',
  0.85,
  665,
  92,
  95
);

do $$
declare
  provisional_old_count integer;
  conflicting_new_ids integer;
begin
  select count(*)
  into provisional_old_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_theology_rewrite batch
    on batch.old_id = review.generated_question_id
  where review.review_status = 'provisional'
    and review.routing_priority = 1
    and review.scoring_weight = 0.55;

  select count(*)
  into conflicting_new_ids
  from public.ot_generated_questions question
  join obs_nt_theology_rewrite batch
    on batch.new_id = question.id;

  if provisional_old_count <> 21 or conflicting_new_ids <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT theology rewrite precondition failed: provisional_old=%s/21 conflicting_new_ids=%s/0.',
        provisional_old_count,
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
  '20260729_nt_theological_reasoning_expository_rewrite',
  'public',
  'obs_nt_expository_item_reviews_retired_21',
  'data',
  jsonb_agg(
    to_jsonb(review)
    order by review.generated_question_id
  )::text
from public.obs_nt_expository_item_reviews review
join obs_nt_theology_rewrite batch
  on batch.old_id = review.generated_question_id
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_nt_theological_reasoning_expository_rewrite'
    and backup.object_schema = 'public'
    and backup.object_name =
          'obs_nt_expository_item_reviews_retired_21'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
  backed_up_rows integer;
begin
  select
    count(*),
    coalesce(jsonb_array_length(max(definition)::jsonb), 0)
  into backup_count, backed_up_rows
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_theological_reasoning_expository_rewrite'
    and object_schema = 'public'
    and object_name =
          'obs_nt_expository_item_reviews_retired_21'
    and object_type = 'data';

  if backup_count <> 1 or backed_up_rows <> 21 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT theology rewrite backup failed: backups=%s/1 rows=%s/21.',
        backup_count,
        backed_up_rows
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
  'nt_expository_mcq_v2',
  jsonb_build_object(
    'question_id', batch.new_id,
    'question_format', 'mcq',
    'question_layer', 'expository_rewrite',
    'source_batch',
      '20260729_nt_theological_reasoning_expository_rewrite',
    'testament', 'NT',
    'book_code', batch.book_code,
    'chapter', batch.chapter,
    'reference', batch.reference,
    'source_ref', batch.reference,
    'prompt', batch.prompt,
    'choices', batch.choices,
    'correct_choice_id', batch.correct_choice_id,
    'correct_answer', batch.correct_answer,
    'dimension', 'theological_reasoning',
    'dimension_key', 'theological_reasoning',
    'irt_b', batch.irt_b,
    'difficulty_estimate', batch.difficulty_estimate,
    'importance_conceptual', batch.importance_conceptual,
    'importance_context', batch.importance_context,
    'interpretation_policy',
      'explicit_local_context_no_systematic_inference',
    'position_rebalanced', true
  ),
  batch.dedupe_key
from obs_nt_theology_rewrite batch;

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
  'manual_theological_reasoning_expository_rewrite',
  'Tests the cited passage''s argument, sequence, or contrast without '
    || 'requiring a later systematic or confessional conclusion. Replaces '
    || batch.old_id::text
    || '.',
  '20260729_nt_theological_reasoning_expository_rewrite',
  now(),
  now()
from obs_nt_theology_rewrite batch;

update public.obs_nt_expository_item_reviews review
set
  review_status = 'excluded',
  routing_priority = 0,
  scoring_weight = 0.0,
  review_notes =
    'Retired without mutating historical answers; replaced by '
    || batch.new_id::text
    || '.',
  reviewed_by =
    '20260729_nt_theological_reasoning_expository_rewrite',
  reviewed_at = now(),
  updated_at = now()
from obs_nt_theology_rewrite batch
where review.generated_question_id = batch.old_id;

do $$
declare
  active_nt_count integer;
  reviewed_count integer;
  approved_count integer;
  provisional_count integer;
  excluded_count integer;
  new_approved_count integer;
  retired_count integer;
  invalid_new_count integer;
  new_answer_count integer;
  old_answer_count integer;
  theology_routable_count integer;
  theology_approved_count integer;
begin
  select count(*)
  into active_nt_count
  from public.v_nt_question_bank;

  select
    count(*),
    count(*) filter (where review_status = 'approved'),
    count(*) filter (where review_status = 'provisional'),
    count(*) filter (where review_status = 'excluded')
  into
    reviewed_count,
    approved_count,
    provisional_count,
    excluded_count
  from public.obs_nt_expository_item_reviews;

  select count(*)
  into new_approved_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_theology_rewrite batch
    on batch.new_id = review.generated_question_id
  where review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into retired_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_theology_rewrite batch
    on batch.old_id = review.generated_question_id
  where review.review_status = 'excluded'
    and review.routing_priority = 0
    and review.scoring_weight = 0.0;

  select count(*)
  into invalid_new_count
  from public.ot_generated_questions question
  join obs_nt_theology_rewrite batch
    on batch.new_id = question.id
  where not public.obs_q_correct_resolves(question.payload)
    or public.obs_q_choice_count(question.payload) <> 4
    or public.obs_q_distinct_choice_count(question.payload) <> 4
    or question.payload->>'dimension_key' <>
         'theological_reasoning'
    or question.payload->>'interpretation_policy' <>
         'explicit_local_context_no_systematic_inference';

  select count(*)
  into new_answer_count
  from public.assessment_answers answer
  join obs_nt_theology_rewrite batch
    on batch.new_id = answer.generated_question_id;

  select count(*)
  into old_answer_count
  from public.assessment_answers answer
  join obs_nt_theology_rewrite batch
    on batch.old_id = answer.generated_question_id;

  select
    count(*),
    count(*) filter (where review.review_status = 'approved')
  into theology_routable_count, theology_approved_count
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'dimension_key' =
          'theological_reasoning'
    and review.review_status in ('approved', 'provisional')
    and review.scoring_weight > 0.0;

  if active_nt_count <> 227
     or reviewed_count <> 227
     or approved_count <> 156
     or provisional_count <> 13
     or excluded_count <> 58
     or new_approved_count <> 21
     or retired_count <> 21
     or invalid_new_count <> 0
     or new_answer_count <> 0
     or old_answer_count <> 4
     or theology_routable_count <> 43
     or theology_approved_count <> 43
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT theology rewrite verification failed: active=%s reviewed=%s approved=%s provisional=%s excluded=%s new=%s retired=%s invalid=%s new_answers=%s old_answers=%s theology_routable=%s theology_approved=%s.',
        active_nt_count,
        reviewed_count,
        approved_count,
        provisional_count,
        excluded_count,
        new_approved_count,
        retired_count,
        invalid_new_count,
        new_answer_count,
        old_answer_count,
        theology_routable_count,
        theology_approved_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
