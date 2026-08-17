-- Add 50 approved, text-dependent NT questions across every epistle and
-- Revelation. This batch strengthens Events & Timeline, Structure & Cross-Ref,
-- Characters & Lineage, and Law & Commands without relying on systematic or
-- confessional inference.

begin;

create temporary table obs_nt_epistle_depth_batch_2 (
  id uuid primary key,
  book_code text not null,
  reference text not null,
  chapter integer not null,
  dimension_key text not null,
  prompt text not null,
  choices text[] not null,
  correct_choice_id text not null,
  correct_answer text not null,
  irt_b double precision not null,
  difficulty_estimate integer not null,
  importance_conceptual integer not null,
  importance_context integer not null,
  dedupe_key text unique not null
) on commit drop;

insert into obs_nt_epistle_depth_batch_2 values
('3020d4f1-8e24-426f-a3c5-8e4c38f09da8','ROM','Romans 4:6-8',4,'structure_cross_ref',
 'After discussing Abraham, whom does Paul quote in Romans 4 to describe the blessedness of forgiven sin?',
 array['Moses','Isaiah','David','Elijah'],'C','David',0.45,590,82,92,'nt_depth_b2|ROM|david_forgiveness_rom4'),
('b6ba395f-6e8b-4293-a161-a8b0fb25aec3','ROM','Romans 15:25-28',15,'events_timeline',
 'What task does Paul say he must complete before traveling by way of Rome toward Spain?',
 array['Collect letters from the churches of Asia','Deliver the contribution from Macedonia and Achaia to Jerusalem','Return to Antioch to appoint elders','Visit the churches of Galatia with Barnabas'],'B',
 'Deliver the contribution from Macedonia and Achaia to Jerusalem',0.55,605,78,92,'nt_depth_b2|ROM|collection_before_spain_rom15'),

('750f67ff-cb01-42a6-912b-27c2b2e8ed6e','1CO','1 Corinthians 10:1-12',10,'structure_cross_ref',
 'Which set of wilderness failures does Paul use as warnings in 1 Corinthians 10?',
 array['Craving evil, idolatry, sexual immorality, testing Christ, and grumbling','Refusing circumcision, appointing a king, building the temple, and entering exile','Neglecting the Passover, rejecting David, opposing Elijah, and leaving Jerusalem','Withholding tithes, marrying foreigners, rebuilding walls, and refusing tribute'],'A',
 'Craving evil, idolatry, sexual immorality, testing Christ, and grumbling',0.65,625,90,96,'nt_depth_b2|1CO|wilderness_warnings_1co10'),
('6b437405-71e7-4d2d-8ac4-b4c2ced15271','1CO','1 Corinthians 15:20-28',15,'events_timeline',
 'What order does Paul give in 1 Corinthians 15 for resurrection and the end?',
 array['The end, then Christ, then those who belong to him','Those who belong to Christ, then Christ, then the end','All humanity together, followed by Christ surrendering the kingdom','Christ the firstfruits, then those who belong to him at his coming, then the end'],'D',
 'Christ the firstfruits, then those who belong to him at his coming, then the end',0.70,635,94,97,'nt_depth_b2|1CO|resurrection_order_1co15'),

('a0e8cdcc-daff-41df-9f73-008ba82bcc26','2CO','2 Corinthians 13:5',13,'law_commands',
 'What does Paul command the Corinthians to examine and test in 2 Corinthians 13:5?',
 array['Whether the apostles have sufficient credentials','Whether they themselves are in the faith','Whether the Jerusalem collection is complete','Whether Titus should remain in Corinth'],'B',
 'Whether they themselves are in the faith',0.35,570,88,94,'nt_depth_b2|2CO|examine_in_faith_2co13'),
('2242cda5-93d7-43c1-9ca4-707455a9b06e','2CO','2 Corinthians 2:12-13',2,'events_timeline',
 'What did Paul do after arriving in Troas and finding no rest in his spirit because Titus was absent?',
 array['He returned immediately to Ephesus','He waited in Troas until Titus arrived','He took leave of them and went on to Macedonia','He sailed to Jerusalem with the collection'],'C',
 'He took leave of them and went on to Macedonia',0.60,615,75,91,'nt_depth_b2|2CO|troas_to_macedonia_2co2'),

