-- Add 30 text-dependent narrative questions: three geography and three
-- event-sequence items for each Gospel and Acts.

begin;

create temporary table obs_nt_narrative_batch_1 (
  id uuid primary key,
  book_code text not null,
  dedupe_key text unique not null,
  dimension_key text not null,
  prompt text not null,
  choices jsonb not null,
  correct_choice_id text not null,
  correct_answer text not null,
  reference text not null,
  chapter integer not null,
  irt_b double precision not null,
  difficulty_estimate integer not null,
  importance_conceptual integer not null,
  importance_context integer not null
) on commit drop;

insert into obs_nt_narrative_batch_1 values
(
  'cce71a6a-eaac-43d3-81e1-9bd86332971e',
  'MAT',
  'nt_narrative|MAT|move_to_capernaum_mat4',
  'geography_nations',
  'After leaving Nazareth, where does Jesus settle as his Galilean ministry begins in Matthew 4?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Bethlehem'),
    jsonb_build_object('id', 'B', 'text', 'Capernaum'),
    jsonb_build_object('id', 'C', 'text', 'Bethany'),
    jsonb_build_object('id', 'D', 'text', 'Jericho')
  ),
  'B',
  'Capernaum',
  'Matthew 4:12-17',
  4,
  0.35,
  600,
  80,
  88
),
(
  '5872d3c0-c307-4bd0-b963-a91f8f8174c4',
  'MAT',
  'nt_narrative|MAT|gethsemane_mat26',
  'geography_nations',
  'To what place does Jesus take the disciples to pray after the Last Supper in Matthew?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Gethsemane'),
    jsonb_build_object('id', 'B', 'text', 'Golgotha'),
    jsonb_build_object('id', 'C', 'text', 'Gabbatha'),
    jsonb_build_object('id', 'D', 'text', 'Bethphage')
  ),
  'A',
  'Gethsemane',
  'Matthew 26:30, 36',
  26,
  0.55,
  625,
  82,
  90
),
(
  'ac16b5f7-fae0-4588-9a13-18d5afd0c616',
  'MAT',
  'nt_narrative|MAT|resurrection_meeting_galilee_mat28',
  'geography_nations',
  'Where are the disciples told they will see the risen Jesus in Matthew 28?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Galilee'),
    jsonb_build_object('id', 'B', 'text', 'Samaria'),
    jsonb_build_object('id', 'C', 'text', 'Jericho'),
    jsonb_build_object('id', 'D', 'text', 'Emmaus')
  ),
  'A',
  'Galilee',
  'Matthew 28:7, 10, 16',
  28,
  0.45,
  610,
  84,
  90
),
(
  '299ba703-3714-45b9-afd6-fe5e09b0b5ea',
  'MAT',
  'nt_narrative|MAT|flight_to_egypt_trigger_mat2',
  'events_timeline',
  'What causes Joseph to take the child Jesus and his mother to Egypt in Matthew 2?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'A famine makes food unavailable in Bethlehem'),
    jsonb_build_object('id', 'B', 'text', 'An angel warns that Herod is seeking the child to destroy him'),
    jsonb_build_object('id', 'C', 'text', 'The Magi ask Joseph to return with them'),
    jsonb_build_object('id', 'D', 'text', 'Augustus orders every family to relocate')
  ),
  'B',
  'An angel warns that Herod is seeking the child to destroy him',
  'Matthew 2:13-15',
  2,
  0.55,
  625,
  86,
  92
),
(
  '1c36eab0-9d91-419b-93f5-09894b711a28',
  'MAT',
  'nt_narrative|MAT|after_feeding_boat_mat14',
  'events_timeline',
  'Immediately after feeding the five thousand in Matthew, what does Jesus make the disciples do?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Collect money for the journey to Jerusalem'),
    jsonb_build_object('id', 'B', 'text', 'Climb the mountain with Peter, James, and John'),
    jsonb_build_object('id', 'C', 'text', 'Get into the boat and go ahead of him to the other side'),
    jsonb_build_object('id', 'D', 'text', 'Return to Nazareth and teach in the synagogue')
  ),
  'C',
  'Get into the boat and go ahead of him to the other side',
  'Matthew 14:19-23',
  14,
  0.65,
  640,
  82,
  90
),
(
  'f4babcbc-aa1f-47db-8b37-b71fb53dee42',
  'MAT',
  'nt_narrative|MAT|after_peter_confession_mat16',
  'events_timeline',
  'What new emphasis begins after Peter confesses Jesus as the Messiah in Matthew 16?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Jesus begins teaching that he must go to Jerusalem, suffer, be killed, and be raised'),
    jsonb_build_object('id', 'B', 'text', 'Jesus begins sending the Twelve only to Gentile cities'),
    jsonb_build_object('id', 'C', 'text', 'Jesus begins rebuilding the temple with his disciples'),
    jsonb_build_object('id', 'D', 'text', 'Jesus begins avoiding every journey toward Jerusalem')
  ),
  'A',
  'Jesus begins teaching that he must go to Jerusalem, suffer, be killed, and be raised',
  'Matthew 16:13-21',
  16,
  0.8,
  665,
  90,
  94
),
(
  '4a2e2c4d-57b2-4967-82a0-ce1fbae24c86',
  'MRK',
  'nt_narrative|MRK|synagogue_capernaum_mrk1',
  'geography_nations',
  'In which town does Jesus teach in a synagogue and command an unclean spirit to leave a man in Mark 1?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Nazareth'),
    jsonb_build_object('id', 'B', 'text', 'Bethsaida'),
    jsonb_build_object('id', 'C', 'text', 'Capernaum'),
    jsonb_build_object('id', 'D', 'text', 'Caesarea Philippi')
  ),
  'C',
  'Capernaum',
  'Mark 1:21-28',
  1,
  0.35,
  600,
  80,
  88
),
(
  'd797e7bb-dacf-4b67-a0df-f33826be2a52',
  'MRK',
  'nt_narrative|MRK|two_stage_healing_bethsaida_mrk8',
  'geography_nations',
  'At what village does Jesus restore a blind man''s sight in two stages in Mark 8?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Bethany'),
    jsonb_build_object('id', 'B', 'text', 'Bethsaida'),
    jsonb_build_object('id', 'C', 'text', 'Nain'),
    jsonb_build_object('id', 'D', 'text', 'Sychar')
  ),
  'B',
  'Bethsaida',
  'Mark 8:22-26',
  8,
  0.7,
  650,
  78,
  90
),
(
  '55fec42b-b663-450a-a18e-16c12e56d5c6',
  'MRK',
  'nt_narrative|MRK|gethsemane_mrk14',
  'geography_nations',
  'Where does Jesus pray while Peter, James, and John struggle to stay awake in Mark 14?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Gethsemane'),
    jsonb_build_object('id', 'B', 'text', 'Golgotha'),
    jsonb_build_object('id', 'C', 'text', 'Bethphage'),
    jsonb_build_object('id', 'D', 'text', 'Capernaum')
  ),
  'A',
  'Gethsemane',
  'Mark 14:32-42',
  14,
  0.45,
  610,
  82,
  90
),
(
  '595c7333-82c1-4c1d-a449-0e9bbf43ee76',
  'MRK',
  'nt_narrative|MRK|after_storm_demon_mrk4_5',
  'events_timeline',
  'What encounter follows Jesus calming the storm when the boat reaches the other side in Mark?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'A man with an unclean spirit comes from among the tombs'),
    jsonb_build_object('id', 'B', 'text', 'A rich man asks how to inherit eternal life'),
    jsonb_build_object('id', 'C', 'text', 'A Syrophoenician woman asks help for her daughter'),
    jsonb_build_object('id', 'D', 'text', 'Blind Bartimaeus calls out beside the road')
  ),
  'A',
  'A man with an unclean spirit comes from among the tombs',
  'Mark 4:35-5:2',
  5,
  0.7,
  650,
  82,
  92
),
(
  '9eb9919a-3d4f-4bbe-a35d-323f684a140e',
  'MRK',
  'nt_narrative|MRK|cross_discipleship_after_prediction_mrk8',
  'events_timeline',
  'After the first prediction of his suffering in Mark 8, what does Jesus call the crowd and disciples to do?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Take up arms and prepare to defend Jerusalem'),
    jsonb_build_object('id', 'B', 'text', 'Deny themselves, take up their cross, and follow him'),
    jsonb_build_object('id', 'C', 'text', 'Return home until the danger has passed'),
    jsonb_build_object('id', 'D', 'text', 'Seek the highest places in the coming kingdom')
  ),
  'B',
  'Deny themselves, take up their cross, and follow him',
  'Mark 8:31-35',
  8,
  0.65,
  645,
  90,
  94
),
(
  '8b3bd3a7-694f-45ae-8233-3b082ba12af5',
  'MRK',
  'nt_narrative|MRK|argument_on_way_mrk9',
  'events_timeline',
  'What had the disciples been arguing about on the way to Capernaum in Mark 9?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Which of them was the greatest'),
    jsonb_build_object('id', 'B', 'text', 'Who should pay the temple tax'),
    jsonb_build_object('id', 'C', 'text', 'Whether to travel through Samaria'),
    jsonb_build_object('id', 'D', 'text', 'How many baskets remained after the feeding')
  ),
  'A',
  'Which of them was the greatest',
  'Mark 9:33-37',
  9,
  0.55,
  625,
  80,
  90
),
(
  'e7f85198-3c4c-4b72-b412-705bd3d8912c',
  'LUK',
  'nt_narrative|LUK|isaiah_synagogue_nazareth_luk4',
  'geography_nations',
  'In which town does Jesus read from Isaiah in the synagogue and declare the Scripture fulfilled in Luke 4?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Nazareth'),
    jsonb_build_object('id', 'B', 'text', 'Capernaum'),
    jsonb_build_object('id', 'C', 'text', 'Bethlehem'),
    jsonb_build_object('id', 'D', 'text', 'Jericho')
  ),
  'A',
  'Nazareth',
  'Luke 4:16-21',
  4,
  0.35,
  600,
  84,
  90
),
(
  '183eddc5-0f74-4f3a-9f4a-25337d94d351',
  'LUK',
  'nt_narrative|LUK|zacchaeus_jericho_luk19',
  'geography_nations',
  'In what city does Zacchaeus climb a tree to see Jesus in Luke 19?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Jerusalem'),
    jsonb_build_object('id', 'B', 'text', 'Jericho'),
    jsonb_build_object('id', 'C', 'text', 'Bethany'),
    jsonb_build_object('id', 'D', 'text', 'Nain')
  ),
  'B',
  'Jericho',
  'Luke 19:1-10',
  19,
  0.35,
  595,
  82,
  88
),
(
  '420f96f0-e017-4e32-888b-0297c4dbc6e0',
  'LUK',
  'nt_narrative|LUK|ascension_near_bethany_luk24',
  'geography_nations',
  'Near what village does Luke place Jesus'' ascension at the end of the Gospel?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Emmaus'),
    jsonb_build_object('id', 'B', 'text', 'Bethlehem'),
    jsonb_build_object('id', 'C', 'text', 'Bethany'),
    jsonb_build_object('id', 'D', 'text', 'Bethsaida')
  ),
  'C',
  'Bethany',
  'Luke 24:50-53',
  24,
  0.6,
  635,
  82,
  90
),
(
  '9fffe876-1b5b-47aa-83cd-f195a909630d',
  'LUK',
  'nt_narrative|LUK|samaritan_rejection_response_luk9',
  'events_timeline',
  'When a Samaritan village refuses to receive Jesus in Luke 9, what do James and John ask permission to do?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Call down fire from heaven'),
    jsonb_build_object('id', 'B', 'text', 'Return immediately to Galilee'),
    jsonb_build_object('id', 'C', 'text', 'Send Peter to negotiate with the village'),
    jsonb_build_object('id', 'D', 'text', 'Shake the dust off and end the journey')
  ),
  'A',
  'Call down fire from heaven',
  'Luke 9:51-56',
  9,
  0.65,
  645,
  82,
  92
),
(
  '081ee069-a590-425b-8742-1b5a9c8d07b6',
  'LUK',
  'nt_narrative|LUK|after_samaritan_martha_mary_luk10',
  'events_timeline',
  'Which scene follows the parable of the Good Samaritan in Luke 10?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Jesus visits Martha and Mary'),
    jsonb_build_object('id', 'B', 'text', 'Jesus raises the widow''s son at Nain'),
    jsonb_build_object('id', 'C', 'text', 'Jesus calls Levi from the tax booth'),
    jsonb_build_object('id', 'D', 'text', 'Jesus heals ten lepers near Samaria')
  ),
  'A',
  'Jesus visits Martha and Mary',
  'Luke 10:25-42',
  10,
  0.8,
  665,
  82,
  92
),
(
  '6b4219e1-a3ee-4fb9-a189-162efdd4f0b3',
  'LUK',
  'nt_narrative|LUK|disciple_asks_prayer_luk11',
  'events_timeline',
  'What prompts Jesus to teach the disciples the Lord''s Prayer in Luke 11?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'A disciple sees Jesus praying and asks him to teach them'),
    jsonb_build_object('id', 'B', 'text', 'A Pharisee challenges Jesus about fasting'),
    jsonb_build_object('id', 'C', 'text', 'John the Baptist sends messengers from prison'),
    jsonb_build_object('id', 'D', 'text', 'Martha asks Jesus to correct Mary')
  ),
  'A',
  'A disciple sees Jesus praying and asks him to teach them',
  'Luke 11:1-4',
  11,
  0.55,
  625,
  84,
  90
),
(
  '9d1e541e-f670-44bc-86f4-7ccb6690b811',
  'JHN',
  'nt_narrative|JHN|samaritan_woman_sychar_jhn4',
  'geography_nations',
  'Near what Samaritan town does Jesus speak with the woman at Jacob''s well in John 4?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Sychar'),
    jsonb_build_object('id', 'B', 'text', 'Bethany'),
    jsonb_build_object('id', 'C', 'text', 'Cana'),
    jsonb_build_object('id', 'D', 'text', 'Ephraim')
  ),
  'A',
  'Sychar',
  'John 4:5-7',
  4,
  0.6,
  635,
  80,
  90
),
(
  '569e584d-a4e3-49d8-9cb9-c0c1de0fc845',
  'JHN',
  'nt_narrative|JHN|lazarus_bethany_jhn11',
  'geography_nations',
  'In what village do Mary, Martha, and Lazarus live in John 11?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Bethsaida'),
    jsonb_build_object('id', 'B', 'text', 'Bethlehem'),
    jsonb_build_object('id', 'C', 'text', 'Bethany'),
    jsonb_build_object('id', 'D', 'text', 'Capernaum')
  ),
  'C',
  'Bethany',
  'John 11:1-18',
  11,
  0.45,
  610,
  80,
  88
),
(
  '6962e77c-2f4d-45c8-a54f-74b9a170f55c',
  'JHN',
  'nt_narrative|JHN|resurrection_appearance_tiberias_jhn21',
  'geography_nations',
  'By what sea does the risen Jesus appear to seven disciples in John 21?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'The Dead Sea'),
    jsonb_build_object('id', 'B', 'text', 'The Sea of Tiberias'),
    jsonb_build_object('id', 'C', 'text', 'The Mediterranean Sea'),
    jsonb_build_object('id', 'D', 'text', 'The Red Sea')
  ),
  'B',
  'The Sea of Tiberias',
  'John 21:1-14',
  21,
  0.5,
  615,
  82,
  90
),
(
  '4ae96302-7a77-4a18-87f1-7c0253052960',
  'JHN',
  'nt_narrative|JHN|nicodemus_after_signs_jhn2_3',
  'events_timeline',
  'Which Pharisee comes to Jesus at night after John reports that many believed because of the signs at Passover?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Nicodemus'),
    jsonb_build_object('id', 'B', 'text', 'Gamaliel'),
    jsonb_build_object('id', 'C', 'text', 'Joseph of Arimathea'),
    jsonb_build_object('id', 'D', 'text', 'Caiaphas')
  ),
  'A',
  'Nicodemus',
  'John 2:23-3:2',
  3,
  0.65,
  645,
  84,
  92
),
(
  '99caba9e-faa8-4f03-a000-23aa31f88738',
  'JHN',
  'nt_narrative|JHN|after_feeding_walks_sea_jhn6',
  'events_timeline',
  'What sign follows the feeding of the five thousand in John 6?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Jesus walks on the sea toward the disciples'' boat'),
    jsonb_build_object('id', 'B', 'text', 'Jesus raises Lazarus from the tomb'),
    jsonb_build_object('id', 'C', 'text', 'Jesus heals the man born blind'),
    jsonb_build_object('id', 'D', 'text', 'Jesus turns water into wine at Cana')
  ),
  'A',
  'Jesus walks on the sea toward the disciples'' boat',
  'John 6:1-21',
  6,
  0.55,
  625,
  82,
  90
),
(
  'caa35ca1-56ae-4f52-9c4f-c31538a360c2',
  'JHN',
  'nt_narrative|JHN|council_after_lazarus_jhn11',
  'events_timeline',
  'How do the chief priests and Pharisees respond after Lazarus is raised in John 11?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'They call a council and begin planning to put Jesus to death'),
    jsonb_build_object('id', 'B', 'text', 'They invite Jesus to teach publicly in the temple'),
    jsonb_build_object('id', 'C', 'text', 'They ask Lazarus to testify before the Roman governor'),
    jsonb_build_object('id', 'D', 'text', 'They leave Jerusalem to follow Jesus in Galilee')
  ),
  'A',
  'They call a council and begin planning to put Jesus to death',
  'John 11:45-53',
  11,
  0.75,
  660,
  88,
  94
),
(
  '483f36c6-0e0f-4b57-a42b-df15b6fa99e5',
  'ACT',
  'nt_narrative|ACT|eunuch_road_gaza_act8',
  'geography_nations',
  'The Ethiopian official meets Philip on the road from Jerusalem toward which city?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Damascus'),
    jsonb_build_object('id', 'B', 'text', 'Gaza'),
    jsonb_build_object('id', 'C', 'text', 'Joppa'),
    jsonb_build_object('id', 'D', 'text', 'Caesarea')
  ),
  'B',
  'Gaza',
  'Acts 8:26-39',
  8,
  0.55,
  625,
  82,
  90
),
(
  '10513394-92b8-4872-ba74-58e2d21037f2',
  'ACT',
  'nt_narrative|ACT|called_christians_antioch_act11',
  'geography_nations',
  'In which city are the disciples first called Christians in Acts?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Jerusalem'),
    jsonb_build_object('id', 'B', 'text', 'Antioch'),
    jsonb_build_object('id', 'C', 'text', 'Ephesus'),
    jsonb_build_object('id', 'D', 'text', 'Philippi')
  ),
  'B',
  'Antioch',
  'Acts 11:19-26',
  11,
  0.4,
  605,
  84,
  90
),
(
  '834f4319-44f0-4e3a-b061-7604cad4e9a9',
  'ACT',
  'nt_narrative|ACT|areopagus_athens_act17',
  'geography_nations',
  'In which city does Paul address the Areopagus after seeing many objects of worship?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Corinth'),
    jsonb_build_object('id', 'B', 'text', 'Athens'),
    jsonb_build_object('id', 'C', 'text', 'Ephesus'),
    jsonb_build_object('id', 'D', 'text', 'Thessalonica')
  ),
  'B',
  'Athens',
  'Acts 17:16-34',
  17,
  0.45,
  610,
  84,
  90
),
(
  '1407cfa0-f329-4e68-bed2-352e3e692752',
  'ACT',
  'nt_narrative|ACT|after_stephen_scattering_act8',
  'events_timeline',
  'What happens to the Jerusalem believers after Stephen is killed in Acts?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Persecution scatters many through Judea and Samaria, where they preach'),
    jsonb_build_object('id', 'B', 'text', 'They appoint Paul to replace Stephen among the Seven'),
    jsonb_build_object('id', 'C', 'text', 'They abandon Jerusalem and settle together in Rome'),
    jsonb_build_object('id', 'D', 'text', 'The Sanhedrin grants them freedom to teach in the temple')
  ),
  'A',
  'Persecution scatters many through Judea and Samaria, where they preach',
  'Acts 7:54-8:4',
  8,
  0.65,
  645,
  88,
  94
),
(
  'f90b4ca1-0d7a-4221-be78-33b2b3deae83',
  'ACT',
  'nt_narrative|ACT|jerusalem_council_issue_act15',
  'events_timeline',
  'What dispute brings the apostles and elders together for the Jerusalem council in Acts 15?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'Whether Gentile believers must be circumcised and keep the law of Moses'),
    jsonb_build_object('id', 'B', 'text', 'Whether Paul should continue making tents while preaching'),
    jsonb_build_object('id', 'C', 'text', 'Whether Peter should remain permanently in Caesarea'),
    jsonb_build_object('id', 'D', 'text', 'Whether believers may appeal their cases to Roman courts')
  ),
  'A',
  'Whether Gentile believers must be circumcised and keep the law of Moses',
  'Acts 15:1-21',
  15,
  0.65,
  645,
  92,
  95
),
(
  '79e965ef-ccd7-47e2-b847-d268f87093ea',
  'ACT',
  'nt_narrative|ACT|philippi_earthquake_jailer_act16',
  'events_timeline',
  'What event leads the Philippian jailer to ask Paul and Silas what he must do to be saved?',
  jsonb_build_array(
    jsonb_build_object('id', 'A', 'text', 'An earthquake opens the prison doors while the prisoners remain inside'),
    jsonb_build_object('id', 'B', 'text', 'A riot at the theater forces the city officials to intervene'),
    jsonb_build_object('id', 'C', 'text', 'A vision directs Paul to cross over into Macedonia'),
    jsonb_build_object('id', 'D', 'text', 'A mob stones Paul and leaves him outside the city')
  ),
  'A',
  'An earthquake opens the prison doors while the prisoners remain inside',
  'Acts 16:25-34',
  16,
  0.6,
  635,
  86,
  94
);

