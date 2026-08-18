// Extracted from app/page.tsx during a file-size cleanup (2026-08-16).
// Pure helper functions, types, and storage-key constants used by the homepage.
// No behavior change intended — this is a straight relocation.

import { loadPublicQuestionMetadata, type PublicQuestionMetadataRow } from "@/lib/supabase/questionMetadata";
import { clearPendingTransfer } from "@/lib/auth/anonymousTransfer";
import { BLI_LEVELS, toDisplayScore } from "@/lib/bli";
import {
  poolBliSections,
  testamentHeadlineAsSection,
  type BliContractScores,
  type BliSectionScore,
} from "@/lib/bliContract";
import {
  SECTION_INTERPRETATION_FLOOR,
  sectionEvidence,
} from "@/lib/bliEvidence";
import {
  BIBLE_BOOKS,
  OT_BOOK_CODES,
  NT_BOOK_CODES,
  SECTION_BOOKS,
  sectionForBook,
  testamentForBook,
  type Testament as BibleTestament,
} from "@/lib/bibleTaxonomy";

export const SKY_SEED_KEY = "obs_sky_seed";
export const ANON_SESSION_ACTIVE_KEY = "obs_anon_session_active";
export const ANON_USER_ID_KEY = "obs_anon_user_id";
export const SESSION_ANSWERED_KEY = "obs_session_answered";
export const SESSION_CORRECT_KEY = "obs_session_correct";
export const OT_ATTEMPT_ID_KEY = "obs_ot_attempt_id";
export const NT_ATTEMPT_ID_KEY = "obs_nt_attempt_id";
export const RECOMMENDATION_RETEST_WAIT_MS = 20 * 60 * 1000;

export function isAnonymousSession(session: { user?: { email?: string | null } } | null) {
  return Boolean(session?.user && !session.user.email);
}

export function clearAssessmentBrowserStorage() {
  // A pending transfer capability is guest-session state and must die with it.
  // This function is the single cleanup path for sign-out, account deletion and
  // stale-anonymous-session reaping, so clearing here covers all three; leaving
  // a record behind would let the next person to sign in on this browser claim
  // the previous visitor's progress.
  clearPendingTransfer(localStorage);
  localStorage.removeItem("obs_answered");
  localStorage.removeItem("obs_correct");
  localStorage.removeItem("obs_attempt_id");
  localStorage.removeItem("obs_user_id");
  localStorage.removeItem(ANON_USER_ID_KEY);
  sessionStorage.removeItem(ANON_SESSION_ACTIVE_KEY);
  sessionStorage.removeItem(ANON_USER_ID_KEY);
  sessionStorage.removeItem(SESSION_ANSWERED_KEY);
  sessionStorage.removeItem(SESSION_CORRECT_KEY);
  sessionStorage.removeItem(OT_ATTEMPT_ID_KEY);
  sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
}

export function readSessionAssessmentData() {
  if (typeof window === "undefined") return null;
  const answered = Number(sessionStorage.getItem(SESSION_ANSWERED_KEY) || 0);
  const correct = Number(sessionStorage.getItem(SESSION_CORRECT_KEY) || 0);
  if (!Number.isFinite(answered) || !Number.isFinite(correct) || answered <= 0) return null;
  return {
    answered,
    correct: Math.max(0, Math.min(correct, answered)),
    bli: Math.round((Math.max(0, Math.min(correct, answered)) / answered) * 100),
  };
}

export function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export function getOrCreateSkySeed() {
  if (typeof window === "undefined") return 1;
  const existing = sessionStorage.getItem(SKY_SEED_KEY);
  if (existing) return Number(existing) || 1;
  const seed = Math.floor(Math.random() * 4294967295) || 1;
  sessionStorage.setItem(SKY_SEED_KEY, String(seed));
  return seed;
}