('17a977bd-2f81-4665-bec3-a4c374724462','GAL','Galatians 4:21-31',4,'structure_cross_ref',
 'Which two women does Paul use in Galatians 4 when speaking of two covenants?',
 array['Rachel and Leah','Tamar and Rahab','Ruth and Naomi','Hagar and Sarah'],'D',
 'Hagar and Sarah',0.30,560,88,95,'nt_depth_b2|GAL|hagar_sarah_covenants_gal4'),
('651e3681-3910-4f21-9ade-5a06557d7c31','GAL','Galatians 2:1-3',2,'events_timeline',
 'How long does Paul say passed before he went up again to Jerusalem with Barnabas and Titus?',
 array['Fourteen years','Seven years','Three years','Forty days'],'A',
 'Fourteen years',0.50,595,72,90,'nt_depth_b2|GAL|fourteen_years_gal2'),

('9b51399b-e97b-4c45-8731-fba0ad9463bc','EPH','Ephesians 6:21-22',6,'characters_lineage',
 'Whom does Paul send to tell the Ephesians how he is doing and to encourage their hearts?',
 array['Epaphroditus','Onesimus','Tychicus','Titus'],'C',
 'Tychicus',0.40,580,72,90,'nt_depth_b2|EPH|tychicus_report_eph6'),
('f107db9f-ae95-4793-aba7-4cb9dd52aea6','EPH','Ephesians 4:7-10',4,'structure_cross_ref',
 'How does Paul explain the ascent language he quotes in Ephesians 4 before discussing gifts?',
 array['The one who ascended never descended to earth','The one who descended is also the one who ascended above all the heavens','The ascent refers only to Moses climbing Sinai','The descent belongs to David while the ascent belongs to the church'],'B',
 'The one who descended is also the one who ascended above all the heavens',0.70,635,84,94,'nt_depth_b2|EPH|descent_ascent_eph4'),
('22e0b208-33f2-424e-af00-1b75cee8d6be','EPH','Ephesians 1:13-14',1,'events_timeline',
 'What sequence does Ephesians 1:13-14 describe for its readers?',
 array['They were sealed, then heard the gospel, then believed','They believed, then received the law, then heard the gospel','They heard the gospel, were baptized for the dead, and received gifts','They heard the word of truth, believed in Christ, and were sealed with the promised Spirit'],'D',
 'They heard the word of truth, believed in Christ, and were sealed with the promised Spirit',0.45,590,91,95,'nt_depth_b2|EPH|heard_believed_sealed_eph1'),

('24e0bf0d-40b2-42f0-9b40-37d8b4775a40','PHP','Philippians 4:15-16',4,'events_timeline',
 'At what city had the Philippians sent Paul help more than once?',
 array['Thessalonica','Corinth','Ephesus','Troas'],'A',
 'Thessalonica',0.45,590,68,88,'nt_depth_b2|PHP|aid_thessalonica_php4'),
('cb3b8576-2ca2-4ea0-b1e6-ede63343a443','PHP','Philippians 2:6-11',2,'structure_cross_ref',
 'What follows Christ''s obedience to death on a cross in the sequence of Philippians 2:6-11?',
 array['He returns to equality with God by seizing it','He remains unnamed until the final judgment','God highly exalts him and gives him the name above every name','The nations appoint him as their earthly ruler'],'C',
 'God highly exalts him and gives him the name above every name',0.40,580,94,97,'nt_depth_b2|PHP|humiliation_exaltation_php2'),

('3c96ec63-9549-4a92-8dbb-76f1ac19ede7','COL','Colossians 2:13-15',2,'events_timeline',
 'Which action is described between God making believers alive with Christ and disarming rulers and authorities?',
 array['Sending the apostles to the nations','Canceling the record of debt and nailing it to the cross','Giving Israel the law through angels','Raising believers to meet Christ in the air'],'B',
 'Canceling the record of debt and nailing it to the cross',0.60,615,90,95,'nt_depth_b2|COL|alive_debt_powers_col2'),
