-- Baseline book-orientation questions for all 39 Old Testament books.
--
-- These items test whether a learner recognizes a book's broad narrative,
-- literary, or theological shape. They deliberately do not require exact
-- chapter-number recall. The existing BLI dimension still describes the kind
-- of knowledge being tested; question_family and knowledge_granularity record
-- the baseline book-level purpose.

begin;

do $$
begin
  if to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_biblical_books') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regclass('public.obs_admin_question_bank_audit') is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Book-orientation prerequisites are missing; no questions were inserted.';
  end if;
end
$$;

with seed (
  book_code,
  prompt,
  choice_a,
  choice_b,
  choice_c,
  choice_d,
  correct_choice_id,
  reference,
  explanation,
  dimension_key,
  importance_conceptual,
  importance_context,
  irt_b
) as (
  values
    (
      'GEN',
      'Which book moves from creation and the flood to the family stories of Abraham, Isaac, Jacob, and Joseph?',
      'Exodus', 'Genesis', 'Joshua', '1 Chronicles',
      'B', 'Genesis',
      'Genesis moves from primeval history to the patriarchs and the formation of Israel''s family.',
      'events_timeline', 95, 96, -1.50
    ),
    (
      'EXO',
      'Which book centers on Israel''s deliverance from Egypt, the covenant at Sinai, and the building of the tabernacle?',
      'Deuteronomy', 'Numbers', 'Exodus', 'Joshua',
      'C', 'Exodus',
      'Exodus joins deliverance from Egypt to covenant at Sinai and God''s dwelling among Israel.',
      'events_timeline', 95, 96, -1.45
    ),
    (
      'LEV',
      'Which book is organized largely around sacrifices, priesthood, ritual purity, and Israel''s call to holiness?',
      'Leviticus', 'Numbers', 'Deuteronomy', 'Ezekiel',
      'A', 'Leviticus',
      'Leviticus gives priestly, sacrificial, purity, and holiness instructions for Israel.',
      'law_commands', 88, 92, -1.30
    ),
    (
      'NUM',
      'Which book traces Israel''s wilderness journey through censuses, rebellions, judgments, and preparation to enter the land?',
      'Exodus', 'Joshua', 'Deuteronomy', 'Numbers',
      'D', 'Numbers',
      'Numbers follows the wilderness generation from Sinai toward the plains of Moab.',
      'events_timeline', 86, 90, -1.20
    ),
    (
      'DEU',
      'Which book presents Moses'' covenant-renewal speeches to Israel before the people enter the promised land?',
      'Leviticus', 'Deuteronomy', 'Exodus', 'Joshua',
      'B', 'Deuteronomy',
      'Deuteronomy records Moses'' final speeches renewing covenant instruction for the new generation.',
      'law_commands', 93, 94, -1.30
    ),
    (
      'JOS',
      'Which book follows Israel''s entry into Canaan, major campaigns, distribution of the land, and covenant renewal?',
      'Judges', 'Deuteronomy', 'Joshua', '1 Samuel',
      'C', 'Joshua',
      'Joshua narrates entry into the land, conquest, allotment, and covenant renewal.',
      'events_timeline', 91, 93, -1.35
    ),
    (
      'JDG',
      'Which book is organized around cycles of apostasy, oppression, crying out, and deliverance?',
      'Judges', 'Joshua', '1 Samuel', '2 Kings',
      'A', 'Judges 2:11-19; 3-16',
      'Judges repeatedly shows Israel turning away, suffering oppression, crying out, and receiving a deliverer.',
      'events_timeline', 92, 94, -1.35
    ),
    (
      'RUT',
      'Which book tells how a Moabite widow joins Israel, finds a redeemer in Bethlehem, and enters the family line of David?',
      'Esther', 'Judges', 'Song of Songs', 'Ruth',
      'D', 'Ruth',
      'Ruth follows Ruth and Boaz and closes by locating their family in David''s ancestry.',
      'characters_lineage', 78, 84, -1.15
    ),
    (
      '1SA',
      'Which book moves from Samuel''s leadership to Saul''s kingship and the rise of David?',
      '2 Samuel', '1 Samuel', 'Judges', '1 Kings',
      'B', '1 Samuel',
      'First Samuel narrates the transition from judges to monarchy through Samuel, Saul, and David.',
      'events_timeline', 91, 93, -1.35
    ),
    (
      '2SA',
      'Which book focuses on David''s reign, his covenant, his victories, and the severe consequences of his failures?',
      '1 Kings', '1 Samuel', '2 Samuel', '1 Chronicles',
      'C', '2 Samuel',
      'Second Samuel centers on David''s kingship, covenant, household conflict, and later troubles.',
      'events_timeline', 93, 94, -1.30
    ),
    (
      '1KI',
      'Which book begins with Solomon, the temple, and the kingdom''s division, then follows kings such as Ahab and prophets such as Elijah?',
      '1 Kings', '2 Kings', '2 Samuel', '2 Chronicles',
      'A', '1 Kings',
      'First Kings moves from Solomon and the temple to the divided kingdom and Elijah''s ministry.',
      'events_timeline', 93, 94, -1.25
    ),
    (
      '2KI',
      'Which book follows the decline of Israel and Judah through prophetic ministry until both kingdoms fall into exile?',
      '1 Kings', '1 Chronicles', '2 Chronicles', '2 Kings',
      'D', '2 Kings',
      'Second Kings narrates the later divided monarchy, the fall of Samaria, and finally Jerusalem''s exile.',
      'events_timeline', 93, 94, -1.20
    ),
    (
      '1CH',
      'Which book opens with extensive genealogies, retells David''s reign, and emphasizes his preparation for the temple?',
      '2 Chronicles', '1 Chronicles', 'Ezra', '2 Samuel',
      'B', '1 Chronicles',
      'First Chronicles connects Israel''s genealogies to David and his preparations for temple worship.',
      'events_timeline', 76, 82, -1.00
    ),
    (
      '2CH',
      'Which book begins with Solomon and the temple, concentrates on the kings of Judah, and ends with exile and Cyrus''s decree?',
      '1 Kings', 'Ezra', '2 Chronicles', '1 Chronicles',
      'C', '2 Chronicles',
      'Second Chronicles follows Solomon and Judah''s kings through exile to the decree permitting return.',
      'events_timeline', 82, 86, -1.00
    ),
    (
      'EZR',
      'Which book recounts returns from Babylon, the rebuilding of the temple, and later reform under a priestly scribe?',
      'Ezra', 'Nehemiah', 'Haggai', '2 Chronicles',
      'A', 'Ezra',
      'Ezra joins the restored temple with the later arrival and reforms of Ezra the scribe.',
      'events_timeline', 83, 88, -1.10
    ),
    (
      'NEH',
      'Which book centers on rebuilding Jerusalem''s walls and renewing the restored community''s covenant life?',
      'Ezra', 'Haggai', 'Zechariah', 'Nehemiah',
      'D', 'Nehemiah',
      'Nehemiah leads the wall project and participates in the community''s public renewal and reforms.',
      'events_timeline', 82, 87, -1.10
    ),
    (
      'EST',
      'Which book tells of Jewish deliverance in Persia through a queen and explains the celebration of Purim?',
      'Ruth', 'Esther', 'Daniel', 'Ezra',
      'B', 'Esther',
      'Esther narrates the reversal of a plot against the Jews and the origin of Purim.',
      'events_timeline', 77, 84, -1.20
    ),
    (
      'JOB',
      'Which book uses a righteous sufferer, debates with friends, and divine speeches to explore suffering and God''s justice?',
      'Ecclesiastes', 'Psalms', 'Job', 'Proverbs',
      'C', 'Job',
      'Job combines a suffering narrative with sustained debate and God''s response from the whirlwind.',
      'theological_reasoning', 84, 89, -1.20
    ),
    (
      'PSA',
      'Which book is a collection of prayers and songs of praise, lament, thanksgiving, trust, and royal hope?',
      'Psalms', 'Proverbs', 'Song of Songs', 'Isaiah',
      'A', 'Psalms',
      'Psalms gathers Israel''s songs and prayers across many forms and settings.',
      'theological_reasoning', 93, 95, -1.50
    ),
    (
      'PRO',
      'Which book gathers wisdom sayings and instructions about fearing the Lord and living with skill, justice, and self-control?',
      'Ecclesiastes', 'Job', 'Psalms', 'Proverbs',
      'D', 'Proverbs',
      'Proverbs presents wisdom instruction for conduct, speech, work, relationships, and justice.',
      'theological_reasoning', 89, 92, -1.40
    ),
    (
      'ECC',
      'Which book reflects on life under the sun, the limits of human toil, and the fleeting character of earthly gain?',
      'Job', 'Ecclesiastes', 'Proverbs', 'Song of Songs',
      'B', 'Ecclesiastes',
      'Ecclesiastes repeatedly examines toil, wisdom, pleasure, mortality, and what can truly be gained.',
      'theological_reasoning', 79, 85, -1.05
    ),
    (
      'SNG',
      'Which book is a collection of love poetry celebrating desire, beauty, longing, and mutual delight?',
      'Ruth', 'Ecclesiastes', 'Song of Songs', 'Psalms',
      'C', 'Song of Songs',
      'Song of Songs is poetic dialogue centered on love, desire, beauty, and longing.',
      'theological_reasoning', 70, 78, -0.95
    ),
    (
      'ISA',
      'Which prophetic book moves between judgment and hope while emphasizing Zion, a coming ruler, the Lord''s servant, and future restoration?',
      'Isaiah', 'Jeremiah', 'Ezekiel', 'Micah',
      'A', 'Isaiah',
      'Isaiah combines warnings of judgment with major promises concerning Zion, the servant, and restoration.',
      'promise_prophecy', 96, 96, -1.25
    ),
    (
      'JER',
      'Which prophetic book addresses Judah''s final years, warns of Babylon, portrays a suffering prophet, and promises a new covenant?',
      'Isaiah', 'Ezekiel', 'Lamentations', 'Jeremiah',
      'D', 'Jeremiah',
      'Jeremiah warns Judah before Jerusalem''s fall and includes the promise of a new covenant.',
      'promise_prophecy', 91, 93, -1.20
    ),
    (
      'LAM',
      'Which book is a collection of poetic laments over the destruction of Jerusalem?',
      'Psalms', 'Lamentations', 'Jeremiah', 'Joel',
      'B', 'Lamentations',
      'Lamentations grieves Jerusalem''s fall while wrestling with judgment, suffering, and hope.',
      'theological_reasoning', 79, 84, -1.10
    ),
    (
      'EZE',
      'Which prophetic book features visions among the exiles, the departure and return of God''s glory, and an extended vision of a restored temple?',
      'Jeremiah', 'Daniel', 'Ezekiel', 'Zechariah',
      'C', 'Ezekiel',
      'Ezekiel''s visions address exiles through judgment, divine glory, restoration, and a renewed temple.',
      'promise_prophecy', 89, 91, -1.10
    ),
    (
      'DAN',
      'Which book combines court narratives under foreign empires with symbolic visions of kingdoms and God''s final rule?',
      'Daniel', 'Ezekiel', 'Zechariah', 'Esther',
      'A', 'Daniel',
      'Daniel combines stories of faithfulness in imperial courts with visions concerning successive kingdoms.',
      'promise_prophecy', 89, 92, -1.25
    ),
    (
      'HOS',
      'Which prophetic book uses a troubled marriage as a central picture of Israel''s covenant unfaithfulness and the Lord''s restoring love?',
      'Amos', 'Micah', 'Malachi', 'Hosea',
      'D', 'Hosea',
      'Hosea''s marriage and family become signs of Israel''s unfaithfulness, judgment, and promised restoration.',
      'promise_prophecy', 80, 86, -1.05
    ),
    (
      'JOL',
      'Which prophetic book begins with a devastating locust plague, develops the day of the Lord, and promises the outpouring of God''s Spirit?',
      'Zephaniah', 'Joel', 'Amos', 'Obadiah',
      'B', 'Joel',
      'Joel interprets a locust disaster through the day of the Lord and promises the Spirit''s outpouring.',
      'promise_prophecy', 76, 83, -0.95
    ),
    (
      'AMO',
      'Which prophetic book condemns the northern kingdom for injustice and religious hypocrisy despite its prosperity?',
      'Hosea', 'Micah', 'Amos', 'Malachi',
      'C', 'Amos',
      'Amos announces judgment on Israel for oppression, injustice, and worship divorced from righteousness.',
      'promise_prophecy', 83, 88, -1.00
    ),
    (
      'OBA',
      'Which prophetic book is a short oracle of judgment against Edom for violence and pride toward Judah?',
      'Obadiah', 'Nahum', 'Joel', 'Zephaniah',
      'A', 'Obadiah',
      'Obadiah focuses on Edom''s pride and violence and announces the day of the Lord.',
      'promise_prophecy', 66, 75, -0.80
    ),
    (
      'JON',
      'Which book follows a reluctant prophet who flees his commission, is delivered from the sea, and finally preaches to Nineveh?',
      'Nahum', 'Habakkuk', 'Obadiah', 'Jonah',
      'D', 'Jonah',
      'Jonah narrates the prophet''s flight, deliverance, mission to Nineveh, and confrontation with divine compassion.',
      'events_timeline', 82, 88, -1.25
    ),
    (
      'MIC',
      'Which prophetic book alternates judgment and restoration for Samaria and Jerusalem and foretells a ruler from Bethlehem?',
      'Amos', 'Micah', 'Isaiah', 'Zechariah',
      'B', 'Micah',
      'Micah indicts both kingdoms while promising restoration and a ruler associated with Bethlehem.',
      'promise_prophecy', 80, 86, -0.95
    ),
    (
      'NAM',
      'Which prophetic book is an oracle celebrating the coming fall of Nineveh?',
      'Obadiah', 'Jonah', 'Nahum', 'Habakkuk',
      'C', 'Nahum',
      'Nahum announces and vividly portrays Nineveh''s downfall.',
      'promise_prophecy', 68, 77, -0.85
    ),
    (
      'HAB',
      'Which prophetic book takes the form of a dialogue about violence and injustice before ending in a prayer of trust?',
      'Habakkuk', 'Nahum', 'Zephaniah', 'Joel',
      'A', 'Habakkuk',
      'Habakkuk questions God about injustice, receives answers concerning Babylon, and closes with trusting prayer.',
      'theological_reasoning', 77, 84, -0.95
    ),
    (
      'ZEP',
      'Which prophetic book emphasizes the day of the Lord as judgment while also promising purification and restoration for a humble remnant?',
      'Joel', 'Nahum', 'Habakkuk', 'Zephaniah',
      'D', 'Zephaniah',
      'Zephaniah develops the day of the Lord through judgment, purification, and restored rejoicing.',
      'promise_prophecy', 71, 79, -0.85
    ),
    (
      'HAG',
      'Which prophetic book urges the returned exiles to stop neglecting the rebuilding of the temple?',
      'Zechariah', 'Haggai', 'Ezra', 'Malachi',
      'B', 'Haggai',
      'Haggai challenges the restored community to prioritize rebuilding the Lord''s house.',
      'promise_prophecy', 72, 81, -0.90
    ),
    (
      'ZEC',
      'Which prophetic book combines night visions, encouragement to rebuild the temple, and promises concerning a future king and restoration?',
      'Haggai', 'Malachi', 'Zechariah', 'Ezekiel',
      'C', 'Zechariah',
      'Zechariah''s visions and oracles encourage restoration while looking toward future kingship and renewal.',
      'promise_prophecy', 83, 88, -0.95
    ),
    (
      'MAL',
      'Which prophetic book uses a series of disputes about corrupt worship and covenant faithfulness and promises a coming messenger?',
      'Malachi', 'Haggai', 'Zechariah', 'Nehemiah',
      'A', 'Malachi',
      'Malachi confronts compromised worship and faithfulness and closes with expectation of a coming messenger.',
      'promise_prophecy', 83, 88, -1.00
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
    end as correct_answer,
    'book_orientation|' || seed.book_code || '|overview' as dedupe_key
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
  'book_orientation_mcq_v1',
  jsonb_build_object(
    'prompt', prepared.prompt,
    'book_code', prepared.book_code,
    'reference', prepared.reference,
    'explanation', prepared.explanation,
    'choices', jsonb_build_array(
      jsonb_build_object('id', 'A', 'text', prepared.choice_a),
      jsonb_build_object('id', 'B', 'text', prepared.choice_b),
      jsonb_build_object('id', 'C', 'text', prepared.choice_c),
      jsonb_build_object('id', 'D', 'text', prepared.choice_d)
    ),
    'correct_choice_id', prepared.correct_choice_id,
    'correct_answer', prepared.correct_answer,
    'dimension_key', prepared.dimension_key,
    'question_layer', '1',
    'question_format', 'multiple_choice',
    'question_family', 'book_orientation',
    'knowledge_granularity', 'book_overview',
    'retrieval_target', 'book_identity',
    'exact_chapter_recall_required', false,
    'baseline_eligible', true,
    'source_batch', '20260726_book_orientation_baseline_questions',
    'stem_family', 'book_orientation|' || prepared.book_code,
    'importance_conceptual', prepared.importance_conceptual,
    'importance_context', prepared.importance_context,
    'difficulty_estimate', round(500 + prepared.irt_b * 80),
    'irt_a', 1.0,
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
  active_count integer;
  book_count integer;
  blocked_count integer;
  blocked_sample text;
begin
  select
    count(*),
    count(distinct payload->>'book_code')
  into active_count, book_count
  from public.ot_generated_questions
  where question_type = 'book_orientation_mcq_v1'
    and payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions';

  select
    count(*),
    string_agg(
      format(
        '%s/%s:%s',
        audit.book_code,
        audit.dimension_key,
        array_to_string(audit.blocker_reasons, ',')
      ),
      '; '
      order by audit.book_code
    )
  into blocked_count, blocked_sample
  from public.obs_admin_question_bank_audit audit
  where audit.question_type = 'book_orientation_mcq_v1'
    and audit.payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions'
    and (
      cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
    );

  if active_count <> 39
     or book_count <> 39
     or blocked_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Book-orientation seed failed: active=%s/39 books=%s/39 blocked=%s (%s).',
        active_count,
        book_count,
        blocked_count,
        coalesce(blocked_sample, 'no sample')
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
