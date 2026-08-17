-- Replace the 25 provisional NT Promise & Prophecy items with text-dependent
-- questions. The one already-approved 1 Peter item remains unchanged.
--
-- Historical integrity:
--   * Old question IDs and their two existing answers are not mutated.
--   * Old IDs become excluded from routing/scoring.
--   * New questions use new IDs and begin with no answer history.
--
-- Interpretation policy:
--   * Key only claims explicit in the cited literary context.
--   * Do not require an eschatological system or confessional inference.
--   * Avoid adjudicating the debated referent of Philippians 1:6 or the
--     grammatical referent of "God and Savior" in Titus 2:13.

begin;

create temporary table obs_nt_promise_rewrite (
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

insert into obs_nt_promise_rewrite values
(
  'da268a03-d430-4337-9ca4-7d495f413270',
  'fbb59014-6c8b-4ceb-b1b9-5504c1ff0197',
  '1CO',
  'nt_expository|1CO|mortality_last_trumpet_1co15',
  'In 1 Corinthians 15:51-54, what happens to mortal humanity when the last trumpet sounds?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Mortality puts on immortality'),
    jsonb_build_object('id', 'B', 'text', 'Creation enters freedom from corruption'),
    jsonb_build_object('id', 'C', 'text', 'The fullness of the Gentiles comes in'),
    jsonb_build_object('id', 'D', 'text', 'The man of lawlessness is revealed')
  ),
  'A',
  'Mortality puts on immortality',
  '1 Corinthians 15:51-54',
  15,
  'promise_prophecy',
  'local_context',
  0.75,
  650,
  88,
  91
),
(
  '4194ed45-30e5-4cd6-984c-cb867cb5a276',
  'f77eacd0-f5f0-4e3b-9e4c-285905e8319c',
  '1JN',
  'nt_expository|1JN|appearing_hope_purification_1jn3',
  'In 1 John 3:2-3, what response follows the hope of being like Christ when he appears?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Everyone with this hope purifies himself as Christ is pure'),
    jsonb_build_object('id', 'B', 'text', 'Everyone with this hope asks for a sign from heaven'),
    jsonb_build_object('id', 'C', 'text', 'Everyone with this hope withdraws from the congregation'),
    jsonb_build_object('id', 'D', 'text', 'Everyone with this hope stops examining personal conduct')
  ),
  'A',
  'Everyone with this hope purifies himself as Christ is pure',
  '1 John 3:2-3',
  3,
  'promise_prophecy',
  'argument_flow',
  0.65,
  635,
  84,
  90
),
(
  '4eb80dc9-ee47-4143-8f51-e88d0c3c2eb5',
  '1acaf536-a1f2-4d97-8bce-5f5716b618d1',
  '1TH',
  'nt_expository|1TH|resurrection_sequence_encouragement_1th4',
  'What instruction closes the resurrection and gathering sequence in 1 Thessalonians 4:13-18?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Encourage one another with these words'),
    jsonb_build_object('id', 'B', 'text', 'Aspire to live quietly and work with your hands'),
    jsonb_build_object('id', 'C', 'text', 'Test everything and hold fast what is good'),
    jsonb_build_object('id', 'D', 'text', 'Pray without ceasing and give thanks')
  ),
  'A',
  'Encourage one another with these words',
  '1 Thessalonians 4:13-18',
  4,
  'promise_prophecy',
  'argument_flow',
  0.55,
  620,
  88,
  92
),
(
  '23c1879e-ca80-4db8-adc5-e0194f8bd81d',
  '67e2223c-5baa-4793-9a96-63aae6d847bf',
  '1TI',
  'nt_expository|1TI|appearing_doxology_1ti6',
  'Which description of God follows the reference to Christ''s appearing in 1 Timothy 6:14-16?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'He alone has immortality and dwells in unapproachable light'),
    jsonb_build_object('id', 'B', 'text', 'He desires all people to be saved and come to the truth'),
    jsonb_build_object('id', 'C', 'text', 'He gives every good created thing to be received with thanks'),
    jsonb_build_object('id', 'D', 'text', 'He entrusted a pattern of sound words to Timothy')
  ),
  'A',
  'He alone has immortality and dwells in unapproachable light',
  '1 Timothy 6:14-16',
  6,
  'promise_prophecy',
  'local_context',
  0.85,
  665,
  82,
  88
),
(
  'b371da7e-46ca-4568-ae18-dc96107ecf06',
  '267b0e36-8f25-4a45-8af5-468208aa465d',
  '2CO',
  'nt_expository|2CO|promises_yes_spirit_guarantee_2co1',
  'After saying that God''s promises find their Yes in Christ, what guarantee does Paul name in 2 Corinthians 1:20-22?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'God put his Spirit in believers'' hearts as a guarantee'),
    jsonb_build_object('id', 'B', 'text', 'The Corinthians sent a completed collection to Jerusalem'),
    jsonb_build_object('id', 'C', 'text', 'Paul received letters of recommendation from the apostles'),
    jsonb_build_object('id', 'D', 'text', 'Every opponent of Paul immediately accepted his ministry')
  ),
  'A',
  'God put his Spirit in believers'' hearts as a guarantee',
  '2 Corinthians 1:20-22',
  1,
  'promise_prophecy',
  'argument_flow',
  0.75,
  650,
  86,
  91
),
(
  '57b283f4-88b2-4315-930e-68722cf0b432',
  '6a3ff48a-7345-4168-9120-7b44a6436d3f',
  '2JN',
  'nt_expository|2JN|full_reward_teaching_warning_2jn8',
  'What danger immediately follows the warning to watch yourselves and not lose a full reward in 2 John 8-9?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Running ahead and not remaining in the teaching of Christ'),
    jsonb_build_object('id', 'B', 'text', 'Failing to send financial support to Paul in prison'),
    jsonb_build_object('id', 'C', 'text', 'Refusing to observe special days and food restrictions'),
    jsonb_build_object('id', 'D', 'text', 'Neglecting to appoint elders in every city')
  ),
  'A',
  'Running ahead and not remaining in the teaching of Christ',
  '2 John 8-9',
  1,
  'promise_prophecy',
  'local_context',
  0.8,
  660,
  78,
  88
),
(
  'fdf0d561-343d-464b-a822-eb49fc5e9fe7',
  '622ae85d-f025-40c0-a34b-a5fd06a133d3',
  '2PE',
  'nt_expository|2PE|new_creation_diligence_2pe3',
  'Because believers await new heavens and a new earth, what does 2 Peter 3:13-14 tell them to be diligent to do?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Be found without spot or blemish and at peace'),
    jsonb_build_object('id', 'B', 'text', 'Calculate the day and hour of the Lord''s return'),
    jsonb_build_object('id', 'C', 'text', 'Leave their cities before the present heavens disappear'),
    jsonb_build_object('id', 'D', 'text', 'Identify the political ruler who will precede the end')
  ),
  'A',
  'Be found without spot or blemish and at peace',
  '2 Peter 3:13-14',
  3,
  'promise_prophecy',
  'argument_flow',
  0.7,
  640,
  86,
  91
),
(
  '8c042846-4182-48e3-b2df-c014cf001d9a',
  '5fa2614d-166b-4720-8d79-36c1046e7434',
  '2TH',
  'nt_expository|2TH|revelation_relief_judgment_2th1',
  'What contrast does Paul make at Jesus'' revelation in 2 Thessalonians 1:6-10?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Relief for the afflicted and judgment for those who reject God and the gospel'),
    jsonb_build_object('id', 'B', 'text', 'Prosperity for Roman citizens and poverty for everyone outside Rome'),
    jsonb_build_object('id', 'C', 'text', 'Immediate freedom for every prisoner and exile in the empire'),
    jsonb_build_object('id', 'D', 'text', 'A new opportunity for the dead to hear Paul preach')
  ),
  'A',
  'Relief for the afflicted and judgment for those who reject God and the gospel',
  '2 Thessalonians 1:6-10',
  1,
  'promise_prophecy',
  'local_context',
  0.8,
  660,
  88,
  92
),
(
  '810e5e53-28be-4229-959d-9997b082e7fa',
  '58aab230-2555-4440-bd08-188e828402df',
  '2TI',
  'nt_expository|2TI|crown_all_love_appearing_2ti4',
  'According to 2 Timothy 4:8, who besides Paul will receive the crown of righteousness?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'All who have loved Christ''s appearing'),
    jsonb_build_object('id', 'B', 'text', 'Only those who visited Paul during his imprisonment'),
    jsonb_build_object('id', 'C', 'text', 'Every official who protected Christians from prosecution'),
    jsonb_build_object('id', 'D', 'text', 'Only teachers who never experienced suffering')
  ),
  'A',
  'All who have loved Christ''s appearing',
  '2 Timothy 4:8',
  4,
  'promise_prophecy',
  'authorial_claim',
  0.45,
  605,
  82,
  88
),
(
  'f3df539d-bdf8-435d-bcb0-050922dad11f',
  '1f93c5af-b5b6-49d7-9e2f-2aef0b5a8831',
  '3JN',
  'nt_expository|3JN|pen_ink_face_to_face_3jn13',
  'Why does John stop short of writing more with pen and ink near the end of 3 John?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'He hopes to see Gaius soon and speak face to face'),
    jsonb_build_object('id', 'B', 'text', 'He has already sent Demetrius to dictate the remaining message'),
    jsonb_build_object('id', 'C', 'text', 'He expects Diotrephes to destroy every written copy'),
    jsonb_build_object('id', 'D', 'text', 'He has forbidden the friends to exchange written greetings')
  ),
  'A',
  'He hopes to see Gaius soon and speak face to face',
  '3 John 13-14',
  1,
  'events_timeline',
  'local_context',
  0.55,
  620,
  62,
  84
),
(
  '3dadc476-e97c-4944-a563-79dfab026bb3',
  '002d9bd6-e95a-44c6-99e8-da17ca6bc89b',
  'ACT',
  'nt_expository|ACT|kingdom_timing_spirit_witnesses_act1',
  'How does Jesus redirect the disciples'' question about restoring the kingdom in Acts 1:6-8?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'He withholds the timetable and promises power to be witnesses when the Spirit comes'),
    jsonb_build_object('id', 'B', 'text', 'He gives the date and orders them to begin a revolt in Jerusalem'),
    jsonb_build_object('id', 'C', 'text', 'He says the kingdom has no connection to Israel or the nations'),
    jsonb_build_object('id', 'D', 'text', 'He sends them immediately to Rome without waiting in Jerusalem')
  ),
  'A',
  'He withholds the timetable and promises power to be witnesses when the Spirit comes',
  'Acts 1:6-8',
  1,
  'promise_prophecy',
  'argument_flow',
  0.65,
  635,
  92,
  94
),
(
  '9f6665b5-7be2-4dcc-b5c3-79f178423f82',
  '83a41ed7-1921-4814-9fac-3bc05c4a772a',
  'COL',
  'nt_expository|COL|hidden_life_revealed_glory_col3',
  'What hidden-to-revealed sequence appears in Colossians 3:3-4?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Believers'' life is hidden with Christ now, and they will appear with him in glory'),
    jsonb_build_object('id', 'B', 'text', 'The mystery remains hidden forever and is never proclaimed to the nations'),
    jsonb_build_object('id', 'C', 'text', 'Paul hides his travel plans until every church has sent an offering'),
    jsonb_build_object('id', 'D', 'text', 'Earthly rulers are hidden now but will appear as mediators of salvation')
  ),
  'A',
  'Believers'' life is hidden with Christ now, and they will appear with him in glory',
  'Colossians 3:3-4',
  3,
  'promise_prophecy',
  'argument_flow',
  0.7,
  640,
  84,
  90
),
(
  '94dc62e6-6b5f-49fd-92d6-ce528f26e8c0',
  'f8a58386-f477-4357-8f44-99e8793db533',
  'EPH',
  'nt_expository|EPH|spirit_seal_inheritance_eph1',
  'In Ephesians 1:13-14, what is the promised Holy Spirit said to guarantee?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The inheritance until the redemption of God''s possession'),
    jsonb_build_object('id', 'B', 'text', 'That Gentile believers will never experience imprisonment'),
    jsonb_build_object('id', 'C', 'text', 'That every spiritual gift will remain equally visible in each believer'),
    jsonb_build_object('id', 'D', 'text', 'The immediate rebuilding of the temple in Jerusalem')
  ),
  'A',
  'The inheritance until the redemption of God''s possession',
  'Ephesians 1:13-14',
  1,
  'promise_prophecy',
  'authorial_claim',
  0.6,
  625,
  88,
  91
),
(
  'e54f18d7-9ffc-4f2f-9752-10b51bf9e40a',
  '9a373653-1d67-4800-9a15-ca24826f7351',
  'GAL',
  'nt_expository|GAL|sowing_reaping_perseverance_gal6',
  'What contrast supports Paul''s command not to grow weary in doing good in Galatians 6:7-10?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Sowing to the flesh reaps corruption, while sowing to the Spirit reaps eternal life'),
    jsonb_build_object('id', 'B', 'text', 'Circumcision produces wisdom, while uncircumcision produces ignorance'),
    jsonb_build_object('id', 'C', 'text', 'Living in Jerusalem brings suffering, while living in Galatia brings peace'),
    jsonb_build_object('id', 'D', 'text', 'Teaching publicly earns a reward, while teaching privately loses it')
  ),
  'A',
  'Sowing to the flesh reaps corruption, while sowing to the Spirit reaps eternal life',
  'Galatians 6:7-10',
  6,
  'promise_prophecy',
  'argument_flow',
  0.75,
  650,
  86,
  91
),
(
  'b10b43ee-b316-411e-ab79-03712ea0690f',
  '2bf2d145-92bc-4f1e-9984-74edca08f3a8',
  'HEB',
  'nt_expository|HEB|first_second_appearing_heb9',
  'What contrast does Hebrews 9:26-28 make between Christ''s first and second appearances?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'He first appeared to deal with sin and will appear again to save those waiting for him'),
    jsonb_build_object('id', 'B', 'text', 'He first appeared as a priest and will return to offer another sacrifice for sin'),
    jsonb_build_object('id', 'C', 'text', 'He first appeared only to Israel and will return only to the tribe of Levi'),
    jsonb_build_object('id', 'D', 'text', 'He first appeared in weakness and will return to abolish bodily resurrection')
  ),
  'A',
  'He first appeared to deal with sin and will appear again to save those waiting for him',
  'Hebrews 9:26-28',
  9,
  'promise_prophecy',
  'argument_flow',
  0.75,
  650,
  90,
  93
),
(
  'df8a79bc-1342-4fe8-996a-a0e6da3373db',
  '699aaa61-9248-40ed-9759-1ea63df87c56',
  'JAS',
  'nt_expository|JAS|trial_endurance_crown_jas1',
  'What sequence leads to the promised crown of life in James 1:12?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'A person remains steadfast under trial and stands the test'),
    jsonb_build_object('id', 'B', 'text', 'A teacher gains many hearers and avoids stricter judgment'),
    jsonb_build_object('id', 'C', 'text', 'A rich person stores wealth and plans for future trade'),
    jsonb_build_object('id', 'D', 'text', 'A congregation receives signs before asking for wisdom')
  ),
  'A',
  'A person remains steadfast under trial and stands the test',
  'James 1:12',
  1,
  'promise_prophecy',
  'argument_flow',
  0.55,
  620,
  82,
  88
),
(
  '76e0d7ac-db26-4e1a-93f1-ce9d354ad20f',
  '31f47739-f26b-4cab-b746-ccc1645a52eb',
  'JHN',
  'nt_expository|JHN|advocate_world_disciples_jhn14',
  'In John 14:15-18, what contrast explains why the world cannot receive the promised Spirit of truth?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The world neither sees nor knows him, but the disciples know him because he remains with them'),
    jsonb_build_object('id', 'B', 'text', 'The world speaks Greek, but the disciples understand only Aramaic'),
    jsonb_build_object('id', 'C', 'text', 'The world lives outside Judea, but the disciples remain inside Jerusalem'),
    jsonb_build_object('id', 'D', 'text', 'The world lacks written law, but the disciples possess every prophetic scroll')
  ),
  'A',
  'The world neither sees nor knows him, but the disciples know him because he remains with them',
  'John 14:15-18',
  14,
  'promise_prophecy',
  'local_context',
  0.7,
  640,
  90,
  93
),
(
  'da0a167f-0569-4aaa-af71-a78b3f7e3ebc',
  '40a5fb8c-0d88-4f7f-a1e5-9edceea6e6ad',
  'JUD',
  'nt_expository|JUD|practices_before_doxology_jud20',
  'Which practices lead into Jude''s declaration that God is able to keep believers from stumbling?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Build up the faith, pray in the Spirit, remain in God''s love, and await Christ''s mercy'),
    jsonb_build_object('id', 'B', 'text', 'Identify the date of judgment and withdraw from every doubter'),
    jsonb_build_object('id', 'C', 'text', 'Return to Egypt, rebuild the altar, and appoint a new high priest'),
    jsonb_build_object('id', 'D', 'text', 'Seek political protection, avoid travel, and conceal the apostolic message')
  ),
  'A',
  'Build up the faith, pray in the Spirit, remain in God''s love, and await Christ''s mercy',
  'Jude 20-25',
  1,
  'promise_prophecy',
  'argument_flow',
  0.9,
  675,
  84,
  92
),
(
  '314eaf7d-f96c-4d78-8487-99021565fc95',
  'c29b13fc-3977-425b-afe1-5cf0e22e35b8',
  'LUK',
  'nt_expository|LUK|scripture_message_power_luk24',
  'Which message does Jesus say must be proclaimed before promising power from on high in Luke 24:44-49?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The Messiah''s suffering and resurrection, and repentance for forgiveness to all nations'),
    jsonb_build_object('id', 'B', 'text', 'The rebuilding of Jerusalem''s walls and restoration of the Davidic army'),
    jsonb_build_object('id', 'C', 'text', 'The replacement of Roman governors by the twelve apostles'),
    jsonb_build_object('id', 'D', 'text', 'The transfer of worship from Jerusalem to the synagogues of Galilee')
  ),
  'A',
  'The Messiah''s suffering and resurrection, and repentance for forgiveness to all nations',
  'Luke 24:44-49',
  24,
  'promise_prophecy',
  'argument_flow',
  0.8,
  660,
  94,
  95
),
(
  '07be7433-a7a5-481e-a4ba-9959ce248647',
  'd40d8ba6-be2c-4f38-b209-c37fe013eb84',
  'MAT',
  'nt_expository|MAT|commission_presence_mat28',
  'In Matthew 28:18-20, which commission stands between Jesus'' claim of all authority and his promise to be with the disciples?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Make disciples of all nations, baptizing and teaching them'),
    jsonb_build_object('id', 'B', 'text', 'Remain in Galilee until Rome appoints a new governor'),
    jsonb_build_object('id', 'C', 'text', 'Rebuild the temple and restore sacrifices for the nations'),
    jsonb_build_object('id', 'D', 'text', 'Choose seven servants to distribute food in Jerusalem')
  ),
  'A',
  'Make disciples of all nations, baptizing and teaching them',
  'Matthew 28:18-20',
  28,
  'promise_prophecy',
  'local_context',
  0.55,
  620,
  94,
  95
),
(
  'e89eb3ae-9580-4fc0-89a1-380c430c906d',
  'f515b876-66b6-417a-adae-7c69081d180e',
  'MRK',
  'nt_expository|MRK|trial_spirit_speech_mrk13',
  'When disciples are handed over for witness in Mark 13:9-11, what does Jesus promise about their speech?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The Holy Spirit will give what they are to say in that hour'),
    jsonb_build_object('id', 'B', 'text', 'Peter will send them a written defense before every hearing'),
    jsonb_build_object('id', 'C', 'text', 'Their accusers will be unable to hear their testimony'),
    jsonb_build_object('id', 'D', 'text', 'Roman officials will translate their words for every nation')
  ),
  'A',
  'The Holy Spirit will give what they are to say in that hour',
  'Mark 13:9-11',
  13,
  'promise_prophecy',
  'local_context',
  0.65,
  635,
  88,
  92
),
(
  '6556622b-a5d2-44f4-943e-c37392e4cf4e',
  'b9ea2463-1184-47fe-9257-6aeafbb2e4d8',
  'PHM',
  'nt_expository|PHM|guest_room_prayers_phm22',
  'What request does Paul make because he hopes to be restored to Philemon through the believers'' prayers?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Prepare a guest room for him'),
    jsonb_build_object('id', 'B', 'text', 'Send Onesimus back to Colossae under guard'),
    jsonb_build_object('id', 'C', 'text', 'Collect money for Paul''s legal appeal'),
    jsonb_build_object('id', 'D', 'text', 'Appoint Archippus as bishop over every church')
  ),
  'A',
  'Prepare a guest room for him',
  'Philemon 22',
  1,
  'events_timeline',
  'local_context',
  0.5,
  612,
  60,
  84
),
(
  'a275f577-f674-41c9-a5d6-4c930d8c3199',
  'd7fa9d51-708a-437c-806e-e8c8aadf2a9c',
  'PHP',
  'nt_expository|PHP|body_transformation_php3',
  'What transformation does Paul expect the Savior to accomplish in Philippians 3:20-21?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Transform believers'' lowly bodies to be like his glorious body'),
    jsonb_build_object('id', 'B', 'text', 'Remove every believer from bodily existence'),
    jsonb_build_object('id', 'C', 'text', 'Turn Roman citizenship into priestly ancestry'),
    jsonb_build_object('id', 'D', 'text', 'Make imprisonment impossible for faithful messengers')
  ),
  'A',
  'Transform believers'' lowly bodies to be like his glorious body',
  'Philippians 3:20-21',
  3,
  'promise_prophecy',
  'authorial_claim',
  0.55,
  620,
  88,
  92
),
(
  '09d22bed-b5fb-46af-afb7-c78223a5ccd0',
  '40ce0ef1-00fb-46c6-b069-29f7a081cc5f',
  'ROM',
  'nt_expository|ROM|wisdom_innocence_crushing_rom16',
  'What instruction immediately frames the promise that the God of peace will soon crush Satan in Romans 16:19-20?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Be wise about what is good and innocent about what is evil'),
    jsonb_build_object('id', 'B', 'text', 'Withdraw from all Gentile congregations until Paul arrives'),
    jsonb_build_object('id', 'C', 'text', 'Observe one particular day and food practice as binding on everyone'),
    jsonb_build_object('id', 'D', 'text', 'Appeal every disagreement directly to the emperor')
  ),
  'A',
  'Be wise about what is good and innocent about what is evil',
  'Romans 16:19-20',
  16,
  'promise_prophecy',
  'local_context',
  0.7,
  640,
  84,
  91
),
(
  'c2c519b5-9d67-4e76-bb47-48d5202d6541',
  '3fed7a88-9af3-4e1f-b961-67bda2852c5c',
  'TIT',
  'nt_expository|TIT|grace_training_blessed_hope_tit2',
  'How does Titus 2:11-14 connect waiting for the blessed hope with present life?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Grace trains believers to reject ungodliness and live self-controlled, upright, godly lives'),
    jsonb_build_object('id', 'B', 'text', 'Waiting removes the need for good works until Christ appears'),
    jsonb_build_object('id', 'C', 'text', 'Only elders are expected to resist worldly passions'),
    jsonb_build_object('id', 'D', 'text', 'Believers must identify the date of the appearing before teaching others')
  ),
  'A',
  'Grace trains believers to reject ungodliness and live self-controlled, upright, godly lives',
  'Titus 2:11-14',
  2,
  'promise_prophecy',
  'argument_flow',
  0.75,
  650,
  90,
  93
);