('f8e87737-c8b0-4ced-8370-ff3f2947cee4','COL','Colossians 2:16-17',2,'structure_cross_ref',
 'What contrast does Colossians 2:16-17 make concerning food, festivals, new moons, and Sabbaths?',
 array['They are the substance, while Christ is their shadow','They are forbidden for Gentiles but required for Jews','They are equal paths that lead to the same maturity','They are a shadow of things to come, while the substance belongs to Christ'],'D',
 'They are a shadow of things to come, while the substance belongs to Christ',0.35,570,88,95,'nt_depth_b2|COL|shadow_substance_col2'),

('eeba9a4f-33f3-4e23-9f30-dc20bcf8cec4','1TH','1 Thessalonians 3:1-5',3,'characters_lineage',
 'Whom did Paul send to establish and encourage the Thessalonians in their faith?',
 array['Timothy','Silvanus','Titus','Luke'],'A',
 'Timothy',0.25,550,78,92,'nt_depth_b2|1TH|timothy_sent_1th3'),
('f8b530ac-8ba0-4b91-a6c8-9ba945eb1cfc','1TH','1 Thessalonians 2:1-2',2,'events_timeline',
 'Where had Paul and his coworkers suffered and been shamefully treated before speaking the gospel in Thessalonica?',
 array['Berea','Athens','Philippi','Corinth'],'C',
 'Philippi',0.40,580,72,90,'nt_depth_b2|1TH|suffered_philippi_1th2'),

('e791ad61-d6da-4987-a981-b92165d1f5a8','2TH','2 Thessalonians 3:6,14-15',3,'law_commands',
 'How does 2 Thessalonians 3 combine separation and correction toward a persistently disobedient believer?',
 array['Expel him permanently and refuse every conversation','Keep away and take note of him, but warn him as a brother rather than an enemy','Continue supporting him without addressing his conduct','Refer him to civil authorities before speaking to him'],'B',
 'Keep away and take note of him, but warn him as a brother rather than an enemy',0.65,625,86,94,'nt_depth_b2|2TH|separate_warn_brother_2th3'),
('c93849ba-f280-4415-9942-0d916616d5eb','2TH','2 Thessalonians 2:1-8',2,'structure_cross_ref',
 'What does 2 Thessalonians 2 say must come before the man of lawlessness is revealed?',
 array['The rebuilding of Jerusalem','The conversion of every nation','The imprisonment of Paul','The rebellion'],'D',
 'The rebellion',0.55,605,84,94,'nt_depth_b2|2TH|rebellion_before_revealing_2th2'),
('229d89db-a1df-4383-977b-f9cf201baf3e','2TH','2 Thessalonians 3:7-10',3,'events_timeline',
 'What example of conduct does Paul say he and his coworkers gave while among the Thessalonians?',
 array['They worked night and day rather than eating anyone''s bread without paying','They accepted support from every household so they could teach all day','They stopped working to demonstrate expectation of the Lord''s return','They relied only on the wealthy members of the church'],'A',
 'They worked night and day rather than eating anyone''s bread without paying',0.45,590,78,92,'nt_depth_b2|2TH|worked_night_day_2th3'),

('2b1af902-b80b-445b-8ea4-571c83a3e05a','1TI','1 Timothy 1:3-4',1,'events_timeline',
 'What arrangement does Paul recall near the opening of 1 Timothy?',
 array['Timothy went to Macedonia while Paul remained in Ephesus','Both men remained in Jerusalem to settle a dispute','Paul urged Timothy to remain in Ephesus while Paul went to Macedonia','Timothy traveled to Crete while Paul sailed to Rome'],'C',
 'Paul urged Timothy to remain in Ephesus while Paul went to Macedonia',0.45,590,76,92,'nt_depth_b2|1TI|timothy_remain_ephesus_1ti1'),