export function coneMarkerPercent(s: number): number {
  const bandIndex = BLI_LEVELS.findIndex(b => s >= b.min && s <= b.max);
  const safeBandIndex = bandIndex === -1 ? (s < BLI_LEVELS[0].min ? 0 : BLI_LEVELS.length - 1) : bandIndex;
  const band = BLI_LEVELS[safeBandIndex];
  const span = Math.max(1, band.max - band.min);
  const withinBand = Math.max(0, Math.min(1, (s - band.min) / span));
  const visualIndexFromTop = BLI_LEVELS.length - 1 - safeBandIndex;
  return ((visualIndexFromTop + (1 - withinBand)) / BLI_LEVELS.length) * 100;
}
export function formatProgressDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
export function formatScoreChange(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

const SECTION_RECOMMENDATIONS = [
  { name: "Torah", books: "Genesis - Deuteronomy", focus: "Rebuild the narrative spine from creation, covenant, exodus, Sinai, and wilderness into Deuteronomy.", priority: "Start here because later Old Testament history assumes this foundation." },
  { name: "Former Prophets", books: "Joshua - Kings", focus: "Trace Israel's settlement, monarchy, division, decline, and exile as one connected historical arc.", priority: "This is the next major narrative layer after Torah." },
  { name: "Latter Prophets", books: "Isaiah - Malachi", focus: "Connect prophetic messages to covenant failure, exile, restoration hope, and the coming kingdom.", priority: "Prophets make the most sense once the historical timeline is stable." },
  { name: "Writings", books: "Psalms, Proverbs, Job...", focus: "Deepen wisdom, worship, lament, poetry, and post-exilic reflection.", priority: "This strengthens texture and theology after the main chronology is clearer." },
];
const BOOK_FOCUS_RANGES: Record<string, { label: string; range: string; start: number; end: number; focus: string }> = {
  GEN: { label: "Genesis", range: "Genesis 12-50", start: 12, end: 50, focus: "Focus on Abraham, Isaac, Jacob, Joseph, covenant promises, and the family line that frames the rest of the Old Testament." },
  EXO: { label: "Exodus", range: "Exodus 1-20", start: 1, end: 20, focus: "Focus on Israel in Egypt, Moses, the plagues, the exodus, Sinai, and the Ten Commandments." },
  LEV: { label: "Leviticus", range: "Leviticus 1-16", start: 1, end: 16, focus: "Focus on sacrifice, priesthood, purity, holiness, and the Day of Atonement." },
  NUM: { label: "Numbers", range: "Numbers 10-25", start: 10, end: 25, focus: "Focus on the wilderness journey, rebellion, intercession, Balaam, and covenant failure before the land." },
  DEU: { label: "Deuteronomy", range: "Deuteronomy 5-30", start: 5, end: 30, focus: "Focus on covenant renewal, law, blessing and curse, and Moses' final instruction before entry into the land." },
  JOS: { label: "Joshua", range: "Joshua 1-12", start: 1, end: 12, focus: "Focus on crossing the Jordan, conquest narratives, covenant faithfulness, and Israel entering the land." },
  JDG: { label: "Judges", range: "Judges 2-16", start: 2, end: 16, focus: "Focus on Israel's cycle of decline, deliverance, and the major judges." },
  RUT: { label: "Ruth", range: "Ruth 1-4", start: 1, end: 4, focus: "Focus on covenant loyalty, providence, redemption, and Ruth's place in David's line." },
  "1SA": { label: "1 Samuel", range: "1 Samuel 8-31", start: 8, end: 31, focus: "Focus on Samuel, Saul, David's rise, kingship, and the transition into monarchy." },
  "2SA": { label: "2 Samuel", range: "2 Samuel 5-12", start: 5, end: 12, focus: "Focus on David's reign, Jerusalem, covenant promise, sin, and royal consequences." },
  "1KI": { label: "1 Kings", range: "1 Kings 1-19", start: 1, end: 19, focus: "Focus on Solomon, the divided kingdom, temple, idolatry, Elijah, and covenant decline." },
  "2KI": { label: "2 Kings", range: "2 Kings 17-25", start: 17, end: 25, focus: "Focus on Israel and Judah's fall, exile, and the covenant meaning of the kingdoms' collapse." },
  ISA: { label: "Isaiah", range: "Isaiah 1-12", start: 1, end: 12, focus: "Focus on judgment, holiness, remnant hope, and the promised king." },
  JER: { label: "Jeremiah", range: "Jeremiah 1-31", start: 1, end: 31, focus: "Focus on covenant indictment, exile warnings, and new covenant hope." },
  EZE: { label: "Ezekiel", range: "Ezekiel 1-37", start: 1, end: 37, focus: "Focus on exile, God's glory, judgment, restoration, and the valley of dry bones." },
  DAN: { label: "Daniel", range: "Daniel 1-7", start: 1, end: 7, focus: "Focus on exile faithfulness, kingdoms, visions, and God's rule over history." },
  PSA: { label: "Psalms", range: "Psalms 1-41", start: 1, end: 41, focus: "Focus on wisdom, lament, kingship, trust, and worship in Book 1 of Psalms." },
  PRO: { label: "Proverbs", range: "Proverbs 1-9", start: 1, end: 9, focus: "Focus on wisdom, fear of the LORD, instruction, folly, and moral formation." },
  JOB: { label: "Job", range: "Job 1-14", start: 1, end: 14, focus: "Focus on suffering, righteousness, lament, and the opening dispute over God's justice." },
};

export type SectionScoreMap = Record<string, {
  accuracy_pct: number;
  raw_bli_pct: number;
  total: number;
}>;
export type BreakdownTab = "sections" | "books" | "domains";
export type DashboardTab = "bli" | "church-history" | "biblical-languages";
export type AssessmentSnapshot = { answered: number; correct: number; bli?: number };
export type RecommendedStudy = {
  label: string;
  books: string;
  focus: string;
  priority: string;
  actionHref: string;
  actionLabel: string;
};
export type ScopeKind = "canon" | "section" | "book" | "domain";
export type ScopeScore = {
  key: string;
  label: string;
  subtitle: string;
  kind: ScopeKind;
  className: string;
  testament: BibleTestament;
  backendScopeKey: string;
  rawScore: number | null;
  displayScore: number | null;
  answered: number;
  correct: number;
  confidence: "none" | "low" | "moderate" | "high";
};
export type ScopeSummary = {
  scope_type: string;
  scope_key: string;
  answered: number;
  correct: number;
  idk: number;
  accuracy: number | null;
  first_answered_at: string | null;
  last_answered_at: string | null;
  evidence_level: "Needs more evidence" | "Low evidence" | "Moderate evidence" | "High evidence";
  books: Array<{
    book_code: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
  dimensions: Array<{
    dimension_key: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
};
export type ScopeDetailTarget = {
  scopeType: "TESTAMENT" | "SECTION" | "BOOK" | "DIMENSION" | "UNIT";
  scopeKey: string;
  label: string;
  subtitle: string;
  unitKey?: string;
};
export type BankRow = PublicQuestionMetadataRow;
export type AnswerRow = {
  generated_question_id: string | null;
  is_correct: boolean;
  is_idk?: boolean | null;
  scoring_eligible?: boolean | null;
};
export type BackendRecommendation = {
  unit_key: string;
  label: string;
  section: string;
  book_code: string;
  start_chapter: number;
  end_chapter: number;
  answered: number;
  display_score: number | null;
  retest_question_target: number;
  focus_text: string;
  reason: string;
  recommendation_kind: "UNIT" | "DIMENSION";
  dimension_key: string | null;
  dimension_label: string | null;
  dimension_short_label: string | null;
  dimension_answered: number | null;
  dimension_correct: number | null;
  dimension_display_score: number | null;
  dimension_available_questions: number | null;
  dimension_focus_text: string | null;
};
export type BliEvidence = {
  scope: string;
  theta: number;
  theta_se: number;
  theta_lower_95: number;
  theta_upper_95: number;
  n_responses: number;
  evidence_level: "Very limited" | "Limited" | "Developing" | "Strong" | "Very strong";
  evidence_description: string;
};
export type BliSectionFollowup = {
  scoring_version: "bli_weighted_v2";
  testament: BibleTestament;
  section_name: string;
  scope_key: string;
  answered: number;
  minimum_reliable_answers: number;
  established_answers: number;
  answers_needed: number;
  suggested_question_count: number;
  evidence_status: "provisional" | "developing" | "established";
  is_provisional: boolean;
};
export type ProgressPoint = {
  attempt_id: string;
  captured_at: string;
  raw_bli: number;
  display_bli: number;
  bli_level: string;
  questions_answered: number;
  correct_answers: number;
  idk_answers: number;
  theta: number | null;
  theta_se: number | null;
  n_responses: number;
  score_change: number;
};
export type NtPilotSummary = {
  answered: number;
  correct: number;
  accuracy: number;
  scope: string;
  booksAttempted: number;
  updatedAt: string;
};
const SECTION_META = [
  { key: "ot", label: "Old Testament", subtitle: "Genesis - Malachi", kind: "canon" as const, className: "ot", testament: "OT" as const, backendScopeKey: "OT", books: OT_BOOK_CODES },
  { key: "torah", label: "Torah", subtitle: "Genesis - Deuteronomy", kind: "section" as const, className: "torah", testament: "OT" as const, backendScopeKey: "Torah", books: SECTION_BOOKS.Torah },
  { key: "prophets", label: "Prophets", subtitle: "Former + Latter Prophets", kind: "section" as const, className: "prophets", testament: "OT" as const, backendScopeKey: "Prophets", books: [...SECTION_BOOKS["Former Prophets"], ...SECTION_BOOKS["Latter Prophets"]] },
  { key: "former", label: "Former Prophets", subtitle: "Joshua - Kings", kind: "section" as const, className: "former", testament: "OT" as const, backendScopeKey: "Former Prophets", books: SECTION_BOOKS["Former Prophets"] },
  { key: "latter", label: "Latter Prophets", subtitle: "Isaiah - Malachi", kind: "section" as const, className: "latter", testament: "OT" as const, backendScopeKey: "Latter Prophets", books: SECTION_BOOKS["Latter Prophets"] },
  { key: "writings", label: "Writings", subtitle: "Psalms, Proverbs, Job...", kind: "section" as const, className: "writings", testament: "OT" as const, backendScopeKey: "Writings", books: SECTION_BOOKS.Writings },
  { key: "nt", label: "New Testament", subtitle: "Matthew - Revelation", kind: "canon" as const, className: "nt", testament: "NT" as const, backendScopeKey: "NT", books: NT_BOOK_CODES },
  { key: "gospels-acts", label: "Gospels & Acts", subtitle: "Matthew - Acts", kind: "section" as const, className: "gospels", testament: "NT" as const, backendScopeKey: "GOSPELS_ACTS", books: SECTION_BOOKS["Gospels & Acts"] },
  { key: "pauline", label: "Pauline Epistles", subtitle: "Romans - Philemon", kind: "section" as const, className: "pauline", testament: "NT" as const, backendScopeKey: "PAULINE", books: SECTION_BOOKS["Pauline Epistles"] },
  { key: "general", label: "General Epistles", subtitle: "Hebrews - Jude", kind: "section" as const, className: "general", testament: "NT" as const, backendScopeKey: "GENERAL", books: SECTION_BOOKS["General Epistles"] },
  { key: "revelation", label: "Revelation", subtitle: "Revelation", kind: "section" as const, className: "revelation", testament: "NT" as const, backendScopeKey: "APOCALYPSE", books: SECTION_BOOKS.Apocalypse },
];
const DOMAIN_META = [
  { key: "characters", backendKey: "characters_lineage", label: "Characters & Lineage", match: (type: string) => type.includes("relationship") || type.includes("people") || type.includes("lineage") || type.includes("genealogy") },
  { key: "events", backendKey: "events_timeline", label: "Events & Timeline", match: (type: string) => type.includes("primary") || type.includes("chronology") || type.includes("sequence") || type.includes("numeric") },
  { key: "geography", backendKey: "geography_nations", label: "Geography & Nations", match: (type: string) => type.includes("geography") || type.includes("location") || type.includes("nation") || type.includes("empire") },
  { key: "law", backendKey: "law_commands", label: "Law & Commands", match: (type: string) => type.includes("command") || type.includes("law") || type.includes("covenant_curse") },
  { key: "speech", backendKey: "promise_prophecy", label: "Promise & Prophecy", match: (type: string) => type.includes("speech") || type.includes("promise") || type.includes("prophecy") || type.includes("prophetic") },
  { key: "significance", backendKey: "theological_reasoning", label: "Theological Reasoning", match: (type: string) => type.includes("significance") || type.includes("concept") || type.includes("wisdom") || type.includes("theological") },
  { key: "scripture_connections", backendKey: "structure_cross_ref", label: "Cross Ref", match: (type: string) => type.includes("scripture_connection") || type.includes("cross_ref") || type.includes("intertextual") },
];
export type KnowledgeGapResource = { label: string; href: string };
export type KnowledgeGapGuidance = {
  label: string;
  steps: string[];
  resources?: KnowledgeGapResource[];
};
export type KnowledgeGapGuidanceOverride = Partial<KnowledgeGapGuidance>;

const DIMENSION_GUIDANCE: Record<string, KnowledgeGapGuidance> = {
  characters_lineage: {
    label: "What to practice",
    steps: [
      "Name the main people in the passage and how they relate to each other.",
      "Track family lines, allies, rivals, and succession.",
      "Ask which person carries the promise, threat, or covenant story forward.",
    ],
    resources: [
      { label: "Character in biblical narrative", href: "https://bibleproject.com/videos/character-biblical-narrative/" },
    ],
  },
  events_timeline: {
    label: "What to practice",
    steps: [
      "Put the major events in order before worrying about small details.",
      "Notice what changes after each event: location, leader, covenant status, or conflict.",
      "Retell the passage as a short sequence from memory.",
    ],
    resources: [
      { label: "Plot in biblical narrative", href: "https://bibleproject.com/videos/plot-biblical-narrative/" },
    ],
  },
  geography_nations: {
    label: "What to practice",
    steps: [
      "Find the places, regions, rivers, roads, and neighboring peoples named in the passage.",
      "Trace movement on a map and ask why the location matters to the story.",
      "Connect nations or territories to the conflicts, promises, and alliances in the passage.",
    ],
    resources: [
      { label: "OpenBible maps", href: "https://www.openbible.info/geo/" },
      { label: "Bible Hub Atlas", href: "https://biblehub.com/atlas/" },
      { label: "Setting in biblical narrative", href: "https://bibleproject.com/videos/setting-biblical-narrative/" },
    ],
  },
  law_commands: {
    label: "What to practice",
    steps: [
      "Look for commands, prohibitions, covenant signs, blessings, curses, and obligations.",
      "Ask who receives the command, what obedience requires, and what consequence is attached.",
      "In narrative books, notice where a command is obeyed, ignored, repeated, or broken.",
    ],
    resources: [
      { label: "Biblical law overview", href: "https://bibleproject.com/videos/law/" },
      { label: "Covenants guide", href: "https://bibleproject.com/guides/covenants/" },
    ],
  },
  promise_prophecy: {
    label: "What to practice",
    steps: [
      "Identify promises, warnings, blessings, curses, and speeches from God or his messengers.",
      "Ask who receives the word, what future it announces, and what response it calls for.",
      "Track whether the passage shows the promise beginning, threatened, delayed, or fulfilled.",
    ],
    resources: [
      { label: "Covenants guide", href: "https://bibleproject.com/guides/covenants/" },
      { label: "Prophecy podcast", href: "https://bibleproject.com/podcasts/what-prophecy/" },
    ],
  },
  theological_reasoning: {
    label: "What to practice",
    steps: [
      "Ask what the passage reveals about God, sin, covenant, judgment, mercy, or wisdom.",
      "Explain why the event matters, not only what happened.",
      "Connect repeated themes to the larger movement of the book.",
    ],
    resources: [
      { label: "BibleProject guides", href: "https://bibleproject.com/guides/" },
      { label: "Free BibleProject classes", href: "https://bibleproject.com/classroom/" },
    ],
  },
  structure_cross_ref: {
    label: "What to practice",
    steps: [
      "Notice repeated phrases, patterns, echoes, and callbacks to earlier passages.",
      "Ask how this passage depends on what came before it.",
      "Compare the passage with one related text before retesting.",
    ],
    resources: [
      { label: "Design patterns", href: "https://bibleproject.com/classroom/introduction-to-the-hebrew-bible/modules/5" },
      { label: "BibleProject guides", href: "https://bibleproject.com/guides/" },
    ],
  },
};
const BOOK_DIMENSION_GUIDANCE: Record<string, Record<string, KnowledgeGapGuidanceOverride>> = {
  GEN: {
    law_commands: {
      resources: [
        { label: "Genesis guide", href: "https://bibleproject.com/guides/book-of-genesis/" },
        { label: "Covenants in Genesis", href: "https://bibleproject.com/guides/covenants/" },
      ],
    },
    promise_prophecy: {
      resources: [
        { label: "Genesis guide", href: "https://bibleproject.com/guides/book-of-genesis/" },
        { label: "Covenants guide", href: "https://bibleproject.com/guides/covenants/" },
      ],
    },
    characters_lineage: {
      resources: [
        { label: "Genesis guide", href: "https://bibleproject.com/guides/book-of-genesis/" },
      ],
    },
  },
  EXO: {
    law_commands: {
      resources: [
        { label: "Exodus guide", href: "https://bibleproject.com/guides/book-of-exodus/" },
        { label: "Covenants guide", href: "https://bibleproject.com/guides/covenants/" },
      ],
    },
    geography_nations: {
      resources: [
        { label: "Exodus guide", href: "https://bibleproject.com/guides/book-of-exodus/" },
        { label: "OpenBible maps", href: "https://www.openbible.info/geo/" },
      ],
    },
  },
  LEV: {
    law_commands: {
      resources: [
        { label: "Leviticus guide", href: "https://bibleproject.com/guides/book-of-leviticus/" },
      ],
    },
  },
  NUM: {
    geography_nations: {
      resources: [
        { label: "Numbers guide", href: "https://bibleproject.com/guides/book-of-numbers/" },
        { label: "OpenBible maps", href: "https://www.openbible.info/geo/" },
      ],
    },
  },
  DEU: {
    law_commands: {
      resources: [
        { label: "Deuteronomy guide", href: "https://bibleproject.com/guides/book-of-deuteronomy/" },
        { label: "Covenants guide", href: "https://bibleproject.com/guides/covenants/" },
      ],
    },
  },
  JDG: {
    geography_nations: {
      resources: [
        { label: "Judges guide", href: "https://bibleproject.com/guides/book-of-judges/" },
        { label: "Bible Hub Atlas", href: "https://biblehub.com/atlas/" },
      ],
    },
    events_timeline: {
      resources: [
        { label: "Judges guide", href: "https://bibleproject.com/guides/book-of-judges/" },
      ],
    },
  },
};
const UNIT_DIMENSION_GUIDANCE: Record<string, Record<string, KnowledgeGapGuidanceOverride>> = {
  "gen-1-11": {
    characters_lineage: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Genesis 3-5 and 9-10 for Adam and Eve, Cain and Abel, Seth, Noah, Noah's sons, and the nations table.",
        "Track how the family line moves from Adam to Noah and then spreads into peoples after the flood.",
        "Use Genesis 11:10-32 to bridge from the nations to Abram's family.",
      ],
    },
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the big sequence: creation, fall, Cain and Abel, flood, covenant with Noah, nations, Babel.",
        "Anchor the sequence in Genesis 1-3, 4, 6-9, 10, and 11.",
        "Ask what each event changes about humanity's relationship with God, land, violence, and blessing.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Eden in Genesis 2-3, Ararat after the flood in Genesis 8, and Babel/Shinar in Genesis 11.",
        "Use Genesis 10 as the nations frame; do not try to memorize every name at once.",
        "Ask how movement away from Eden and toward Babel sets up the need for Abram's call.",
      ],
    },
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Start with Genesis 3:15, then Genesis 6:18 and 9:8-17.",
        "Track promise through judgment: seed, rescue, covenant, and the sign of the rainbow.",
        "Use Genesis 11:10-32 to see why the promise story narrows toward Abram.",
      ],
    },
  },
  "gen-12-50": {
    characters_lineage: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Genesis 12-25 for Abraham, Sarah, Hagar, Ishmael, and Isaac.",
        "Then use Genesis 25-36 for Jacob, Esau, Leah, Rachel, and the sons of Jacob.",
        "Use Genesis 37-50 for Joseph and Judah; those chapters explain how Israel's family ends up in Egypt.",
      ],
    },
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the main sequence through Abraham: call, covenant, circumcision, Sodom, Isaac's birth, binding of Isaac.",
        "Then practice Jacob's movement: birthright/blessing, Bethel, Laban, return, wrestling, reconciliation.",
        "Finish with Joseph: sold, Egypt, prison, rise, famine, family reunion, Jacob's blessing.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Start with Genesis 12-13: Haran, Canaan, Shechem, Bethel, the Negev, Egypt, and the Jordan Valley.",
        "Then focus on Genesis 18-19, 28, 32-33, and 37-50: Mamre, Sodom, Bethel, the Jabbok/Peniel area, Shechem, Canaan, and Egypt.",
        "The key geography is movement: Mesopotamia/Haran to Canaan, pressure toward Egypt, and the family eventually settling in Egypt.",
      ],
    },
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Start with Genesis 12, 15, 17, 18:17-19, and 22; these carry the densest covenant commands, signs, obligations, and tests.",
        "Then skim Genesis 26, 28, and 35 for covenant renewal, obedience language, vows, and altar-building.",
        "Do not reread all of Genesis 12-50 for this gap unless you want the wider story; the Law gap is concentrated in the covenant scenes.",
      ],
      resources: [
        { label: "Genesis guide", href: "https://bibleproject.com/guides/book-of-genesis/" },
        { label: "Covenants guide", href: "https://bibleproject.com/guides/covenants/" },
        { label: "Biblical law overview", href: "https://bibleproject.com/videos/law/" },
      ],
    },
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Start with Genesis 12, 15, 17, and 22 for land, offspring, blessing, covenant, and oath promises.",
        "Then use Genesis 26, 28, 35, 48-49 to see the promises repeated through Isaac, Jacob, Joseph's sons, and Judah.",
        "Ask what is promised, who receives it, and whether the chapter advances land, seed, blessing, or kingship.",
      ],
    },
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Genesis 15, 18, 22, 39-50 for faith, righteousness, justice, testing, providence, and forgiveness.",
        "Pay special attention to Genesis 50:20 as a summary of providence in the Joseph story.",
        "Ask what each scene reveals about God's promise staying alive through flawed people.",
      ],
    },
  },
  "exo-1-20": {
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice Exodus 1-6 as the oppression and call of Moses, then Exodus 7-12 as the plague sequence.",
        "Use Exodus 12-15 for Passover, exodus, sea crossing, and song.",
        "Finish with Exodus 16-20: wilderness provision, Sinai arrival, and the Ten Commandments.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Egypt in Exodus 1-12, then the sea crossing in Exodus 13-15.",
        "Track the move through the wilderness toward Sinai in Exodus 16-19.",
        "The core map is Egypt -> sea -> wilderness -> Mount Sinai.",
      ],
    },
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "For Law & Commands here, focus mainly on Exodus 12-13 and 19-20.",
        "Exodus 12-13 gives Passover and consecration instructions; Exodus 19-20 gives covenant setup and the Ten Commandments.",
        "Do not treat the plague narrative as the main law section; use it as the rescue context before the commands.",
      ],
    },
  },
  "exo-21-40": {
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Start with Exodus 21-23 for covenant case laws.",
        "Then use Exodus 25-31 and 35-40 for tabernacle commands and priestly/worship instructions.",
        "Use Exodus 32-34 to see covenant violation, intercession, renewal, and the restored covenant terms.",
      ],
    },
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Exodus 24, 32-34, and 40.",
        "Ask how covenant presence is threatened by idolatry and restored through mercy and intercession.",
        "Track the movement from law, to golden calf, to renewed covenant, to God's glory filling the tabernacle.",
      ],
    },
  },
  "lev-1-16": {
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Leviticus 1-7 for offerings, 8-10 for priesthood, 11-15 for purity, and 16 for the Day of Atonement.",
        "Ask what each instruction protects: worship, holiness, purity, access to God, or atonement.",
        "If time is short, start with Leviticus 1, 4, 10-11, and 16.",
      ],
    },
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Leviticus 4, 10, 11, and 16.",
        "Ask what sin, impurity, priesthood, holiness, and atonement mean for life near God's presence.",
        "Use the Day of Atonement in Leviticus 16 as the theological center of the unit.",
      ],
    },
  },
  "lev-17-27": {
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Start with Leviticus 17, 19, 23, 25, and 26.",
        "Leviticus 19 is the densest community-life command chapter; Leviticus 23 covers sacred time; Leviticus 25 covers sabbath year and Jubilee.",
        "Use Leviticus 26 for blessings, curses, covenant judgment, and restoration hope.",
      ],
    },
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "This unit is mostly law collection, not narrative timeline.",
        "Practice the order of themes instead: blood/sacrifice, holiness/community, priesthood, feasts, land/Jubilee, covenant consequences.",
        "Anchor that order in Leviticus 17, 19, 21-22, 23, 25, and 26.",
      ],
    },
  },
  "num-10-25": {
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the sequence from Sinai departure to wilderness rebellion to Balaam.",
        "Anchor it in Numbers 10-12, 13-14, 16-17, 20-21, and 22-24.",
        "Ask how each event shows testing, complaint, judgment, intercession, or unexpected blessing.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Track Israel's movement from Sinai into the wilderness and toward Moab.",
        "Focus on Numbers 10, 13-14, 20-21, and 22-25.",
        "Pay attention to Kadesh, Edom, Arad, Moab, and the plains of Moab.",
      ],
    },
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "For promise/prophecy, focus especially on Numbers 13-14 and 22-24.",
        "Numbers 13-14 tests trust in the land promise; Numbers 22-24 contains Balaam's oracles.",
        "Use Numbers 24:15-19 as the high-value prophecy passage.",
      ],
    },
  },
  "deu-5-30": {
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Start with Deuteronomy 5-6, 10-11, 12, 16-18, 24, 28-30.",
        "Use Deuteronomy 5-6 for covenant summary, 12-26 for laws, and 28-30 for blessing, curse, repentance, and life/death choice.",
        "If you need a short pass, read Deuteronomy 5-6, 10:12-22, 24:19-22, and 28-30.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Deuteronomy 1:1-5 as the setting, then Deuteronomy 11 and 27-30 for entering and living in the land.",
        "Remember the geographic posture: Israel is east of the Jordan on the plains of Moab, looking toward Canaan.",
        "Use Deuteronomy 34 as the endpoint: Moses views the land from Nebo.",
      ],
    },
  },
  "jos-1-12": {
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the sequence: commission, spies/Rahab, Jordan crossing, Jericho, Achan/Ai, Gibeon, southern and northern campaigns.",
        "Anchor that in Joshua 1-2, 3-4, 5-6, 7-8, 9, 10, and 11.",
        "Ask how covenant obedience or disobedience affects each event.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Joshua 2-4, 6, 8-11, and 12.",
        "Track Jordan crossing, Jericho, Ai, Gibeon, the southern campaign, and the northern campaign.",
        "The map movement matters more than memorizing every city: entry from the east, central foothold, then south and north.",
      ],
    },
  },
  "jdg-2-16": {
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Start with Judges 2:11-19 for the repeating cycle.",
        "Then group the deliverer stories: Othniel/Ehud in Judges 3, Deborah/Barak in 4-5, Gideon in 6-8, Abimelech in 9, Jephthah in 10-12, Samson in 13-16.",
        "Practice the pattern: sin, oppression, cry, deliverer, relapse.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "For geography, focus on Judges 1, 3-5, 6-8, 11, and 13-16.",
        "Track tribal territories and borderlands, especially Moab/Ammon, the Kishon area, Midian, Gilead, Philistia, Zorah, and Gaza.",
        "Do not reread all of Judges for maps; pair each judge with the oppressor or region involved.",
      ],
    },
    characters_lineage: {
      label: "Most relevant chapters",
      steps: [
        "Focus on the major judges: Deborah/Barak, Gideon, Abimelech, Jephthah, and Samson.",
        "Use Judges 4-5, 6-9, 10-12, and 13-16.",
        "Track whether each character moves Israel toward covenant faithfulness or deeper disorder.",
      ],
    },
  },
  "1sa-8-31": {
    characters_lineage: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Samuel, Saul, Jonathan, David, Goliath, Abigail, and Saul's household.",
        "Use 1 Samuel 8-10, 13-16, 17-20, 24-25, 28, and 31.",
        "Track the contrast between Saul's decline and David's rise rather than trying to memorize every side character.",
      ],
    },
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the sequence: request for king, Saul chosen, Saul's failures, David anointed, Goliath, Saul pursues David, Saul's death.",
        "Anchor it in 1 Samuel 8-10, 13-15, 16-17, 18-24, 28, and 31.",
        "Ask how kingship moves from request, to warning, to failure, to replacement.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Gibeah, Bethlehem, the Valley of Elah, Nob, Gath, En-gedi, Ziklag, and Mount Gilboa.",
        "Use 1 Samuel 10-11, 16-17, 21, 24, 27, and 31.",
        "The map is mostly Israel and Philistine border conflict, plus David's fugitive movements.",
      ],
    },
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Focus on 1 Samuel 8, 12, 13, and 15.",
        "Those chapters show kingship warnings, covenant accountability, unlawful sacrifice, and Saul's failure to obey the command concerning Amalek.",
        "For a Law gap, do not reread all of 1 Samuel 8-31; start where command and obedience are explicit.",
      ],
    },
  },
  "2sa-5-12": {
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the sequence: David established, Jerusalem captured, ark brought up, covenant promise, victories, Bathsheba, Nathan's confrontation.",
        "Anchor it in 2 Samuel 5, 6, 7, 8-10, 11, and 12.",
        "Ask how the unit moves from royal establishment to royal failure and consequences.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on 2 Samuel 5-6: Hebron to Jerusalem, Zion, and the ark's movement.",
        "Then skim 2 Samuel 8 and 10 for surrounding enemies and David's expanding kingdom.",
        "The key geographic shift is Jerusalem becoming David's capital and worship center.",
      ],
    },
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Start with 2 Samuel 7; it is the center of the promise/prophecy dimension here.",
        "Then connect 2 Samuel 12 to the consequences announced after David's sin.",
        "Ask what is promised to David's house and what judgment is spoken over David's household.",
      ],
    },
  },
  "1ki-1-19": {
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the sequence: Solomon's succession, wisdom, temple, dedication, decline, kingdom division, Elijah.",
        "Anchor it in 1 Kings 1-3, 5-8, 11-12, 17-19.",
        "If time is short, focus on 1 Kings 3, 8, 11-12, and 18-19.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Jerusalem and the temple in 1 Kings 1-8.",
        "Then use 1 Kings 12 and 17-19 for Shechem/Bethel/Dan, Cherith, Zarephath, Mount Carmel, and Horeb.",
        "The key geography is temple-centered Jerusalem, divided kingdom worship sites, and Elijah's movements.",
      ],
    },
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Focus on 1 Kings 8, 11-12, and 18.",
        "Watch covenant obedience language in Solomon's prayer, Solomon's idolatry, Jeroboam's false worship, and Elijah's call to choose the LORD.",
        "This Law gap is less about legal codes and more about covenant loyalty and prohibited worship.",
      ],
    },
  },
  "2ki-17-25": {
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the sequence: fall of Samaria, Hezekiah and Assyria, Josiah's reform, final kings, fall of Jerusalem.",
        "Anchor it in 2 Kings 17, 18-19, 22-23, 24, and 25.",
        "Ask how covenant failure explains both Israel's fall and Judah's exile.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Samaria, Jerusalem, Assyria, Babylon, and exile movements.",
        "Use 2 Kings 17, 18-19, 24, and 25.",
        "The map is the collapse of Israel to Assyria and Judah to Babylon.",
      ],
    },
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Start with 2 Kings 17 and 22-23.",
        "2 Kings 17 explains covenant violation; 2 Kings 22-23 shows the law book rediscovered and Josiah's reforms.",
        "Use 2 Kings 24-25 to see the covenant consequences reach exile.",
      ],
    },
  },
  "isa-1-12": {
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Isaiah 1, 2, 6, 7, 9, 11, and 12.",
        "Track judgment, remnant hope, Immanuel, the promised king, and restoration.",
        "Isaiah 6 gives the prophet's call; Isaiah 7, 9, and 11 carry the densest promise/king material.",
      ],
    },
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Start with Isaiah 1, 5-6, 9, and 11.",
        "Ask how holiness, judgment, pride, remnant, and messianic hope fit together.",
        "Use Isaiah 6 as the theological center for God's holiness and the prophet's mission.",
      ],
    },
  },
  "jer-1-31": {
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Jeremiah 1, 7, 18-20, 25, 29, and 31.",
        "Track Jeremiah's call, temple warning, enacted signs, exile duration, letter to exiles, and new covenant promise.",
        "Jeremiah 31 is the high-value chapter for restoration and new covenant hope.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Jerusalem/Judah and Babylon as the two major poles.",
        "Use Jeremiah 1, 7, 25, 29, and 31.",
        "The key setting is Judah facing Babylonian exile, with hope spoken to exiles and survivors.",
      ],
    },
  },
  "eze-1-37": {
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Ezekiel 1-3, 8-11, 24, 34, 36, and 37.",
        "Track call, glory, Jerusalem judgment, shepherd promise, new heart/spirit, and dry bones restoration.",
        "Use Ezekiel 36-37 as the high-value restoration promise section.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Ezekiel 1, 8-11, and 40's setup if you want the later temple frame.",
        "For this unit, the main geographic tension is exiles in Babylonia by the Kebar canal and visions concerning Jerusalem.",
        "Do not treat every oracle as a map exercise; track Babylon/exile and Jerusalem/temple.",
      ],
    },
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Ezekiel 1, 8-11, 18, 33-34, 36-37.",
        "Ask how glory, judgment, responsibility, shepherd leadership, new heart, and resurrection hope fit together.",
        "Ezekiel 36-37 is the clearest concentrated section for restoration theology.",
      ],
    },
  },
  "dan-1-7": {
    characters_lineage: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Daniel and his three friends in Daniel 1-3, then Daniel and the kings in Daniel 4-6.",
        "Track Nebuchadnezzar, Belshazzar, Darius, and Daniel's faithful witness in exile.",
        "Do not treat the characters as isolated heroes; ask how each episode shows faithfulness under empire.",
      ],
    },
    events_timeline: {
      label: "Most relevant chapters",
      steps: [
        "Practice the sequence: exile training, dream, fiery furnace, humbled king, writing on the wall, lions' den, four beasts vision.",
        "Anchor it in Daniel 1, 2, 3, 4, 5, 6, and 7.",
        "Ask how court stories prepare for the kingdom vision in Daniel 7.",
      ],
    },
    geography_nations: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Babylon as the exile setting in Daniel 1-5.",
        "Then notice the shift of empires and rulers in Daniel 5-7.",
        "The geography is less travel and more empire setting: Judah's exiles living under foreign kingdoms.",
      ],
    },
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Daniel 2 and 7.",
        "Daniel 2 gives the kingdoms image; Daniel 7 gives the beasts and the Son of Man vision.",
        "Use the court stories in Daniel 1-6 as the narrative setting for the kingdom prophecy.",
      ],
    },
  },
  "psa-1-41": {
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Psalms 1-2, 8, 13, 22-24, and 32.",
        "Track wisdom, kingship, creation, lament, trust, worship, confession, and forgiveness.",
        "For this gap, sample representative psalms rather than trying to reread all 41 at once.",
      ],
    },
    promise_prophecy: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Psalms 2, 22, and 24 for royal hope, suffering/righteousness, and the king of glory.",
        "Use Psalm 16 if you want another key hope/rescue text.",
        "Ask how royal and lament psalms point beyond the immediate speaker.",
      ],
    },
  },
  "pro-1-9": {
    law_commands: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Proverbs 1-4 and 6-7 for commands, warnings, and instruction language.",
        "Track the repeated calls: listen, receive, keep, do not forsake, do not enter the wrong path.",
        "This is wisdom instruction rather than Torah law, so look for father/son commands and moral consequences.",
      ],
    },
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Proverbs 1, 3, 8, and 9.",
        "Ask what wisdom is, why fear of the LORD matters, and how folly competes for allegiance.",
        "Use Proverbs 8-9 as the concentrated wisdom-versus-folly section.",
      ],
    },
  },
  "job-1-14": {
    theological_reasoning: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Job 1-2, 3, and 38-42 later if you want the full book's answer.",
        "Within this unit, Job 1-2 frames the test and Job 3 opens the lament.",
        "Ask what the speeches assume about righteousness, suffering, justice, and God's governance.",
      ],
    },
    characters_lineage: {
      label: "Most relevant chapters",
      steps: [
        "Focus on Job, the accuser, Job's wife, and the three friends introduced in Job 1-2.",
        "Then watch how the friends begin responding in Job 4-14.",
        "The character gap here is about roles in the argument, not genealogy.",
      ],
    },
  },
};