do $$
declare
  provisional_old_count integer;
  conflicting_new_ids integer;
begin
  select count(*)
  into provisional_old_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_promise_rewrite batch
    on batch.old_id = review.generated_question_id
  where review.review_status = 'provisional'
    and review.routing_priority = 1
    and review.scoring_weight = 0.55;

  select count(*)
  into conflicting_new_ids
  from public.ot_generated_questions question
  join obs_nt_promise_rewrite batch
    on batch.new_id = question.id;

  if provisional_old_count <> 25 or conflicting_new_ids <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Promise rewrite precondition failed: provisional_old=%s/25 conflicting_new_ids=%s/0.',
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
  '20260729_nt_promise_prophecy_expository_rewrite',
  'public',
  'obs_nt_expository_item_reviews_retired_25',
  'data',
  jsonb_agg(
    to_jsonb(review)
    order by review.generated_question_id
  )::text
from public.obs_nt_expository_item_reviews review
join obs_nt_promise_rewrite batch
  on batch.old_id = review.generated_question_id
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and backup.object_schema = 'public'
    and backup.object_name =
          'obs_nt_expository_item_reviews_retired_25'
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
          '20260729_nt_promise_prophecy_expository_rewrite'
    and object_schema = 'public'
    and object_name =
          'obs_nt_expository_item_reviews_retired_25'
    and object_type = 'data';

  if backup_count <> 1 or backed_up_rows <> 25 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Promise rewrite backup failed: backups=%s/1 rows=%s/25.',
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
      '20260729_nt_promise_prophecy_expository_rewrite',
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
    'interpretation_policy', 'explicit_local_context',
    'position_rebalanced', true
  ),
  batch.dedupe_key