('0460a398-d7e9-463b-9eb3-55e1b0a4038d','1TI','1 Timothy 3:14-15',3,'structure_cross_ref',
 'What reason does Paul give for writing the preceding instructions in 1 Timothy 3?',
 array['So Timothy can calculate the date of Paul''s release','So people may know how one ought to behave in the household of God','So the Ephesian church can choose which apostle to follow','So every elder can receive the same spiritual gift'],'B',
 'So people may know how one ought to behave in the household of God',0.35,570,90,95,'nt_depth_b2|1TI|purpose_household_conduct_1ti3'),

('8d81fda6-d67d-40fe-b3ed-536459b117fb','2TI','2 Timothy 2:1-2',2,'law_commands',
 'What does Paul tell Timothy to do with the teaching he heard before many witnesses?',
 array['Keep it private until Paul returns','Write it only for the elders in Ephesus','Send it to Jerusalem for authorization','Entrust it to faithful people who will be able to teach others'],'D',
 'Entrust it to faithful people who will be able to teach others',0.35,570,91,95,'nt_depth_b2|2TI|entrust_faithful_teachers_2ti2'),
('4469a08d-dc34-459b-a325-89b781dd3704','2TI','2 Timothy 4:9-12',4,'events_timeline',
 'Whom does Paul say he sent to Ephesus near the close of 2 Timothy?',
 array['Tychicus','Crescens','Titus','Demas'],'A',
 'Tychicus',0.55,605,68,88,'nt_depth_b2|2TI|tychicus_sent_ephesus_2ti4'),

('0cd0f6e1-08dc-41a7-9491-6360853aaca3','TIT','Titus 3:12',3,'characters_lineage',
 'Which two possible replacements does Paul say he may send to Titus before Titus comes to Nicopolis?',
 array['Luke or Mark','Timothy or Silvanus','Artemas or Tychicus','Apollos or Zenas'],'C',
 'Artemas or Tychicus',0.70,635,62,86,'nt_depth_b2|TIT|artemas_tychicus_tit3'),
('4836d3b6-6d69-4307-888c-c21c089925d5','TIT','Titus 3:9',3,'law_commands',
 'What does Titus 3:9 instruct Titus to avoid?',
 array['All contact with unbelieving rulers','Foolish controversies, genealogies, dissensions, and quarrels about the law','Travel during the winter and correspondence with other churches','Public reading of the law in mixed congregations'],'B',
 'Foolish controversies, genealogies, dissensions, and quarrels about the law',0.40,580,80,93,'nt_depth_b2|TIT|avoid_controversies_tit3'),
('85ab0b16-3012-4c76-96f8-e45552f0b2db','TIT','Titus 1:12-13',1,'structure_cross_ref',
 'What description does Titus introduce as the saying of one of the Cretans'' own prophets?',
 array['Cretans are always seekers, restless sailors, and bold speakers','Cretans are zealous for law, careful in speech, and slow to feast','Cretans are divided houses, wandering teachers, and lovers of myths','Cretans are always liars, evil beasts, and lazy gluttons'],'D',
 'Cretans are always liars, evil beasts, and lazy gluttons',0.60,615,68,90,'nt_depth_b2|TIT|cretan_prophet_quote_tit1'),

('8b398090-58fc-4bb1-af6c-3da099d1ea99','PHM','Philemon 10-16',1,'events_timeline',
 'What does Paul do with Onesimus after describing him as formerly useless but now useful?',
 array['He sends Onesimus back to Philemon as his own heart','He sends Onesimus to Crete to assist Titus','He keeps Onesimus permanently without consulting Philemon','He sends Onesimus to Jerusalem with the collection'],'A',
 'He sends Onesimus back to Philemon as his own heart',0.25,550,88,95,'nt_depth_b2|PHM|onesimus_sent_back_phm12'),
