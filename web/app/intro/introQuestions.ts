import { BIBLE_BOOKS, type BibleSectionKey } from "@/lib/bibleTaxonomy";

/**
 * Real sample questions, one per book, pulled from the live question bank
 * (`public.v_question_bank`, highest routing_score per book, prompts short
 * enough to fit the hover card).
 *
 * They are baked in rather than fetched at runtime, deliberately. The bank is
 * not readable by `anon` or `authenticated` — the assessment serves items
 * through a security-definer path — so putting these on a public marketing
 * page live would mean granting the internet read access to the question set.
 * That is a one-way door: once all ~1,500 prompts can be scraped, anyone can
 * pre-study the exact items, which is precisely what an adaptive assessment
 * must not allow, and it cannot be undone by revoking the grant later.
 *
 * Prompts only. No options and no answers are stored here or shown anywhere,
 * and the card that displays them is labelled as a sample.
 *
 * To refresh, re-run against the project:
 *
 *   with ranked as (
 *     select book_code, prompt,
 *            row_number() over (partition by book_code
 *                               order by routing_score desc nulls last) as rn
 *     from v_question_bank
 *     where prompt is not null
 *       and length(prompt) between 28 and 88
 *       and prompt like '%?'
 *   )
 *   select book_code, prompt from ranked where rn = 1 order by book_code;
 */

export type SampleQuestion = { book: string; prompt: string };