from obs_nt_promise_rewrite batch;

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
  'manual_promise_prophecy_expository_rewrite',
  'Requires the wording, sequence, or argument of the cited context; '
    || 'does not require a confessional or eschatological system. '
    || 'Replaces '
    || batch.old_id::text
    || '.',
  '20260729_nt_promise_prophecy_expository_rewrite',
  now(),
  now()
from obs_nt_promise_rewrite batch;

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
    '20260729_nt_promise_prophecy_expository_rewrite',
  reviewed_at = now(),
  updated_at = now()
from obs_nt_promise_rewrite batch
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
  new_answer_count integer;
  old_answer_count integer;
  promise_routable_count integer;
  event_reclassification_count integer;
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
  join obs_nt_promise_rewrite batch
    on batch.new_id = review.generated_question_id
  where review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into retired_excluded_count
  from public.obs_nt_expository_item_reviews review
  join obs_nt_promise_rewrite batch
    on batch.old_id = review.generated_question_id
  where review.review_status = 'excluded'
    and review.routing_priority = 0
    and review.scoring_weight = 0.0;

  select count(*)
  into invalid_new_questions
  from public.ot_generated_questions question
  join obs_nt_promise_rewrite batch
    on batch.new_id = question.id
  where not public.obs_q_correct_resolves(question.payload)
    or public.obs_q_choice_count(question.payload) <> 4
    or public.obs_q_distinct_choice_count(question.payload) <> 4
    or question.payload->>'interpretation_policy' <>
         'explicit_local_context'
    or question.payload->>'dimension_key' not in (
      'events_timeline',
      'promise_prophecy'
    );

  select count(*)
  into new_answer_count
  from public.assessment_answers answer
  join obs_nt_promise_rewrite batch
    on batch.new_id = answer.generated_question_id;

  select count(*)
  into old_answer_count
  from public.assessment_answers answer
  join obs_nt_promise_rewrite batch
    on batch.old_id = answer.generated_question_id;

  select count(*)
  into promise_routable_count
  from public.ot_generated_questions question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.id
  where question.payload->>'dimension_key' = 'promise_prophecy'
    and review.review_status in ('approved', 'provisional')
    and review.scoring_weight > 0.0;

  select count(*)
  into event_reclassification_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_promise_prophecy_expository_rewrite'
    and question.payload->>'dimension_key' = 'events_timeline'
    and upper(question.payload->>'book_code') in ('3JN', 'PHM');

  if active_nt_count <> 206
     or reviewed_count <> 206
     or approved_count <> 135
     or provisional_count <> 34
     or excluded_count <> 37
     or rewrite_count <> 0
     or new_approved_count <> 25
     or retired_excluded_count <> 25
     or invalid_new_questions <> 0
     or new_answer_count <> 0
     or old_answer_count <> 2
     or promise_routable_count <> 24
     or event_reclassification_count <> 2
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT Promise rewrite verification failed: active=%s reviewed=%s approved=%s provisional=%s excluded=%s rewrite=%s new_approved=%s retired=%s invalid=%s new_answers=%s old_answers=%s promise_routable=%s event_reclassified=%s.',
        active_nt_count,
        reviewed_count,
        approved_count,
        provisional_count,
        excluded_count,
        rewrite_count,
        new_approved_count,
        retired_excluded_count,
        invalid_new_questions,
        new_answer_count,
        old_answer_count,
        promise_routable_count,
        event_reclassification_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