('ea67b19f-d76c-4f99-9b37-36cc49895fb6','PHM','Philemon 8-10',1,'structure_cross_ref',
 'Although Paul says he could command Philemon, what approach does he choose instead?',
 array['He threatens to appeal to the whole church','He postpones the matter until a personal visit','He appeals on the basis of love','He asks Archippus to issue the command'],'C',
 'He appeals on the basis of love',0.30,560,90,96,'nt_depth_b2|PHM|command_versus_appeal_phm8'),

('460c0f07-0cb0-4a51-956f-15823b5baa06','HEB','Hebrews 7:1-10',7,'characters_lineage',
 'Who blesses Abraham and receives a tenth from him in Hebrews 7?',
 array['Aaron','Melchizedek','Levi','Joshua'],'B',
 'Melchizedek',0.15,535,92,96,'nt_depth_b2|HEB|melchizedek_abraham_heb7'),
('67e83488-b4f1-4391-b705-b11ee3e2a94f','HEB','Hebrews 11:4-8',11,'events_timeline',
 'Which sequence follows the order of the first four named examples in Hebrews 11?',
 array['Noah, Abel, Abraham, Enoch','Abraham, Noah, Enoch, Abel','Enoch, Abel, Noah, Abraham','Abel, Enoch, Noah, Abraham'],'D',
 'Abel, Enoch, Noah, Abraham',0.45,590,84,94,'nt_depth_b2|HEB|faith_examples_order_heb11'),

('6e64c36c-181e-4af4-884c-8160e8e45b7b','JAS','James 5:17-18',5,'characters_lineage',
 'Whom does James describe as a person with a nature like ours whose prayers affected rain?',
 array['Elijah','Elisha','Moses','Samuel'],'A',
 'Elijah',0.10,520,84,93,'nt_depth_b2|JAS|elijah_prayer_rain_jas5'),
('d4184a06-279f-4d0e-8222-de1afc3130a3','JAS','James 2:21-26',2,'structure_cross_ref',
 'Which Old Testament example does James place after Abraham when arguing that faith acts?',
 array['Moses hiding the spies','Ruth following Naomi','Rahab receiving the messengers and sending them out another way','Hannah dedicating Samuel'],'C',
 'Rahab receiving the messengers and sending them out another way',0.35,570,88,95,'nt_depth_b2|JAS|rahab_after_abraham_jas2'),

('63c5f98d-8715-42d5-b53e-2f6ccde39745','1PE','1 Peter 5:12',5,'characters_lineage',
 'Through whom does Peter say he has written this brief letter?',
 array['Mark','Silvanus','Timothy','Barnabas'],'B',
 'Silvanus',0.55,605,64,86,'nt_depth_b2|1PE|through_silvanus_1pe5'),
('5038ad22-2baf-49af-902c-41837adc4bd5','1PE','1 Peter 3:8-9',3,'law_commands',
 'What response does 1 Peter 3 command instead of repaying evil for evil or reviling for reviling?',
 array['Seek an equal judgment','Remain silent until the offender apologizes','Withdraw from the community','Bless, because believers were called to inherit a blessing'],'D',
 'Bless, because believers were called to inherit a blessing',0.25,550,88,95,'nt_depth_b2|1PE|repay_with_blessing_1pe3'),

('ad92f42a-0d55-40f6-ba50-f530960b9257','2PE','2 Peter 2:6-8',2,'characters_lineage',
 'Which righteous man, distressed by the conduct of the lawless, does 2 Peter place in its judgment examples?',
 array['Lot','Noah','Job','Daniel'],'A',
 'Lot',0.30,560,78,92,'nt_depth_b2|2PE|righteous_lot_2pe2'),
('592f96d3-b1e3-4296-a0e9-b8f734572303','2PE','2 Peter 1:16-18',1,'events_timeline',
 'What did Peter and the other eyewitnesses hear on the holy mountain?',
 array['A command to build three permanent shelters','A voice from the Majestic Glory declaring Jesus to be the beloved Son','A warning that Jerusalem would soon fall','An angel interpreting the vision of four kingdoms'],'B',
 'A voice from the Majestic Glory declaring Jesus to be the beloved Son',0.35,570,90,96,'nt_depth_b2|2PE|voice_holy_mountain_2pe1'),