do $$
declare
  batch_count integer;
  geography_count integer;
  events_count integer;
  conflicting_ids integer;
begin
  select
    count(*),
    count(*) filter (where dimension_key = 'geography_nations'),
    count(*) filter (where dimension_key = 'events_timeline')
  into batch_count, geography_count, events_count
  from obs_nt_narrative_batch_1;

  select count(*)
  into conflicting_ids
  from public.ot_generated_questions question
  join obs_nt_narrative_batch_1 batch
    on batch.id = question.id;

  if batch_count <> 30
     or geography_count <> 15
     or events_count <> 15
     or conflicting_ids <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT narrative precondition failed: batch=%s geography=%s events=%s conflicting_ids=%s.',
        batch_count,
        geography_count,
        events_count,
        conflicting_ids
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
  'nt_narrative_expository_mcq_v1',
  jsonb_build_object(
    'question_id', batch.id,
    'question_format', 'mcq',
    'question_layer', 'narrative_expansion',
    'source_batch',
      '20260729_nt_gospels_acts_geography_events_batch_1',
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
from obs_nt_narrative_batch_1 batch;

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
  case batch.dimension_key
    when 'geography_nations' then 'narrative_detail'
    else 'narrative_sequence'
  end,
  3,
  1,
  3,
  'low',
  3,
  1.0,
  'manual_gospels_acts_narrative_batch_1',
  'Explicit Gospel/Acts place or sequence detail with same-category distractors.',
  '20260729_nt_gospels_acts_geography_events_batch_1',
  now(),
  now()
from obs_nt_narrative_batch_1 batch;

do $$
declare
  active_nt_count integer;
  approved_count integer;
  provisional_count integer;
  excluded_count integer;
  batch_count integer;
  invalid_payloads integer;
  invalid_book_balance integer;
  geography_routable integer;
  events_routable integer;
begin
  select count(*)
  into active_nt_count
  from public.v_nt_question_bank;

  select
    count(*) filter (where review_status = 'approved'),
    count(*) filter (where review_status = 'provisional'),
    count(*) filter (where review_status = 'excluded')
  into approved_count, provisional_count, excluded_count
  from public.obs_nt_expository_item_reviews;

  select count(*)
  into batch_count
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_gospels_acts_geography_events_batch_1'
    and review.review_status = 'approved'
    and review.routing_priority = 3
    and review.scoring_weight = 1.0;

  select count(*)
  into invalid_payloads
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_gospels_acts_geography_events_batch_1'
    and (
      not public.obs_q_correct_resolves(question.payload)
      or public.obs_q_choice_count(question.payload) <> 4
      or public.obs_q_distinct_choice_count(question.payload) <> 4
    );

  select count(*)
  into invalid_book_balance
  from (
    select
      question.payload->>'book_code' as book_code,
      count(*) as total,
      count(*) filter (
        where question.payload->>'dimension_key' =
          'geography_nations'
      ) as geography,
      count(*) filter (
        where question.payload->>'dimension_key' =
          'events_timeline'
      ) as events
    from public.ot_generated_questions question
    where question.payload->>'source_batch' =
            '20260729_nt_gospels_acts_geography_events_batch_1'
    group by question.payload->>'book_code'
  ) balance
  where total <> 6 or geography <> 3 or events <> 3;

  select
    count(*) filter (
      where question.payload->>'dimension_key' =
        'geography_nations'
    ),
    count(*) filter (
      where question.payload->>'dimension_key' =
        'events_timeline'
    )
  into geography_routable, events_routable
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.review_status in ('approved', 'provisional');

  if active_nt_count <> 181
     or approved_count <> 110
     or provisional_count <> 59
     or excluded_count <> 12
     or batch_count <> 30
     or invalid_payloads <> 0
     or invalid_book_balance <> 0
     or geography_routable <> 20
     or events_routable <> 29
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT narrative verification failed: active=%s approved=%s provisional=%s excluded=%s batch=%s invalid_payloads=%s invalid_balance=%s geography=%s events=%s.',
        active_nt_count,
        approved_count,
        provisional_count,
        excluded_count,
        batch_count,
        invalid_payloads,
        invalid_book_balance,
        geography_routable,
        events_routable
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
