-- Seed high-quality OT section-level competency questions.
--
-- These items assess broad narrative shape, chronology, historical setting,
-- section descriptions, and "out of place" recognition. They deliberately avoid
-- making Hebrew Bible division labels the main thing being tested.

begin;

with seed (
  dedupe_key,
  book_code,
  section_key,
  retrieval_target,
  prompt,
  choice_a,
  choice_b,
  choice_c,
  choice_d,
  correct_choice_id,
  explanation,
  importance_conceptual,
  importance_context,
  irt_b
) as (
  values
    (
      'section_competency|ot|torah_arc_001',
      'EXO',
      'TORAH',
      'section_arc',
      'Which description best captures the main movement of the Torah narrative?',
      'God creates and calls a family, delivers Israel from Egypt, gives covenant instruction, and brings Israel toward the land.',
      'Israel returns from Babylon, rebuilds Jerusalem, and renews temple worship under Persian rule.',
      'David establishes Jerusalem, Solomon builds the temple, and the kingdom divides after Solomon.',
      'Prophets warn the divided kingdoms, interpret exile, and promise restoration after judgment.',
      'A',
      'The Torah moves from creation and the patriarchs through exodus, Sinai, wilderness, and preparation to enter the land.',
      84,
      82,
      -0.55
    ),
    (
      'section_competency|ot|torah_sequence_001',
      'GEN',
      'TORAH',
      'section_chronology',
      'Which sequence places these major Torah events from earliest to latest?',
      'Creation, call of Abraham, exodus from Egypt, covenant at Sinai',
      'Call of Abraham, creation, covenant at Sinai, exodus from Egypt',
      'Exodus from Egypt, creation, call of Abraham, covenant at Sinai',
      'Covenant at Sinai, call of Abraham, creation, exodus from Egypt',
      'A',
      'Creation precedes Abraham; Abraham precedes Israel in Egypt; the exodus precedes Sinai.',
      84,
      80,
      -0.5
    ),
    (
      'section_competency|ot|torah_out_of_place_001',
      'NUM',
      'TORAH',
      'section_period_discrimination',
      'Which event is out of place if the focus is the Torah narrative?',
      'David is anointed king over Judah in Hebron.',
      'Israel leaves Egypt after the Passover.',
      'The covenant is given at Sinai.',
      'The people wander in the wilderness toward Moab.',
      'A',
      'David becoming king belongs much later in Israel''s story, not in the Torah period.',
      82,
      78,
      -0.35
    ),
    (
      'section_competency|ot|torah_before_sinai_001',
      'EXO',
      'TORAH',
      'relative_chronology',
      'Which event happens before Israel receives the covenant at Sinai?',
      'The Passover and exodus from Egypt',
      'The fall of Jericho',
      'David brings the ark to Jerusalem',
      'Jerusalem falls to Babylon',
      'A',
      'The exodus and Passover occur before Israel arrives at Sinai.',
      82,
      78,
      -0.45
    ),
    (
      'section_competency|ot|torah_numbers_transition_001',
      'NUM',
      'TORAH',
      'section_transition',
      'Which description best fits the broad transition in Numbers?',
      'Israel moves from Sinai into wilderness testing and toward the plains of Moab.',
      'Israel settles the land and asks for a king like the nations.',
      'Judah returns from exile and rebuilds the temple.',
      'The northern kingdom falls while Judah survives another century.',
      'A',
      'Numbers follows Israel from Sinai through wilderness failures toward Moab and the edge of the land.',
      80,
      76,
      -0.2
    ),
    (
      'section_competency|ot|torah_deuteronomy_setting_001',
      'DEU',
      'TORAH',
      'section_setting',
      'Which setting best describes Deuteronomy within the larger Old Testament story?',
      'Moses addresses Israel on the plains of Moab before the people enter the land.',
      'Joshua divides the conquered land among the tribes after Jericho falls.',
      'Solomon dedicates the temple in Jerusalem after years of construction.',
      'Ezra reads the law to the returned exiles after the walls are rebuilt.',
      'A',
      'Deuteronomy is framed as Moses'' covenant-renewal speeches before Israel crosses into the land.',
      80,
      76,
      -0.2
    ),
    (
      'section_competency|ot|torah_theme_cluster_001',
      'LEV',
      'TORAH',
      'section_theme_cluster',
      'Which cluster best fits major Torah concerns?',
      'Promise, exodus, covenant, priesthood, holiness, wilderness testing',
      'Temple rebuilding, Persian decrees, city walls, and restored community records',
      'Court tales in Babylon, symbolic visions, and foreign empires',
      'Wisdom poems, royal songs, laments, and reflections on suffering',
      'A',
      'The Torah centers on promise, deliverance, covenant, holiness, priesthood, and wilderness formation.',
      81,
      78,
      -0.35
    ),
    (
      'section_competency|ot|torah_patriarchal_period_001',
      'GEN',
      'TORAH',
      'section_period_discrimination',
      'Which event belongs to the patriarchal period rather than the exodus or monarchy?',
      'Jacob wrestles and receives the name Israel.',
      'Moses receives the Ten Commandments at Sinai.',
      'David defeats Goliath before Saul''s army.',
      'Elijah confronts the prophets of Baal on Mount Carmel.',
      'A',
      'Jacob belongs to the Genesis patriarchal narratives before the exodus and monarchy.',
      81,
      78,
      -0.35
    ),
    (
      'section_competency|ot|former_arc_001',
      '2KI',
      'FORMER',
      'section_arc',
      'Which description best captures the broad historical arc from Joshua through Kings?',
      'Israel enters the land, struggles under judges, develops monarchy, divides, and goes into exile.',
      'God creates the world, calls Abraham, delivers Israel from Egypt, and gives covenant law at Sinai.',
      'Judah returns from exile, rebuilds the temple, and records the restored community.',
      'Wisdom teachers explore suffering, worship, desire, work, and the fear of the Lord.',
      'A',
      'Joshua through Kings moves from entry into the land to judges, monarchy, division, and exile.',
      84,
      82,
      -0.45
    ),
    (
      'section_competency|ot|former_sequence_001',
      '1SA',
      'FORMER',
      'section_chronology',
      'Which sequence places these periods from earliest to latest?',
      'Conquest, judges, united monarchy, divided monarchy',
      'Divided monarchy, conquest, united monarchy, judges',
      'Judges, exile, conquest, united monarchy',
      'United monarchy, conquest, judges, divided monarchy',
      'A',
      'The broad sequence is entry/conquest, judges, united monarchy, then divided monarchy.',
      84,
      80,
      -0.45
    ),
    (
      'section_competency|ot|former_before_david_001',
      '1SA',
      'FORMER',
      'relative_chronology',
      'Which event happens before David becomes king?',
      'Samuel anoints David while Saul is still king.',
      'Solomon dedicates the temple in Jerusalem.',
      'The northern kingdom falls to Assyria.',
      'Cyrus issues a decree for return from exile.',
      'A',
      'David is anointed before his public kingship and before the later monarchy and exile events.',
      82,
      78,
      -0.35
    ),
    (
      'section_competency|ot|former_out_of_place_001',
      'JDG',
      'FORMER',
      'section_period_discrimination',
      'Which item is out of place in the broad story from Joshua through Kings?',
      'Cyrus permits the exiles to return and rebuild the temple.',
      'Jericho falls after Israel crosses the Jordan.',
      'Israel asks Samuel for a king.',
      'Jerusalem falls to Babylon near the end of Kings.',
      'A',
      'Cyrus and the return from exile belong after Kings, especially in Ezra-Nehemiah.',
      82,
      78,
      -0.3
    ),
    (
      'section_competency|ot|judges_cycle_001',
      'JDG',
      'FORMER',
      'section_pattern',
      'Which pattern best describes the repeated cycle in Judges?',
      'Israel turns away, is oppressed, cries out, and is delivered through a judge.',
      'A prophet writes to exiles, interprets visions, and predicts four empires.',
      'A king builds the temple, dedicates it, and divides priestly duties.',
      'A wisdom teacher compares the righteous and wicked through short sayings.',
      'A',
      'Judges repeatedly portrays apostasy, oppression, crying out, and deliverance.',
      82,
      78,
      -0.35
    ),
    (
      'section_competency|ot|divided_kingdom_arc_001',
      '1KI',
      'FORMER',
      'section_arc',
      'Which description best fits the divided kingdom storyline?',
      'After Solomon, Israel and Judah split; prophets confront royal unfaithfulness; both kingdoms eventually fall.',
      'After Moses, Israel wanders forty years before receiving the law at Sinai.',
      'After Cyrus, Judah rebuilds the temple before entering Egypt.',
      'After Job, the psalms move from lament into temple rebuilding.',
      'A',
      'Kings traces the split after Solomon, prophetic confrontation, and the falls of Israel and Judah.',
      83,
      80,
      -0.35
    ),
    (
      'section_competency|ot|kings_closing_crisis_001',
      '2KI',
      'FORMER',
      'section_endpoint',
      'Which crisis stands near the end of the story in 2 Kings?',
      'Jerusalem falls to Babylon and Judah goes into exile.',
      'The flood covers the earth in Noah''s generation.',
      'The walls of Jericho fall after Israel marches around them.',
      'The temple is rebuilt under Zerubbabel and Joshua.',
      'A',
      'Second Kings ends with Jerusalem destroyed and Judah in Babylonian exile.',
      82,
      78,
      -0.3
    ),
    (
      'section_competency|ot|monarchy_begins_001',
      '1SA',
      'FORMER',
      'section_transition',
      'Which transition marks the beginning of Israel''s monarchy?',
      'Israel asks for a king, and Saul becomes king under Samuel''s ministry.',
      'Abraham leaves his country and receives promises about land and offspring.',
      'Moses renews the covenant on the plains of Moab.',
      'Nehemiah receives permission to rebuild Jerusalem''s wall.',
      'A',
      'The monarchy begins in 1 Samuel with Saul, Samuel, and Israel''s request for a king.',
      80,
      76,
      -0.2
    ),
    (
      'section_competency|ot|prophets_arc_001',
      'JER',
      'LATTER',
      'section_arc',
      'Which description best captures the broad work of the writing prophets?',
      'They confront covenant unfaithfulness, interpret judgment and exile, and hold out hope for restoration.',
      'They narrate the conquest of Canaan, tribal allotments, and the rise of the judges.',
      'They collect royal songs, wisdom sayings, and festival poems for worship.',
      'They retell creation, the flood, Abraham, the exodus, and Sinai in one continuous law code.',
      'A',
      'The prophets combine covenant lawsuit, judgment, exile interpretation, and restoration hope.',
      84,
      82,
      -0.35
    ),
    (
      'section_competency|ot|prophets_sequence_001',
      'HAG',
      'LATTER',
      'section_chronology',
      'Which sequence best follows the broad historical settings of several prophetic books?',
      'Assyrian threat, Babylonian exile, return-era temple rebuilding',
      'Return-era temple rebuilding, Assyrian threat, Babylonian exile',
      'Babylonian exile, conquest of Canaan, Assyrian threat',
      'Conquest of Canaan, return-era temple rebuilding, Sinai covenant',
      'A',
      'Some prophets address Assyrian-era crises, others Babylonian exile, and Haggai/Zechariah the return-era temple work.',
      82,
      78,
      -0.15
    ),
    (
      'section_competency|ot|ezekiel_setting_001',
      'EZK',
      'LATTER',
      'section_setting',
      'Which setting best fits Ezekiel within the Old Testament story?',
      'A priestly prophet speaks among the exiles in Babylon and sees God''s glory depart and return.',
      'A judge defeats Midian before Israel asks Samuel for a king.',
      'A Persian queen risks her life to save Jews scattered through the empire.',
      'A teacher in Jerusalem composes short sayings about diligence and folly.',
      'A',
      'Ezekiel prophesies among the exiles in Babylon and centers major visions on God''s glory.',
      82,
      78,
      -0.25
    ),
    (
      'section_competency|ot|prophets_out_of_place_001',
      'ISA',
      'LATTER',
      'section_period_discrimination',
      'Which item is out of place if the focus is the writing prophets'' historical settings?',
      'Joshua leads Israel across the Jordan and Jericho falls.',
      'Isaiah warns Judah during Assyrian pressure.',
      'Jeremiah warns of Babylon and the fall of Jerusalem.',
      'Haggai urges the returned community to rebuild the temple.',
      'A',
      'Jericho belongs to the conquest narrative, not the settings of the writing prophets.',
      80,
      76,
      -0.1
    ),
    (
      'section_competency|ot|prophetic_pattern_001',
      'MIC',
      'LATTER',
      'section_pattern',
      'Which pattern appears often across the prophetic books?',
      'Judgment for covenant unfaithfulness followed by hope for restoration',
      'A judge is raised, wins a battle, and begins a dynasty in Jerusalem',
      'A genealogy leads to a census, which leads to tribal land allotments',
      'A wisdom teacher gives proverbs about ants, sluggards, and speech',
      'A',
      'Many prophetic books move between judgment and future hope or restoration.',
      82,
      78,
      -0.25
    ),
    (
      'section_competency|ot|post_exile_prophets_001',
      'ZEC',
      'LATTER',
      'section_setting',
      'Which situation best fits Haggai and Zechariah?',
      'Returned exiles are being urged and encouraged to rebuild the temple.',
      'Israel is preparing to leave Egypt on the night of Passover.',
      'David is fleeing from Saul before becoming king.',
      'The northern kingdom is choosing Jeroboam after Solomon''s death.',
      'A',
      'Haggai and Zechariah minister after the return from exile during the temple rebuilding period.',
      81,
      78,
      -0.15
    ),
    (
      'section_competency|ot|twelve_scope_001',
      'AMO',
      'LATTER',
      'section_scope',
      'Which description best fits the Twelve as a collection?',
      'Shorter prophetic books addressing Israel, Judah, surrounding nations, judgment, repentance, and hope',
      'Five books narrating creation, patriarchs, exodus, Sinai, and wilderness travel',
      'Historical books moving from conquest to exile through judges and kings',
      'Wisdom books and songs focused only on private prayer and family life',
      'A',
      'The Twelve are shorter prophetic books with themes of judgment, repentance, nations, and hope.',
      80,
      76,
      -0.15
    ),
    (
      'section_competency|ot|daniel_setting_001',
      'DAN',
      'WRITINGS',
      'section_setting',
      'Which description best fits Daniel''s place in the Old Testament storyline?',
      'Faithful Jews live under foreign empires, and visions portray God''s rule over kingdoms.',
      'Israel receives sacrificial laws at Sinai before entering the wilderness.',
      'Joshua divides Canaan after the walls of Jericho fall.',
      'Solomon organizes temple singers before building the tabernacle.',
      'A',
      'Daniel combines diaspora court narratives with visions about kingdoms and God''s final rule.',
      82,
      78,
      -0.2
    ),
    (
      'section_competency|ot|writings_breadth_001',
      'PSA',
      'WRITINGS',
      'section_scope',
      'Which description best captures the breadth of the Writings?',
      'Prayer and praise, wisdom reflection, festival stories, exile-era faithfulness, and return-era rebuilding',
      'Creation, patriarchs, exodus, Sinai, and wilderness law as one continuous narrative',
      'Conquest, judges, monarchy, division, and exile as a single historical sequence',
      'Prophetic warnings to Israel and Judah collected only around Assyria and Babylon',
      'A',
      'The Writings include worship, wisdom, scrolls, Daniel, and return-era books such as Ezra-Nehemiah and Chronicles.',
      84,
      82,
      -0.25
    ),
    (
      'section_competency|ot|post_exilic_rebuilding_001',
      'EZR',
      'WRITINGS',
      'section_setting',
      'Which description best fits Ezra-Nehemiah in the larger story?',
      'Returned exiles rebuild the temple community, Jerusalem''s wall, and covenant life under Persian rule.',
      'Israel wanders from Sinai to Moab while the tabernacle is built.',
      'The northern kingdom splits away immediately after Saul dies.',
      'The prophet Jonah rebuilds Jerusalem after Nineveh repents.',
      'A',
      'Ezra-Nehemiah belongs to the return from exile and restoration of temple, city, and covenant life.',
      82,
      78,
      -0.2
    ),
    (
      'section_competency|ot|wisdom_cluster_001',
      'PRO',
      'WRITINGS',
      'section_theme_cluster',
      'Which cluster best fits the Old Testament wisdom books?',
      'Suffering, the fear of the Lord, wise living, desire, work, and the limits of human understanding',
      'Conquest campaigns, tribal land allotments, and covenant renewal at Shechem',
      'Assyrian siege, Babylonian exile, and temple rebuilding under Darius',
      'Plagues, Passover, Sinai, priesthood, and wilderness census lists',
      'A',
      'Job, Proverbs, Ecclesiastes, and Song of Songs explore wisdom, suffering, desire, work, and human limits.',
      82,
      78,
      -0.2
    ),
    (
      'section_competency|ot|psalms_function_001',
      'PSA',
      'WRITINGS',
      'section_function',
      'Which description best fits the role of Psalms within the Old Testament?',
      'A collection of prayers and songs for lament, praise, thanksgiving, trust, kingship, and instruction',
      'A legal code centered on priestly ordination, sacrifices, and ritual purity',
      'A court narrative about Jews serving under Babylonian and Persian kings',
      'A conquest account focused on crossing the Jordan and allotting the land',
      'A',
      'Psalms gives Israel a broad vocabulary of worship, lament, praise, trust, and royal hope.',
      81,
      78,
      -0.2
    ),
    (
      'section_competency|ot|chronicles_focus_001',
      '1CH',
      'WRITINGS',
      'section_focus',
      'Which description best fits the broad focus of Chronicles?',
      'It retells Israel''s story with special attention to David, the temple, worship, and Judah''s hope.',
      'It narrates Israel''s escape from Egypt and covenant formation at Sinai.',
      'It records the visions of Ezekiel among the exiles beside the Kebar canal.',
      'It tells how Esther becomes queen and rescues Jews in Persia.',
      'A',
      'Chronicles retells earlier history with strong focus on David, temple worship, and restored hope.',
      80,
      76,
      -0.1
    ),
    (
      'section_competency|ot|esther_setting_001',
      'EST',
      'WRITINGS',
      'section_setting',
      'Which setting best fits Esther in the Old Testament storyline?',
      'Jews living in Persia face a threat of destruction and are delivered through Esther''s courage.',
      'Israel camps at Sinai and receives instructions for sacrifices and priests.',
      'Elijah challenges Baal prophets during Ahab''s reign in the northern kingdom.',
      'Joshua leads the people across the Jordan into Canaan.',
      'A',
      'Esther is set among Jews in the Persian Empire and explains deliverance remembered at Purim.',
      80,
      76,
      -0.1
    ),
    (
      'section_competency|ot|cross_chronology_earliest_001',
      'GEN',
      'OT',
      'cross_section_chronology',
      'Which event comes earliest in the Old Testament storyline?',
      'The tower of Babel',
      'The fall of Jericho',
      'David defeats Goliath',
      'Daniel is thrown into the lions'' den',
      'A',
      'Babel occurs in Genesis before the conquest, monarchy, and exile-era Daniel narratives.',
      84,
      82,
      -0.45
    ),
    (
      'section_competency|ot|cross_chronology_latest_001',
      'DAN',
      'OT',
      'cross_section_chronology',
      'Which event comes latest in the Old Testament storyline?',
      'Daniel is thrown into the lions'' den.',
      'The tower of Babel is built.',
      'The walls of Jericho fall.',
      'David defeats Goliath.',
      'A',
      'Daniel''s exile-era court story is later than Babel, Jericho, and David''s early life.',
      84,
      82,
      -0.4
    ),
    (
      'section_competency|ot|cross_before_division_001',
      '1SA',
      'OT',
      'relative_chronology',
      'Which event happens before the kingdom divides after Solomon?',
      'David defeats Goliath.',
      'Samaria falls to Assyria.',
      'Jerusalem falls to Babylon.',
      'Cyrus permits exiles to return.',
      'A',
      'David''s victory over Goliath occurs before David''s kingship, Solomon, and the later divided kingdom.',
      82,
      78,
      -0.35
    ),
    (
      'section_competency|ot|cross_sequence_001',
      '2KI',
      'OT',
      'cross_section_chronology',
      'Which sequence places these events from earliest to latest?',
      'Exodus from Egypt, fall of Jericho, David defeats Goliath, Jerusalem falls to Babylon',
      'Fall of Jericho, exodus from Egypt, Jerusalem falls to Babylon, David defeats Goliath',
      'David defeats Goliath, exodus from Egypt, fall of Jericho, Jerusalem falls to Babylon',
      'Jerusalem falls to Babylon, David defeats Goliath, fall of Jericho, exodus from Egypt',
      'A',
      'The exodus precedes conquest; conquest precedes David; David precedes Jerusalem''s fall to Babylon.',
      84,
      82,
      -0.35
    ),
    (
      'section_competency|ot|after_exile_001',
      'EZR',
      'OT',
      'relative_chronology',
      'Which event belongs after the Babylonian exile begins?',
      'Cyrus issues a decree allowing return and temple rebuilding.',
      'Abraham is called to leave his country.',
      'Israel crosses the Red Sea.',
      'Saul becomes Israel''s first king.',
      'A',
      'Cyrus''s decree belongs to the Persian-period return after Babylonian exile.',
      82,
      78,
      -0.25
    ),
    (
      'section_competency|ot|after_temple_001',
      '1KI',
      'OT',
      'relative_chronology',
      'Which event happens after Solomon builds the temple?',
      'The kingdom divides into Israel and Judah.',
      'Moses receives the law at Sinai.',
      'Joshua crosses the Jordan.',
      'Samuel anoints Saul as king.',
      'A',
      'The kingdom divides after Solomon''s reign and temple building.',
      80,
      76,
      -0.15
    ),
    (
      'section_competency|ot|restoration_period_001',
      'NEH',
      'OT',
      'section_period_discrimination',
      'Which period is described by return, rebuilding the temple, rebuilding Jerusalem''s wall, and covenant renewal?',
      'The post-exilic restoration period',
      'The patriarchal period',
      'The wilderness period',
      'The united monarchy',
      'A',
      'Return, temple rebuilding, wall rebuilding, and covenant renewal belong to the post-exilic restoration period.',
      82,
      78,
      -0.2
    ),
    (
      'section_competency|ot|which_between_001',
      'JOS',
      'OT',
      'relative_chronology',
      'Which event belongs between the exodus from Egypt and the rise of David?',
      'The fall of Jericho',
      'The tower of Babel',
      'The rebuilding of Jerusalem''s wall',
      'Daniel serves in Babylon',
      'A',
      'Jericho belongs to the conquest after the exodus and before the monarchy.',
      82,
      78,
      -0.25
    ),
    (
      'section_competency|ot|prophets_before_return_001',
      'JER',
      'OT',
      'relative_chronology',
      'Which event happens before the return from exile under Persian rule?',
      'Jeremiah warns Judah about Babylon.',
      'Nehemiah rebuilds Jerusalem''s wall.',
      'Ezra teaches the returned community.',
      'The second temple is completed.',
      'A',
      'Jeremiah''s warnings about Babylon precede the exile and later return under Persia.',
      81,
      78,
      -0.15
    ),
    (
      'section_competency|ot|section_bridge_001',
      '2CH',
      'OT',
      'section_bridge',
      'Which description best links Kings, Chronicles, and Ezra-Nehemiah in the larger story?',
      'Kings ends in exile, Chronicles retells the story with temple hope, and Ezra-Nehemiah follows return and rebuilding.',
      'Kings begins with creation, Chronicles gives Sinai law, and Ezra-Nehemiah narrates the conquest.',
      'Kings is wisdom poetry, Chronicles is prophetic vision, and Ezra-Nehemiah is patriarchal narrative.',
      'Kings explains Passover, Chronicles explains Balaam, and Ezra-Nehemiah explains the flood.',
      'A',
      'The larger movement is exile in Kings, temple-centered retelling in Chronicles, and return/rebuilding in Ezra-Nehemiah.',
      84,
      82,
      -0.25
    )
),
prepared as (
  select
    seed.*,
    case seed.correct_choice_id
      when 'A' then seed.choice_a
      when 'B' then seed.choice_b
      when 'C' then seed.choice_c
      when 'D' then seed.choice_d
    end as correct_answer
  from seed
)
insert into public.ot_generated_questions (
  event_id,
  question_type,
  payload,
  dedupe_key
)
select
  null,
  'section_competency_mcq_v1',
  jsonb_build_object(
    'prompt', prepared.prompt,
    'book_code', prepared.book_code,
    'section_key', prepared.section_key,
    'explanation', prepared.explanation,
    'choices', jsonb_build_array(
      jsonb_build_object('id', 'A', 'text', prepared.choice_a),
      jsonb_build_object(
        'id', 'B',
        'text', prepared.choice_b,
        'meta', jsonb_build_object(
          'distractor', jsonb_build_object(
            'plausibility', 'high',
            'relation', 'other_reviewed',
            'misconception_code', prepared.dedupe_key || '|B'
          )
        )
      ),
      jsonb_build_object(
        'id', 'C',
        'text', prepared.choice_c,
        'meta', jsonb_build_object(
          'distractor', jsonb_build_object(
            'plausibility', 'high',
            'relation', 'other_reviewed',
            'misconception_code', prepared.dedupe_key || '|C'
          )
        )
      ),
      jsonb_build_object(
        'id', 'D',
        'text', prepared.choice_d,
        'meta', jsonb_build_object(
          'distractor', jsonb_build_object(
            'plausibility', 'medium',
            'relation', 'other_reviewed',
            'misconception_code', prepared.dedupe_key || '|D'
          )
        )
      )
    ),
    'correct_choice_id', prepared.correct_choice_id,
    'correct_answer', prepared.correct_answer,
    'dimension_key', 'events_timeline',
    'question_layer', '1',
    'question_format', 'multiple_choice',
    'question_family', 'section_competency',
    'knowledge_granularity', 'section_overview',
    'retrieval_target', prepared.retrieval_target,
    'exact_chapter_recall_required', false,
    'baseline_eligible', true,
    'assessment_role', 'baseline',
    'source_batch', '20260815_section_competency_questions',
    'stem_family', prepared.dedupe_key,
    'distractor_contract_version', 1,
    'distractor_quality_reviewed', true,
    'length_tell_reviewed', true,
    'importance_conceptual', prepared.importance_conceptual,
    'importance_context', prepared.importance_context,
    'difficulty_estimate', round(500 + prepared.irt_b * 80),
    'irt_a', 1.05,
    'irt_b', prepared.irt_b
  ),
  prepared.dedupe_key
from prepared
where not exists (
  select 1
  from public.ot_generated_questions existing
  where existing.dedupe_key = prepared.dedupe_key
    and existing.question_type not like 'quarantined%'
);

do $$
declare
  inserted_count integer;
begin
  select count(*)
  into inserted_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' = '20260815_section_competency_questions'
    and question.question_type = 'section_competency_mcq_v1'
    and question.question_type not like 'quarantined%';

  if inserted_count <> 40 then
    raise exception 'Expected 40 active section competency questions, found %', inserted_count;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