('6faf4686-b5f9-481a-b21f-675e2d4fdc85','2PE','2 Peter 3:14-18',3,'law_commands',
 'Which paired instructions close 2 Peter?',
 array['Separate from every teacher and wait in silence','Take care not to be carried away by error, and grow in the grace and knowledge of Christ','Return to Jerusalem and submit the letter to the apostles','Determine the day of the Lord and warn every city'],'B',
 'Take care not to be carried away by error, and grow in the grace and knowledge of Christ',0.55,605,88,95,'nt_depth_b2|2PE|guard_and_grow_2pe3'),

('2f8169b2-a0e2-4ef4-a243-0572afbf63dc','1JN','1 John 3:11-12',3,'characters_lineage',
 'Whom does 1 John name as the negative example immediately after commanding love for one another?',
 array['Balaam','Korah','Esau','Cain'],'D',
 'Cain',0.15,535,86,94,'nt_depth_b2|1JN|cain_negative_example_1jn3'),
('b211a66c-daeb-443c-8d7e-1b5a625d61be','1JN','1 John 4:1-3',4,'law_commands',
 'What does 1 John command believers to do rather than believe every spirit?',
 array['Test the spirits to see whether they are from God','Ask each spirit to provide a public sign','Receive only spirits reported by the Jerusalem church','Wait for a prophet to identify each spirit by name'],'A',
 'Test the spirits to see whether they are from God',0.20,540,90,96,'nt_depth_b2|1JN|test_the_spirits_1jn4'),

('41e46c9a-a3dc-487c-9e9a-27962c10f05c','2JN','2 John 9-11',1,'law_commands',
 'What does 2 John instruct concerning someone who comes without abiding in the teaching of Christ?',
 array['Debate him publicly until he changes his mind','Receive him but do not allow him to speak','Do not receive him into the house or give him a greeting','Send him to the nearest apostle for examination'],'C',
 'Do not receive him into the house or give him a greeting',0.45,590,84,94,'nt_depth_b2|2JN|do_not_receive_2jn10'),
('facdd1d9-0ad6-4d36-b241-1c9128871fae','2JN','2 John 5-6',1,'structure_cross_ref',
 'How does 2 John define love immediately after repeating the command to love one another?',
 array['Love is agreement on every disputed teaching','Love is walking according to God''s commandments','Love is receiving every traveling teacher','Love is avoiding all correction of another believer'],'B',
 'Love is walking according to God''s commandments',0.25,550,90,96,'nt_depth_b2|2JN|love_walk_commands_2jn6'),
('b0631499-770a-4657-8426-367f6bd1c692','2JN','2 John 8',1,'law_commands',
 'Why does 2 John tell its readers to watch themselves?',
 array['So that they can identify the date of Christ''s return','So that no visitor learns the location of the church','So that they can avoid every contact with outsiders','So that they may not lose what has been worked for but may win a full reward'],'D',
 'So that they may not lose what has been worked for but may win a full reward',0.50,595,78,92,'nt_depth_b2|2JN|watch_full_reward_2jn8'),

('42e26397-9c6a-4a34-8339-fd969a502228','3JN','3 John 11',1,'law_commands',
 'What pattern does the elder tell Gaius to imitate?',
 array['Do not imitate evil, but imitate good','Imitate the person who holds first place','Imitate only those who travel without support','Do not imitate anyone until the elder arrives'],'A',
 'Do not imitate evil, but imitate good',0.10,520,82,93,'nt_depth_b2|3JN|imitate_good_3jn11'),
('2ec4c8f3-a6a0-4296-9808-587a776631cf','3JN','3 John 9-12',1,'structure_cross_ref',
 'Whose good testimony is presented immediately after the criticism of Diotrephes?',
 array['Gaius','The elder','Demetrius','Diotrephes himself'],'C',
 'Demetrius',0.35,570,72,90,'nt_depth_b2|3JN|demetrius_after_diotrephes_3jn12'),