export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  { book: "1CH", prompt: "Which description best fits the broad focus of Chronicles?" },
  { book: "1CO", prompt: "According to 1 Corinthians 15, what follows if Christ has not been raised?" },
  { book: "1JN", prompt: "What does 1 John command believers to do rather than believe every spirit?" },
  { book: "1KI", prompt: "Which geographic division becomes central after Solomon's death in 1 Kings?" },
  { book: "1PE", prompt: "Through what event does God give believers a living hope?" },
  { book: "1SA", prompt: "Which book moves from Samuel's leadership to Saul's kingship and the rise of David?" },
  { book: "1TH", prompt: "Whom did Paul send to establish and encourage the Thessalonians in their faith?" },
  { book: "1TI", prompt: "What reason does Paul give for writing the preceding instructions in 1 Timothy 3?" },
  { book: "2CH", prompt: "Which geographic and political center receives the main attention in 2 Chronicles?" },
  { book: "2CO", prompt: "What does Paul command the Corinthians to examine and test in 2 Corinthians 13:5?" },
  { book: "2JN", prompt: "How does 2 John define love immediately after repeating the command to love one another?" },
  { book: "2KI", prompt: "Which two royal capitals fall to foreign empires in 2 Kings?" },
  { book: "2PE", prompt: "What did Peter and the other eyewitnesses hear on the holy mountain?" },
  { book: "2SA", prompt: "When David wanted to build a temple for God, what did God promise in response?" },
  { book: "2TH", prompt: "What rule had Paul given concerning a person who is unwilling to work?" },
  { book: "2TI", prompt: "What does Paul tell Timothy to do with the teaching he heard before many witnesses?" },
  { book: "3JN", prompt: "What pattern does the elder tell Gaius to imitate?" },
  { book: "ACT", prompt: "What does Jesus promise the disciples will receive when the Holy Spirit comes upon them?" },
  { book: "AMO", prompt: "Which geographic contrast helps locate Amos's ministry?" },
  { book: "COL", prompt: "How does Colossians 3:16 say the word of Christ should dwell among believers?" },
  { book: "DAN", prompt: "Which setting best describes the court narratives in Daniel?" },
  { book: "DEU", prompt: "What is the Shema, Israel's central confession from Deuteronomy 6?" },
  { book: "ECC", prompt: "What does Ecclesiastes 3 say there is for every matter?" },
  { book: "EPH", prompt: "What time-related limit does Ephesians place on anger?" },
  { book: "EST", prompt: "Where does most of the court action in Esther take place?" },
  { book: "EXO", prompt: "Which place is not a major setting in Exodus?" },
  { book: "EZE", prompt: "Which two locations frame much of Ezekiel's prophetic perspective?" },
  { book: "EZR", prompt: "Which movement provides the broad geographic frame for Ezra?" },
  { book: "GAL", prompt: "Which two women does Paul use in Galatians 4 when speaking of two covenants?" },
  { book: "GEN", prompt: "Who was the father of Judah?" },
  { book: "HAB", prompt: "Which geopolitical setting drives Habakkuk's complaints and the LORD's answer?" },
  { book: "HAG", prompt: "Which city and building project provide the setting for Haggai?" },
  { book: "HEB", prompt: "What does Hebrews 10 tell believers not to neglect as the Day draws near?" },
  { book: "HOS", prompt: "Hosea's prophetic ministry is directed chiefly to which kingdom?" },
  { book: "ISA", prompt: "Which city and region form the central earthly setting of Isaiah's warnings and hopes?" },
  { book: "JAS", prompt: "What contrast does James 1 use to command an active response to the word?" },
  { book: "JDG", prompt: "Which setting best describes most of the events in Judges?" },
  { book: "JER", prompt: "Which geographic movement best fits the closing crisis of Jeremiah?" },
  { book: "JHN", prompt: "What is Jesus' first sign in John?" },
  { book: "JOB", prompt: "Who is the righteous sufferer at the center of the book of Job?" },
  { book: "JOL", prompt: "Which place is central to Joel's calls to repentance and promises of deliverance?" },
  { book: "JON", prompt: "Which route best summarizes Jonah's geographic movement?" },
  { book: "JOS", prompt: "What role did Joshua play in relation to Moses and Israel?" },
  { book: "JUD", prompt: "What does Jude urge believers to do?" },
  { book: "LAM", prompt: "Which city's destruction provides the setting and subject of Lamentations?" },
  { book: "LEV", prompt: "Where are the instructions of Leviticus situated within Israel's journey?" },
  { book: "LUK", prompt: "What does Mary do after receiving Gabriel's announcement?" },
  { book: "MAL", prompt: "Which failure repeatedly concerns Malachi?" },
  { book: "MAT", prompt: "What material opens Matthew before the birth narrative?" },
  { book: "MIC", prompt: "Which two capitals frame Micah's indictments of Israel and Judah?" },
  { book: "MRK", prompt: "With whom does Mark's narrative begin after its title and prophetic citation?" },
  { book: "NAM", prompt: "Which city's fall is the geographic focus of Nahum?" },
  { book: "NEH", prompt: "Which journey begins Nehemiah's work?" },
  { book: "NUM", prompt: "What was the disagreement between the ten spies and Caleb/Joshua?" },
  { book: "OBA", prompt: "Which two lands stand in sharp opposition in Obadiah?" },
  { book: "PHM", prompt: "Whom does Paul call his child, whose father he became while imprisoned?" },
  { book: "PHP", prompt: "What practice does Philippians 4 set against anxiety?" },
  { book: "PRO", prompt: "Which cluster best fits the Old Testament wisdom books?" },
  { book: "PSA", prompt: "What central metaphor governs Psalm 23, and what does it affirm about God?" },
  { book: "REV", prompt: "On what island was John when he received the vision addressed to the seven churches?" },
  { book: "ROM", prompt: "What instruction concludes Paul's teaching about responding to evil in Romans 12?" },
  { book: "RUT", prompt: "Which movement provides the geographic frame for Ruth?" },
  { book: "SNG", prompt: "What is the Song of Songs, and how has it been interpreted within the canon?" },
  { book: "TIT", prompt: "Where did Paul leave Titus to put what remained in order and appoint elders?" },
  { book: "ZEC", prompt: "Zechariah addresses a returned community centered on which city and project?" },
  { book: "ZEP", prompt: "During whose reign does Zephaniah locate his prophetic ministry?" },
];

/**
 * Grouped by section, so a star can offer a question from its own part of the
 * canon — hovering in the Torah asks about the Torah.
 */
export const QUESTIONS_BY_SECTION: Record<BibleSectionKey, string[]> = (() => {
  const sectionOf = new Map(BIBLE_BOOKS.map(b => [b.code, b.sectionKey]));
  const out = {
    TORAH: [], FORMER: [], LATTER: [], WRITINGS: [],
    GOSPELS_ACTS: [], PAULINE: [], GENERAL: [], APOCALYPSE: [],
  } as Record<BibleSectionKey, string[]>;
  for (const q of SAMPLE_QUESTIONS) {
    const key = sectionOf.get(q.book);
    if (key) out[key].push(q.prompt);
  }
  return out;
})();