export function mergeKnowledgeGapGuidance(
  dimensionKey: string | null,
  bookCode: string,
  unitKey: string,
): KnowledgeGapGuidance | null {
  if (!dimensionKey) return null;
  const base = DIMENSION_GUIDANCE[dimensionKey];
  if (!base) return null;
  const bookOverride = BOOK_DIMENSION_GUIDANCE[bookCode]?.[dimensionKey];
  const unitOverride = UNIT_DIMENSION_GUIDANCE[unitKey]?.[dimensionKey];
  const resources = [
    ...(unitOverride?.resources ?? []),
    ...(bookOverride?.resources ?? []),
    ...(base.resources ?? []),
  ].filter((resource, index, list) => (
    list.findIndex(item => item.href === resource.href) === index
  ));
  return {
    label: unitOverride?.label ?? bookOverride?.label ?? base.label,
    steps: unitOverride?.steps ?? bookOverride?.steps ?? base.steps,
    resources,
  };
}

export function detailTargetForScore(score: ScopeScore): ScopeDetailTarget {
  if (score.kind === "canon") {
    return { scopeType: "TESTAMENT", scopeKey: score.backendScopeKey, label: score.label, subtitle: score.subtitle };
  }
  if (score.kind === "book") {
    return {
      scopeType: "BOOK",
      scopeKey: score.backendScopeKey,
      label: score.label,
      subtitle: score.subtitle,
    };
  }
  if (score.kind === "domain") {
    return {
      scopeType: "DIMENSION",
      scopeKey: `${score.testament}:${score.backendScopeKey}`,
      label: score.label,
      subtitle: `${score.testament === "NT" ? "New" : "Old"} Testament knowledge dimension`,
    };
  }
  return { scopeType: "SECTION", scopeKey: score.backendScopeKey, label: score.label, subtitle: score.subtitle };
}