('6b9bf59f-3840-4dc4-a4d6-7ecd6289002d','JUD','Jude 14-15',1,'characters_lineage',
 'Whom does Jude identify as the seventh from Adam?',
 array['Noah','Enoch','Methuselah','Abraham'],'B',
 'Enoch',0.35,570,72,90,'nt_depth_b2|JUD|enoch_seventh_adam_jud14'),
('7a7e948b-3dc2-4188-8ecc-73bad62593bb','JUD','Jude 5-7',1,'events_timeline',
 'Which sequence follows Jude''s order of opening judgment examples?',
 array['Sodom, unbelieving Israel, then the angels','The angels, Sodom, then unbelieving Israel','Unbelieving Israel, Sodom, then the angels','Unbelieving Israel, the angels who left their position, then Sodom and Gomorrah'],'D',
 'Unbelieving Israel, the angels who left their position, then Sodom and Gomorrah',0.65,625,82,94,'nt_depth_b2|JUD|judgment_examples_order_jud5'),
('7a9f1717-b3c4-4857-96e3-db000638b4b5','JUD','Jude 11',1,'structure_cross_ref',
 'Which three Old Testament rebellions are joined in Jude''s pronouncement of woe?',
 array['The way of Cain, Balaam''s error, and Korah''s rebellion','Esau''s hunger, Saul''s jealousy, and Absalom''s revolt','Achan''s theft, Eli''s negligence, and Jeroboam''s calves','Pharaoh''s oppression, Sihon''s resistance, and Ahab''s vineyard'],'A',
 'The way of Cain, Balaam''s error, and Korah''s rebellion',0.55,605,88,96,'nt_depth_b2|JUD|cain_balaam_korah_jud11'),

('777a6b97-0fac-4413-999a-88b7c92605b3','REV','Revelation 2:12-13',2,'characters_lineage',
 'Who is named as the faithful witness killed where Satan dwells in the message to Pergamum?',
 array['Polycarp','Stephen','Antipas','James'],'C',
 'Antipas',0.45,590,76,92,'nt_depth_b2|REV|antipas_pergamum_rev2'),
('f1198bc7-a336-40b4-955e-ab3635f402d6','REV','Revelation 2:4-5',2,'law_commands',
 'What three-part response is commanded after the church in Ephesus is told it has abandoned its first love?',
 array['Wait, watch, and endure','Remember, repent, and do the works done at first','Fast, appoint elders, and send a gift','Leave the city, gather in Pergamum, and remain silent'],'B',
 'Remember, repent, and do the works done at first',0.25,550,90,96,'nt_depth_b2|REV|remember_repent_first_works_rev2');

do $$
declare
  batch_count integer;
  id_conflicts integer;
  dedupe_conflicts integer;
  invalid_rows integer;
begin
  select count(*) into batch_count from obs_nt_epistle_depth_batch_2;

  select count(*) into id_conflicts
  from public.ot_generated_questions question
  join obs_nt_epistle_depth_batch_2 batch on batch.id = question.id;

  select count(*) into dedupe_conflicts
  from public.ot_generated_questions question
  join obs_nt_epistle_depth_batch_2 batch
    on batch.dedupe_key = question.dedupe_key;

  select count(*) into invalid_rows
  from obs_nt_epistle_depth_batch_2
  where cardinality(choices) <> 4
    or correct_choice_id not in ('A','B','C','D')
    or correct_answer <> choices[
      case correct_choice_id
        when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4
      end
    ]
    or dimension_key not in (
      'characters_lineage',
      'events_timeline',
      'law_commands',
      'structure_cross_ref'
    );

  if batch_count <> 50
     or id_conflicts <> 0
     or dedupe_conflicts <> 0
     or invalid_rows <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT epistle depth batch 2 precondition failed: rows=%s/50 ids=%s/0 dedupes=%s/0 invalid=%s/0.',
        batch_count, id_conflicts, dedupe_conflicts, invalid_rows
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
    'question_layer', case when batch.irt_b >= 0.55 then 3 else 2 end,
    'content_layer', 'expository_depth',
    'source_batch', '20260730_nt_epistle_depth_batch_2',
    'testament', 'NT',
    'book_code', batch.book_code,
    'chapter', batch.chapter,
    'reference', batch.reference,
    'source_ref', batch.reference,
    'prompt', batch.prompt,
    'choices', jsonb_build_array(
      jsonb_build_object('id','A','text',batch.choices[1]),
      jsonb_build_object('id','B','text',batch.choices[2]),
      jsonb_build_object('id','C','text',batch.choices[3]),
      jsonb_build_object('id','D','text',batch.choices[4])
    ),
    'correct_choice_id', batch.correct_choice_id,
    'correct_answer', batch.correct_answer,
    'dimension', batch.dimension_key,
    'dimension_key', batch.dimension_key,
    'expository_target',
      case
        when batch.dimension_key = 'structure_cross_ref'
          then 'argument_flow'
        else 'local_context'
      end,
    'irt_b', batch.irt_b,
    'difficulty_estimate', batch.difficulty_estimate,
    'importance_conceptual', batch.importance_conceptual,
    'importance_context', batch.importance_context,
    'interpretation_policy', 'explicit_local_context_no_systematic_inference'
  ),
  batch.dedupe_key