export function assessmentHrefForScore(score: ScopeScore): string | null {
  if (score.kind === "canon") {
    return score.testament === "NT"
      ? "/assess?testament=NT&scope=NT"
      : "/assess";
  }

  if (score.testament === "NT") {
    if (score.kind === "domain") return null;
    const params = new URLSearchParams({
      testament: "NT",
      scope: score.backendScopeKey,
      target: score.kind === "book" ? "15" : "20",
    });
    return `/assess?${params.toString()}`;
  }

  const params = new URLSearchParams({
    mode: "scope",
    label: score.label,
    target: score.kind === "book" ? "15" : "20",
  });

  if (score.kind === "book") {
    params.set("scope", score.backendScopeKey);
    return `/assess?${params.toString()}`;
  }

  const sectionKey = {
    Torah: "TORAH",
    "Former Prophets": "FORMER",
    "Latter Prophets": "LATTER",
    Writings: "WRITINGS",
  }[score.label];

  if (!sectionKey) return null;
  params.set("scope", sectionKey);
  return `/assess?${params.toString()}`;
}

export function dimensionDisplayName(key: string): string {
  return DOMAIN_META.find(domain => domain.backendKey === key)?.label
    ?? key.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export async function loadDimensionAwareQuestionBank() {
  return loadPublicQuestionMetadata();
}

export function sectionNameForBook(bookCode: string) {
  const section = sectionForBook(bookCode);
  return section === "Unmapped" ? "Old Testament" : section;
}

export function classNameForSection(sectionName: string) {
  if (sectionName === "Torah") return "torah";
  if (sectionName === "Former Prophets") return "former";
  if (sectionName === "Latter Prophets") return "latter";
  if (sectionName === "Writings") return "writings";
  if (sectionName === "Gospels & Acts") return "gospels";
  if (sectionName === "Pauline Epistles") return "pauline";
  if (sectionName === "General Epistles") return "general";
  if (sectionName === "Apocalypse") return "revelation";
  return "ot";
}

export function confidenceForAnswers(answered: number): ScopeScore["confidence"] {
  return sectionEvidence(answered).confidence;
}

export function scoreEvidence(rows: { isCorrect: boolean; weight: number }[]) {
  const possible = rows.reduce((sum, row) => sum + row.weight, 0);
  const earned = rows.reduce((sum, row) => {
    return sum + row.weight * (row.isCorrect ? 1 : 0);
  }, 0);
  if (possible <= 0) return null;
  const observed = earned / possible;
  const guessAdjusted = Math.max(0, Math.min(1, (observed - 0.25) / 0.75));
  return guessAdjusted * 100;
}

export function buildScopeScores(bankRows: BankRow[], answerRows: AnswerRow[]) {
  const bankById = new Map(bankRows.map(row => [row.generated_question_id, row]));
  const evidence = answerRows
    .filter(answer => (
      answer.generated_question_id
      && !answer.is_idk
      && answer.scoring_eligible !== false
    ))
    .map(answer => {
      const bank = bankById.get(answer.generated_question_id!);
      if (!bank || !bank.book_code) return null;
      const weight = Math.max(1, Number(bank.routing_score ?? bank.importance_conceptual ?? bank.importance_context ?? 50));
      return {
        bookCode: bank.book_code,
        section: sectionNameForBook(bank.book_code),
        testament: testamentForBook(bank.book_code) ?? "OT",
        questionType: bank.question_type ?? "",
        dimensionKey: bank.dimension_key ?? null,
        isCorrect: Boolean(answer.is_correct),
        weight,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const makeScore = (
    key: string,
    label: string,
    subtitle: string,
    kind: ScopeKind,
    className: string,
    testament: BibleTestament,
    backendScopeKey: string,
    rows: typeof evidence,
  ): ScopeScore => {
    const rawScore = scoreEvidence(rows);
    return {
      key,
      label,
      subtitle,
      kind,
      className,
      testament,
      backendScopeKey,
      rawScore,
      displayScore: rawScore === null ? null : toDisplayScore(rawScore),
      answered: rows.length,
      correct: rows.filter(row => row.isCorrect).length,
      confidence: confidenceForAnswers(rows.length),
    };
  };

  const sections = SECTION_META.map(scope => makeScore(
    scope.key,
    scope.label,
    scope.subtitle,
    scope.kind,
    scope.className,
    scope.testament,
    scope.backendScopeKey,
    evidence.filter(row => scope.books.includes(row.bookCode)),
  ));

  const books = BIBLE_BOOKS.map(bibleBook => makeScore(
    `book:${bibleBook.code}`,
    bibleBook.name,
    bibleBook.code === "ACT"
      ? "Acts"
      : bibleBook.section === "Gospels & Acts"
        ? "Gospels"
        : bibleBook.section === "Apocalypse"
          ? "Revelation"
          : bibleBook.section,
    "book",
    classNameForSection(bibleBook.section),
    bibleBook.testament,
    bibleBook.code,
    evidence.filter(row => row.bookCode === bibleBook.code),
  ));

  const domains = (["OT", "NT"] as const).flatMap(testament =>
    DOMAIN_META.map(domain => makeScore(
      `domain:${testament}:${domain.key}`,
      domain.label,
      `${testament} question dimension`,
      "domain",
      `domain-${domain.key}`,
      testament,
      domain.backendKey,
      evidence.filter(row => (
        row.testament === testament
        && (row.dimensionKey === domain.backendKey || (!row.dimensionKey && domain.match(row.questionType)))
      )),
    ))
  );

  return { sections, books, domains };
}

export function canonicalBliForSectionScope(
  scope: ScopeScore,
  scores: BliContractScores,
): BliSectionScore | null {
  if (scope.key === "ot") return testamentHeadlineAsSection(scores, "OT");
  if (scope.key === "nt") return testamentHeadlineAsSection(scores, "NT");
  if (scope.key === "prophets") {
    return poolBliSections(
      scores.ot_section_scores,
      ["Former Prophets", "Latter Prophets"],
    );
  }

  const sectionScores = scope.testament === "OT"
    ? scores.ot_section_scores
    : scores.nt_section_scores;
  const canonicalName = scope.label === "Revelation" ? "Apocalypse" : scope.label;
  return sectionScores[canonicalName] ?? null;
}

export function applyCanonicalBliToSectionScopes(
  scopes: ScopeScore[],
  scores: BliContractScores | null,
): ScopeScore[] {
  return scopes.map(scope => {
    const canonical = scores ? canonicalBliForSectionScope(scope, scores) : null;
    if (!canonical) {
      return {
        ...scope,
        rawScore: null,
        displayScore: null,
        answered: 0,
        correct: 0,
        confidence: "none",
      };
    }
    return {
      ...scope,
      rawScore: canonical.raw_bli_pct,
      displayScore: canonical.display_bli,
      answered: canonical.answered,
      correct: canonical.correct,
      confidence: confidenceForAnswers(canonical.answered),
    };
  });
}

export function evidenceLabel(score: ScopeScore) {
  const evidence = sectionEvidence(score.answered);
  if (evidence.status === "untested") return "Needs answers";
  if (evidence.status === "provisional") return "Early read";
  if (evidence.status === "developing") return "Getting clearer";
  return "Reliable sample";
}

export function hasBaselineEvidence(score: ScopeScore | undefined) {
  if (!score || score.rawScore === null) return false;
  return score.answered >= SECTION_INTERPRETATION_FLOOR
    && (score.displayScore ?? 0) >= 513;
}

export function getRecommendedStudy(sectionScores: SectionScoreMap, hasAssessment: boolean, bookScores: ScopeScore[]): RecommendedStudy {
  if (!hasAssessment) {
    return {
      label: "Take your first assessment",
      books: "Personalized recommendation pending",
      focus: "Answer a short set of questions so OBA can find a natural place to begin.",
      priority: "Recommendation pending",
      actionHref: "/assess",
      actionLabel: "Start assessment",
    };
  }

  const bookTarget = OT_BOOK_CODES
    .map(bookCode => {
      const focus = BOOK_FOCUS_RANGES[bookCode];
      const score = bookScores.find(item => item.key === `book:${bookCode}`);
      return focus ? { bookCode, focus, score } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .find(item => !item.score || item.score.answered < 3 || (item.score.displayScore ?? 0) < 513);

  if (bookTarget) {
    const score = bookTarget.score;
    const params = new URLSearchParams({
      mode: "focus",
      book: bookTarget.bookCode,
      start: String(bookTarget.focus.start),
      end: String(bookTarget.focus.end),
      label: bookTarget.focus.range,
      target: "15",
    });
    return {
      label: bookTarget.focus.range,
      books: bookTarget.focus.label,
      focus: bookTarget.focus.focus,
      priority: score && score.answered > 0
        ? `${score.displayScore ?? "--"} BLI · ${score.answered} answers`
        : "Not enough evidence yet",
      actionHref: `/assess?${params.toString()}`,
      actionLabel: "Retest this range",
    };
  }

  const earliestMajorGap = SECTION_RECOMMENDATIONS.find(section => {
    const score = sectionScores[section.name];
    return !score || score.total < 4 || score.accuracy_pct < 70;
  });
  const target = earliestMajorGap ?? [...SECTION_RECOMMENDATIONS]
    .sort((a, b) => (sectionScores[a.name]?.accuracy_pct ?? 100) - (sectionScores[b.name]?.accuracy_pct ?? 100))[0];
  const score = sectionScores[target.name];

  return {
    label: earliestMajorGap ? target.name : `Deepen ${target.name}`,
    books: target.books,
    focus: target.focus,
    priority: score
      ? `${score.accuracy_pct}% accuracy · ${score.total} answers`
      : "Not enough answers yet",
    actionHref: "/assess",
    actionLabel: "Continue assessment",
  };
}

export const DASHBOARD_SUBJECTS: Array<{
  id: DashboardTab;
  label: string;
  subtitle: string;
  color: string;
  soon: boolean;
}> = [
  { id: "bli", label: "Bible Assessment", subtitle: "OT, NT, and combined literacy", color: "#0aa3a3", soon: false },
  { id: "church-history", label: "Church History", subtitle: "Coming soon", color: "#d4a017", soon: true },
  { id: "biblical-languages", label: "Biblical Languages", subtitle: "Coming soon", color: "#7c3aed", soon: true },
];