from obs_nt_epistle_depth_batch_2 batch;

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
  case
    when batch.dimension_key = 'structure_cross_ref'
      then 'argument_flow'
    else 'local_context'
  end,
  3,
  1,
  3,
  'low',
  3,
  1.0,
  'manual_nt_epistle_depth_batch_2',
  'Tests an explicit name, instruction, event sequence, or literary connection in the cited NT context.',
  '20260730_nt_epistle_depth_batch_2',
  now(),
  now()
from obs_nt_epistle_depth_batch_2 batch;

do $$
declare
  inserted_questions integer;
  approved_reviews integer;
  invalid_questions integer;
  answer_collisions integer;
  character_count integer;
  event_count integer;
  command_count integer;
  structure_count integer;
  covered_books integer;
begin
  select count(*) into inserted_questions
  from public.ot_generated_questions
  where payload->>'source_batch' = '20260730_nt_epistle_depth_batch_2';

  select count(*) into approved_reviews
  from public.obs_nt_expository_item_reviews review
  join obs_nt_epistle_depth_batch_2 batch
    on batch.id = review.generated_question_id
  where review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*) into invalid_questions
  from public.ot_generated_questions question
  join obs_nt_epistle_depth_batch_2 batch on batch.id = question.id
  where not public.obs_q_correct_resolves(question.payload)
    or public.obs_q_choice_count(question.payload) <> 4
    or public.obs_q_distinct_choice_count(question.payload) <> 4
    or question.payload->>'interpretation_policy' <>
       'explicit_local_context_no_systematic_inference'
    or question.payload->>'question_layer' not in ('2','3');

  select count(*) into answer_collisions
  from public.assessment_answers answer
  join obs_nt_epistle_depth_batch_2 batch
    on batch.id = answer.generated_question_id;

  select
    count(*) filter (where dimension_key = 'characters_lineage'),
    count(*) filter (where dimension_key = 'events_timeline'),
    count(*) filter (where dimension_key = 'law_commands'),
    count(*) filter (where dimension_key = 'structure_cross_ref'),
    count(distinct book_code)
  into
    character_count,
    event_count,
    command_count,
    structure_count,
    covered_books
  from obs_nt_epistle_depth_batch_2;

  if inserted_questions <> 50
     or approved_reviews <> 50
     or invalid_questions <> 0
     or answer_collisions <> 0
     or character_count <> 10
     or event_count <> 15
     or command_count <> 11
     or structure_count <> 14
     or covered_books <> 22
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT epistle depth batch 2 verification failed: questions=%s/50 approved=%s/50 invalid=%s/0 answers=%s/0 chars=%s/10 events=%s/15 commands=%s/11 structure=%s/14 books=%s/22.',
        inserted_questions,
        approved_reviews,
        invalid_questions,
        answer_collisions,
        character_count,
        event_count,
        command_count,
        structure_count,
        covered_books
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
