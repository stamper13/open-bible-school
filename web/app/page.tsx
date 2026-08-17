"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/lib/supabase/client";
import { beginPendingTransfer, clearPendingTransfer, newFlowId } from "@/lib/auth/anonymousTransfer";
import { authCallbackUrl } from "@/lib/auth/redirect";
import { loadPublicQuestionMetadata, type PublicQuestionMetadataRow } from "@/lib/supabase/questionMetadata";
import { BLI_LEVELS, levelForScore, toDisplayScore, type BliLevel } from "@/lib/bli";
import {
  EMPTY_EXPLORE_TREE,
  EMPTY_FOCUS_PATH,
  compactReference,
  loadExploreTree,
  loadFocusPath,
  passageReference,
  readableUnitLabel,
  rereadHref,
  type ExploreTree,
  type FocusPath,
} from "@/lib/focusPath";
import { SHOOTING_PALETTES, drawStreak } from "@/lib/skyStreak";
import { verseOfTheDay } from "@/lib/verseOfTheDay";
import CoverageGrid, { CoverageLegend, hasFocusRecommendation, type CoverageGridView } from "./knowledge-map/CoverageGrid";
import ReadingLogWidget from "./ReadingLogWidget";
import StarfieldRewardsLayer from "@/components/StarfieldRewardsLayer";
import {
  normalizeBliContractRow,
  poolBliSections,
  testamentHeadlineAsSection,
  type BliContractScores,
  type BliSectionScore,
} from "@/lib/bliContract";
import {
  SECTION_INTERPRETATION_FLOOR,
  leastEvidenceSection,
  sectionEvidence,
} from "@/lib/bliEvidence";
import {
  BIBLE_BOOKS,
  BOOK_NAMES,
  OT_BOOK_CODES,
  NT_BOOK_CODES,
  SECTION_BOOKS,
  sectionForBook,
  testamentForBook,
  type Testament as BibleTestament,
} from "@/lib/bibleTaxonomy";
import {
  RECOMMENDATION_EVENT_MAX_ATTEMPTS,
  RECOMMENDATION_EVENT_RETRY_DELAY_MS,
  RECOMMENDATION_EVENT_SOURCE,
  buildRecommendationViewMetadata,
  newInteractionId,
  shouldRetryStudyEvent,
  type RecommendationInteractionSurface,
} from "@/lib/recommendationEvents";

const SKY_SEED_KEY = "obs_sky_seed";
const ANON_SESSION_ACTIVE_KEY = "obs_anon_session_active";
const ANON_USER_ID_KEY = "obs_anon_user_id";
const SESSION_ANSWERED_KEY = "obs_session_answered";
const SESSION_CORRECT_KEY = "obs_session_correct";
const OT_ATTEMPT_ID_KEY = "obs_ot_attempt_id";
const NT_ATTEMPT_ID_KEY = "obs_nt_attempt_id";
const RECOMMENDATION_RETEST_WAIT_MS = 20 * 60 * 1000;

function isAnonymousSession(session: { user?: { email?: string | null } } | null) {
  return Boolean(session?.user && !session.user.email);
}

function clearAssessmentBrowserStorage() {
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

function readSessionAssessmentData() {
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

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function getOrCreateSkySeed() {
  if (typeof window === "undefined") return 1;
  const existing = sessionStorage.getItem(SKY_SEED_KEY);
  if (existing) return Number(existing) || 1;
  const seed = Math.floor(Math.random() * 4294967295) || 1;
  sessionStorage.setItem(SKY_SEED_KEY, String(seed));
  return seed;
}

function coneMarkerPercent(s: number): number {
  const bandIndex = BLI_LEVELS.findIndex(b => s >= b.min && s <= b.max);
  const safeBandIndex = bandIndex === -1 ? (s < BLI_LEVELS[0].min ? 0 : BLI_LEVELS.length - 1) : bandIndex;
  const band = BLI_LEVELS[safeBandIndex];
  const span = Math.max(1, band.max - band.min);
  const withinBand = Math.max(0, Math.min(1, (s - band.min) / span));
  const visualIndexFromTop = BLI_LEVELS.length - 1 - safeBandIndex;
  return ((visualIndexFromTop + (1 - withinBand)) / BLI_LEVELS.length) * 100;
}
function formatProgressDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
function formatScoreChange(value: number): string {
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

type SectionScoreMap = Record<string, {
  accuracy_pct: number;
  raw_bli_pct: number;
  total: number;
}>;
type BreakdownTab = "sections" | "books" | "domains";
type ScopeKind = "canon" | "section" | "book" | "domain";
type ScopeScore = {
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
type ScopeSummary = {
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
type ScopeDetailTarget = {
  scopeType: "TESTAMENT" | "SECTION" | "BOOK" | "DIMENSION" | "UNIT";
  scopeKey: string;
  label: string;
  subtitle: string;
  unitKey?: string;
};
type BankRow = PublicQuestionMetadataRow;
type AnswerRow = {
  generated_question_id: string | null;
  is_correct: boolean;
  is_idk?: boolean | null;
  scoring_eligible?: boolean | null;
};
type BackendRecommendation = {
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
type BliEvidence = {
  scope: string;
  theta: number;
  theta_se: number;
  theta_lower_95: number;
  theta_upper_95: number;
  n_responses: number;
  evidence_level: "Very limited" | "Limited" | "Developing" | "Strong" | "Very strong";
  evidence_description: string;
};
type BliSectionFollowup = {
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
type ProgressPoint = {
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
type NtPilotSummary = {
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
type KnowledgeGapResource = { label: string; href: string };
type KnowledgeGapGuidance = {
  label: string;
  steps: string[];
  resources?: KnowledgeGapResource[];
};
type KnowledgeGapGuidanceOverride = Partial<KnowledgeGapGuidance>;

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

function mergeKnowledgeGapGuidance(
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

function detailTargetForScore(score: ScopeScore): ScopeDetailTarget {
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

function assessmentHrefForScore(score: ScopeScore): string | null {
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

function dimensionDisplayName(key: string): string {
  return DOMAIN_META.find(domain => domain.backendKey === key)?.label
    ?? key.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

async function loadDimensionAwareQuestionBank() {
  return loadPublicQuestionMetadata();
}

function sectionNameForBook(bookCode: string) {
  const section = sectionForBook(bookCode);
  return section === "Unmapped" ? "Old Testament" : section;
}

function classNameForSection(sectionName: string) {
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

function confidenceForAnswers(answered: number): ScopeScore["confidence"] {
  return sectionEvidence(answered).confidence;
}

function scoreEvidence(rows: { isCorrect: boolean; weight: number }[]) {
  const possible = rows.reduce((sum, row) => sum + row.weight, 0);
  const earned = rows.reduce((sum, row) => {
    return sum + row.weight * (row.isCorrect ? 1 : 0);
  }, 0);
  if (possible <= 0) return null;
  const observed = earned / possible;
  const guessAdjusted = Math.max(0, Math.min(1, (observed - 0.25) / 0.75));
  return guessAdjusted * 100;
}

function buildScopeScores(bankRows: BankRow[], answerRows: AnswerRow[]) {
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

function canonicalBliForSectionScope(
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

function applyCanonicalBliToSectionScopes(
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

function evidenceLabel(score: ScopeScore) {
  const evidence = sectionEvidence(score.answered);
  if (evidence.status === "untested") return "Needs answers";
  if (evidence.status === "provisional") return "Early read";
  if (evidence.status === "developing") return "Getting clearer";
  return "Reliable sample";
}

function hasBaselineEvidence(score: ScopeScore | undefined) {
  if (!score || score.rawScore === null) return false;
  return score.answered >= SECTION_INTERPRETATION_FLOOR
    && (score.displayScore ?? 0) >= 513;
}

function getRecommendedStudy(sectionScores: SectionScoreMap, hasAssessment: boolean, bookScores: ScopeScore[]) {
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

const DASHBOARD_SUBJECTS: Array<{
  id: "bli" | "church-history" | "biblical-languages";
  label: string;
  subtitle: string;
  color: string;
  soon: boolean;
}> = [
  { id: "bli", label: "Bible Assessment", subtitle: "OT, NT, and combined literacy", color: "#0aa3a3", soon: false },
  { id: "church-history", label: "Church History", subtitle: "Coming soon", color: "#d4a017", soon: true },
  { id: "biblical-languages", label: "Biblical Languages", subtitle: "Coming soon", color: "#7c3aed", soon: true },
];

export default function HomePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dashboardUserId, setDashboardUserId] = useState<string | null>(null);
  // The frontier card is a second projection of the knowledge map's focus
  // path — same RPC, compact shape. No separate endpoint.
  const [frontier, setFrontier] = useState<FocusPath>(EMPTY_FOCUS_PATH);
  // The coverage grid is the same course-style checklist shown on the full
  // knowledge map, surfaced here now that the dashboard has room for it.
  const [coverageTrees, setCoverageTrees] = useState<Record<BibleTestament, ExploreTree>>({
    OT: EMPTY_EXPLORE_TREE,
    NT: EMPTY_EXPLORE_TREE,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Account controls collapse behind the email; a click opens the menu.
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const learnMoreRef = useRef<HTMLDivElement>(null);
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const subjectMenuRef = useRef<HTMLDivElement>(null);
  const [firstAssessmentChooserOpen, setFirstAssessmentChooserOpen] = useState(false);
  const [dashboardHydrated, setDashboardHydrated] = useState(false);
  const [assessmentData, setAssessmentData] = useState<{answered: number, correct: number, bli?: number} | null>(null);
  const [sessionAssessmentData, setSessionAssessmentData] = useState<{answered: number, correct: number, bli?: number} | null>(null);
  const [sectionScores, setSectionScores] = useState<SectionScoreMap>({});
  const [scopeScores, setScopeScores] = useState<{sections: ScopeScore[]; books: ScopeScore[]; domains: ScopeScore[]}>(() => buildScopeScores([], []));
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<BreakdownTab>("sections");
  // The single testament toggle at the top of the dashboard now drives every
  // testament-scoped box beneath it (score strip, recommendation engine,
  // coverage map, knowledge profile breakdown) — there is no second,
  // independent testament switch anywhere further down the page.
  const [suiteTestament, setSuiteTestament] = useState<BibleTestament>("OT");
  const profileTestament = suiteTestament;
  const [showBliTooltip, setShowBliTooltip] = useState(false);
  const [showEvidenceTooltip, setShowEvidenceTooltip] = useState(false);
  const [showLevelTooltip, setShowLevelTooltip] = useState(false);
  const [expandedConeLayer, setExpandedConeLayer] = useState<string | null>(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState<"bli" | "church-history" | "biblical-languages">("bli");
  const [coverageMapMode, setCoverageMapMode] = useState<CoverageGridView>("recommended");
  const [backendRecommendation, setBackendRecommendation] = useState<BackendRecommendation | null>(null);
  const [sectionFollowup, setSectionFollowup] = useState<BliSectionFollowup | null>(null);
  const [bliEvidence, setBliEvidence] = useState<BliEvidence | null>(null);
  const [ntBliEvidence, setNtBliEvidence] = useState<BliEvidence | null>(null);
  const [combinedBliEvidence, setCombinedBliEvidence] = useState<BliEvidence | null>(null);
  const progressTestament = suiteTestament;
  const [progressHistory, setProgressHistory] = useState<ProgressPoint[]>([]);
  const [activeProgressAttemptId, setActiveProgressAttemptId] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [scopeDetailTarget, setScopeDetailTarget] = useState<ScopeDetailTarget | null>(null);
  // These score details stay behind icon triggers so the BLI card can lead,
  // then expand inline only when the learner asks for that layer.
  const [progressPanelOpen, setProgressPanelOpen] = useState(false);
  const [conePanelOpen, setConePanelOpen] = useState(false);
  const [knowledgeProfileOpen, setKnowledgeProfileOpen] = useState(false);
  const [scopeSummary, setScopeSummary] = useState<ScopeSummary | null>(null);
  const [scopeSummaryLoading, setScopeSummaryLoading] = useState(false);
  const [scopeSummaryError, setScopeSummaryError] = useState<string | null>(null);
  const [ntPilotSummary, setNtPilotSummary] = useState<NtPilotSummary | null>(null);
  const [testamentScores, setTestamentScores] = useState<BliContractScores | null>(null);
  const [pendingRetestHref, setPendingRetestHref] = useState<string | null>(null);
  const tooltipCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTooltipCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBackfillAttemptedRef = useRef<string | null>(null);
  const scopeRequestRef = useRef(0);
  // Guards ONE in-flight explicit recommendation interaction so a double-click
  // or a concurrent handler cannot start a second logical event. It is not a
  // correctness guard for duplicates: the interaction UUID plus the database
  // partial unique index is what makes recording exactly-once.
  const recommendationInteractionRef = useRef<string | null>(null);
  const coneRef = useRef<HTMLDivElement>(null);
  const sloshRef = useRef({
    x1: 0, v1: 0, x2: 0, v2: 0,
    lastPointerX: null as number | null,
    lastPointerT: 0,
    raf: 0,
    running: false,
    lastFrameT: 0,
  });
  const visibleAssessmentData = assessmentData ?? sessionAssessmentData;
  const coverageTree = coverageTrees[suiteTestament];
  const currentDisplayScore = visibleAssessmentData
    ? testamentScores?.ot_questions_answered
      ? testamentScores.ot_display_bli
      : toDisplayScore(visibleAssessmentData.bli ?? Math.round((visibleAssessmentData.correct / visibleAssessmentData.answered) * 100))
    : 0;
  const currentDisplayLevel = levelForScore(currentDisplayScore);
  const currentDisplayBand = BLI_LEVELS.find((band) => band.name === currentDisplayLevel) ?? BLI_LEVELS[0];
  const ntDisplayScore = testamentScores?.nt_questions_answered ? testamentScores.nt_display_bli : 0;
  const activeDisplayScore = suiteTestament === "NT" ? ntDisplayScore : currentDisplayScore;
  const activeDisplayLevel = suiteTestament === "NT" && testamentScores?.nt_questions_answered
    ? testamentScores.nt_bli_level
    : levelForScore(activeDisplayScore);
  const activeHasScore = suiteTestament === "NT"
    ? Boolean(testamentScores?.nt_questions_answered)
    : Boolean(visibleAssessmentData);
  const waterFillPercent = activeHasScore ? 100 - coneMarkerPercent(activeDisplayScore) : 0;

  // The level popover describes whichever testament is active; close it on
  // switch so it doesn't linger open showing the previous testament's copy.
  useEffect(() => {
    setShowLevelTooltip(false);
  }, [suiteTestament]);

  useEffect(() => {
    setSessionAssessmentData(readSessionAssessmentData());
    try {
      const stored = localStorage.getItem("oba_nt_pilot_summary");
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<NtPilotSummary>;
      if (
        typeof parsed.answered === "number" &&
        typeof parsed.correct === "number" &&
        typeof parsed.accuracy === "number" &&
        typeof parsed.scope === "string" &&
        typeof parsed.booksAttempted === "number" &&
        typeof parsed.updatedAt === "string"
      ) {
        setNtPilotSummary(parsed as NtPilotSummary);
      }
    } catch {
      setNtPilotSummary(null);
    }
  }, []);

  const localSectionFollowup = useMemo(
    () => leastEvidenceSection(scopeScores.sections.filter(score => (
      score.testament === "OT" && score.kind === "section"
    ))),
    [scopeScores.sections],
  );
  const uncertaintyFollowup = sectionFollowup?.is_provisional
    ? {
        label: sectionFollowup.section_name,
        scopeKey: sectionFollowup.scope_key,
        answered: sectionFollowup.answered,
        answersNeeded: sectionFollowup.answers_needed,
        target: sectionFollowup.suggested_question_count,
      }
    : localSectionFollowup
      ? {
          label: localSectionFollowup.label,
          scopeKey: localSectionFollowup.backendScopeKey,
          answered: localSectionFollowup.answered,
          answersNeeded: sectionEvidence(localSectionFollowup.answered).answersToInterpretation,
          target: Math.max(5, sectionEvidence(localSectionFollowup.answered).answersToInterpretation),
        }
      : null;
  const isRecommendationEvidenceBlocked = Boolean(uncertaintyFollowup);
  const uncertaintyRecommendation = visibleAssessmentData && uncertaintyFollowup ? {
    label: `Clarify your ${uncertaintyFollowup.label} profile`,
    books: `${uncertaintyFollowup.label} · Build the sample`,
    focus: "Add a few more answers here before OBA chooses a lowest confirmed weakness.",
    priority: `${uncertaintyFollowup.answersNeeded} more ${uncertaintyFollowup.answersNeeded === 1 ? "answer" : "answers"} to unlock recommendations`,
    actionHref: `/assess?${new URLSearchParams({
      mode: "scope",
      label: uncertaintyFollowup.label,
      scope: uncertaintyFollowup.scopeKey,
      target: String(uncertaintyFollowup.target),
    }).toString()}`,
    actionLabel: "Add section evidence",
  } : null;
  const recommendedStudy = uncertaintyRecommendation ?? (!isRecommendationEvidenceBlocked && backendRecommendation ? (() => {
    const hasDimensionTarget = !!backendRecommendation.dimension_key;
    const dimensionName =
      backendRecommendation.dimension_short_label ??
      backendRecommendation.dimension_label ??
      (backendRecommendation.dimension_key ? dimensionDisplayName(backendRecommendation.dimension_key) : null);
    const bookName = BOOK_NAMES[backendRecommendation.book_code] ?? backendRecommendation.book_code;
    const dimensionGuidance = mergeKnowledgeGapGuidance(
      backendRecommendation.dimension_key,
      backendRecommendation.book_code,
      backendRecommendation.unit_key,
    );
    const params = new URLSearchParams({
      mode: "focus",
      unit: backendRecommendation.unit_key,
      book: backendRecommendation.book_code,
      start: String(backendRecommendation.start_chapter),
      end: String(backendRecommendation.end_chapter),
      label: backendRecommendation.label,
      target: String(backendRecommendation.retest_question_target),
    });
    if (hasDimensionTarget && backendRecommendation.dimension_key) {
      params.set("dimension", backendRecommendation.dimension_key);
    }
    return {
      // Just the dimension name (e.g. "Law") — this used to read "Law gap"
      // right underneath a badge that also said "Law", which was the same
      // fact stated twice. The eyebrow above ("Dimension gap") already
      // carries the "gap" framing, so the title only needs the name itself.
      label: hasDimensionTarget && dimensionName
        ? dimensionName
        : `${bookName} gap evidence`,
      books: hasDimensionTarget
        ? `${bookName} · ${backendRecommendation.label}`
        : `${backendRecommendation.label} · ${backendRecommendation.section}`,
      focus: hasDimensionTarget
        ? (backendRecommendation.dimension_focus_text
          ?? `Test ${dimensionName?.toLowerCase() ?? "this dimension"} questions inside ${backendRecommendation.label}. The passage is the context; the gap is the dimension.`)
        : `OBA has selected ${backendRecommendation.label} as the next assessment area, but it has not isolated a dimension-level deficit there yet. Answer a focused set here so the next Knowledge Gap can name the weak dimension instead of only the passage.`,
      priority: hasDimensionTarget && backendRecommendation.dimension_display_score
        ? `${backendRecommendation.dimension_display_score} BLI · ${backendRecommendation.dimension_answered ?? 0} ${dimensionName ?? "dimension"} answers`
        : backendRecommendation.display_score
        ? `${backendRecommendation.display_score} BLI in this passage · dimension gap pending`
        : "Needs focused answers before a dimension gap can be named",
      actionHref: `/assess?${params.toString()}`,
      actionLabel: hasDimensionTarget && dimensionName ? `Retest ${dimensionName}` : "Find the gap",
      guidanceLabel: dimensionGuidance?.label,
      guidanceSteps: dimensionGuidance?.steps ?? [],
      resources: dimensionGuidance?.resources ?? [],
    };
  })() : getRecommendedStudy(sectionScores, !!visibleAssessmentData, scopeScores.books));
  const isBackendRecommendationShown = !isRecommendationEvidenceBlocked && Boolean(backendRecommendation);
  const knowledgeGapEyebrow = isRecommendationEvidenceBlocked
    ? "Evidence gap"
    : backendRecommendation?.dimension_key
      ? "Dimension gap"
      : backendRecommendation
        ? "Gap evidence"
        : "Knowledge gap";
  const recommendedGuidanceSteps = "guidanceSteps" in recommendedStudy && Array.isArray(recommendedStudy.guidanceSteps)
    ? recommendedStudy.guidanceSteps.filter((step): step is string => typeof step === "string")
    : [];
  const recommendedGuidanceLabel = "guidanceLabel" in recommendedStudy && typeof recommendedStudy.guidanceLabel === "string"
    ? recommendedStudy.guidanceLabel
    : "What to practice";
  const recommendedResources = "resources" in recommendedStudy && Array.isArray(recommendedStudy.resources)
    ? recommendedStudy.resources.filter((resource): resource is { label: string; href: string } => (
      resource
      && typeof resource.label === "string"
      && typeof resource.href === "string"
    ))
    : [];
  const visibleBreakdownScores = useMemo(() => {
    if (activeBreakdownTab === "sections") {
      const visibleKeys = profileTestament === "OT"
        ? new Set(["torah", "former", "latter", "writings"])
        : new Set(["gospels-acts", "pauline", "general", "revelation"]);
      return scopeScores.sections.filter(score => (
        score.testament === profileTestament && visibleKeys.has(score.key)
      ));
    }
    if (activeBreakdownTab === "domains") {
      return scopeScores.domains.filter(score => score.testament === profileTestament);
    }
    return scopeScores.books.filter(score => score.testament === profileTestament);
  }, [activeBreakdownTab, profileTestament, scopeScores]);
  const scriptureConnectionsUnlocked = useMemo(() => {
    const torah = scopeScores.sections.find(score => score.label === "Torah");
    const former = scopeScores.sections.find(score => score.label === "Former Prophets");
    return hasBaselineEvidence(torah) && hasBaselineEvidence(former);
  }, [scopeScores.sections]);
  const chronologicalProgress = useMemo(
    () => [...progressHistory].reverse(),
    [progressHistory],
  );
  const progressBounds = useMemo(() => {
    const scores = chronologicalProgress.map(p => Math.max(0, Math.min(800, p.display_bli)));
    if (scores.length === 0) return { lo: 0, hi: 800 };
    const dataLo = Math.min(...scores);
    const dataHi = Math.max(...scores);
    const span = Math.max(dataHi - dataLo, 90);
    const pad = span * 0.28;
    const lo = Math.max(0, Math.floor((dataLo - pad) / 10) * 10);
    const hi = Math.min(800, Math.ceil((dataHi + pad) / 10) * 10);
    return { lo, hi: hi > lo ? hi : lo + 100 };
  }, [chronologicalProgress]);
  const plottedProgress = useMemo(() => {
    const lastIndex = chronologicalProgress.length - 1;
    const { lo, hi } = progressBounds;
    const range = Math.max(hi - lo, 1);
    return chronologicalProgress.map((point, index) => {
      const score = Math.max(0, Math.min(800, point.display_bli));
      return {
        point,
        x: lastIndex <= 0 ? 50 : 3 + (index / lastIndex) * 94,
        y: 92 - ((score - lo) / range) * 84,
      };
    });
  }, [chronologicalProgress, progressBounds]);
  const progressAxisLabels = useMemo(() => {
    const { lo, hi } = progressBounds;
    return [hi, Math.round((hi + lo) / 2), lo];
  }, [progressBounds]);
  const progressXAxisLabels = useMemo(() => {
    const n = plottedProgress.length;
    if (n === 0) return [];
    const times = plottedProgress.map(p => new Date(p.point.captured_at).getTime());
    const spanDays = (times[n - 1] - times[0]) / 86400000;
    if (n === 1) {
      return [{
        x: plottedProgress[0].x,
        text: new Date(times[0]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      }];
    }

    // Granularity follows the span: hours within a single day, days for weeks and
    // months, month+year once the record stretches past a year.
    const fmt = (t: number) => {
      const d = new Date(t);
      if (spanDays < 1) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      if (spanDays < 3) return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
      if (spanDays < 400) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    };

    // Denser records earn more ticks; sparse ones label every point.
    const target = n <= 5 ? n : spanDays < 3 ? 4 : n <= 12 ? 4 : n <= 30 ? 5 : 6;
    const idxs = Array.from(
      new Set(Array.from({ length: target }, (_, k) => Math.round((k * (n - 1)) / Math.max(target - 1, 1)))),
    ).sort((a, b) => a - b);

    const out: Array<{ x: number; text: string }> = [];
    idxs.forEach((i, k) => {
      const text = fmt(times[i]);
      // Drop a tick whose text repeats the previous one, unless it's the final tick.
      if (k > 0 && k < idxs.length - 1 && out.length > 0 && out[out.length - 1].text === text) return;
      out.push({ x: plottedProgress[i].x, text });
    });
    if (out.length > 1 && out[out.length - 1].text === out[out.length - 2].text) out.splice(out.length - 2, 1);
    return out;
  }, [plottedProgress]);
  const progressPath = plottedProgress
    .map((entry, index) => `${index === 0 ? "M" : "L"} ${entry.x.toFixed(2)} ${entry.y.toFixed(2)}`)
    .join(" ");
  const progressAreaPath = plottedProgress.length > 0
    ? `${progressPath} L ${plottedProgress[plottedProgress.length - 1].x.toFixed(2)} 100 L ${plottedProgress[0].x.toFixed(2)} 100 Z`
    : "";
  const activeProgressPoint = progressHistory.find(point => point.attempt_id === activeProgressAttemptId)
    ?? progressHistory[0]
    ?? null;
  const hasReadingRecommendation = Boolean(frontier.focusLeaf);
  const activeCoverageMapMode: CoverageGridView = suiteTestament === "OT"
    ? (coverageMapMode === "recommended" && !hasReadingRecommendation ? "overview" : coverageMapMode)
    : "overview";
  const coverageModeCopy = suiteTestament === "NT"
    ? "Every New Testament chapter, ready for NT recommendations when that engine comes online."
    : activeCoverageMapMode === "skill"
      ? "The recommended dimension gap is pulled forward with concrete practice steps."
      : activeCoverageMapMode === "overview"
        ? "Every Old Testament chapter in its full section and book context."
        : "The next reading range is pulled forward; Overview snaps it back into the full map.";
  // The dashboard only switches from the "new learner" landing to full
  // results once a standard assessment is actually complete (20 questions —
  // see TOTAL_INITIAL / NT_PILOT_TARGET in app/assess/page.tsx). Anything
  // short of that is a partial attempt: leaving mid-test and coming back to
  // the dashboard should not surface a half-answered score as if it were a
  // finished result.
  const ASSESSMENT_COMPLETE_THRESHOLD = 20;
  const otAnsweredCount = testamentScores?.ot_questions_answered ?? visibleAssessmentData?.answered ?? 0;
  const ntAnsweredCount = testamentScores?.nt_questions_answered ?? ntPilotSummary?.answered ?? 0;
  const hasCompletedAssessment = Boolean(
    otAnsweredCount >= ASSESSMENT_COMPLETE_THRESHOLD ||
    ntAnsweredCount >= ASSESSMENT_COMPLETE_THRESHOLD
  );
  // Which testament (if either) has an unfinished attempt sitting under the
  // threshold — used to swap "Take assessment" for "Continue assessment" and
  // resume the right test instead of re-showing the OT/NT chooser.
  const inProgressTestament: "OT" | "NT" | null = hasCompletedAssessment
    ? null
    : otAnsweredCount > 0
      ? "OT"
      : ntAnsweredCount > 0
        ? "NT"
        : null;
  const isNewAssessmentLanding = activeDashboardTab === "bli" && dashboardHydrated && !hasCompletedAssessment;
  const isDashboardLoading = activeDashboardTab === "bli" && !dashboardHydrated;

  // `obs_recommendation_seen:<actionHref>` is UI STATE ONLY — a per-device
  // record of when this recommendation was first shown, used solely to decide
  // whether the retest CTA opens the "have you reread this?" interstitial (see
  // handleRecommendedAction). It is deliberately NOT an analytics record and is
  // never consulted when deciding whether to emit an event: browser storage is
  // per-device, user-clearable, and cannot make event recording correct.
  useEffect(() => {
    if (!recommendedStudy.actionHref.startsWith("/assess?")) return;
    const key = `obs_recommendation_seen:${recommendedStudy.actionHref}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, String(Date.now()));
  }, [recommendedStudy.actionHref]);

  const recordStudyEvent = useCallback(async (
    // The client is the sole producer of `recommendation_viewed` and nothing
    // else. Lifecycle events (`retest_started`, `retest_completed`) are emitted
    // by the server-side assessment RPCs, which are the only writers that know
    // whether an attempt was actually created and can record its attempt_id.
    // Do not widen this union without re-reading
    // Documents/OBS/RETEST_STARTED_DUPLICATE_PRODUCERS_2026-08-02.md.
    eventType: "recommendation_viewed",
    unitKey: string,
    metadata: Record<string, unknown> = { source: RECOMMENDATION_EVENT_SOURCE },
  ): Promise<{ error: { code?: string | null } | null }> => {
    if (!dashboardUserId) return { error: null };
    const { error } = await supabase.rpc("obs_record_study_event", {
      p_user_id: dashboardUserId,
      p_unit_key: unitKey,
      p_event_type: eventType,
      p_attempt_id: null,
      p_metadata: metadata,
    });
    return { error };
  }, [dashboardUserId]);

  // `recommendation_viewed` records an EXPLICIT interaction with the
  // recommendation and nothing else. There is deliberately no load/render
  // effect here: mounting, reloading, remounting, reauthenticating, and
  // refreshing the recommendation must all record zero events. If page
  // impressions are ever wanted they get their own event name
  // (`recommendation_rendered`) with its own identity window.
  //
  // One interaction produces one UUID. That UUID is reused for retries of the
  // same interaction, so a retried request can never become a second row, and a
  // genuinely new interaction always mints a new UUID, so a later legitimate
  // view is never suppressed.
  const recordRecommendationView = useCallback(async (
    surface: RecommendationInteractionSurface,
  ) => {
    const unitKey = backendRecommendation?.unit_key;
    if (!dashboardUserId || !unitKey) return;
    // Serialize concurrent handlers: a double-click is one logical event.
    if (recommendationInteractionRef.current) return;

    const interactionId = newInteractionId();
    recommendationInteractionRef.current = interactionId;
    try {
      for (let attempt = 1; attempt <= RECOMMENDATION_EVENT_MAX_ATTEMPTS; attempt += 1) {
        const { error } = await recordStudyEvent(
          "recommendation_viewed",
          unitKey,
          buildRecommendationViewMetadata(interactionId, surface),
        );
        if (!error) return;
        if (attempt >= RECOMMENDATION_EVENT_MAX_ATTEMPTS || !shouldRetryStudyEvent(error)) {
          console.warn("Recommendation view event was not recorded:", error);
          return;
        }
        await new Promise(resolve => {
          setTimeout(resolve, RECOMMENDATION_EVENT_RETRY_DELAY_MS * attempt);
        });
      }
    } finally {
      recommendationInteractionRef.current = null;
    }
  }, [backendRecommendation?.unit_key, dashboardUserId, recordStudyEvent]);

  const openScopeDetail = async (target: ScopeDetailTarget) => {
    setScopeDetailTarget(target);
    setScopeSummary(null);
    setScopeSummaryError(null);
    if (!dashboardUserId) {
      setScopeSummaryError("Complete an assessment or sign in to build scope details.");
      return;
    }

    const requestId = scopeRequestRef.current + 1;
    scopeRequestRef.current = requestId;
    setScopeSummaryLoading(true);
    const { data, error } = await supabase.rpc("obs_get_scope_summary", {
      p_user_id: dashboardUserId,
      p_scope_type: target.scopeType,
      p_scope_key: target.scopeKey,
    });
    if (requestId !== scopeRequestRef.current) return;

    if (error) {
      console.error("Scope summary load failed:", error);
      setScopeSummaryError("This scope could not be loaded just now. This is usually a temporary connection problem.");
      setScopeSummaryLoading(false);
      return;
    }

    const row = ((data ?? [])[0] as ScopeSummary | undefined) ?? null;
    setScopeSummary(row ? {
      ...row,
      answered: Number(row.answered),
      correct: Number(row.correct),
      idk: Number(row.idk),
      accuracy: row.accuracy === null ? null : Number(row.accuracy),
      books: (row.books ?? []).map(book => ({
        ...book,
        answered: Number(book.answered),
        correct: Number(book.correct),
        idk: Number(book.idk),
        accuracy: book.accuracy === null ? null : Number(book.accuracy),
      })),
      dimensions: (row.dimensions ?? []).map(dimension => ({
        ...dimension,
        answered: Number(dimension.answered),
        correct: Number(dimension.correct),
        idk: Number(dimension.idk),
        accuracy: dimension.accuracy === null ? null : Number(dimension.accuracy),
      })),
    } : null);
    setScopeSummaryLoading(false);
  };

  const closeScopeDetail = useCallback(() => {
    scopeRequestRef.current += 1;
    setScopeDetailTarget(null);
    setScopeSummary(null);
    setScopeSummaryError(null);
    setScopeSummaryLoading(false);
  }, []);

  useEffect(() => {
    if (!scopeDetailTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeScopeDetail();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeScopeDetail, scopeDetailTarget]);

  useEffect(() => {
    if (!progressPanelOpen && !conePanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProgressPanelOpen(false);
      setConePanelOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [progressPanelOpen, conePanelOpen]);

  const handleRecommendedAction = (event: MouseEvent<HTMLAnchorElement>) => {
    // Clicking through the recommendation is an explicit view, in both the
    // interstitial branch and the direct-navigation branch below.
    if (isBackendRecommendationShown) void recordRecommendationView("primary_cta");
    if (!recommendedStudy.actionHref.startsWith("/assess?")) return;
    const key = `obs_recommendation_seen:${recommendedStudy.actionHref}`;
    const firstSeen = Number(localStorage.getItem(key) || Date.now());
    const isFresh = Date.now() - firstSeen < RECOMMENDATION_RETEST_WAIT_MS;
    if (isFresh) {
      event.preventDefault();
      setPendingRetestHref(recommendedStudy.actionHref);
      return;
    }
    // No client-side `retest_started`: obs_start_or_resume_ot_assessment(_v2)
    // records it when the attempt is actually created.
  };

  const continuePendingRetest = () => {
    if (!pendingRetestHref) return;
    // No client-side `retest_started` here either; see handleRecommendedAction.
    window.location.href = pendingRetestHref;
  };

  const openBliTooltip = () => {
    if (tooltipCloseRef.current) clearTimeout(tooltipCloseRef.current);
    setShowBliTooltip(true);
  };
  const closeBliTooltipSoon = () => {
    if (tooltipCloseRef.current) clearTimeout(tooltipCloseRef.current);
    tooltipCloseRef.current = setTimeout(() => setShowBliTooltip(false), 220);
  };

  // The level badge (e.g. "Literate") opens its explanation on click, not
  // hover — hover only lights the badge up via CSS. These handlers just keep
  // the popover open while focus/pointer is still inside it (button or the
  // "Learn more" link) and close it shortly after both are left.
  const cancelLevelTooltipClose = () => {
    if (levelTooltipCloseRef.current) clearTimeout(levelTooltipCloseRef.current);
  };
  const closeLevelTooltipSoon = () => {
    if (levelTooltipCloseRef.current) clearTimeout(levelTooltipCloseRef.current);
    levelTooltipCloseRef.current = setTimeout(() => setShowLevelTooltip(false), 220);
  };

  // Water slosh physics: two damped harmonic oscillators (fundamental sloshing
  // mode ~1.05 Hz + a faster, more damped second mode). Pointer movement
  // injects energy proportional to swipe distance and speed, so the water
  // responds to *how* you move, keeps ringing after the pointer leaves, and
  // settles naturally as the oscillators decay. Values are written to CSS
  // custom properties on the cone; no React re-renders per frame.
  const runSloshLoop = () => {
    const slosh = sloshRef.current;
    if (slosh.running) return;
    slosh.running = true;
    slosh.lastFrameT = performance.now();
    const step = (now: number) => {
      const cone = coneRef.current;
      if (!cone) {
        slosh.running = false;
        return;
      }
      const dt = Math.min((now - slosh.lastFrameT) / 1000, 0.05);
      slosh.lastFrameT = now;
      const w1 = 2 * Math.PI * 1.05;
      const z1 = 0.055;
      const w2 = 2 * Math.PI * 2.0;
      const z2 = 0.12;
      slosh.v1 += (-w1 * w1 * slosh.x1 - 2 * z1 * w1 * slosh.v1) * dt;
      slosh.x1 += slosh.v1 * dt;
      slosh.v2 += (-w2 * w2 * slosh.x2 - 2 * z2 * w2 * slosh.v2) * dt;
      slosh.x2 += slosh.v2 * dt;
      const amp = Math.min(1, Math.abs(slosh.x1) * 1.1 + Math.abs(slosh.x2) * 0.6);
      cone.style.setProperty("--slosh-x", slosh.x1.toFixed(4));
      cone.style.setProperty("--slosh-x2", slosh.x2.toFixed(4));
      cone.style.setProperty("--slosh-amp", amp.toFixed(4));
      const energy = Math.abs(slosh.x1) + Math.abs(slosh.v1) / w1 + Math.abs(slosh.x2) + Math.abs(slosh.v2) / w2;
      if (energy > 0.003) {
        slosh.raf = requestAnimationFrame(step);
      } else {
        slosh.running = false;
        slosh.x1 = 0; slosh.v1 = 0; slosh.x2 = 0; slosh.v2 = 0;
        cone.style.setProperty("--slosh-x", "0");
        cone.style.setProperty("--slosh-x2", "0");
        cone.style.setProperty("--slosh-amp", "0");
      }
    };
    slosh.raf = requestAnimationFrame(step);
  };

  const injectSloshImpulse = (kick: number) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const slosh = sloshRef.current;
    const clamped = Math.max(-2.4, Math.min(2.4, kick));
    slosh.v1 += clamped * 2.4;
    slosh.v2 += clamped * 4.6;
    // Clamp stored energy so frantic scrubbing can't blow up the surface
    slosh.v1 = Math.max(-8, Math.min(8, slosh.v1));
    slosh.v2 = Math.max(-15, Math.min(15, slosh.v2));
    runSloshLoop();
  };

  const handleConePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    const slosh = sloshRef.current;
    slosh.lastPointerX = event.clientX;
    slosh.lastPointerT = performance.now();
    injectSloshImpulse(0.5);
  };

  const handleConePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const slosh = sloshRef.current;
    const now = performance.now();
    if (slosh.lastPointerX !== null) {
      const dx = event.clientX - slosh.lastPointerX;
      const dtMs = Math.max(now - slosh.lastPointerT, 8);
      if (Math.abs(dx) >= 1) {
        const speed = Math.min(Math.abs(dx) / dtMs, 2);
        injectSloshImpulse(dx * 0.004 * (0.6 + speed));
      }
    }
    slosh.lastPointerX = event.clientX;
    slosh.lastPointerT = now;
  };

  const handleConePointerLeave = () => {
    sloshRef.current.lastPointerX = null;
  };

  const handleSignIn = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    // Mint the transfer capability while the guest session is still active.
    // The token proves control of that session; it lives in localStorage and
    // is never placed in the redirect URL. Passing the guest id as an "anon"
    // query parameter let a crafted callback link claim another visitor's
    // progress, and leaked the id through Referer headers and browser history.
    const anonId = isAnonymousSession(session) ? session?.user?.id : null;
    // Random, non-secret correlator so the callback can prove it completes THIS
    // flow. The capability never leaves localStorage.
    const flowId = newFlowId();
    if (anonId) {
      await beginPendingTransfer(supabase, localStorage, anonId, flowId);
    } else {
      // Not a guest session: make sure no earlier record survives into a
      // sign-in that has nothing to transfer.
      clearPendingTransfer(localStorage);
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl({ flow: flowId }) },
    });
  };

  const handleDeleteAccount = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setDeleteError("Your session has expired. Sign in again and retry.");
        return;
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmEmail: deleteConfirm.trim() }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDeleteError(payload?.error ?? "The account could not be deleted. Please try again.");
        return;
      }

      // The account is gone; drop every trace of it from this browser too.
      await supabase.auth.signOut();
      clearAssessmentBrowserStorage();
      window.location.href = "/";
    } catch {
      setDeleteError("The account could not be deleted. Please check your connection and try again.");
    } finally {
      setDeleteBusy(false);
    }
  };

  useEffect(() => {
    const slosh = sloshRef.current;
    return () => {
      cancelAnimationFrame(slosh.raf);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      let session = data.session;
      if (isAnonymousSession(session) && !sessionStorage.getItem(ANON_SESSION_ACTIVE_KEY)) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        session = null;
      }
      if (cancelled) return;
      setDashboardUserId(session?.user?.id ?? null);
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        sessionStorage.removeItem(ANON_SESSION_ACTIVE_KEY);
        sessionStorage.removeItem(ANON_USER_ID_KEY);
        sessionStorage.removeItem(SESSION_ANSWERED_KEY);
        sessionStorage.removeItem(SESSION_CORRECT_KEY);
      }
      const localAssessment = readSessionAssessmentData();
      if (localAssessment) {
        setSessionAssessmentData(localAssessment);
        setDashboardHydrated(true);
      }
      if (session?.user?.id) {
        const [
          { data: testamentScoreData, error: testamentScoreError },
          bankData,
          { data: answerData },
          { data: recommendationData },
          { data: otEvidenceData },
          { data: ntEvidenceData },
          { data: bibleEvidenceData },
          { data: sectionFollowupData },
        ] = await Promise.all([
          supabase.rpc("obs_get_bli_scores_v2", { p_user_id: session.user.id }),
          loadDimensionAwareQuestionBank(),
          supabase
            .from("assessment_answers")
            .select(
              "generated_question_id,is_correct,is_idk,scoring_eligible"
            )
            .eq("user_id", session.user.id),
          supabase.rpc("obs_get_user_recommendation_v2", { p_user_id: session.user.id }),
          supabase.rpc("obs_get_bli_uncertainty", { p_user_id: session.user.id, p_scope: "OT" }),
          supabase.rpc("obs_get_bli_uncertainty", { p_user_id: session.user.id, p_scope: "NT" }),
          // "BIBLE" is the whole-canon pooled scope — it's the Combined
          // tab's evidence only. It used to also stand in for either
          // testament alone before that testament had evidence of its own,
          // but that silently showed the same pooled numbers under OT, NT,
          // and Combined alike — indistinguishable from each other, and
          // wrong for NT specifically, whose own scope has real data for
          // only a couple of users. Each testament now shows only its own
          // evidence, falling through to the genuine "no evidence yet"
          // empty state instead.
          supabase.rpc("obs_get_bli_uncertainty", { p_user_id: session.user.id, p_scope: "BIBLE" }),
          supabase.rpc("obs_get_bli_section_followup_v1", {
            p_user_id: session.user.id,
            p_testament: "OT",
          }),
        ]);
        if (cancelled) return;
        setBackendRecommendation(((recommendationData ?? [])[0] as BackendRecommendation | undefined) ?? null);
        setSectionFollowup(((sectionFollowupData ?? [])[0] as BliSectionFollowup | undefined) ?? null);
        const otEvidence = ((otEvidenceData ?? [])[0] as BliEvidence | undefined) ?? null;
        const ntEvidence = ((ntEvidenceData ?? [])[0] as BliEvidence | undefined) ?? null;
        const bibleEvidenceRow = ((bibleEvidenceData ?? [])[0] as BliEvidence | undefined) ?? null;
        setBliEvidence(otEvidence);
        setNtBliEvidence(ntEvidence);
        setCombinedBliEvidence(bibleEvidenceRow);

        if (testamentScoreError) {
          console.error("Canonical BLI score load failed:", testamentScoreError);
        }
        const canonicalScores = normalizeBliContractRow((testamentScoreData ?? [])[0]);
        const scoped = buildScopeScores((bankData ?? []) as BankRow[], (answerData ?? []) as AnswerRow[]);
        setScopeScores({
          ...scoped,
          sections: applyCanonicalBliToSectionScopes(scoped.sections, canonicalScores),
        });
        const sectionMap: SectionScoreMap = {};
        if (canonicalScores) {
          ["Torah", "Former Prophets", "Latter Prophets", "Writings"].forEach(sectionName => {
            const score = canonicalScores.ot_section_scores[sectionName];
            if (!score) return;
            sectionMap[sectionName] = {
              accuracy_pct: score.accuracy_pct,
              total: score.answered,
              raw_bli_pct: score.raw_bli_pct,
            };
          });
        }
        setSectionScores(sectionMap);

        setTestamentScores(canonicalScores);
        if (canonicalScores) {
          if (canonicalScores.ot_questions_answered > 0) {
            setAssessmentData({
              answered: canonicalScores.ot_questions_answered,
              correct: canonicalScores.ot_correct_answers,
              bli: canonicalScores.ot_raw_bli_pct,
            });
          } else {
        setAssessmentData(null);
        setSessionAssessmentData(null);
          }
        } else {
          setAssessmentData(null);
        }
      }
    }).catch(error => {
      console.error("Dashboard bootstrap failed:", error);
    }).finally(() => {
      if (!cancelled) setDashboardHydrated(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
      setDashboardUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Close open nav menus on an outside click or Escape.
  useEffect(() => {
    if (!accountMenuOpen && !learnMoreOpen && !subjectMenuOpen) return;
    const onPointer = (event: globalThis.MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (learnMoreRef.current && !learnMoreRef.current.contains(event.target as Node)) {
        setLearnMoreOpen(false);
      }
      if (subjectMenuRef.current && !subjectMenuRef.current.contains(event.target as Node)) {
        setSubjectMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        setLearnMoreOpen(false);
        setSubjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountMenuOpen, learnMoreOpen, subjectMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    // Zero rows is a real state (unauthorized or not enough evidence yet), so
    // an empty path simply hides the card rather than surfacing an error.
    loadFocusPath(dashboardUserId)
      .then(path => { if (!cancelled) setFrontier(path); })
      .catch(error => {
        console.error("Frontier load failed:", error);
        if (!cancelled) setFrontier(EMPTY_FOCUS_PATH);
      });
    return () => { cancelled = true; };
  }, [dashboardUserId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadExploreTree(dashboardUserId, "OT", true),
      loadExploreTree(dashboardUserId, "NT", true),
    ])
      .then(([otTree, ntTree]) => {
        if (!cancelled) setCoverageTrees({ OT: otTree, NT: ntTree });
      })
      .catch(error => {
        console.error("Coverage tree load failed:", error);
        if (!cancelled) {
          setCoverageTrees({ OT: EMPTY_EXPLORE_TREE, NT: EMPTY_EXPLORE_TREE });
        }
      });
    return () => { cancelled = true; };
  }, [dashboardUserId]);

  useEffect(() => {
    if (!dashboardUserId) {
      setProgressHistory([]);
      setActiveProgressAttemptId(null);
      setProgressLoading(false);
      setProgressError(null);
      return;
    }

    let cancelled = false;
    const loadHistory = async () => {
      setProgressLoading(true);
      setProgressError(null);
      setActiveProgressAttemptId(null);

      const requestHistory = () => supabase.rpc("obs_get_progress_history", {
        p_user_id: dashboardUserId,
        p_testament: progressTestament,
        p_limit: 50,
      });

      let { data, error } = await requestHistory();
      if (!error && (data ?? []).length === 0 && progressBackfillAttemptedRef.current !== dashboardUserId) {
        progressBackfillAttemptedRef.current = dashboardUserId;
        const { error: backfillError } = await supabase.rpc("obs_backfill_assessment_snapshots", {
          p_user_id: dashboardUserId,
        });
        if (!backfillError) {
          ({ data, error } = await requestHistory());
        } else {
          error = backfillError;
        }
      }

      if (cancelled) return;
      if (error) {
        setProgressHistory([]);
        console.error("Progress history load failed:", error);
        setProgressError("Progress history could not be loaded just now. This is usually a temporary connection problem.");
        setProgressLoading(false);
        return;
      }

      const rows = ((data ?? []) as ProgressPoint[]).map(row => ({
        ...row,
        raw_bli: Number(row.raw_bli),
        display_bli: Number(row.display_bli),
        questions_answered: Number(row.questions_answered),
        correct_answers: Number(row.correct_answers),
        idk_answers: Number(row.idk_answers),
        theta: row.theta === null ? null : Number(row.theta),
        theta_se: row.theta_se === null ? null : Number(row.theta_se),
        n_responses: Number(row.n_responses),
        score_change: Number(row.score_change),
      }));
      setProgressHistory(rows);
      setActiveProgressAttemptId(rows[0]?.attempt_id ?? null);
      setProgressLoading(false);
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [dashboardUserId, progressTestament]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(0);
  // Skill constellation: when the Skills tab is active, a few sky stars fly
  // into a polygon whose vertex radii correspond exactly to domain scores.
  const constellationRef = useRef<{ active: boolean; t: number; points: { angle: number; pct: number }[]; lastTargets?: { x: number; y: number }[] }>({ active: false, t: 0, points: [] });
  const radarSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const constellation = constellationRef.current;
    if (activeBreakdownTab !== "domains") {
      constellation.active = false;
      return;
    }
    const domains = scopeScores.domains.filter(score => score.testament === profileTestament);
    constellation.points = domains.map((score, index) => {
      const isLockedConnection = score.key.endsWith(":scripture_connections") && !scriptureConnectionsUnlocked;
      const pct = isLockedConnection || score.rawScore === null || score.answered === 0 ? 0 : Math.max(0, Math.min(100, score.rawScore));
      const angle = -Math.PI / 2 + (index / Math.max(domains.length, 1)) * Math.PI * 2;
      return { angle, pct };
    });
    constellation.active = true;
  }, [activeBreakdownTab, profileTestament, scopeScores.domains, scriptureConnectionsUnlocked]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isArrivingFromAssessment = sessionStorage.getItem("obs_dashboard_arriving") === "1";
    const initialRotation = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_rotation") || 0)
      : 0;
    canvas.style.setProperty("--sky-start-rotation", `${initialRotation}deg`);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const SKY_OVERSCAN = 2.35;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = createSeededRandom(getOrCreateSkySeed());
    const isArrivingFromAssessment = sessionStorage.getItem("obs_dashboard_arriving") === "1";
    const initialRotation = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_rotation") || 0)
      : 0;
    const initialFrame = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_frame") || 0)
      : 0;
    let initialOffset = { x: 0, y: 0 };
    if (isArrivingFromAssessment) {
      try {
        initialOffset = JSON.parse(sessionStorage.getItem("obs_dashboard_sky_offset") || "{}") || initialOffset;
      } catch {}
    }
    canvas.style.setProperty("--sky-start-rotation", `${initialRotation}deg`);
    sessionStorage.removeItem("obs_dashboard_arriving");
    sessionStorage.removeItem("obs_dashboard_sky_rotation");
    sessionStorage.removeItem("obs_dashboard_sky_frame");
    sessionStorage.removeItem("obs_dashboard_sky_offset");

    function resize() {
      if (!canvas || !ctx) return;
      const skyWidth = window.innerWidth * SKY_OVERSCAN;
      const skyHeight = window.innerHeight * SKY_OVERSCAN;
      canvas.width = skyWidth * DPR;
      canvas.height = skyHeight * DPR;
      canvas.style.width = skyWidth + "px";
      canvas.style.height = skyHeight + "px";
    }

    resize();
    window.addEventListener("resize", resize);

    function handleScroll() {
      scrollRef.current = window.scrollY || window.pageYOffset || 0;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Generate stars
    const STAR_COUNT = 1400;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: random(),
      y: random(),
      r: (0.5 + random() * 1.8) * DPR,
      opacity: 0.5 + random() * 0.5,
      twinkleSpeed: 0.002 + random() * 0.004,
      twinkleOffset: random() * Math.PI * 2,
    }));

    const shootingPalettes = SHOOTING_PALETTES;
    const nextShootingStarGap = () => 420 + Math.floor(random() * 300);
    const createShootingStar = (startFrame: number) => {
      const fromLeft = random() > 0.28;
      const palette = shootingPalettes[Math.floor(random() * shootingPalettes.length)];
      return {
        x: fromLeft ? -0.22 : 1.08,
        y: 0.02 + random() * 0.48,
        dx: (fromLeft ? 1 : -1) * (0.18 + random() * 0.12),
        dy: 0.055 + random() * 0.16,
        startFrame,
        duration: 220 + Math.floor(random() * 110),
        length: (90 + random() * 80) * DPR,
        width: (1.25 + random() * 0.8) * DPR,
        palette,
      };
    };
    const shootingStars = [createShootingStar(240 + Math.floor(random() * 360))];

    function resetShootingStar(star: (typeof shootingStars)[number]) {
      Object.assign(star, createShootingStar(star.startFrame + nextShootingStarGap()));
    }

    let frame = initialFrame;
    const skyOffsetX = Number(initialOffset.x || 0) * DPR;
    const skyOffsetY = Number(initialOffset.y || 0) * DPR;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      // Deep navy gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0b0f1e");
      grad.addColorStop(0.5, "#111827");
      grad.addColorStop(1, "#0d1530");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Advance domain-constellation activation (eased 0..1)
      const constellation = constellationRef.current;
      constellation.t += ((constellation.active ? 1 : 0) - constellation.t) * 0.05;
      if (constellation.t < 0.005) constellation.t = constellation.active ? constellation.t : 0;
      // Map radar-chart SVG coordinates into sky-canvas pixels so the
      // constellation overlays the radar exactly (accounts for canvas
      // centering, overscan, DPR, and initial rotation).
      let constellationTargets: { x: number; y: number }[] | null = null;
      const radarRect = radarSvgRef.current?.getBoundingClientRect();
      if (radarRect && radarRect.width > 0) {
        const theta = (initialRotation * Math.PI) / 180;
        const cosT = Math.cos(-theta);
        const sinT = Math.sin(-theta);
        const viewportCx = window.innerWidth / 2;
        const viewportCy = window.innerHeight / 2;
        constellationTargets = constellation.points.map(point => {
          const svgX = 160 + Math.cos(point.angle) * 104 * (point.pct / 100);
          const svgY = 160 + Math.sin(point.angle) * 104 * (point.pct / 100);
          const px = radarRect.left + (svgX / 320) * radarRect.width;
          const py = radarRect.top + (svgY / 320) * radarRect.height;
          const dx = px - viewportCx;
          const dy = py - viewportCy;
          return {
            x: w / 2 + (dx * cosT - dy * sinT) * DPR,
            y: h / 2 + (dx * sinT + dy * cosT) * DPR,
          };
        });
        constellation.lastTargets = constellationTargets;
      } else if (constellation.lastTargets && constellation.lastTargets.length === constellation.points.length) {
        constellationTargets = constellation.lastTargets;
      }
      const memberCount = constellation.t > 0.01 && constellationTargets ? constellation.points.length : 0;
      const constellationEase = constellation.t * constellation.t * (3 - 2 * constellation.t);

      // Draw stars with twinkle (constellation members are drawn separately below)
      stars.forEach((star, index) => {
        if (index < memberCount) return;
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        const opacity = star.opacity * (0.6 + 0.4 * twinkle);
        const x = ((star.x * w + skyOffsetX) % (w + 40) + w + 40) % (w + 40) - 20;
        const y = ((star.y * h + skyOffsetY - scrollRef.current * 0.15 * DPR) % (h + 40) + h + 40) % (h + 40) - 20;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      });

      // Domain constellation: repositioned, brightened, connected stars.
      // Vertex distance from center is exactly proportional to each domain score.
      if (memberCount > 0) {
        const targets = constellationTargets as { x: number; y: number }[];
        const memberPoints = constellation.points.map((_point, index) => {
          const star = stars[index];
          const homeX = ((star.x * w + skyOffsetX) % (w + 40) + w + 40) % (w + 40) - 20;
          const homeY = ((star.y * h + skyOffsetY - scrollRef.current * 0.15 * DPR) % (h + 40) + h + 40) % (h + 40) - 20;
          const target = targets[index];
          return {
            x: homeX + (target.x - homeX) * constellationEase,
            y: homeY + (target.y - homeY) * constellationEase,
            star,
          };
        });

        const lineAlpha = Math.max(0, (constellationEase - 0.55) / 0.45);
        if (lineAlpha > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(173,232,255,${0.55 * lineAlpha})`;
          ctx.lineWidth = 1.1 * DPR;
          ctx.shadowColor = `rgba(10,163,163,${0.5 * lineAlpha})`;
          ctx.shadowBlur = 8 * DPR;
          ctx.beginPath();
          memberPoints.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        memberPoints.forEach(point => {
          const twinkle = Math.sin(frame * point.star.twinkleSpeed * 2 + point.star.twinkleOffset);
          const brightRadius = point.star.r * (1 + 2.4 * constellationEase) + 0.4 * twinkle * DPR * constellationEase;
          ctx.save();
          ctx.shadowColor = `rgba(173,232,255,${0.9 * constellationEase})`;
          ctx.shadowBlur = 14 * DPR * constellationEase;
          ctx.beginPath();
          ctx.arc(point.x, point.y, Math.max(brightRadius, 0.4), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * constellationEase})`;
          ctx.fill();
          ctx.restore();
        });
      }

      shootingStars.forEach(star => {
        const progress = (frame - star.startFrame) / star.duration;
        if (progress > 1) {
          resetShootingStar(star);
          return;
        }
        if (progress < 0) return;

        const opacity = Math.sin(progress * Math.PI) * 0.9;
        const headX = star.x * w + progress * w * star.dx + skyOffsetX * 0.12;
        const headY = star.y * h + progress * h * star.dy + skyOffsetY * 0.12;
        const angle = Math.atan2(h * star.dy, w * star.dx);
        const tailX = headX - Math.cos(angle) * star.length;
        const tailY = headY - Math.sin(angle) * star.length;
        drawStreak(ctx, {
          tailX,
          tailY,
          headX,
          headY,
          opacity,
          width: star.width,
          blur: 10 * DPR,
          palette: star.palette,
        });
      });

      // Teal nebula glow
      const nebula = ctx.createRadialGradient(w * 0.7 + skyOffsetX * 0.1, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.4);
      nebula.addColorStop(0, "rgba(10,163,163,0.05)");
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      frame++;
      if (!reduceMotion) animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <style>{`
        :root {
          --ink: #0e1116; --muted: #566070; --navy: #1b2442;
          --accent: #0aa3a3; --accent-dim: rgba(10,163,163,.10);
          --accent-line: rgba(10,163,163,.22);
          --card: rgba(255,255,255,.96); --border: rgba(27,36,66,.09);
          --shadow: 0 22px 58px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.2);
          --shadow-sm: 0 6px 20px rgba(0,0,0,.25);
          --torah-bar: linear-gradient(90deg,#d4a017,#f5c842);
          --former-bar: linear-gradient(90deg,#0e8c6a,#34d399);
          --latter-bar: linear-gradient(90deg,#2563c4,#60a5fa);
          --writings-bar: linear-gradient(90deg,#7c3aed,#a78bfa);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body {
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          color: var(--ink); min-height: 100vh;
          background: #0b0f1e;
        }
        canvas.stars {
          position: fixed; left: 50%; top: 50%; z-index: 0; pointer-events: none;
          transform-origin: 50% 50%; transform: translate3d(-50%,-50%,0) rotate(var(--sky-start-rotation, 0deg));
        }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px;
          background: rgba(11,15,30,.80);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nav-brand {
          font-family: var(--font-crimson), Georgia, serif;
          font-weight: 600; font-size: 18px;
          color: #fff; text-decoration: none; letter-spacing: .01em;
        }
        .brand-wrap { display: inline-flex; align-items: center; gap: 8px; }
        .beta-badge {
          position: relative;
          display: inline-flex; align-items: center;
          padding: 2px 8px; border-radius: 999px;
          font-family: system-ui, sans-serif;
          font-size: 10px; font-weight: 800; letter-spacing: .10em;
          text-transform: uppercase;
          color: rgba(255,255,255,.82);
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.16);
          cursor: help; outline: none;
        }
        .beta-tooltip {
          position: absolute; top: calc(100% + 10px); left: 0;
          width: 260px; padding: 10px 12px;
          border-radius: 10px;
          background: rgba(14,18,38,.98);
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 12px 34px rgba(0,0,0,.5);
          font-family: system-ui, sans-serif;
          font-size: 12px; font-weight: 500; letter-spacing: 0;
          text-transform: none; line-height: 1.45;
          color: rgba(255,255,255,.86);
          opacity: 0; visibility: hidden; transform: translateY(-4px);
          transition: opacity .16s ease, transform .16s ease, visibility .16s;
          z-index: 50; pointer-events: none;
        }
        .beta-badge:hover .beta-tooltip,
        .beta-badge:focus .beta-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }

        .nav-right { display: flex; align-items: center; gap: 10px; }
        .nav-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          border: 1px solid rgba(255,255,255,.15); cursor: pointer; text-decoration: none;
          background: transparent; color: rgba(255,255,255,.7);
          transition: transform .14s ease, background .15s ease, color .15s ease;
        }
        .nav-btn:hover { background: rgba(255,255,255,.1); color: #fff; transform: translateY(-1px); }
        .learn-more { position: relative; }
        .learn-more-trigger svg { transition: transform .14s ease; }
        .learn-more-trigger[aria-expanded="true"] {
          background: rgba(255,255,255,.12);
          color: #fff;
        }
        .learn-more-trigger[aria-expanded="true"] svg { transform: rotate(180deg); }
        .learn-more-menu {
          position: absolute; top: calc(100% + 14px); right: 0; z-index: 60;
          width: min(268px, calc(100vw - 32px));
          padding: 10px; border-radius: 16px;
          background: rgba(11,15,30,.97);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 24px 60px rgba(0,0,0,.5);
          transform-origin: top right;
          animation: learnMoreMenuIn .22s cubic-bezier(.22,.9,.32,1) both;
        }
        /* A faint dashed ring drifting slowly behind the panel — the same
           orbit motif as the brand mark and the knowledge map, just quiet
           enough not to compete with the menu items. */
        .learn-more-menu::before {
          content: ""; position: absolute; top: -52px; right: -34px; z-index: -1;
          width: 190px; height: 190px; border-radius: 50%;
          border: 1px dashed rgba(111,224,224,.22);
          pointer-events: none;
          animation: learnMoreOrbitSpin 48s linear infinite;
        }
        @keyframes learnMoreMenuIn {
          0% { opacity: 0; transform: scale(.92) translateY(-6px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes learnMoreOrbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .learn-more-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 11px; border-radius: 10px;
          color: #fff; text-decoration: none;
          transition: background .14s ease;
          opacity: 0;
        }
        /* Three slightly different arrival curves so the items read as
           separate bodies swinging into place rather than one block sliding
           in — the closest a transform-only animation gets to an orbit path. */
        .learn-more-item:nth-child(1) { animation: learnMoreItemIn1 .5s cubic-bezier(.22,.9,.32,1) .02s both; }
        .learn-more-item:nth-child(2) { animation: learnMoreItemIn2 .5s cubic-bezier(.22,.9,.32,1) .10s both; }
        .learn-more-item:nth-child(3) { animation: learnMoreItemIn3 .5s cubic-bezier(.22,.9,.32,1) .18s both; }
        @keyframes learnMoreItemIn1 {
          0% { opacity: 0; transform: translate(26px,-20px) scale(.5); }
          60% { opacity: 1; transform: translate(-4px,4px) scale(1.06); }
          100% { opacity: 1; transform: translate(0,0) scale(1); }
        }
        @keyframes learnMoreItemIn2 {
          0% { opacity: 0; transform: translate(10px,-26px) scale(.5); }
          60% { opacity: 1; transform: translate(-2px,5px) scale(1.05); }
          100% { opacity: 1; transform: translate(0,0) scale(1); }
        }
        @keyframes learnMoreItemIn3 {
          0% { opacity: 0; transform: translate(-6px,-22px) scale(.5); }
          60% { opacity: 1; transform: translate(3px,4px) scale(1.05); }
          100% { opacity: 1; transform: translate(0,0) scale(1); }
        }
        .learn-more-planet {
          flex-shrink: 0; margin-top: 4px;
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--planet-color);
          box-shadow: 0 0 9px var(--planet-color);
        }
        .learn-more-item-copy { display: flex; flex-direction: column; gap: 2px; }
        .learn-more-item-title { font-size: 13px; font-weight: 700; line-height: 1.25; }
        .learn-more-item span:not(.learn-more-item-title) {
          display: block;
          color: rgba(255,255,255,.56); font-size: 11px; font-weight: 600;
        }
        .learn-more-item:hover,
        .learn-more-item:focus-visible {
          background: rgba(255,255,255,.08);
          outline: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .learn-more-menu::before { display: none; }
        }
        .page {
          max-width: 1180px; margin: 0 auto; padding: 44px 24px 88px; position: relative; z-index: 1;
          /* backwards (not both): holds the "from" state during the .08s
             delay so there's no flash-before-fade-in, but — critically —
             does NOT hold the "to" state once the animation finishes.
             "both" was leaving a resolved (non-"none") transform matrix on
             this element indefinitely via getComputedStyle, which creates a
             new containing block and silently breaks every
             position:fixed descendant (e.g. the scope-drawer modal) into
             positioning relative to .page instead of the viewport. */
          animation: dashboardPageReveal .7s cubic-bezier(.22,.72,.18,1) .08s backwards;
        }
        .page.is-new-assessment-landing {
          max-width: 1240px;
          padding-top: 54px;
        }
        .page.is-dashboard-loading {
          min-height: calc(100vh - 80px);
          display: grid;
          place-items: center;
          padding-top: 0;
          padding-bottom: 0;
        }
        @keyframes dashboardPageReveal {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 36px; flex-wrap: wrap;
        }
        .page-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 30px; font-weight: 600; line-height: 1.1;
          color: #fff; letter-spacing: .005em;
        }
        .page-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        /* Subject switcher — replaces the old three-tile dashboard-tabs grid
           for returning users, reclaiming that whole row. Reuses the nav's
           learn-more-menu visual language (dark panel, planet-dot rows) for
           the dropdown itself so it doesn't feel like a third pattern. */
        .subject-switcher { position: relative; }
        .subject-trigger {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 12px 6px 10px; border-radius: 999px; margin-top: 2px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
          color: rgba(255,255,255,.85); font: inherit; font-size: 12.5px; font-weight: 750;
          cursor: pointer; transition: background .15s ease, border-color .15s ease;
        }
        .subject-trigger:hover, .subject-trigger:focus-visible { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.26); outline: none; }
        .subject-trigger svg { color: rgba(255,255,255,.5); }
        .subject-trigger-dot {
          width: 7px; height: 7px; border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
        }
        .subject-menu { top: calc(100% + 10px); left: 0; right: auto; transform-origin: top left; }
        .subject-menu::before { left: -34px; right: auto; }
        .subject-menu-item { width: 100%; border: 0; background: transparent; cursor: pointer; }
        .subject-menu-item.is-active { background: rgba(255,255,255,.07); }
        .subject-menu-item.is-active .learn-more-item-title::after {
          content: "· current"; margin-left: 6px; font-weight: 600;
          color: rgba(255,255,255,.4); text-transform: none; letter-spacing: 0;
        }
        .page-meta {
          font-size: 13px; color: rgba(255,255,255,.45); margin-top: 5px;
          display: flex; align-items: center; gap: 6px;
        }
        .page-meta::before {
          content: ""; display: inline-block;
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(255,255,255,.25);
        }
        .dashboard-tabs {
          display: inline-grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px; width: 100%; max-width: 760px;
          padding: 6px; margin: -14px 0 28px;
          border: 1px solid rgba(212,160,23,.28); border-radius: 16px;
          background: rgba(255,255,255,.07); backdrop-filter: blur(14px);
          box-shadow: 0 16px 40px rgba(0,0,0,.22), 0 0 30px rgba(212,160,23,.055), inset 0 0 0 1px rgba(245,200,66,.06);
        }
        .page.is-new-assessment-landing .dashboard-tabs {
          max-width: 820px;
          margin: 0 0 28px;
        }
        .dashboard-tab {
          border: 0; border-radius: 11px; padding: 12px 14px;
          background: transparent; color: rgba(255,255,255,.62);
          display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          cursor: pointer; font-family: inherit; text-align: left;
          transition: background .16s ease, color .16s ease, transform .14s ease;
        }
        .dashboard-tab strong {
          font-size: 13px; font-weight: 800; letter-spacing: .02em;
        }
        .dashboard-tab span {
          font-size: 11px; font-weight: 650; color: rgba(255,255,255,.38);
        }
        .dashboard-tab:hover { background: rgba(255,255,255,.08); color: #fff; transform: translateY(-1px); }
        .dashboard-tab.is-active {
          background: rgba(255,255,255,.92); color: var(--navy);
          box-shadow: 0 10px 24px rgba(0,0,0,.2);
        }
        .dashboard-tab.is-active span { color: var(--muted); }
        .dashboard-loading-card {
          position: relative;
          min-height: min(460px, 62vh); width: 100%; padding: 32px;
          display: grid; place-items: center;
          color: #fff; text-align: center;
        }
        .dashboard-loading-orbit {
          position: relative; width: 58px; height: 58px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 0 28px rgba(10,163,163,.16), inset 0 0 22px rgba(255,255,255,.04);
          animation: dashboardLoadingSpin 2.8s linear infinite;
        }
        .dashboard-loading-orbit::before,
        .dashboard-loading-orbit::after {
          content: ""; position: absolute; border-radius: 999px;
        }
        .dashboard-loading-orbit::before {
          width: 16px; height: 16px; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle at 35% 30%, #fff6c9, #d4a017 58%, #8c640a);
          box-shadow: 0 0 18px rgba(212,160,23,.48);
        }
        .dashboard-loading-orbit::after {
          width: 10px; height: 10px; right: 2px; top: 24px;
          background: radial-gradient(circle at 35% 30%, #dbfffb, #0aa3a3);
          box-shadow: 0 0 14px rgba(10,163,163,.58);
        }
        .dashboard-loading-sr {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        @keyframes dashboardLoadingSpin { to { transform: rotate(1turn); } }
        .save-results-card {
          position: relative; overflow: hidden;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(226,232,240,.92); border-radius: 12px;
          box-shadow: 0 12px 28px rgba(0,0,0,.14);
          backdrop-filter: blur(14px);
          padding: 15px 18px; margin-bottom: 22px;
          display: grid; grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px; align-items: center;
        }
        .save-results-card::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: linear-gradient(180deg, #0aa3a3, #d4a017);
          pointer-events: none;
        }
        .save-results-graphic,
        .save-results-content,
        .save-results-actions { position: relative; z-index: 1; }
        .save-results-graphic {
          display: none;
          width: 72px; aspect-ratio: 1; border-radius: 50%;
          border: 1px solid rgba(10,163,163,.22);
          background:
            radial-gradient(circle at 50% 50%, rgba(255,246,201,.92) 0 8px, rgba(212,160,23,.95) 9px 15px, transparent 16px),
            radial-gradient(circle at 74% 28%, rgba(219,255,251,.95) 0 5px, rgba(10,163,163,.90) 6px 10px, transparent 11px),
            radial-gradient(circle at 28% 75%, rgba(255,255,255,.92) 0 4px, rgba(124,58,237,.82) 5px 8px, transparent 9px),
            rgba(255,255,255,.46);
          box-shadow: inset 0 0 30px rgba(10,163,163,.10), 0 14px 30px rgba(27,36,66,.14);
        }
        .save-results-graphic::before,
        .save-results-graphic::after {
          content: ""; position: absolute; border-radius: 50%; pointer-events: none;
        }
        .save-results-graphic::before {
          inset: 13px; border: 1px dashed rgba(10,163,163,.42);
          transform: rotate(-18deg) scaleX(1.18);
        }
        .save-results-graphic::after {
          right: -3px; bottom: 7px; width: 22px; height: 22px;
          background: #fff; border: 1px solid rgba(10,163,163,.22);
          box-shadow: 0 8px 18px rgba(27,36,66,.13);
        }
        .save-results-check {
          position: absolute; right: 3px; bottom: 14px; z-index: 2;
          width: 11px; height: 7px;
          border-left: 2px solid #0a6e6e; border-bottom: 2px solid #0a6e6e;
          transform: rotate(-45deg);
        }
        .save-results-kicker {
          display: inline-flex; align-items: center; gap: 7px;
          color: #0a6e6e; font-size: 10px; font-weight: 900;
          letter-spacing: .11em; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .save-results-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; font-weight: 650; line-height: 1.08;
          color: var(--navy); margin-bottom: 4px;
        }
        .save-results-copy {
          color: var(--muted); font-size: 12.5px; line-height: 1.45;
          max-width: 720px;
        }
        .save-results-actions {
          display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        }
        .save-results-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          border: none; border-radius: 999px; padding: 10px 16px;
          background: var(--navy);
          color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 850;
          cursor: pointer; box-shadow: 0 10px 22px rgba(27,36,66,.24);
          transition: transform .13s ease, box-shadow .15s ease;
          white-space: nowrap;
        }
        .save-results-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(27,36,66,.30); }
        .save-results-note {
          font-size: 11px; color: rgba(86,96,112,.76); font-weight: 650;
          text-align: right;
        }
        @keyframes saveResultsGlow { to { transform: rotate(1turn); } }
        .first-assessment-card {
          position: relative; overflow: hidden;
          display: grid; grid-template-columns: minmax(280px, 420px) minmax(0, 1fr);
          gap: 34px; align-items: center;
          min-height: 430px; padding: 38px;
          color: #fff;
          background:
            radial-gradient(circle at 21% 38%, rgba(255,214,92,.36), transparent 36%),
            radial-gradient(circle at 76% 18%, rgba(229,173,35,.28), transparent 34%),
            radial-gradient(circle at 88% 74%, rgba(10,163,163,.16), transparent 35%),
            linear-gradient(145deg, rgba(79,58,17,.74), rgba(37,31,27,.70) 44%, rgba(10,22,38,.78));
          border: 1px solid rgba(245,200,66,.48); border-radius: 22px;
          box-shadow: 0 30px 90px rgba(0,0,0,.28), 0 0 58px rgba(212,160,23,.18), inset 0 0 82px rgba(255,220,126,.10), inset 0 0 0 1px rgba(255,237,171,.12);
          backdrop-filter: blur(18px);
        }
        .first-assessment-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background-image:
            radial-gradient(circle, rgba(255,255,255,.78) 0 1px, transparent 1.4px),
            radial-gradient(circle, rgba(255,255,255,.38) 0 1px, transparent 1.5px);
          background-size: 92px 92px, 137px 137px;
          background-position: 10px 18px, 42px 56px;
          opacity: .55;
        }
        .first-assessment-orbit,
        .first-assessment-content { position: relative; z-index: 1; }
        .first-assessment-orbit {
          width: min(100%, 380px); aspect-ratio: 1; border-radius: 999px;
          border: 1px dashed rgba(255,255,255,.24);
          margin: 0 auto;
          background: radial-gradient(circle at 50% 50%, rgba(212,160,23,.10), transparent 38%);
        }
        .first-assessment-orbit::before,
        .first-assessment-orbit::after {
          content: ""; position: absolute; border-radius: 999px; pointer-events: none;
        }
        .first-assessment-orbit::before {
          inset: 56px; border: 1px dashed rgba(10,163,163,.34);
          transform: rotate(-22deg) scaleX(1.18);
        }
        .first-assessment-orbit::after {
          inset: 110px; border: 1px solid rgba(255,255,255,.14);
          transform: rotate(18deg) scaleX(1.42);
        }
        .first-assessment-sun,
        .first-assessment-planet,
        .first-assessment-moon {
          position: absolute; display: block; border-radius: 999px;
          box-shadow: 0 0 34px currentColor;
        }
        .first-assessment-sun {
          width: 102px; height: 102px; left: 50%; top: 50%;
          color: rgba(212,160,23,.72);
          background: radial-gradient(circle at 38% 38%, #fff2b8, #d4a017 45%, #91680e);
          transform: translate(-50%, -50%);
        }
        .first-assessment-planet {
          width: 56px; height: 56px; left: 73%; top: 35%;
          color: rgba(10,163,163,.58);
          background: radial-gradient(circle at 36% 34%, #d6fffa, #0aa3a3 48%, #075e61);
        }
        .first-assessment-moon {
          width: 24px; height: 24px; left: 82%; top: 52%;
          color: rgba(255,255,255,.38);
          background: radial-gradient(circle at 38% 38%, #fff, #cfd6df 55%, #7f8b99);
        }
        .first-assessment-kicker {
          margin-bottom: 11px; color: #5eead4;
          font-size: 12px; font-weight: 900; letter-spacing: .13em; text-transform: uppercase;
        }
        .first-assessment-content h2 {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(36px, 5vw, 58px); line-height: .98; font-weight: 700;
          max-width: 520px; margin-bottom: 16px;
        }
        .first-assessment-content p {
          max-width: 560px; color: rgba(255,255,255,.76);
          font-size: 16px; line-height: 1.65; margin-bottom: 24px;
        }
        .first-assessment-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .first-assessment-primary,
        .first-assessment-secondary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 44px; padding: 12px 18px; border-radius: 999px;
          font-size: 14px; font-weight: 850; text-decoration: none;
          font-family: inherit; cursor: pointer;
        }
        .first-assessment-primary {
          border: 0;
          background: #e6ad12; color: #141827;
          box-shadow: 0 14px 34px rgba(230,173,18,.28);
        }
        .first-assessment-secondary {
          border: 1px solid rgba(255,255,255,.24); color: rgba(255,255,255,.88);
          background: rgba(255,255,255,.06);
        }
        .first-assessment-choice-panel {
          margin-top: 18px; width: min(100%, 540px);
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
          animation: firstAssessmentChoiceIn .2s ease both;
        }
        .first-assessment-choice {
          display: grid; gap: 5px; min-height: 92px;
          padding: 16px; border-radius: 14px;
          text-decoration: none; color: #fff;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.075);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.035);
          transition: transform .14s ease, border-color .14s ease, background .14s ease;
        }
        .first-assessment-choice:hover,
        .first-assessment-choice:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(230,173,18,.48);
          background: rgba(255,255,255,.11);
          outline: none;
        }
        .first-assessment-choice strong {
          font-size: 14px; font-weight: 900;
        }
        .first-assessment-choice span {
          color: rgba(255,255,255,.62);
          font-size: 12px; line-height: 1.35; font-weight: 650;
        }
        @keyframes firstAssessmentChoiceIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .first-assessment-steps {
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          margin-top: 28px; color: rgba(255,255,255,.68);
          font-size: 12px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em;
        }
        .first-assessment-steps span {
          padding: 7px 10px; border-radius: 999px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.13);
        }
        .oba-feature-grid {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px; margin-top: 34px;
        }
        .oba-feature-card {
          position: relative; overflow: hidden;
          min-height: 238px; padding: 20px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.16);
          background:
            linear-gradient(145deg, rgba(255,255,255,.94), rgba(240,247,251,.88));
          box-shadow: 0 18px 52px rgba(0,0,0,.22), inset 0 0 34px rgba(255,255,255,.42);
          backdrop-filter: blur(16px);
          color: var(--navy);
        }
        .oba-feature-card::before {
          content: ""; position: absolute; inset: -35% -20% auto auto;
          width: 180px; height: 180px; border-radius: 999px;
          background: color-mix(in srgb, var(--feature-hue) 22%, transparent);
          filter: blur(4px); pointer-events: none;
        }
        .oba-feature-graphic {
          position: relative; height: 88px; margin-bottom: 15px;
          border-radius: 14px;
          background:
            radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--feature-hue) 18%, transparent), transparent 58%),
            rgba(27,36,66,.045);
          border: 1px solid rgba(27,36,66,.08);
        }
        .oba-feature-graphic span {
          position: absolute; display: block;
        }
        .oba-feature-graphic.is-signal .signal-node {
          width: 16px; height: 16px; border-radius: 999px;
          background: var(--feature-hue);
          box-shadow: 0 0 0 7px color-mix(in srgb, var(--feature-hue) 16%, transparent), 0 0 24px color-mix(in srgb, var(--feature-hue) 40%, transparent);
        }
        .oba-feature-graphic.is-signal .signal-node:nth-child(1) { left: 18%; top: 54%; }
        .oba-feature-graphic.is-signal .signal-node:nth-child(2) { left: 46%; top: 26%; }
        .oba-feature-graphic.is-signal .signal-node:nth-child(3) { left: 72%; top: 50%; }
        .oba-feature-graphic.is-signal .signal-line {
          height: 2px; width: 34%; left: 28%; top: 46%;
          background: linear-gradient(90deg, transparent, var(--feature-hue), transparent);
          transform: rotate(-22deg);
        }
        .oba-feature-graphic.is-signal .signal-line:nth-child(5) {
          left: 53%; top: 43%; width: 26%; transform: rotate(18deg);
        }
        .oba-feature-graphic.is-map .map-orbit {
          inset: 16px 31%; border-radius: 999px;
          border: 1.5px dashed color-mix(in srgb, var(--feature-hue) 46%, transparent);
          transform: rotate(-13deg) scaleX(1.55);
        }
        .oba-feature-graphic.is-map .map-star {
          width: 34px; height: 34px; left: 42%; top: 28%;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 30%, #fff7c9, var(--feature-hue) 58%, #8c640a);
          box-shadow: 0 0 24px color-mix(in srgb, var(--feature-hue) 48%, transparent);
        }
        .oba-feature-graphic.is-map .map-planet {
          width: 18px; height: 18px; left: 67%; top: 48%;
          border-radius: 999px; background: #0aa3a3;
          box-shadow: 0 0 16px rgba(10,163,163,.45);
        }
        .oba-feature-graphic.is-path .path-step {
          width: 22px; height: 22px; border-radius: 7px;
          border: 2px solid var(--feature-hue);
          background: color-mix(in srgb, var(--feature-hue) 15%, #ffffff);
        }
        .oba-feature-graphic.is-path .path-step:nth-child(1) { left: 16%; top: 48%; opacity: .58; }
        .oba-feature-graphic.is-path .path-step:nth-child(2) { left: 42%; top: 34%; opacity: .8; }
        .oba-feature-graphic.is-path .path-step:nth-child(3) { left: 68%; top: 22%; background: var(--feature-hue); }
        .oba-feature-graphic.is-path .path-line {
          height: 2px; width: 58%; left: 23%; top: 45%;
          background: linear-gradient(90deg, color-mix(in srgb, var(--feature-hue) 32%, transparent), var(--feature-hue));
          transform: rotate(-15deg);
        }
        .oba-feature-kicker {
          margin: 0 0 7px; color: color-mix(in srgb, var(--feature-hue) 72%, #17213d);
          font-size: 10px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase;
        }
        .oba-feature-title {
          margin: 0; font-family: var(--font-crimson), Georgia, serif;
          font-size: 22px; line-height: 1.05; color: var(--navy);
        }
        .oba-feature-copy {
          margin: 8px 0 0; color: rgba(57,67,87,.78);
          font-size: 13px; line-height: 1.5; font-weight: 650;
        }
        .placeholder-dashboard {
          background: var(--card); border: 1px solid var(--border); border-radius: 20px;
          box-shadow: var(--shadow); backdrop-filter: blur(16px);
          padding: 44px 46px; min-height: 420px;
          display: grid; grid-template-columns: 1fr 240px; gap: 32px; align-items: center;
        }
        .placeholder-eyebrow {
          font-size: 12px; font-weight: 850; letter-spacing: .13em; text-transform: uppercase;
          color: #0a6e6e; margin-bottom: 12px;
        }
        .placeholder-title {
          font-family: var(--font-crimson), Georgia, serif; font-size: 36px; line-height: 1.04;
          color: var(--navy); margin-bottom: 14px;
        }
        .placeholder-copy { color: var(--muted); font-size: 15px; line-height: 1.65; max-width: 560px; }
        .placeholder-list { display: grid; gap: 10px; margin-top: 24px; }
        .placeholder-pill {
          width: fit-content; padding: 9px 13px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a6e6e; font-size: 12px; font-weight: 800;
        }
        .placeholder-orbit {
          width: 220px; aspect-ratio: 1; border-radius: 999px; position: relative;
          border: 1px solid rgba(10,163,163,.22);
          background: radial-gradient(circle, rgba(255,255,255,.85) 0 18%, rgba(10,163,163,.12) 19% 46%, transparent 47%);
          box-shadow: inset 0 0 42px rgba(10,163,163,.13), 0 18px 42px rgba(27,36,66,.12);
        }
        .placeholder-orbit::before,
        .placeholder-orbit::after {
          content: ""; position: absolute; inset: 24px; border-radius: inherit;
          border: 1px solid rgba(27,36,66,.12); transform: rotate(-18deg) scaleX(1.28);
        }
        .placeholder-orbit::after {
          inset: 54px; border-color: rgba(212,160,23,.32); transform: rotate(28deg) scaleX(1.42);
        }
        /* No card here on purpose — the score sits straight on the
           starfield, like the header-assess controls above it. */
        .score-strip {
          display: grid; grid-template-columns: auto 1fr auto;
          background: transparent; border: 1px solid rgba(212,160,23,.4); border-radius: 14px;
          box-shadow: none;
          overflow: visible;
          margin-bottom: 28px; position: relative; z-index: 40;
        }
        .score-block, .level-block, .conf-block { animation: scoreTabIn .35s ease both; }
        @keyframes scoreTabIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        /* Combined BLI used to be a third tab alongside OT/NT in its own
           row; now that the header's OT/NT toggle drives this panel
           directly, Combined isn't something you "switch to" (there's no
           combined assessment) — it's a standing fact shown alongside
           whichever testament is active. */
        .combined-note {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 14px; color: rgba(255,255,255,.6);
          font-size: 12.5px; font-weight: 650;
        }
        .combined-note strong { color: #fff; font-weight: 800; }
        .combined-note-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #0aa3a3; box-shadow: 0 0 8px rgba(10,163,163,.7);
          flex-shrink: 0;
        }
        .progress-card {
          position: relative; z-index: 3; overflow: hidden;
          margin: 0 0 18px; padding: 24px 26px 20px;
          color: var(--navy); background: var(--card);
          border: 1px solid var(--border); border-radius: 20px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
        }
        .progress-panel {
          margin: -10px 0 30px;
          animation: knowledgeProfileIn .22s cubic-bezier(.22,.72,.18,1) both;
        }
        .progress-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 14% 26%, rgba(10,163,163,.12), transparent 28%),
            radial-gradient(circle at 86% 18%, rgba(212,160,23,.10), transparent 30%);
          opacity: .9;
        }
        .progress-head {
          position: relative; z-index: 1;
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 22px; margin-bottom: 18px;
        }
        .progress-eyebrow {
          margin-bottom: 5px; color: #0a6e6e;
          font-size: 10px; font-weight: 850; letter-spacing: .13em;
          text-transform: uppercase;
        }
        .progress-title {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 650; line-height: 1.1;
        }
        .progress-sub {
          max-width: 500px; margin-top: 5px;
          color: var(--muted); font-size: 12.5px; line-height: 1.45;
        }
        .progress-controls { display: flex; align-items: center; gap: 13px; }
        .progress-tabs {
          display: inline-grid; grid-template-columns: repeat(2, 1fr); padding: 3px;
          border: 1px solid rgba(27,36,66,.10); border-radius: 999px;
          background: rgba(27,36,66,.055);
        }
        .progress-tab {
          min-width: 48px; border: 0; border-radius: 999px; padding: 7px 11px;
          color: var(--muted); background: transparent;
          font: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
        }
        .progress-tab:hover, .progress-tab:focus-visible { color: var(--navy); outline: none; }
        .progress-tab.is-active {
          color: #fff; background: var(--accent); box-shadow: 0 3px 10px rgba(10,163,163,.20);
        }
        .progress-latest {
          min-width: 66px; text-align: right;
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 27px; font-weight: 700; line-height: 1;
        }
        .progress-latest span {
          display: block; margin-top: 3px; color: var(--muted);
          font-family: var(--font-inter), system-ui, sans-serif; font-size: 9px;
          font-weight: 750; letter-spacing: .10em; text-transform: uppercase;
        }
        .progress-chart-shell {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 34px minmax(0,1fr); gap: 9px;
        }
        .progress-axis {
          height: 174px; display: flex; flex-direction: column;
          justify-content: space-between; padding: 3px 0 2px;
          color: rgba(27,36,66,.60); font-size: 11.5px; font-weight: 800;
          text-align: right; letter-spacing: .02em;
        }
        .progress-chart-scroll {
          min-width: 0; overflow-x: auto; overflow-y: hidden;
          /* The native scrollbar here fades in/out on hover/scroll (most
             visibly on macOS), which right under the x-axis reads as the
             chart itself flickering. Scrolling (drag/swipe/trackpad) still
             works; it just never paints a visible track. */
          scrollbar-width: none;
        }
        .progress-chart-scroll::-webkit-scrollbar { display: none; }
        .progress-chart {
          position: relative; min-width: 620px; height: 174px;
          margin-bottom: 24px;
        }
        .progress-xaxis {
          position: absolute; top: 100%; left: 0; right: 0; height: 22px;
          pointer-events: none;
        }
        .progress-xaxis span {
          position: absolute; top: 7px; transform: translateX(-50%);
          color: rgba(86,96,112,.78); font-size: 10.5px; font-weight: 750;
          letter-spacing: .04em; white-space: nowrap;
        }
        .progress-xaxis span:first-child { transform: translateX(-20%); }
        .progress-xaxis span:last-child { transform: translateX(-80%); }
        .progress-chart svg {
          position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
        }
        .progress-guide {
          stroke: rgba(27,36,66,.14); stroke-width: 1; vector-effect: non-scaling-stroke;
          stroke-dasharray: 3 5;
        }
        .progress-line-glow {
          fill: none; stroke: rgba(10,163,163,.20); stroke-width: 8;
          stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
        }
        .progress-area { fill: url(#progressArea); }
        .progress-line {
          fill: none; stroke: url(#progressStroke); stroke-width: 2.4;
          stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
        }
        .progress-line-flow {
          fill: none; stroke: rgba(255,255,255,.85); stroke-width: 1.6;
          stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
          stroke-dasharray: 2.5 13.5;
          animation: progressFlow 3.2s linear infinite;
          opacity: .55;
        }
        @keyframes progressFlow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -16; }
        }
        .progress-point {
          position: absolute; width: 8px; height: 8px; padding: 0;
          transform: translate(-50%,-50%); border-radius: 50%;
          border: 1px solid rgba(10,163,163,.38); background: #fff;
          box-shadow: inset 0 0 4px rgba(111,218,221,.9), 0 0 8px rgba(111,218,221,.4);
          cursor: pointer; transition: transform .16s cubic-bezier(.34,1.56,.64,1), background .16s ease, box-shadow .16s ease;
        }
        .progress-point:hover, .progress-point:focus-visible, .progress-point.is-active {
          transform: translate(-50%,-50%) scale(1.7);
          background: #f5c842; border-color: #fff8d6;
          box-shadow: 0 0 0 4px rgba(245,200,66,.16), 0 0 18px rgba(245,200,66,.6);
          outline: none;
        }
        .progress-point.is-latest {
          width: 10px; height: 10px;
          background: #f5c842; border-color: #fff8d6;
          box-shadow: 0 0 12px rgba(245,200,66,.7), 0 0 26px rgba(245,200,66,.35);
        }
        .progress-point.is-latest::after {
          content: ""; position: absolute; inset: -3px; border-radius: 50%;
          border: 1.5px solid rgba(245,200,66,.65);
          animation: progressRadar 2.2s ease-out infinite;
        }
        @keyframes progressRadar {
          0% { transform: scale(1); opacity: .9; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        .progress-detail {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: minmax(150px,1.2fr) repeat(3,minmax(80px,.65fr)) auto;
          gap: 14px; align-items: center; margin-top: 14px; padding-top: 15px;
          border-top: 1px solid rgba(27,36,66,.10);
        }
        .progress-detail-primary strong {
          display: block; color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; line-height: 1.1;
        }
        .progress-detail-primary span,
        .progress-stat span {
          display: block; margin-top: 4px; color: var(--muted);
          font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
        }
        .progress-stat strong { color: var(--navy); font-size: 13px; font-weight: 750; }
        .progress-review-link {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 34px; padding: 0 13px; border-radius: 999px;
          border: 1px solid var(--accent-line);
          background: var(--accent-dim); color: #0a6e6e;
          font-size: 11px; font-weight: 800; text-decoration: none; white-space: nowrap;
          transition: background .15s ease, border-color .15s ease;
        }
        .progress-review-link:hover, .progress-review-link:focus-visible {
          background: var(--navy); border-color: var(--navy); color: #fff;
          outline: none;
        }
        .progress-note {
          position: relative; z-index: 1; margin-top: 13px;
          color: rgba(86,96,112,.74); font-size: 10.5px; line-height: 1.4;
        }
        .progress-empty {
          position: relative; z-index: 1; min-height: 132px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; color: var(--muted);
        }
        .progress-empty strong {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; font-weight: 650;
        }
        .progress-empty span { max-width: 420px; margin-top: 6px; font-size: 12px; line-height: 1.5; }
        .progress-error { color: #b4402f; }
        .score-block {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 30px 40px; gap: 6px; border-right: 1px solid rgba(255,255,255,.12);
          position: relative; z-index: 2;
        }
        /* Bold, solid numerals straight on the starfield — no card, no
           outline. The per-testament accent (gold/purple/teal) shows up as
           a quiet glow and carries over to the level pill beside it, so
           color-coding survives without the number itself needing to be
           anything but plain, confident text. */
        .score-number {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 64px; font-weight: 700; line-height: 1;
          letter-spacing: -.02em; user-select: none;
          color: rgba(255,255,255,.22);
          transition: color .4s ease, text-shadow .4s ease;
        }
        .score-block.has-score .score-number {
          color: #fff;
          text-shadow:
            0 2px 18px rgba(0,0,0,.5),
            0 0 26px color-mix(in srgb, var(--score-accent, var(--accent)) 45%, transparent);
        }
        .score-label-row {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px;
        }
        .bli-info-btn {
          width: 18px; height: 18px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(255,255,255,.06); color: rgba(255,255,255,.7);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; line-height: 1;
          cursor: pointer; font-family: inherit;
        }
        .bli-info-btn:hover, .bli-info-btn:focus-visible {
          border-color: rgba(255,255,255,.4); color: #fff; outline: none;
          background: rgba(255,255,255,.12);
        }
        .bli-tooltip {
          position: absolute; top: 28px; left: 50%; transform: translateX(-50%);
          width: min(320px, calc(100vw - 48px));
          background: rgba(14,18,38,.98); color: rgba(255,255,255,.86);
          border: 1px solid rgba(255,255,255,.14); border-radius: 12px;
          box-shadow: 0 12px 34px rgba(0,0,0,.5); padding: 14px 15px;
          text-align: left; z-index: 80;
          font-size: 12.5px; line-height: 1.55; font-weight: 500;
          letter-spacing: 0; text-transform: none; text-decoration: none;
          display: none; opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity .12s ease, visibility .12s ease;
        }
        .score-label-row:hover .bli-tooltip,
        .score-label-row:focus-within .bli-tooltip,
        .bli-tooltip.is-open {
          display: block; opacity: 1; visibility: visible; pointer-events: auto;
        }
        .bli-tooltip::before {
          content: ""; position: absolute; top: -6px; left: 50%;
          width: 12px; height: 12px; transform: translateX(-50%) rotate(45deg);
          background: rgba(14,18,38,.98); border-left: 1px solid rgba(255,255,255,.14); border-top: 1px solid rgba(255,255,255,.14);
        }
        .bli-tooltip span {
          display: inline-flex; margin-top: 8px;
          color: color-mix(in srgb, var(--score-accent, var(--accent)) 70%, #fff);
          font-weight: 700; text-decoration: none;
        }
        .bli-tooltip:hover span { text-decoration: underline; }
        .level-block {
          padding: 30px 32px;
          display: flex; flex-direction: column; justify-content: center; gap: 10px;
        }
        .level-badge-empty {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.18);
          border-radius: 999px; padding: 5px 13px;
          font-size: 12px; font-weight: 700; color: rgba(255,255,255,.6);
          letter-spacing: .05em; text-transform: uppercase; width: fit-content;
        }
        .level-badge-empty::before {
          content: ""; width: 7px; height: 7px;
          border-radius: 50%; background: rgba(255,255,255,.3);
        }
        .level-desc-empty {
          font-size: 14.5px; line-height: 1.6; color: rgba(255,255,255,.55); max-width: 420px;
        }
        .level-desc-empty strong { color: #fff; }
        /* Verse of the day fills the same middle column once a score
           exists — see lib/verseOfTheDay.ts for the (deterministic,
           public-domain KJV) rotation. */
        .verse-of-day {
          margin: 0; max-width: 380px; align-self: center; text-align: center;
        }
        .verse-of-day-kicker {
          margin: 0 0 11px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font-size: 10.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
          color: var(--score-accent, var(--accent));
        }
        .verse-of-day-kicker::before,
        .verse-of-day-kicker::after {
          content: ""; width: 15px; height: 1px;
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 70%, transparent);
        }
        .verse-of-day-text {
          margin: 0; padding: 0; border: 0;
          font-family: var(--font-crimson), Georgia, serif;
          font-style: italic; font-weight: 500;
          font-size: 16.5px; line-height: 1.56;
          color: rgba(255,255,255,.90);
        }
        .verse-of-day-ref {
          margin: 12px 0 0; padding: 0;
          font-family: var(--font-inter), system-ui, sans-serif;
          font-style: normal; font-size: 11.5px; font-weight: 750;
          letter-spacing: .03em; color: rgba(255,255,255,.5);
        }
        .verse-of-day-ref::before { content: "— "; }
        /* Same slot as the verse of the day, swapped in for a brand-new
           signed-out result — deliberately just the two lines, no card,
           no graphic. See .save-results-card below for the fuller version
           of this same prompt shown elsewhere on the page. */
        .save-progress-mini {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          align-self: center; text-align: center;
        }
        .save-progress-mini-text {
          margin: 0; color: rgba(255,255,255,.75);
          font-size: 13px; font-weight: 750; letter-spacing: .02em;
        }
        .save-progress-mini-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 999px; border: 0; cursor: pointer;
          background: var(--score-accent, var(--accent)); color: #16110a;
          font: inherit; font-size: 12.5px; font-weight: 850;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .save-progress-mini-btn:hover, .save-progress-mini-btn:focus-visible {
          transform: translateY(-1px); box-shadow: 0 10px 22px rgba(0,0,0,.32); outline: none;
        }
        .level-label-row {
          position: relative; display: inline-flex; align-items: center; gap: 8px;
          width: fit-content; min-height: 28px;
        }
        /* The level pill is the one place the per-testament accent still
           shows up as color (gold/purple/teal) now that the numeral itself
           is plain white — a tinted chip on dark reads cleanly without the
           "outlined balloon" look the numeral used to have. */
        .level-badge-btn {
          cursor: pointer; font-family: inherit;
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 16%, transparent);
          border-color: color-mix(in srgb, var(--score-accent, var(--accent)) 45%, transparent);
          color: var(--score-accent, var(--accent));
          transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
        }
        .level-badge-btn::before {
          background: var(--score-accent, var(--accent));
        }
        .level-badge-btn:hover, .level-badge-btn:focus-visible {
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 26%, transparent);
          border-color: color-mix(in srgb, var(--score-accent, var(--accent)) 65%, transparent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--score-accent, var(--accent)) 16%, transparent);
          outline: none;
        }
        .level-tooltip {
          position: absolute; top: calc(100% + 10px); left: 0;
          width: min(320px, calc(100vw - 48px));
          background: rgba(14,18,38,.98); color: rgba(255,255,255,.86);
          border: 1px solid rgba(255,255,255,.14); border-radius: 12px;
          box-shadow: 0 12px 34px rgba(0,0,0,.5); padding: 14px 15px;
          text-align: left; z-index: 80;
          font-size: 13.5px; line-height: 1.6; font-weight: 500;
          letter-spacing: 0; text-transform: none; text-decoration: none;
          display: none; opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity .12s ease, visibility .12s ease;
        }
        .level-tooltip.is-open {
          display: block; opacity: 1; visibility: visible; pointer-events: auto;
        }
        .level-tooltip::before {
          content: ""; position: absolute; top: -6px; left: 20px;
          width: 12px; height: 12px; transform: rotate(45deg);
          background: rgba(14,18,38,.98); border-left: 1px solid rgba(255,255,255,.14); border-top: 1px solid rgba(255,255,255,.14);
        }
        .level-tooltip span {
          display: inline-flex; margin-top: 8px;
          color: color-mix(in srgb, var(--score-accent, var(--accent)) 70%, #fff);
          font-weight: 700; text-decoration: none;
        }
        .level-tooltip:hover span { text-decoration: underline; }
        .knowledge-cone-card {
          position: relative; z-index: 1;
          background: rgba(255,255,255,.94); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: var(--shadow);
          backdrop-filter: blur(16px); padding: 28px 32px 30px;
          margin-bottom: 18px; overflow: visible;
        }
        .knowledge-cone-panel {
          margin: -10px 0 30px;
          animation: knowledgeProfileIn .22s cubic-bezier(.22,.72,.18,1) both;
        }
        .knowledge-cone-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-bottom: 22px;
        }
        .knowledge-cone-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 650; color: var(--navy); line-height: 1.1;
        }
        .knowledge-cone-sub { font-size: 13px; color: var(--muted); margin-top: 5px; }
        .knowledge-cone-score {
          display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
          color: var(--navy); font-weight: 700; font-size: 28px;
          font-family: var(--font-crimson), Georgia, serif;
        }
        .knowledge-cone-score span {
          font-family: var(--font-inter), system-ui, sans-serif; font-size: 10px;
          letter-spacing: .10em; text-transform: uppercase; color: var(--muted);
        }
        .knowledge-cone-wrap {
          position: relative; min-height: 440px;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          perspective: 900px;
        }
        .knowledge-cone {
          position: relative; width: min(560px, 100%); height: 378px;
          transform: rotateX(7deg);
          filter: drop-shadow(0 34px 42px rgba(27,36,66,.38)) drop-shadow(0 13px 24px rgba(10,163,163,.22));
        }
        .glass-vessel {
          position: absolute; inset: 0;
          clip-path: polygon(1% 0, 99% 0, 74.5% 100%, 25.5% 100%);
          background:
            linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.12) 28%, rgba(255,255,255,.28) 50%, rgba(27,36,66,.10) 100%),
            linear-gradient(180deg, rgba(255,255,255,.20), rgba(10,163,163,.06));
          border: 1px solid rgba(255,255,255,.58);
          box-shadow:
            inset 20px 0 34px rgba(255,255,255,.36),
            inset -22px 0 34px rgba(27,36,66,.28),
            inset 0 -28px 40px rgba(8,74,104,.24),
            inset 0 0 0 1px rgba(27,36,66,.12);
          overflow: hidden; z-index: 1;
        }
        .glass-vessel::before {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 0 16%, rgba(255,255,255,.42) 18%, transparent 25% 100%);
          pointer-events: none;
        }
        .glass-vessel::after {
          content: ""; position: absolute; left: 1%; right: 1%; top: -9px; height: 24px;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,.70), rgba(255,255,255,.10));
          border: 1px solid rgba(255,255,255,.56);
          box-shadow: 0 10px 22px rgba(27,36,66,.26), inset 0 -3px 10px rgba(27,36,66,.16);
          pointer-events: none;
        }
        .water-fill {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: var(--water-level);
          background:
            linear-gradient(112deg, rgba(255,255,255,.18) 0%, transparent 24% 62%, rgba(255,255,255,.12) 100%),
            linear-gradient(180deg, rgba(189,248,255,.68) 0%, rgba(55,197,213,.72) 50%, rgba(18,123,154,.80) 100%);
          box-shadow:
            inset 18px 0 26px rgba(255,255,255,.22),
            inset -20px 0 34px rgba(8,74,104,.32),
            inset 0 22px 36px rgba(255,255,255,.36),
            inset 0 -30px 42px rgba(8,74,104,.42),
            0 -12px 34px rgba(10,163,163,.30),
            0 0 0 1px rgba(255,255,255,.22);
          animation: waterRise 6.4s cubic-bezier(.18,.76,.12,1) both;
          transform-origin: bottom;
          transform: skewX(calc(var(--slosh-x, 0) * -2.6deg)) translateX(calc(var(--slosh-x, 0) * -1.8%));
          will-change: transform;
          z-index: 3;
        }
        .water-fill::before {
          content: ""; position: absolute; left: -9%; right: -9%; top: -15px; height: 30px;
          border-radius: 46% 54% 50% 50% / 55% 55% 45% 45%;
          background:
            linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.74), rgba(255,255,255,.16)),
            radial-gradient(ellipse, rgba(217,251,255,.96), rgba(82,205,224,.68) 56%, rgba(82,205,224,0) 75%);
          filter: blur(.12px);
          transform-origin: 50% 50%;
          translate: calc(var(--slosh-x, 0) * -7%) calc(var(--slosh-x2, 0) * 5px);
          rotate: calc(var(--slosh-x, 0) * -6.5deg + var(--slosh-x2, 0) * -1.6deg);
          scale: calc(1 + var(--slosh-amp, 0) * .09) calc(1 - var(--slosh-amp, 0) * .11);
          will-change: translate, rotate, scale;
          animation: waterSurface 6.4s cubic-bezier(.18,.76,.12,1) both, surfaceMorph 5.2s ease-in-out infinite;
        }
        .water-fill::after {
          content: ""; position: absolute; inset: 0;
          background:
            linear-gradient(112deg, transparent 0 30%, rgba(255,255,255,.22) 41%, transparent 53% 100%),
            radial-gradient(ellipse at 50% 18%, rgba(255,255,255,.16), transparent 50%);
          mix-blend-mode: screen;
          opacity: .42;
          animation: internalSheen 6.2s ease-in-out infinite;
          pointer-events: none;
        }
        .water-wave {
          position: absolute; left: -18%; width: 136%; height: 34px;
          top: -17px; overflow: hidden; border-radius: 999px;
          pointer-events: none; mix-blend-mode: screen; opacity: .55;
          transform-origin: 50% 50%;
        }
        .water-wave::before {
          content: ""; position: absolute; left: 50%; top: var(--wave-top, -92px);
          width: var(--wave-size, 220px); height: var(--wave-size, 220px);
          border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%;
          background:
            radial-gradient(circle at 35% 32%, rgba(255,255,255,.72), transparent 0 9%, rgba(255,255,255,0) 17%),
            radial-gradient(circle at 62% 66%, rgba(255,255,255,.30), transparent 0 12%, rgba(255,255,255,0) 22%),
            linear-gradient(135deg, rgba(217,251,255,.70), rgba(82,205,224,.28) 52%, rgba(18,123,154,.16));
          transform: translateX(-50%) rotate(0deg);
          animation: liquidRoll var(--wave-speed, 8s) linear infinite, liquidBob 5.4s ease-in-out infinite;
          filter: blur(.08px);
        }
        .water-wave-a { --wave-size: 245px; --wave-top: -105px; --wave-speed: 8.8s; opacity: calc(.62 + var(--slosh-amp, 0) * .22); translate: calc(var(--slosh-x, 0) * 3.6%) calc(var(--slosh-x2, 0) * -3px); }
        .water-wave-b { --wave-size: 205px; --wave-top: -82px; --wave-speed: 7.1s; top: -11px; opacity: calc(.42 + var(--slosh-amp, 0) * .22); transform: scaleX(1.06); translate: calc(var(--slosh-x, 0) * -2.4% + var(--slosh-x2, 0) * 2.8%) calc(var(--slosh-x2, 0) * 3px); }
        .water-wave-b::before { animation-direction: reverse, normal; background: linear-gradient(135deg, rgba(189,248,255,.54), rgba(10,163,163,.26) 55%, rgba(18,123,154,.14)); }
        .water-wave-c { --wave-size: 270px; --wave-top: -128px; --wave-speed: 11s; top: -23px; opacity: calc(.25 + var(--slosh-amp, 0) * .18); transform: scaleX(.96); translate: calc(var(--slosh-x2, 0) * -3.2%) 0; }
        .water-wave-c::before { background: linear-gradient(135deg, rgba(255,255,255,.44), rgba(189,248,255,.16) 58%, transparent); }
        @keyframes waterRise { from { height: 0; } to { height: var(--water-level); } }
        @keyframes waterSurface { 0% { opacity: .10; transform: scaleX(.48); } 22% { opacity: .92; transform: scaleX(.76); } 100% { opacity: 1; transform: scaleX(1); } }
        @keyframes surfaceMorph {
          0%, 100% { border-radius: 42% 58% 52% 48% / 53% 60% 40% 47%; }
          50% { border-radius: 60% 40% 47% 53% / 60% 52% 48% 40%; }
        }
        @keyframes liquidRoll {
          to { transform: translateX(-50%) rotate(1turn); }
        }
        @keyframes liquidBob {
          0%, 100% { top: var(--wave-top); border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%; }
          50% { top: calc(var(--wave-top) + 7px); border-radius: 55% 45% 58% 42% / 44% 57% 43% 56%; }
        }
        @keyframes internalSheen { 0%, 100% { transform: translateX(-16%) skewX(-7deg); opacity: .30; } 48% { transform: translateX(16%) skewX(-7deg); opacity: .64; } }
        .cone-tier {
          position: relative; width: 100%; height: calc(100% / 7);
          display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;
          padding: 0 calc(var(--text-inset) + 18px); color: var(--navy);
          background: transparent;
          border: 0; border-bottom: 1px solid rgba(27,36,66,.18);
          clip-path: polygon(var(--top-left) 0, var(--top-right) 0, var(--bottom-right) 100%, var(--bottom-left) 100%);
          transition: background .18s, box-shadow .18s, color .18s, transform .18s;
          transform-origin: center;
          z-index: 8;
          cursor: pointer; font-family: inherit; text-align: left;
        }
        .cone-tier:hover, .cone-tier:focus-visible {
          background: rgba(255,255,255,.24); outline: none;
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.30);
        }
        .cone-tier:last-child { border-bottom: 0; }
        .cone-tier.is-active {
          background: rgba(255,255,255,.20);
          box-shadow: inset 0 0 0 2px rgba(27,36,66,.16);
        }
        .cone-tier.is-expanded {
          background: linear-gradient(90deg, rgba(13,21,48,.86), rgba(27,36,66,.74));
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.24), 0 14px 30px rgba(8,13,30,.34);
          color: #fff;
          transform: scale(1.035, 1.22);
          z-index: 18;
        }
        .cone-tier.is-expanded .cone-tier-name,
        .cone-tier.is-expanded .cone-tier-range { transform: translateY(-8px); text-shadow: 0 1px 12px rgba(0,0,0,.35); }
        .cone-tier-name { position: relative; z-index: 1; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-tier-range { position: relative; z-index: 1; font-size: 12px; font-weight: 800; opacity: .76; white-space: nowrap; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-layer-popover {
          position: absolute; left: calc(100% + 20px); top: calc(var(--popover-y) * 1%); width: min(340px, 46vw);
          padding: 17px 19px; border-radius: 10px; z-index: 30;
          background: rgba(255,255,255,.94); border: 1px solid rgba(27,36,66,.10);
          box-shadow: 0 20px 42px rgba(27,36,66,.34), 0 0 0 1px rgba(255,255,255,.56) inset;
          color: rgba(27,36,66,.88); transform: translateY(-50%);
          backdrop-filter: blur(14px); animation: coneDescriptionIn .18s ease-out both;
          pointer-events: none;
        }
        .cone-layer-popover::before {
          content: ""; position: absolute; left: -10px; top: 50%; width: 18px; height: 18px;
          background: rgba(255,255,255,.94); border-left: 1px solid rgba(27,36,66,.10); border-bottom: 1px solid rgba(27,36,66,.10);
          transform: translateY(-50%) rotate(45deg);
        }
        .cone-layer-popover strong { display: block; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 7px; color: var(--navy); }
        .cone-layer-popover span { display: block; font-size: 14px; line-height: 1.48; font-weight: 650; }
        @keyframes coneDescriptionIn { from { opacity: 0; transform: translateY(-50%) translateX(-8px) scale(.96); } to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); } }
        .knowledge-cone-panel .cone-layer-popover {
          left: 50%; top: calc(var(--popover-y) * 1% + 42px); width: min(340px, calc(100% - 28px));
          padding: 15px 17px; transform: translateX(-50%);
          animation: coneDescriptionInDrawer .18s ease-out both;
        }
        .knowledge-cone-panel .cone-layer-popover::before {
          left: 50%; top: -9px; transform: translateX(-50%) rotate(135deg);
        }
        @keyframes coneDescriptionInDrawer { from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
        .cone-marker {
          position: absolute; right: -96px;
          top: calc(var(--marker-y) * 1%);
          transform: translateY(-50%);
          display: flex; align-items: center; gap: 10px;
          color: var(--navy); font-size: 12px; font-weight: 800;
          z-index: 20;
        }
        .cone-marker::before {
          content: ""; width: 74px; height: 2px;
          background: linear-gradient(90deg, rgba(27,36,66,.10), var(--navy));
        }
        .cone-marker-dot {
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; border: 4px solid var(--navy);
          box-shadow: 0 7px 18px rgba(0,0,0,.30);
        }
        .cone-empty-note {
          text-align: center; color: var(--muted); font-size: 14px; line-height: 1.6;
          max-width: 460px; margin: 0 auto;
        }
        .conf-block {
          display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
          padding: 30px 32px; gap: 9px;
          border-left: 1px solid rgba(255,255,255,.12); min-width: 210px; position: relative;
        }
        .conf-empty-label {
          display: inline-flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
          font-size: 13px; font-weight: 850; letter-spacing: .075em;
          text-transform: uppercase; color: rgba(255,255,255,.55); text-align: left;
        }
        .conf-percent {
          font-family: var(--font-crimson), Georgia, serif; font-size: 27px; line-height: 1;
          font-weight: 750; color: #fff; letter-spacing: 0; text-transform: none;
        }
        .conf-note { display: flex; align-items: center; gap: 9px; font-size: 13px; color: rgba(255,255,255,.55); text-align: left; line-height: 1.35; }
        .conf-level {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 5px 10px; border-radius: 999px;
          background: color-mix(in srgb, var(--score-accent, var(--accent)) 16%, transparent);
          border: 1px solid color-mix(in srgb, var(--score-accent, var(--accent)) 45%, transparent);
          color: var(--score-accent, var(--accent)); font-size: 12px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase;
        }
        .evidence-info-btn {
          width: 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.6); font: 800 11px var(--font-inter), sans-serif; cursor: pointer;
        }
        .evidence-tooltip {
          position: absolute; right: 22px; top: calc(100% - 10px); z-index: 80;
          width: min(300px, calc(100vw - 42px)); padding: 13px 15px; border-radius: 8px;
          background: rgba(14,18,38,.98); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 12px 34px rgba(0,0,0,.5);
          color: rgba(255,255,255,.86); font-size: 12px; font-weight: 600; line-height: 1.5;
          opacity: 0; visibility: hidden; transform: translateY(-5px);
          transition: opacity .14s, transform .14s, visibility .14s; pointer-events: none;
        }
        .evidence-tooltip.is-open { opacity: 1; visibility: visible; transform: translateY(0); pointer-events: auto; }
        /* Standard-assessment controls — used to live in their own card;
           now they're just the page header's primary action (see
           .header-assess below), so these are themed for sitting directly
           on the dark starfield instead of on a light card. */
        .header-assess {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          animation: stdAssessIn .4s ease both;
        }
        @keyframes stdAssessIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        .std-assess-toggle {
          position: relative; display: inline-flex; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16);
        }
        .std-assess-toggle-thumb {
          position: absolute; top: 4px; left: 4px;
          width: calc(50% - 4px); height: calc(100% - 8px); border-radius: 999px;
          background: var(--suite-hue); box-shadow: 0 4px 12px rgba(0,0,0,.3);
          transition: transform .32s cubic-bezier(.34,1.56,.64,1), background .3s ease;
        }
        .std-assess-toggle-btn {
          position: relative; z-index: 1; border: 0; background: transparent;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 15px; border-radius: 999px; cursor: pointer;
          font: inherit; font-size: 12.5px; font-weight: 800; color: rgba(255,255,255,.55);
          transition: color .2s ease; white-space: nowrap;
        }
        .std-assess-toggle-btn svg { opacity: .6; transition: opacity .2s ease; }
        .std-assess-toggle-btn.is-active { color: #fff; }
        .std-assess-toggle-btn.is-active svg { opacity: .95; }
        .std-assess-actions { display: flex; align-items: center; gap: 12px; }
        .std-assess-cta {
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 999px;
          background: var(--suite-hue); color: #fff; text-decoration: none;
          font-size: 13.5px; font-weight: 800; white-space: nowrap;
          transition: filter .15s ease, transform .15s ease, background .3s ease;
        }
        .std-assess-cta:hover { filter: brightness(1.08); transform: translateY(-1px); }
        /* A slow, occasional sheen sweep — reads as "this is the thing to
           click" without being an constant distraction. */
        .std-assess-cta::after {
          content: ""; position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,.6), transparent);
          transform: skewX(-20deg);
          animation: ctaSheen 3.6s ease-in-out infinite;
        }
        @keyframes ctaSheen {
          0% { left: -60%; }
          35%, 100% { left: 130%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .std-assess-cta::after { animation: none; opacity: 0; }
        }
        .scope-text-btn {
          border: 0; padding: 5px 0; background: transparent; color: rgba(255,255,255,.5);
          font: inherit; font-size: 11.5px; font-weight: 750; cursor: pointer; white-space: nowrap;
        }
        .scope-text-btn:hover, .scope-text-btn:focus-visible { color: #fff; outline: none; }
        @media (max-width: 640px) {
          .header-assess { width: 100%; }
          .std-assess-toggle { flex: 1; }
          .std-assess-toggle-btn { flex: 1; }
          .std-assess-actions { width: 100%; justify-content: space-between; }
        }
        .recommendation-engine {
          margin-bottom: 28px;
        }
        .recommendation-engine-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-bottom: 14px;
        }
        .recommendation-engine-eyebrow {
          margin: 0 0 5px; color: rgba(255,255,255,.58);
          font-size: 11px; font-weight: 850; letter-spacing: .12em;
          text-transform: uppercase;
        }
        .recommendation-engine-title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 28px; font-weight: 650; line-height: 1.05;
          text-shadow: 0 2px 14px rgba(0,0,0,.28);
        }
        .recommendation-engine-copy {
          max-width: 540px; margin: 6px 0 0;
          color: rgba(255,255,255,.68); font-size: 13px; line-height: 1.5;
        }
        .recommendation-toggle {
          display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.88); border: 1px solid var(--border);
          box-shadow: var(--shadow-sm); backdrop-filter: blur(14px);
          flex-shrink: 0;
        }
        .recommendation-toggle-btn {
          border: 0; border-radius: 999px; padding: 8px 13px;
          background: transparent; color: var(--muted);
          font: inherit; font-size: 12px; font-weight: 850; cursor: pointer;
          transition: background .16s ease, color .16s ease, box-shadow .16s ease;
        }
        .recommendation-toggle-btn:hover,
        .recommendation-toggle-btn:focus-visible {
          color: var(--navy); outline: none;
        }
        .recommendation-toggle-btn.is-active {
          background: var(--navy); color: #fff;
          box-shadow: 0 6px 15px rgba(27,36,66,.20);
        }
        .recommendation-toggle-btn:disabled {
          opacity: .48; cursor: not-allowed;
        }
        .recommendation-engine-body {
          animation: recommendationPanelIn .22s ease both;
        }
        @keyframes recommendationPanelIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        .recommendation-engine-body .recommended-card,
        .recommendation-engine-body .dmm-card {
          margin-bottom: 0;
        }
        .recommended-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 24px 26px; margin-bottom: 28px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(0,1fr) minmax(210px, auto); gap: 22px; align-items: center;
          position: relative; overflow: hidden;
        }
        .recommended-card::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg, var(--accent), #d4a017);
        }
        .recommended-eyebrow { font-size: 11px; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; color: #0a6e6e; margin-bottom: 4px; }
        .recommended-subhead { margin: 0 0 10px; font-size: 11.5px; font-weight: 600; color: var(--muted); max-width: 420px; }
        .recommended-title { font-family: var(--font-crimson), Georgia, serif; font-size: 25px; font-weight: 650; color: var(--navy); line-height: 1.05; }
        .recommended-books { margin-top: 5px; font-size: 13px; color: var(--muted); font-weight: 650; }
        .recommended-focus {
          margin-top: 12px; font-size: 13.5px; line-height: 1.5; color: rgba(27,36,66,.84); max-width: 620px;
        }
        .recommended-guidance {
          margin-top: 14px; padding: 13px 14px;
          border-radius: 12px; border: 1px solid rgba(10,163,163,.16);
          background: rgba(10,163,163,.055); max-width: 660px;
        }
        .recommended-guidance-title {
          margin-bottom: 8px; color: #0a6e6e;
          font-size: 11px; font-weight: 850; letter-spacing: .10em; text-transform: uppercase;
        }
        .recommended-guidance-list {
          display: grid; gap: 6px; margin: 0; padding: 0; list-style: none;
        }
        .recommended-guidance-list li {
          position: relative; padding-left: 16px;
          color: rgba(27,36,66,.82); font-size: 12.5px; line-height: 1.45; font-weight: 650;
        }
        .recommended-guidance-list li::before {
          content: ""; position: absolute; left: 0; top: .62em;
          width: 6px; height: 6px; border-radius: 50%; background: #0aa3a3;
        }
        .recommended-resources {
          display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px;
        }
        .recommended-resource {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 10px; border-radius: 999px;
          color: #0a6e6e; background: rgba(255,255,255,.68);
          border: 1px solid rgba(10,163,163,.18);
          font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .recommended-resource:hover, .recommended-resource:focus-visible {
          color: var(--navy); border-color: rgba(10,163,163,.34); outline: none;
        }
        .recommended-side { display: flex; flex-direction: column; align-items: flex-end; }
        .recommended-priority { font-size: 12.5px; line-height: 1.45; color: var(--muted); max-width: 260px; }
        .recommended-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; margin-top: 12px; }
        .recommended-action { display: flex; align-items: center; gap: 8px; color: var(--navy); font-size: 13px; font-weight: 800; text-decoration: none; }
        .recommended-action svg { width: 16px; height: 16px; }
        .recommended-review {
          display: inline-flex; align-items: center; gap: 7px;
          color: #0a6e6e; font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .recommended-review:hover, .recommended-review:focus-visible {
          color: var(--navy); outline: none; text-decoration: underline;
          text-underline-offset: 3px;
        }
        .frontier-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 20px 22px; margin-bottom: 28px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(0,1fr) minmax(0,.72fr);
          gap: 22px; align-items: start;
          position: relative; overflow: hidden;
        }
        .frontier-card::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 4px;
          background: var(--frontier-hue, var(--accent));
        }
        .frontier-eyebrow {
          font-size: 11px; font-weight: 850; letter-spacing: .11em;
          text-transform: uppercase; color: #0a6e6e; margin-bottom: 7px;
        }
        .frontier-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 23px; font-weight: 650; color: var(--navy); line-height: 1.08;
        }
        .frontier-ref { margin-top: 4px; font-size: 12.5px; color: var(--muted); font-weight: 700; }
        .frontier-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
        .frontier-cta {
          display: inline-flex; align-items: center; gap: 8px;
          min-height: 40px; padding: 10px 15px; border-radius: 10px;
          background: var(--navy); color: #fff; text-decoration: none;
          font-size: 13px; font-weight: 800;
        }
        .frontier-cta:hover { background: #253566; }
        .frontier-map {
          display: inline-flex; align-items: center; gap: 7px;
          color: var(--navy); font-size: 12px; font-weight: 800; text-decoration: none;
        }
        .frontier-map:hover, .frontier-map:focus-visible {
          outline: none; text-decoration: underline; text-underline-offset: 3px;
        }
        .frontier-context { border-left: 1px solid var(--border); padding-left: 20px; }
        .frontier-context-label {
          font-size: 10px; font-weight: 850; letter-spacing: .09em;
          text-transform: uppercase; color: var(--muted); margin-bottom: 9px;
        }
        .frontier-item {
          display: grid; grid-template-columns: minmax(0,1fr) auto;
          gap: 10px; align-items: baseline; padding: 7px 0;
          border-bottom: 1px solid var(--border);
        }
        .frontier-item:last-child { border-bottom: 0; }
        .frontier-item-name { font-size: 12.5px; font-weight: 750; color: var(--navy); line-height: 1.3; }
        .frontier-item-ref { font-size: 10.5px; color: var(--muted); font-weight: 650; margin-top: 2px; }
        .frontier-item-score {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 15px; font-weight: 700; color: var(--muted);
        }
        .retest-modal-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(7,12,28,.66); backdrop-filter: blur(8px);
          display: grid; place-items: center; padding: 24px;
        }
        .retest-modal {
          width: min(100%, 480px); border-radius: 20px;
          background: rgba(255,255,255,.96); border: 1px solid var(--border);
          box-shadow: var(--shadow); padding: 28px 30px;
          position: relative; overflow: hidden;
        }
        .retest-modal::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg, var(--accent), #d4a017);
        }
        .retest-modal-kicker {
          color: #0a6e6e; font-size: 11px; font-weight: 850;
          letter-spacing: .11em; text-transform: uppercase; margin-bottom: 10px;
        }
        .retest-modal-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 28px; line-height: 1.08; font-weight: 650;
          color: var(--navy); margin-bottom: 10px;
        }
        .retest-modal-copy {
          color: var(--muted); font-size: 14px; line-height: 1.6;
          margin-bottom: 18px;
        }
        .retest-modal-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; flex-wrap: wrap;
        }
        .retest-modal-primary,
        .retest-modal-secondary {
          border-radius: 999px; padding: 11px 18px;
          font-family: inherit; font-size: 13.5px; font-weight: 800;
          cursor: pointer;
        }
        .retest-modal-primary {
          border: none; color: #fff; background: var(--navy);
          box-shadow: 0 10px 24px rgba(27,36,66,.28);
        }
        .retest-modal-secondary {
          border: 1px solid var(--border); color: var(--muted);
          background: rgba(255,255,255,.70);
        }
        .section-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: rgba(255,255,255,.45);
          margin-bottom: 14px; margin-top: 32px;
        }
        .breakdown-head {
          display: flex; justify-content: space-between; align-items: center;
          gap: 14px; margin-top: 32px; margin-bottom: 14px;
        }
        .breakdown-head .section-eyebrow { margin: 0; }
        .coverage-map-section { margin-top: 32px; position: relative; }
        .coverage-map-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 14px; margin-bottom: 14px;
        }
        .coverage-map-section .section-eyebrow { margin-bottom: 6px; }
        .coverage-map-title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(22px, 3vw, 30px); line-height: 1;
        }
        .coverage-map-copy {
          margin: 8px 0 0; max-width: 620px;
          color: rgba(255,255,255,.66); font-size: 12.5px; line-height: 1.45;
        }
        .coverage-mode-controls {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px; border-radius: 999px;
          background: rgba(255,255,255,.08); border: 1px solid rgba(212,160,23,.42);
        }
        .coverage-mode-btn {
          min-height: 34px; border: 0; border-radius: 999px; padding: 7px 11px;
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: transparent; color: rgba(255,255,255,.64);
          font: inherit; font-size: 11.5px; font-weight: 850; cursor: pointer;
          transition: background .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .coverage-mode-btn svg {
          width: 15px; height: 15px; fill: none; stroke: currentColor;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        }
        .coverage-mode-btn:hover,
        .coverage-mode-btn:focus-visible {
          color: #fff; background: rgba(255,255,255,.10); outline: none;
        }
        .coverage-mode-btn.is-active {
          background: rgba(255,255,255,.95); color: var(--navy);
          box-shadow: 0 8px 20px rgba(0,0,0,.18);
        }
        .coverage-mode-btn:disabled {
          opacity: .42; cursor: not-allowed;
        }
        .coverage-map-link {
          display: inline-flex; align-items: center; gap: 7px;
          width: 34px; height: 34px; justify-content: center;
          padding: 0; border-radius: 999px; white-space: nowrap;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.85); text-decoration: none;
          font-size: 12px; font-weight: 800;
          transition: background .15s ease, border-color .15s ease;
        }
        .coverage-map-link:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.30); }
        /* A tiny star-and-orbiting-planet in place of a generic map glyph —
           the same slow-drift orbit motif as the brand mark and the
           Learn More menu (see learnMoreOrbitSpin above), just built from
           plain rotating elements rather than SVG so it stays cheap and
           avoids SVG transform-origin quirks. Always drifting quietly;
           speeds up on hover as the one bit of direct feedback that this
           icon leads to the knowledge map. */
        .cml-icon { position: relative; width: 20px; height: 20px; flex: 0 0 auto; }
        .cml-star {
          position: absolute; top: 50%; left: 50%; width: 5px; height: 5px;
          margin: -2.5px 0 0 -2.5px; border-radius: 50%;
          background: #f0c674; box-shadow: 0 0 6px rgba(240,198,116,.85);
          animation: cmlTwinkle 2.6s ease-in-out infinite;
        }
        .cml-orbit {
          position: absolute; inset: 0;
          border: 1px dashed rgba(255,255,255,.32); border-radius: 50%;
          animation: cmlSpin 7s linear infinite;
        }
        .cml-planet {
          position: absolute; top: -1.5px; left: 50%; width: 4px; height: 4px;
          margin-left: -2px; border-radius: 50%;
          background: #7de5e5; box-shadow: 0 0 5px rgba(125,229,229,.85);
        }
        @keyframes cmlSpin { to { transform: rotate(360deg); } }
        @keyframes cmlTwinkle {
          0%, 100% { opacity: .68; transform: scale(.82); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        .coverage-map-link:hover .cml-orbit { animation-duration: 1.3s; }
        .coverage-map-link:hover .cml-star { animation-duration: .9s; }
        @media (prefers-reduced-motion: reduce) {
          .cml-orbit, .cml-star { animation: none; }
        }
        /* One continuous card for the recommendation callout and the
           chapter board — previously separate boxes. They're divided by a
           fine gold line (.coverage-focus-card's border-bottom) instead of
           each carrying its own background/border/shadow. The legend lives
           outside this card entirely — see .coverage-legend-rail below. */
        .coverage-map-card {
          border-radius: 10px; border: 1px solid rgba(226,232,240,.95);
          background: rgba(255,255,255,.97);
          box-shadow: 0 20px 48px rgba(0,0,0,.20);
          overflow: hidden;
        }
        /* The legend has no box of its own — it sits directly on the dark
           starfield backdrop. On wide viewports it breaks out of the .page
           column entirely, floating in the left margin beside the card
           (position: relative on .coverage-map-section is what makes
           right: 100% land at that column's left edge) — there's room there
           for the section-by-completion-level matrix. Below this width
           there's no margin to float a ~220px panel into, so it drops back
           into normal flow above the card instead. */
        .coverage-legend-rail {
          margin-bottom: 14px;
        }
        @media (min-width: 1680px) {
          .coverage-legend-rail {
            position: absolute; top: 58px; right: 100%;
            width: 224px; margin: 0 28px 0 0;
          }
        }
        .coverage-focus-card {
          position: relative;
          display: grid; grid-template-columns: minmax(0,1fr) minmax(190px, auto);
          gap: 18px; align-items: center;
          padding: 20px 22px;
          color: var(--navy);
          border-bottom: 1px solid rgba(212,160,23,.4);
        }
        .coverage-focus-card.is-skill {
          align-items: start;
          background:
            linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,248,225,.96) 58%, rgba(236,253,245,.92));
        }
        .coverage-focus-card.is-skill::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
          background: linear-gradient(180deg, #d4a017, #0aa3a3);
        }
        .coverage-diagnostic-head {
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .coverage-focus-eyebrow {
          margin: 0 0 5px; color: #0a6e6e;
          font-size: 10.5px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
        }
        .coverage-focus-card.is-skill .coverage-focus-eyebrow {
          margin: 0; color: #8a5d00;
        }
        .coverage-focus-title {
          margin: 0; color: var(--navy);
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 650; line-height: 1.08;
        }
        /* The dimension name (e.g. "Law") doubling as the title, when
           there's a dimension gap to click into. Underline only shows on
           hover/focus so it doesn't look like a broken link at rest. */
        .coverage-focus-title-link {
          appearance: none; border: 0; padding: 0; margin: 0; background: transparent;
          font: inherit; color: inherit; cursor: pointer; text-align: left;
          text-decoration-line: underline; text-decoration-color: transparent; text-underline-offset: 4px;
          transition: text-decoration-color .15s ease, color .15s ease;
        }
        .coverage-focus-title-link:hover, .coverage-focus-title-link:focus-visible {
          text-decoration-color: currentColor; color: #0a6e6e; outline: none;
        }
        .coverage-focus-meta {
          margin: 5px 0 0; color: var(--muted);
          font-size: 12.5px; font-weight: 700; line-height: 1.4;
        }
        .coverage-focus-copy {
          margin: 10px 0 0; color: #435168;
          font-size: 13px; line-height: 1.52; max-width: 760px;
        }
        .coverage-focus-actions {
          display: flex; flex-direction: column; align-items: flex-end; gap: 9px;
        }
        .coverage-focus-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border: 0; border-radius: 8px; padding: 10px 14px;
          background: var(--navy); color: #fff; text-decoration: none;
          font-size: 12.5px; font-weight: 850; white-space: nowrap;
          box-shadow: 0 10px 22px rgba(27,36,66,.22);
        }
        .coverage-focus-primary svg { width: 14px; height: 14px; }
        .coverage-focus-priority {
          margin: 0; color: var(--muted);
          font-size: 12px; line-height: 1.45; text-align: right; max-width: 260px;
        }
        .coverage-focus-card.is-skill .recommended-guidance {
          margin-top: 14px; padding: 13px 14px;
          border-radius: 10px; border: 1px solid rgba(212,160,23,.20);
          background: rgba(255,255,255,.64);
        }
        .coverage-focus-card.is-skill .scope-text-btn {
          background: rgba(255,255,255,.68);
        }
        .coverage-map-empty {
          min-height: 132px; padding: 24px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 6px;
          border: 1px solid var(--border); border-radius: 10px;
          background: rgba(255,255,255,.97); color: var(--muted);
        }
        .coverage-map-empty strong {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; font-weight: 650;
        }
        .coverage-map-empty span { max-width: 480px; font-size: 12px; line-height: 1.5; }
        @media (max-width: 560px) {
          .coverage-map-head { flex-direction: column; align-items: start; }
          .coverage-mode-controls { width: 100%; overflow-x: auto; border-radius: 12px; }
          .coverage-mode-btn { flex: 1 0 auto; }
          .coverage-focus-card { grid-template-columns: 1fr; padding: 18px; }
          .coverage-focus-actions { align-items: flex-start; }
          .coverage-focus-priority { text-align: left; max-width: none; }
          .coverage-focus-primary { white-space: normal; }
        }
        .breakdown-controls {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; flex-wrap: wrap;
        }
        .breakdown-tabs {
          display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.88); border: 1px solid var(--border);
          box-shadow: var(--shadow-sm); backdrop-filter: blur(14px);
        }
        .breakdown-tab {
          border: none; border-radius: 999px; padding: 7px 12px;
          background: transparent; color: var(--muted);
          font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
        }
        .breakdown-tab:hover, .breakdown-tab:focus-visible {
          color: var(--navy); outline: none;
        }
        .breakdown-tab.is-active { background: var(--navy); color: #fff; }
        .breakdown-note {
          margin: -4px 0 14px; color: rgba(255,255,255,.68);
          font-size: 12.5px; line-height: 1.45;
        }
        .sections-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .sections-grid.books { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .sections-grid.domains { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .domain-radar-card {
          position: relative; overflow: hidden;
          background:
            radial-gradient(circle at 18% 20%, rgba(10,163,163,.10), transparent 32%),
            radial-gradient(circle at 82% 78%, rgba(212,160,23,.08), transparent 34%),
            var(--card);
          border: 1px solid var(--border);
          border-radius: 20px; padding: 26px 28px;
          box-shadow: var(--shadow-sm);
          backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(300px, 1fr) minmax(250px, .85fr);
          gap: 28px; align-items: center;
        }
        .domain-radar-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 50% 48%, rgba(10,163,163,.10), transparent 32%),
            radial-gradient(circle at 50% 48%, rgba(255,255,255,.55), transparent 54%);
          opacity: .75;
        }
        .domain-radar-card::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 0 42%, rgba(10,163,163,.07) 50%, transparent 58% 100%);
          opacity: .44;
        }
        .domain-radar-wrap {
          position: relative; z-index: 1; min-height: 390px;
          display: grid; place-items: center;
        }
        .domain-radar-svg {
          width: min(100%, 430px); height: auto; display: block;
          overflow: visible;
        }
        .radar-ring {
          fill: none; stroke: rgba(27,36,66,.10); stroke-width: .9;
        }
        .radar-axis {
          stroke: rgba(27,36,66,.09); stroke-width: .8;
        }
        .radar-shape {
          fill: rgba(10,163,163,.10);
          stroke: rgba(10,163,163,.78); stroke-width: 1.8;
          filter: drop-shadow(0 0 10px rgba(10,163,163,.24));
          animation: constellationPulse 4.8s ease-in-out infinite;
        }
        .radar-point {
          fill: #fff; stroke: rgba(10,163,163,.90); stroke-width: 2.5;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 8px rgba(10,163,163,.35));
          animation: constellationStar 3.8s ease-in-out infinite;
        }
        .radar-point-glow {
          fill: rgba(10,163,163,.12);
          stroke: rgba(10,163,163,.16);
          stroke-width: 1;
          animation: constellationStar 3.8s ease-in-out infinite;
        }
        @keyframes constellationPulse {
          0%, 100% { opacity: .82; }
          50% { opacity: 1; }
        }
        @keyframes constellationStar {
          0%, 100% { opacity: .86; }
          50% { opacity: 1; }
        }
        .radar-label {
          fill: rgba(27,36,66,.82); font-size: 10.5px; font-weight: 850;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .radar-score-label {
          fill: var(--navy); font-size: 14px; font-weight: 800;
        }
        .domain-radar-side {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; gap: 12px;
        }
        .domain-radar-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 26px; line-height: 1.08; color: var(--navy);
          font-weight: 650; margin-bottom: 2px;
        }
        .domain-radar-copy {
          color: var(--muted); font-size: 13.5px; line-height: 1.55;
          margin-bottom: 8px;
        }
        .domain-radar-list {
          display: grid; gap: 8px;
        }
        .domain-radar-row {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px;
          align-items: center; padding: 9px 11px; border-radius: 12px;
          background: rgba(27,36,66,.045); border: 1px solid rgba(27,36,66,.08);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.34);
          width: 100%; color: inherit; font: inherit; text-align: left; cursor: pointer;
          transition: background .15s ease, border-color .15s ease, transform .15s ease;
        }
        .domain-radar-row:hover, .domain-radar-row:focus-visible {
          background: rgba(10,163,163,.08); border-color: var(--accent-line);
          transform: translateX(2px); outline: none;
        }
        .domain-radar-row.is-locked {
          background: rgba(27,36,66,.035);
          border-style: dashed;
          opacity: .72; cursor: default;
        }
        .domain-radar-name {
          color: var(--navy); font-size: 13px; font-weight: 760;
        }
        .domain-radar-meta {
          color: var(--muted); font-size: 11.5px; font-weight: 650;
        }
        .domain-radar-score {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 20px; font-weight: 700;
        }
        .domain-radar-score.is-locked {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 11px; letter-spacing: .09em; text-transform: uppercase;
          color: var(--muted);
        }
        .section-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 16px; padding: 20px 22px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          position: relative; overflow: hidden; opacity: .9;
          width: 100%; color: inherit; font: inherit; text-align: left;
          transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, opacity .16s ease;
        }
        .section-card:hover, .section-card:focus-within {
          transform: translateY(-2px); border-color: rgba(10,163,163,.32);
          box-shadow: 0 13px 30px rgba(0,0,0,.22); outline: none;
        }
        .section-card.has-score { opacity: 1; }
        .section-card.low-evidence { opacity: .92; }
        .section-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .section-card.ot::before { background: linear-gradient(90deg,#0aa3a3,#d4a017,#2563c4,#7c3aed); }
        .section-card.nt::before { background: linear-gradient(90deg,#14b8a6,#2563eb,#7c3aed); }
        .section-card.torah::before   { background: var(--torah-bar); }
        .section-card.former::before  { background: var(--former-bar); }
        .section-card.latter::before  { background: var(--latter-bar); }
        .section-card.prophets::before { background: linear-gradient(90deg,#0e8c6a,#2563c4); }
        .section-card.writings::before { background: var(--writings-bar); }
        .section-card.gospels::before { background: linear-gradient(90deg,#0d9488,#2dd4bf); }
        .section-card.acts::before { background: linear-gradient(90deg,#0284c7,#38bdf8); }
        .section-card.pauline::before { background: linear-gradient(90deg,#4f46e5,#818cf8); }
        .section-card.general::before { background: linear-gradient(90deg,#7c3aed,#c084fc); }
        .section-card.revelation::before { background: linear-gradient(90deg,#be123c,#fb7185); }
        .section-card.domain-events::before { background: linear-gradient(90deg,#d4a017,#f5c842); }
        .section-card.domain-characters::before { background: linear-gradient(90deg,#0e8c6a,#34d399); }
        .section-card.domain-geography::before { background: linear-gradient(90deg,#0aa3a3,#67e8f9); }
        .section-card.domain-significance::before { background: linear-gradient(90deg,#2563c4,#60a5fa); }
        .section-card.domain-speech::before { background: linear-gradient(90deg,#7c3aed,#a78bfa); }
        .section-card.domain-law::before { background: linear-gradient(90deg,#b45309,#f59e0b); }
        .section-card.domain-numbers::before { background: linear-gradient(90deg,#566070,#9aa3b2); }
        .section-card-main {
          display: block; width: 100%; border: 0; padding: 0;
          color: inherit; background: transparent; font: inherit;
          text-align: left; cursor: pointer;
        }
        .section-card-main:focus-visible { outline: 2px solid rgba(10,163,163,.58); outline-offset: 6px; border-radius: 8px; }
        .sc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .sc-name { font-size: 15px; font-weight: 650; color: var(--navy); }
        .sc-books { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .sc-pct-empty { font-family: var(--font-crimson),Georgia,serif; font-size: 24px; font-weight: 700; color: rgba(27,36,66,.18); line-height: 1; text-align: right; }
        .sc-provisional-label { display: block; margin-top: 4px; font-family: var(--font-inter),system-ui,sans-serif; font-size: 8.5px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; color: #92400e; }
        .sc-bar-track { height: 6px; border-radius: 999px; background: rgba(27,36,66,.07); margin-bottom: 12px; }
        .sc-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .sc-chip-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
        .sc-chip-empty { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(27,36,66,.05); border: 1px solid var(--border); color: var(--muted); }
        .sc-chip-empty.evidence-high,
        .sc-chip-empty.evidence-moderate { background: var(--accent-dim); border-color: var(--accent-line); color: #0a6e6e; }
        .sc-chip-empty.evidence-low { background: #fef3c7; border-color: #fde68a; color: #92400e; }
        .sc-chip-empty.evidence-none { background: rgba(27,36,66,.05); border-color: var(--border); color: var(--muted); }
        .sc-test-link {
          flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px;
          min-height: 30px; padding: 6px 10px; border: 1px solid rgba(27,36,66,.14);
          border-radius: 999px; color: var(--navy); background: rgba(255,255,255,.66);
          font: inherit; font-size: 11px; font-weight: 800; text-decoration: none; cursor: pointer;
          transition: color .16s ease, background .16s ease, border-color .16s ease, transform .16s ease;
        }
        .sc-test-link:hover, .sc-test-link:focus-visible {
          color: #fff; background: var(--navy); border-color: var(--navy);
          transform: translateX(1px); outline: none;
        }
        .sc-test-link svg { width: 13px; height: 13px; }
        .scope-drawer-backdrop {
          position: fixed; inset: 0; z-index: 120; display: flex; justify-content: flex-end;
          background: rgba(3,8,20,.58); backdrop-filter: blur(5px);
          animation: scopeBackdropIn .18s ease-out both;
        }
        /* This drawer is a data readout over the dashboard's starfield, not
           a settings panel — deliberately translucent dark glass (blurred)
           rather than the opaque light card every other data surface here
           uses, so the sky and its stars stay visible behind the numbers
           they explain. --navy/--muted are redefined locally so every
           var(--navy)/var(--muted) text color below still resolves
           correctly against the dark background without editing each rule
           individually; a handful of spots that hardcode a *background*
           (not just text) tied to the light-mode meaning of --navy are
           overridden explicitly further down instead. */
        .scope-drawer {
          --navy: #fff;
          --muted: rgba(255,255,255,.62);
          width: min(480px, 100%); height: 100%; overflow-y: auto;
          background: rgba(9,14,28,.72); color: #fff;
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255,255,255,.14);
          box-shadow: -24px 0 60px rgba(0,0,0,.45);
          animation: scopeDrawerIn .24s cubic-bezier(.22,.72,.18,1) both;
        }
        @keyframes scopeBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scopeDrawerIn { from { transform: translateX(34px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .scope-drawer-head {
          position: sticky; top: 0; z-index: 2; display: flex;
          justify-content: space-between; align-items: flex-start; gap: 18px;
          padding: 28px 28px 20px; background: rgba(9,14,28,.55);
          border-bottom: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(14px);
        }
        .scope-drawer-kicker {
          margin-bottom: 6px; color: #7de5e5; font-size: 10px;
          font-weight: 850; letter-spacing: .12em; text-transform: uppercase;
        }
        .scope-drawer-title {
          font-family: var(--font-crimson), Georgia, serif; font-size: 31px;
          font-weight: 700; line-height: 1.05;
        }
        .scope-drawer-sub { margin-top: 5px; color: var(--muted); font-size: 12.5px; }
        .scope-drawer-close {
          flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: #fff;
          font: 500 24px/1 system-ui, sans-serif; cursor: pointer;
        }
        .scope-drawer-close:hover, .scope-drawer-close:focus-visible {
          border-color: rgba(125,229,229,.55); color: #7de5e5; outline: none;
        }
        .scope-drawer-body { padding: 24px 28px 34px; }
        /* BLI-adjacent drawers/accordion triggers — small icon chips sitting
           where full-width score support cards used to live in the main scroll. */
        .score-panel-triggers {
          display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 28px;
        }
        .score-panel-trigger {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 999px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(212,160,23,.38);
          color: rgba(255,255,255,.8); font: inherit; font-size: 12.5px; font-weight: 700;
          cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease;
        }
        .score-panel-trigger:hover, .score-panel-trigger:focus-visible {
          background: rgba(255,255,255,.11); border-color: rgba(212,160,23,.65); color: #fff; outline: none;
        }
        .score-panel-trigger.is-active {
          background: rgba(94,234,212,.16); border-color: rgba(94,234,212,.42); color: #fff;
          box-shadow: 0 0 0 1px rgba(94,234,212,.12), 0 12px 30px rgba(10,163,163,.12);
        }
        .score-panel-trigger-icon { display: inline-flex; color: #5eead4; }
        .knowledge-profile-panel {
          margin: -10px 0 30px; padding: 22px;
          border-radius: 18px; border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.08);
          box-shadow: 0 22px 58px rgba(0,0,0,.20);
          backdrop-filter: blur(16px);
          animation: knowledgeProfileIn .22s cubic-bezier(.22,.72,.18,1) both;
        }
        .knowledge-profile-panel .breakdown-head { margin-top: 0; }
        .knowledge-profile-panel .section-eyebrow { margin-top: 0; }
        .knowledge-profile-panel .sections-grid { margin-top: 0; }
        @keyframes knowledgeProfileIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: none; }
        }
        .scope-state {
          min-height: 280px; display: grid; place-content: center; text-align: center;
          color: var(--muted); font-size: 13px; line-height: 1.55;
        }
        .scope-state strong {
          display: block; margin-bottom: 5px; color: var(--navy);
          font-family: var(--font-crimson), Georgia, serif; font-size: 22px;
        }
        .scope-evidence {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,.14);
        }
        .scope-evidence-label {
          display: inline-flex; padding: 6px 10px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #7de5e5; font-size: 11px; font-weight: 850;
        }
        .scope-evidence-copy { margin-top: 7px; color: var(--muted); font-size: 12px; line-height: 1.45; }
        .scope-evidence-score {
          color: var(--navy); font-family: var(--font-crimson), Georgia, serif;
          font-size: 32px; font-weight: 700; text-align: right;
        }
        .scope-evidence-score span {
          display: block; margin-top: 2px; color: var(--muted);
          font-family: var(--font-inter), system-ui, sans-serif; font-size: 9px;
          font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
        }
        .scope-metrics {
          display: grid; grid-template-columns: repeat(3,1fr);
          padding: 19px 0; border-bottom: 1px solid rgba(255,255,255,.14);
        }
        .scope-metric { padding-right: 12px; }
        .scope-metric strong { display: block; font-size: 17px; }
        .scope-metric span {
          color: var(--muted); font-size: 9px; font-weight: 800;
          letter-spacing: .08em; text-transform: uppercase;
        }
        .scope-period { padding: 15px 0; color: var(--muted); font-size: 11.5px; line-height: 1.5; }
        .scope-breakdown { padding-top: 18px; border-top: 1px solid rgba(255,255,255,.14); }
        .scope-breakdown + .scope-breakdown { margin-top: 20px; }
        .scope-breakdown h3 {
          margin-bottom: 9px; font-size: 10px; font-weight: 850;
          letter-spacing: .11em; text-transform: uppercase; color: var(--muted);
        }
        .scope-breakdown-row {
          display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px;
          padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.09);
        }
        .scope-breakdown-row:last-child { border-bottom: 0; }
        .scope-breakdown-name { font-size: 13px; font-weight: 750; }
        .scope-breakdown-meta { color: var(--muted); font-size: 11px; margin-top: 2px; }
        .scope-breakdown-value { font-size: 13px; font-weight: 800; text-align: right; }
        .scope-focused-action {
          display: flex; justify-content: space-between; align-items: center; gap: 18px;
          margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.14);
        }
        .scope-focused-action p { color: var(--muted); font-size: 11.5px; line-height: 1.45; }
        .scope-focused-link {
          flex: 0 0 auto; border-radius: 999px; padding: 10px 15px;
          color: #fff; background: #0aa3a3; text-decoration: none;
          font-size: 12px; font-weight: 800; box-shadow: 0 8px 20px rgba(0,0,0,.3);
        }
        @media (max-width: 640px) {
          .score-strip { grid-template-columns: 1fr; }
          .score-block { border-right: none; border-bottom: 1px solid rgba(255,255,255,.12); }
          .conf-block { border-left: none; border-top: 1px solid rgba(255,255,255,.12); align-items: center; text-align: center; }
          .progress-card { padding: 22px 16px 18px; }
          .progress-head { flex-direction: column; gap: 14px; }
          .progress-controls { width: 100%; justify-content: space-between; }
          .progress-chart { min-width: 560px; }
          .progress-detail { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px 12px; }
          .progress-detail-primary { grid-column: 1 / -1; }
          .progress-review-link { grid-column: 1 / -1; }
          .recommendation-engine-head { flex-direction: column; align-items: flex-start; }
          .recommendation-toggle { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .recommendation-toggle-btn { padding-inline: 8px; }
          .breakdown-head { flex-direction: column; align-items: flex-start; }
          .breakdown-controls { width: 100%; justify-content: flex-start; }
          .breakdown-tabs { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); }
          .breakdown-tab { padding-inline: 8px; }
          .sections-grid,
          .sections-grid.books,
          .sections-grid.domains { grid-template-columns: 1fr; }
          .domain-radar-card { grid-template-columns: 1fr; padding: 22px 18px; }
          .domain-radar-wrap { min-height: 330px; }
          .domain-radar-svg { width: min(100%, 340px); }
          .recommended-card { grid-template-columns: 1fr; }
          .frontier-card { grid-template-columns: 1fr; }
          .frontier-context { border-left: 0; border-top: 1px solid var(--border); padding: 14px 0 0; }
          .recommended-side, .recommended-actions { align-items: flex-start; }
          .recommended-priority { max-width: none; }
          .retest-modal { padding: 24px 22px; }
          .retest-modal-actions { align-items: stretch; flex-direction: column-reverse; }
          .retest-modal-primary,
          .retest-modal-secondary { width: 100%; }
          .save-results-card { grid-template-columns: 1fr; padding: 16px 18px; }
          .save-results-actions { align-items: stretch; }
          .save-results-btn { width: 100%; }
          .save-results-note { text-align: center; }
          .first-assessment-card { grid-template-columns: 1fr; padding: 28px 20px; min-height: auto; }
          .first-assessment-orbit { width: min(100%, 280px); }
          .first-assessment-content h2 { font-size: 36px; }
          .first-assessment-primary,
          .first-assessment-secondary { width: 100%; }
          .first-assessment-choice-panel { grid-template-columns: 1fr; }
          .oba-feature-grid { grid-template-columns: 1fr; gap: 12px; }
          .oba-feature-card { min-height: 0; padding: 18px; }
          .oba-feature-graphic { height: 76px; }
          .knowledge-cone-card { padding: 24px 18px; }
          .knowledge-cone-head { align-items: flex-start; flex-direction: column; }
          .knowledge-cone-score { align-items: flex-start; }
          .knowledge-cone-wrap { min-height: 360px; padding: 18px 8px 58px; }
          .knowledge-cone { height: 320px; transform: rotateX(5deg); }
          .cone-tier { padding: 0 calc(var(--text-inset) + 10px); }
          .cone-tier-name { font-size: 10px; }
          .cone-tier-range { font-size: 10px; }
          .cone-layer-popover { left: 50%; top: calc(var(--popover-y) * 1% + 42px); width: min(340px, 90vw); padding: 15px 17px; transform: translateX(-50%); }
          .cone-layer-popover::before { left: 50%; top: -9px; transform: translateX(-50%) rotate(135deg); }
          .cone-layer-popover strong { font-size: 13px; }
          .cone-layer-popover span { font-size: 13px; line-height: 1.46; }
          @keyframes coneDescriptionIn { from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
          .cone-marker { right: 50%; transform: translate(50%, -50%); }
          .cone-marker::before { width: 46px; }
          .dashboard-tabs { grid-template-columns: 1fr; margin-top: -8px; }
          .placeholder-dashboard { grid-template-columns: 1fr; padding: 30px 24px; min-height: 360px; }
          .placeholder-orbit { width: min(210px, 70vw); margin: 0 auto; }
          .scope-drawer-backdrop { align-items: flex-end; }
          .scope-drawer {
            width: 100%; height: min(88vh, 760px); border-left: 0;
            border-top: 1px solid rgba(255,255,255,.42);
          }
          .scope-drawer-head { padding: 22px 20px 17px; }
          .scope-drawer-body { padding: 20px 20px 30px; }
          .scope-focused-action { align-items: flex-start; flex-direction: column; }
          /* The nav links exceed a phone's width, so let them wrap onto a
             second row rather than being clipped off the right edge. */
          .nav { padding: 11px 16px; flex-wrap: wrap; gap: 8px; }
          /* The beta tooltip is only visually hidden, so it still occupies
             layout and pushed the document 71px wider than the viewport.
             Anchor it to the nav instead of the badge so it can never
             extend past the right edge. */
          .beta-badge { position: static; }
          .beta-tooltip { left: 12px; right: 12px; width: auto; top: calc(100% + 6px); }
          .nav-right { flex-wrap: wrap; gap: 7px; }
          .nav-btn { padding: 7px 12px; font-size: 12px; }
          .bli-tooltip,
          .level-tooltip {
            position: fixed;
            left: 16px;
            right: 16px;
            top: auto;
            bottom: 18px;
            width: auto;
            max-width: none;
            transform: none;
            z-index: 140;
          }
          .bli-tooltip::before,
          .level-tooltip::before {
            display: none;
          }
          .learn-more-menu {
            position: fixed;
            left: 16px;
            right: 16px;
            top: 86px;
            width: auto;
          }
          .learn-more-menu::before { display: none; }
          .page { padding: 28px 16px 72px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .water-fill, .water-fill::before, .water-fill::after,
          .water-wave, .water-wave::before,
          .progress-point,
          .scope-drawer-backdrop, .scope-drawer,
          .placeholder-orbit, .placeholder-orbit::before, .placeholder-orbit::after {
            animation: none !important;
          }
          /* Catch-all: the page reveal and any future decorative animation
             should be instant rather than a multi-second transition. The
             content must still arrive, so opacity is forced back to full. */
          .page { animation: none !important; opacity: 1 !important; filter: none !important; transform: none !important; }
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      <canvas ref={canvasRef} className="stars" aria-hidden="true" />
      <StarfieldRewardsLayer userId={dashboardUserId} />

      {deleteOpen && userEmail && (
        <div
          onClick={() => { if (!deleteBusy) setDeleteOpen(false); }}
          style={{position:"fixed",inset:0,zIndex:80,background:"rgba(12,16,28,.55)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={e => e.stopPropagation()}
            style={{width:"100%",maxWidth:460,background:"#fff",border:"1px solid var(--border)",borderRadius:18,padding:"26px 26px 22px",boxShadow:"0 30px 80px rgba(0,0,0,.28)"}}
          >
            <h2 id="delete-account-title" style={{fontFamily:"var(--font-crimson), Georgia, serif",fontSize:23,fontWeight:600,color:"var(--navy)",marginBottom:10}}>
              Delete your account
            </h2>
            <p style={{fontSize:14,lineHeight:1.65,color:"var(--muted)",marginBottom:14}}>
              This permanently removes your account and every assessment attempt, answer,
              and score attached to it. It cannot be undone, and nothing is kept in a backup
              you could ask us to restore from.
            </p>
            <label style={{display:"block",fontSize:12.5,fontWeight:700,color:"var(--navy)",marginBottom:7}}>
              Type <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace"}}>{userEmail}</span> to confirm
            </label>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              disabled={deleteBusy}
              autoComplete="off"
              spellCheck={false}
              aria-label="Type your email address to confirm deletion"
              style={{width:"100%",padding:"11px 13px",borderRadius:10,border:"1px solid var(--border)",fontSize:14.5,fontFamily:"inherit",color:"var(--navy)",outline:"none",marginBottom:deleteError?10:18}}
            />
            {deleteError && (
              <p role="alert" style={{fontSize:13,lineHeight:1.55,color:"#b4402f",marginBottom:16}}>{deleteError}</p>
            )}
            <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleteBusy}
                style={{padding:"10px 18px",borderRadius:999,border:"1px solid var(--border)",background:"transparent",color:"var(--muted)",fontSize:14,fontWeight:600,fontFamily:"inherit",cursor:deleteBusy?"not-allowed":"pointer"}}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteBusy || deleteConfirm.trim().toLowerCase() !== userEmail.trim().toLowerCase()}
                style={{padding:"10px 18px",borderRadius:999,border:"none",background:deleteConfirm.trim().toLowerCase() === userEmail.trim().toLowerCase() && !deleteBusy ? "#b4402f" : "rgba(180,64,47,.35)",color:"#fff",fontSize:14,fontWeight:600,fontFamily:"inherit",cursor:deleteBusy||deleteConfirm.trim().toLowerCase()!==userEmail.trim().toLowerCase()?"not-allowed":"pointer"}}
              >
                {deleteBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="nav">
        <span className="brand-wrap">
          <BrandLogo className="nav-brand" />
          <span className="beta-badge" tabIndex={0}>
            Beta
            <span className="beta-tooltip" role="tooltip">
              Open Bible Assessment is still in active development. Scores and questions are being refined, so your results may shift as the platform matures.
            </span>
          </span>
        </span>
        <div className="nav-right">
          <Link className="nav-btn" href="/assess">Assess</Link>
          <Link className="nav-btn" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-btn" href="/reading-log">Reading Log</Link>
          <div className="learn-more" ref={learnMoreRef}>
            <button
              type="button"
              className="nav-btn learn-more-trigger"
              onClick={() => {
                setLearnMoreOpen(open => !open);
                setAccountMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={learnMoreOpen}
            >
              Learn More
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {learnMoreOpen && (
              <div className="learn-more-menu" role="menu" aria-label="Learn more pages">
                <Link
                  className="learn-more-item"
                  role="menuitem"
                  href="/credential"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#d4a017" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">Future Ideas</span>
                    <span>Where the project can grow next</span>
                  </span>
                </Link>
                <Link
                  className="learn-more-item"
                  role="menuitem"
                  href="/about"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#0aa3a3" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">About</span>
                    <span>Purpose, limits, and philosophy</span>
                  </span>
                </Link>
                <Link
                  className="learn-more-item"
                  role="menuitem"
                  href="/bli"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#7c3aed" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">How BLI Works</span>
                    <span>Scoring model and score bands</span>
                  </span>
                </Link>
              </div>
            )}
          </div>
          {userEmail ? (
            <div ref={accountMenuRef} style={{position:"relative"}}>
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen(open => !open);
                  setLearnMoreOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                title="Account"
                style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12,color:"var(--muted)",padding:"6px 12px",borderRadius:999,border:"1px solid var(--border)",background:accountMenuOpen?"rgba(255,255,255,.72)":"rgba(255,255,255,.5)",cursor:"pointer",fontFamily:"inherit",transition:"background .14s"}}
              >
                {userEmail}
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{transform:accountMenuOpen?"rotate(180deg)":"none",transition:"transform .14s"}} aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {accountMenuOpen && (
                <div
                  role="menu"
                  style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:40,minWidth:190,padding:6,borderRadius:12,background:"rgba(255,255,255,.98)",border:"1px solid var(--border)",boxShadow:"0 16px 40px rgba(0,0,0,.28)"}}
                >
                  <div style={{padding:"7px 10px 8px",fontSize:11,color:"var(--muted)",borderBottom:"1px solid var(--border)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    Signed in as<br/><span style={{color:"var(--navy)",fontWeight:700}}>{userEmail}</span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setAccountMenuOpen(false);
                      await supabase.auth.signOut();
                      clearAssessmentBrowserStorage();
                      setUserEmail(null);
                      setAssessmentData(null);
                      setTestamentScores(null);
                      setSectionScores({});
                      setScopeScores(buildScopeScores([], []));
                      setBackendRecommendation(null);
                    }}
                    style={{display:"flex",width:"100%",alignItems:"center",gap:9,marginTop:4,padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",color:"var(--navy)",fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(27,36,66,.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setAccountMenuOpen(false); setDeleteConfirm(""); setDeleteError(null); setDeleteOpen(true); }}
                    title="Permanently delete your account and assessment history"
                    style={{display:"flex",width:"100%",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",color:"#b4402f",fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(180,64,47,.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    Delete account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="nav-btn" onClick={handleSignIn}>Sign in</button>
          )}
        </div>
      </nav>

      <main className={`page ${isNewAssessmentLanding ? "is-new-assessment-landing" : ""} ${isDashboardLoading ? "is-dashboard-loading" : ""}`}>
        {!isNewAssessmentLanding && !isDashboardLoading && (
          <header className="page-header">
            <div>
              <div className="page-title-row">
                <h1 className="page-title">Your Learning Dashboard</h1>
                <div className="subject-switcher" ref={subjectMenuRef}>
                  <button
                    type="button"
                    className="subject-trigger"
                    onClick={() => setSubjectMenuOpen(open => !open)}
                    aria-haspopup="menu"
                    aria-expanded={subjectMenuOpen}
                  >
                    <span
                      className="subject-trigger-dot"
                      style={{ background: DASHBOARD_SUBJECTS.find(s => s.id === activeDashboardTab)?.color }}
                      aria-hidden="true"
                    />
                    {DASHBOARD_SUBJECTS.find(s => s.id === activeDashboardTab)?.label}
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {subjectMenuOpen && (
                    <div className="learn-more-menu subject-menu" role="menu" aria-label="Dashboard subject">
                      {DASHBOARD_SUBJECTS.map(subject => (
                        <button
                          type="button"
                          key={subject.id}
                          role="menuitemradio"
                          aria-checked={activeDashboardTab === subject.id}
                          className={`learn-more-item subject-menu-item ${activeDashboardTab === subject.id ? "is-active" : ""}`}
                          onClick={() => { setActiveDashboardTab(subject.id); setSubjectMenuOpen(false); }}
                          style={{ "--planet-color": subject.color } as CSSProperties}
                        >
                          <span className="learn-more-planet" aria-hidden="true" />
                          <span className="learn-more-item-copy">
                            <span className="learn-more-item-title">{subject.label}</span>
                            <span>{subject.id === "bli" ? subject.subtitle : "Coming soon"}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="page-meta">
                {activeDashboardTab === "bli" && (!dashboardHydrated
                  ? "Loading your dashboard..."
                  : testamentScores?.combined_questions_answered
                  ? `${testamentScores.combined_questions_answered} questions answered across OT and NT`
                  : visibleAssessmentData ? `${visibleAssessmentData.answered} questions answered` : "No assessment taken yet")}
                {activeDashboardTab === "church-history" && "Church History dashboard coming soon"}
                {activeDashboardTab === "biblical-languages" && "Biblical Languages dashboard coming soon"}
              </p>
            </div>
            {activeDashboardTab === "bli" && dashboardHydrated && (() => {
              const isOT = suiteTestament === "OT";
              const hasData = isOT ? Boolean(visibleAssessmentData) : Boolean(testamentScores?.nt_questions_answered);
              // The toggle already picked the testament, so both routes go
              // straight to that assessment — no "which testament?" interstitial.
              const ctaHref = isOT ? "/assess" : "/assess?testament=NT&scope=NT";
              return (
                <div className="header-assess" style={{ "--suite-hue": isOT ? "#d4a017" : "#7c3aed" } as CSSProperties}>
                  <div className="std-assess-toggle" role="tablist" aria-label="Testament">
                    <span className="std-assess-toggle-thumb" style={{ transform: isOT ? "translateX(0%)" : "translateX(100%)" }} />
                    <button
                      type="button" role="tab" aria-selected={isOT}
                      className={`std-assess-toggle-btn ${isOT ? "is-active" : ""}`}
                      onClick={() => setSuiteTestament("OT")}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="7" height="16" rx="2"/>
                        <rect x="14" y="4" width="7" height="16" rx="2"/>
                      </svg>
                      Old Testament
                    </button>
                    <button
                      type="button" role="tab" aria-selected={!isOT}
                      className={`std-assess-toggle-btn ${!isOT ? "is-active" : ""}`}
                      onClick={() => setSuiteTestament("NT")}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="3" x2="12" y2="21"/>
                        <line x1="7" y1="9" x2="17" y2="9"/>
                      </svg>
                      New Testament
                    </button>
                  </div>
                  <div className="std-assess-actions">
                    <Link className="std-assess-cta" href={ctaHref}>
                      {hasData ? "Continue assessment" : "Start assessment"}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              );
            })()}
          </header>
        )}

        {!hasCompletedAssessment && !isDashboardLoading && (
          <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
            <button
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "bli"}
              className={`dashboard-tab ${activeDashboardTab === "bli" ? "is-active" : ""}`}
              onClick={() => setActiveDashboardTab("bli")}
            >
              <strong>BLI</strong>
              <span>OT, NT, and combined literacy</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "church-history"}
              className={`dashboard-tab ${activeDashboardTab === "church-history" ? "is-active" : ""}`}
              onClick={() => setActiveDashboardTab("church-history")}
            >
              <strong>Church History</strong>
              <span>Coming soon</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "biblical-languages"}
              className={`dashboard-tab ${activeDashboardTab === "biblical-languages" ? "is-active" : ""}`}
              onClick={() => setActiveDashboardTab("biblical-languages")}
            >
              <strong>Biblical Languages</strong>
              <span>Coming soon</span>
            </button>
          </div>
        )}

        {activeDashboardTab === "bli" ? (
          !dashboardHydrated ? (
            <section className="dashboard-loading-card" aria-label="Loading dashboard" aria-live="polite">
              <div className="dashboard-loading-orbit" aria-hidden="true" />
              <span className="dashboard-loading-sr">Loading your dashboard</span>
            </section>
          ) : !hasCompletedAssessment ? (
            <>
              <section className="first-assessment-card" aria-label="Start your first assessment">
                <div className="first-assessment-orbit" aria-hidden="true">
                  <span className="first-assessment-sun" />
                  <span className="first-assessment-planet" />
                  <span className="first-assessment-moon" />
                </div>
                <div className="first-assessment-content">
                  <p className="first-assessment-kicker">Start here</p>
                  <h2>Take your first Bible assessment</h2>
                  <p>
                    Answer a short adaptive set of questions. OBA will estimate your BLI, map likely strengths and gaps, and recommend one next place to study.
                  </p>
                  <div className="first-assessment-actions">
                    {inProgressTestament ? (
                      <Link
                        className="first-assessment-primary"
                        href={inProgressTestament === "OT" ? "/assess" : "/assess?testament=NT&scope=NT"}
                      >
                        Continue assessment
                        <span aria-hidden="true">→</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="first-assessment-primary"
                        aria-expanded={firstAssessmentChooserOpen}
                        aria-controls="first-assessment-choice-panel"
                        onClick={() => setFirstAssessmentChooserOpen(open => !open)}
                      >
                        Take assessment
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                    <Link className="first-assessment-secondary" href="/bli">
                      Learn more
                    </Link>
                  </div>
                  {!inProgressTestament && firstAssessmentChooserOpen && (
                    <div
                      id="first-assessment-choice-panel"
                      className="first-assessment-choice-panel"
                      aria-label="Choose assessment testament"
                    >
                      <Link className="first-assessment-choice" href="/assess">
                        <strong>Old Testament</strong>
                        <span>Genesis through Malachi, scored as its own 0-800 BLI.</span>
                      </Link>
                      <Link className="first-assessment-choice" href="/assess?testament=NT&scope=NT">
                        <strong>New Testament</strong>
                        <span>Matthew through Revelation, scored separately from OT.</span>
                      </Link>
                    </div>
                  )}
                </div>
              </section>

              <section className="oba-feature-grid" aria-label="Open Bible Assessment features">
                <article className="oba-feature-card" style={{ "--feature-hue": "#0aa3a3" } as CSSProperties}>
                  <div className="oba-feature-graphic is-signal" aria-hidden="true">
                    <span className="signal-node" />
                    <span className="signal-node" />
                    <span className="signal-node" />
                    <span className="signal-line" />
                    <span className="signal-line" />
                  </div>
                  <p className="oba-feature-kicker">Adaptive</p>
                  <h3 className="oba-feature-title">Follows where you&rsquo;re unsure</h3>
                  <p className="oba-feature-copy">
                    OBA weights central passages more heavily and spends extra questions on your least-tested sections, so your score reflects real familiarity — not just how many questions you answered.
                  </p>
                </article>

                <article className="oba-feature-card" style={{ "--feature-hue": "#d4a017" } as CSSProperties}>
                  <div className="oba-feature-graphic is-map" aria-hidden="true">
                    <span className="map-orbit" />
                    <span className="map-star" />
                    <span className="map-planet" />
                  </div>
                  <p className="oba-feature-kicker">Visual</p>
                  <h3 className="oba-feature-title">See the Bible as a map</h3>
                  <p className="oba-feature-copy">
                    See which parts of the Bible you have started to cover, which areas are still untested, and how the sections fit together.
                  </p>
                </article>

                <article className="oba-feature-card" style={{ "--feature-hue": "#7c3aed" } as CSSProperties}>
                  <div className="oba-feature-graphic is-path" aria-hidden="true">
                    <span className="path-line" />
                    <span className="path-step" />
                    <span className="path-step" />
                    <span className="path-step" />
                  </div>
                  <p className="oba-feature-kicker">Practical</p>
                  <h3 className="oba-feature-title">Study what helps next</h3>
                  <p className="oba-feature-copy">
                    After an assessment, OBA gives you a focused place to reread or review instead of a vague study plan.
                  </p>
                </article>
              </section>
            </>
          ) : (
          <>
        {!userEmail && visibleAssessmentData && (
          <section className="save-results-card" aria-label="Save assessment results">
            <div className="save-results-graphic" aria-hidden="true">
              <span className="save-results-check" />
            </div>
            <div className="save-results-content">
              <span className="save-results-kicker">Keep this result</span>
              <h2 className="save-results-title">Save your progress across devices.</h2>
              <p className="save-results-copy">
                You just created a BLI snapshot in this browser. Sign in to keep it, sync it across devices, and return to your recommendation later.
              </p>
            </div>
            <div className="save-results-actions">
              <button className="save-results-btn" type="button" onClick={handleSignIn}>
                Save results
                <span aria-hidden="true">→</span>
              </button>
              <span className="save-results-note">Your existing answers transfer after sign-in.</span>
            </div>
          </section>
        )}


        {(() => {
          // The three tabs share one description-band system (lib/bli.ts),
          // whose wording is written for the OT by default; swap in the
          // right noun for NT / Combined rather than forking the copy.
          const testamentize = (description: string, noun: string) =>
            description.replace(/the Old Testament/g, noun);

          const todaysVerse = verseOfTheDay();

          const otHasData = Boolean(visibleAssessmentData);
          const ntHasData = Boolean(testamentScores?.nt_questions_answered);
          const combinedHasData = Boolean(testamentScores?.combined_available);

          const ntLevel: BliLevel = ntHasData && testamentScores ? testamentScores.nt_bli_level : "Unfamiliar";
          const ntBand = BLI_LEVELS.find((b) => b.name === ntLevel) ?? BLI_LEVELS[0];
          const combinedScore = testamentScores?.combined_display_bli ?? null;
          const combinedLevel: BliLevel = combinedHasData && combinedScore !== null ? levelForScore(combinedScore) : "Unfamiliar";
          const combinedBand = BLI_LEVELS.find((b) => b.name === combinedLevel) ?? BLI_LEVELS[0];

          const tabs = {
            OT: {
              name: "OT BLI", accent: "#d4a017", hasData: otHasData,
              score: currentDisplayScore, level: currentDisplayLevel,
              description: currentDisplayBand.description,
              emptyDescription: <>Take your first assessment to place your score and get a next step.</>,
              evidence: bliEvidence,
              tooltip: "Your OT Bible Literacy Index measures Old Testament knowledge across four sections. The NT BLI is scored separately, and the combined score adds both 0-800 indexes for a total up to 1600.",
              range: otHasData ? `${currentDisplayLevel} · 0-800` : "Complete the OT assessment · 0-800",
            },
            NT: {
              name: "NT BLI", accent: "#7c3aed", hasData: ntHasData,
              score: testamentScores?.nt_display_bli ?? 0, level: ntLevel,
              description: testamentize(ntBand.description, "the New Testament"),
              emptyDescription: <>Take the New Testament assessment to find out where you stand. It builds its own <strong>separate 0-800 score</strong>, distinct from the OT BLI.</>,
              evidence: ntBliEvidence,
              tooltip: "Your NT Bible Literacy Index measures New Testament knowledge across the Gospels, Acts, the Epistles, and Revelation. It is scored separately from the OT BLI.",
              range: ntHasData ? `${ntLevel} · 0-800` : "Complete the NT assessment · 0-800",
            },
            COMBINED: {
              name: "Combined BLI", accent: "#0aa3a3", hasData: combinedHasData,
              score: combinedScore ?? 0, level: combinedLevel,
              description: testamentize(combinedBand.description, "the whole Bible"),
              emptyDescription: <>Complete both the OT and NT assessments to unlock a single, <strong>pooled picture</strong> of your whole-Bible literacy.</>,
              evidence: combinedBliEvidence,
              tooltip: "Your combined score pools evidence from both testaments into one 0-800 picture of whole-Bible literacy, available once both assessments have some evidence.",
              range: combinedHasData ? "Pooled OT + NT · 0-800" : "Available after both assessments · 0-800",
            },
          } as const;
          // The header's OT/NT toggle now drives this panel directly — no
          // separate OT/NT/Combined tab row. Combined isn't a testament you
          // can "switch to" (there's no combined assessment to continue), so
          // it surfaces as a small standing note instead — see combinedNote
          // below — rather than a third toggle position.
          const active = tabs[suiteTestament];

          return (
            <>
              {combinedHasData && (
                <p className="combined-note">
                  <span className="combined-note-dot" aria-hidden="true" />
                  Combined BLI <strong>{combinedScore}</strong> · pooled across both testaments
                </p>
              )}

              <div className="score-strip" style={{ "--score-accent": active.accent } as CSSProperties}>
                <div className={`score-block ${active.hasData ? "has-score" : ""}`} key={`score-${suiteTestament}`}>
                  <span className="score-number">
                    {active.hasData ? active.score : "?"}
                  </span>
                  {/* The level name now doubles as the score's caption — no
                      more separate "OT BLI" label. The small ⓘ next to it
                      still explains what the index itself measures. */}
                  <div
                    className="level-label-row"
                    onMouseEnter={cancelLevelTooltipClose}
                    onMouseLeave={closeLevelTooltipSoon}
                  >
                    {active.hasData && (
                      <>
                        <button
                          type="button"
                          className="level-badge-empty level-badge-btn"
                          aria-expanded={showLevelTooltip}
                          aria-label={`What does ${active.level} mean?`}
                          onClick={() => setShowLevelTooltip((v) => !v)}
                          onFocus={cancelLevelTooltipClose}
                          onBlur={closeLevelTooltipSoon}
                        >
                          {active.level}
                        </button>
                        <Link
                          className={`level-tooltip ${showLevelTooltip ? "is-open" : ""}`}
                          role="tooltip"
                          href="/bli#score-bands"
                          onClick={() => setShowLevelTooltip(false)}
                          onFocus={cancelLevelTooltipClose}
                          onBlur={closeLevelTooltipSoon}
                        >
                          {active.description}
                          <span>Learn more →</span>
                        </Link>
                      </>
                    )}
                    <span
                      className="score-label-row"
                      onMouseEnter={openBliTooltip}
                      onMouseLeave={closeBliTooltipSoon}
                    >
                      <button
                        type="button"
                        className="bli-info-btn"
                        aria-label={`About the ${active.name}`}
                        aria-expanded={showBliTooltip}
                        onFocus={openBliTooltip}
                        onBlur={closeBliTooltipSoon}
                        onClick={() => setShowBliTooltip((v) => !v)}
                      >
                        ⓘ
                      </button>
                      <Link
                        className={`bli-tooltip ${showBliTooltip ? "is-open" : ""}`}
                        role="tooltip"
                        href="/about"
                        onMouseEnter={openBliTooltip}
                        onMouseLeave={closeBliTooltipSoon}
                        onFocus={openBliTooltip}
                        onBlur={closeBliTooltipSoon}
                      >
                        {active.tooltip}
                        <span>Learn more →</span>
                      </Link>
                    </span>
                  </div>
                </div>
                {/* Once there's a score, the level moved under the score
                    number above, so this middle column used to just be
                    breathing room — now it holds the verse of the day
                    instead. Before an assessment exists, it still carries
                    the explanatory copy telling you what to do next. */}
                <div className="level-block" key={`level-${suiteTestament}`}>
                  {!active.hasData ? (
                    <>
                      <div className="level-badge-empty">Not yet assessed</div>
                      <p className="level-desc-empty">
                        {active.emptyDescription}
                      </p>
                    </>
                  ) : !userEmail && visibleAssessmentData ? (
                    // A brand-new, signed-out result in this browser only — the
                    // verse of the day can wait; the one thing worth this slot
                    // right now is not losing the score just taken.
                    <div className="save-progress-mini">
                      <p className="save-progress-mini-text">Save your progress</p>
                      <button type="button" className="save-progress-mini-btn" onClick={handleSignIn}>
                        Save results
                      </button>
                    </div>
                  ) : (
                    <figure className="verse-of-day">
                      <p className="verse-of-day-kicker">Verse of the Day</p>
                      <blockquote className="verse-of-day-text">{todaysVerse.text}</blockquote>
                      <figcaption className="verse-of-day-ref">{todaysVerse.reference}</figcaption>
                    </figure>
                  )}
                </div>
                <div className="conf-block" key={`conf-${suiteTestament}`}>
                  <span className="conf-empty-label">
                    Score evidence
                    <button
                      className="evidence-info-btn"
                      type="button"
                      aria-label="About score evidence"
                      aria-expanded={showEvidenceTooltip}
                      onMouseEnter={() => setShowEvidenceTooltip(true)}
                      onMouseLeave={() => setShowEvidenceTooltip(false)}
                      onFocus={() => setShowEvidenceTooltip(true)}
                      onBlur={() => setShowEvidenceTooltip(false)}
                      onClick={() => setShowEvidenceTooltip((value) => !value)}
                    >
                      i
                    </button>
                  </span>
                  <span className="conf-note">
                    {active.evidence ? (
                      <>
                        <span className="conf-level">{active.evidence.evidence_level}</span>
                        <span>{active.evidence.n_responses} responses</span>
                      </>
                    ) : "Answer questions to establish evidence"}
                  </span>
                  <span className={`evidence-tooltip ${showEvidenceTooltip ? "is-open" : ""}`} role="tooltip">
                    {active.evidence?.evidence_description || "Score evidence reflects the amount and consistency of psychometric evidence supporting your current estimate."}
                  </span>
                </div>
              </div>
            </>
          );
        })()}

        <div className="score-panel-triggers">
          <button
            type="button"
            className={`score-panel-trigger ${knowledgeProfileOpen ? "is-active" : ""}`}
            aria-expanded={knowledgeProfileOpen}
            aria-controls="knowledge-profile-panel"
            onClick={() => setKnowledgeProfileOpen(open => !open)}
          >
            <span className="score-panel-trigger-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>
                <path d="M8 7h8"/>
                <path d="M8 11h6"/>
              </svg>
            </span>
            Knowledge profile
          </button>
          <button
            type="button"
            className={`score-panel-trigger ${progressPanelOpen ? "is-active" : ""}`}
            aria-expanded={progressPanelOpen}
            aria-controls="progress-over-time-panel"
            onClick={() => setProgressPanelOpen(open => !open)}
          >
            <span className="score-panel-trigger-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/>
                <path d="M7 14l4-4 3 3 5-6"/>
              </svg>
            </span>
            Knowledge over time
          </button>
          <button
            type="button"
            className={`score-panel-trigger ${conePanelOpen ? "is-active" : ""}`}
            aria-expanded={conePanelOpen}
            aria-controls="knowledge-cone-panel"
            onClick={() => setConePanelOpen(open => !open)}
          >
            <span className="score-panel-trigger-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 18H3z"/>
                <path d="M9.5 9h5"/>
                <path d="M8 15h8"/>
              </svg>
            </span>
            Knowledge cone
          </button>
        </div>

        {knowledgeProfileOpen && (
          <section id="knowledge-profile-panel" className="knowledge-profile-panel" aria-labelledby="knowledge-profile-title">
            <div className="breakdown-head">
              <p className="section-eyebrow" id="knowledge-profile-title">Knowledge profile</p>
              <div className="breakdown-controls">
                <div className="breakdown-tabs" role="tablist" aria-label="Knowledge profile breakdown">
                  {[
                    { key: "sections", label: "Sections" },
                    { key: "books", label: "Books" },
                    { key: "domains", label: "Skills" },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeBreakdownTab === tab.key}
                      className={`breakdown-tab ${activeBreakdownTab === tab.key ? "is-active" : ""}`}
                      onClick={() => setActiveBreakdownTab(tab.key as BreakdownTab)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="breakdown-note">
              {activeBreakdownTab === "sections" && `Major ${profileTestament} sections.`}
              {activeBreakdownTab === "books" && `${profileTestament} scores by book.`}
              {activeBreakdownTab === "domains" && `Skill areas tested across your ${profileTestament} answers.`}
            </p>
            <div className={`sections-grid ${activeBreakdownTab}`}>
              {visibleBreakdownScores.map(s => {
                const hasScore = s.rawScore !== null && s.answered > 0;
                const scoreEvidence = sectionEvidence(s.answered);
                const assessmentHref = assessmentHrefForScore(s);
                const fillColor = s.className === "torah" ? "linear-gradient(90deg,#d4a017,#f5c842)"
                  : s.className === "former" ? "linear-gradient(90deg,#0e8c6a,#34d399)"
                  : s.className === "latter" ? "linear-gradient(90deg,#2563c4,#60a5fa)"
                  : s.className === "writings" ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
                  : s.className === "prophets" ? "linear-gradient(90deg,#0e8c6a,#2563c4)"
                  : s.className === "ot" ? "linear-gradient(90deg,#0aa3a3,#d4a017,#2563c4,#7c3aed)"
                  : s.className === "nt" ? "linear-gradient(90deg,#14b8a6,#2563eb,#7c3aed)"
                  : s.className === "gospels" ? "linear-gradient(90deg,#0d9488,#2dd4bf)"
                  : s.className === "acts" ? "linear-gradient(90deg,#0284c7,#38bdf8)"
                  : s.className === "pauline" ? "linear-gradient(90deg,#4f46e5,#818cf8)"
                  : s.className === "general" ? "linear-gradient(90deg,#7c3aed,#c084fc)"
                  : s.className === "revelation" ? "linear-gradient(90deg,#be123c,#fb7185)"
                  : "linear-gradient(90deg,#0aa3a3,#67e8f9)";
                return (
                  <article
                    key={s.key}
                    className={`section-card ${s.className} ${hasScore ? "has-score" : ""} ${scoreEvidence.isProvisional ? "low-evidence" : ""}`}
                  >
                    <button
                      type="button"
                      className="section-card-main"
                      onClick={() => void openScopeDetail(detailTargetForScore(s))}
                    >
                      <div className="sc-top">
                        <div>
                          <div className="sc-name">{s.label}</div>
                          <div className="sc-books">{s.subtitle}</div>
                        </div>
                        <div
                          className="sc-pct-empty"
                          style={{color: hasScore ? "#1b2442" : undefined}}
                          aria-label={hasScore && scoreEvidence.isProvisional ? `Early BLI estimate ${s.displayScore}` : undefined}
                        >
                          {hasScore ? s.displayScore : "--"}
                          {hasScore && scoreEvidence.isProvisional && (
                            <span className="sc-provisional-label">Early</span>
                          )}
                        </div>
                      </div>
                      <div className="sc-bar-track">
                        {hasScore && (
                          <div className="sc-bar-fill" style={{
                            width: `${Math.max(3, Math.min(100, s.rawScore ?? 0))}%`,
                            background: fillColor,
                            height: "100%", borderRadius: 999, transition: "width 1s ease"
                          }} />
                        )}
                      </div>
                    </button>
                    <div className="sc-card-footer">
                      <div className="sc-chip-row">
                        <span className={`sc-chip-empty evidence-${s.confidence}`}>
                          {hasScore ? `${s.answered} answered` : "Not yet assessed"}
                        </span>
                        {hasScore && <span className={`sc-chip-empty evidence-${s.confidence}`}>{evidenceLabel(s)}</span>}
                      </div>
                      {assessmentHref && (
                        <Link className="sc-test-link" href={assessmentHref}>
                          {hasScore ? "Retest" : "Test"}
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                          </svg>
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {progressPanelOpen && (
          <section id="progress-over-time-panel" className="progress-card progress-panel" aria-labelledby="progress-title">
            <div className="progress-head">
              <div>
                <p className="progress-eyebrow">Assessment snapshots</p>
                <h2 className="progress-title" id="progress-title">Knowledge over time</h2>
                <p className="progress-sub">
                  A record of completed assessments, shown on the full 0-800 BLI scale.
                </p>
              </div>
              <div className="progress-controls">
                <div className="progress-latest">
                  {progressHistory[0]?.display_bli ?? "--"}
                  <span>Latest {progressTestament} BLI</span>
                </div>
              </div>
            </div>

            {progressLoading ? (
              <div className="progress-empty" role="status">
                <strong>Plotting your progress...</strong>
                <span>Loading completed assessment snapshots.</span>
              </div>
            ) : progressError ? (
              <div className="progress-empty progress-error" role="status">
                <strong>Progress is temporarily unavailable</strong>
                <span>{progressError}</span>
              </div>
            ) : plottedProgress.length === 0 ? (
              <div className="progress-empty">
                <strong>No {progressTestament} snapshots yet</strong>
                <span>
                  Complete an {progressTestament} assessment to begin a durable progress record.
                </span>
              </div>
            ) : (
              <>
                <div className="progress-chart-shell">
                  <div className="progress-axis" aria-hidden="true">
                    {progressAxisLabels.map((v, i) => <span key={i}>{v}</span>)}
                  </div>
                  <div className="progress-chart-scroll">
                    <div className="progress-chart">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="progressArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(111,218,221,.34)" />
                            <stop offset="55%" stopColor="rgba(111,218,221,.10)" />
                            <stop offset="100%" stopColor="rgba(111,218,221,0)" />
                          </linearGradient>
                          <linearGradient id="progressStroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3ba8ab" />
                            <stop offset="62%" stopColor="#6fdadd" />
                            <stop offset="88%" stopColor="#b8ecd9" />
                            <stop offset="100%" stopColor="#f5c842" />
                          </linearGradient>
                        </defs>
                        <line className="progress-guide" x1="0" y1="8" x2="100" y2="8" />
                        <line className="progress-guide" x1="0" y1="50" x2="100" y2="50" />
                        <line className="progress-guide" x1="0" y1="92" x2="100" y2="92" />
                        {progressAreaPath && <path className="progress-area" d={progressAreaPath} />}
                        {progressPath && <path className="progress-line-glow" d={progressPath} />}
                        {progressPath && <path className="progress-line" d={progressPath} />}
                        {progressPath && <path className="progress-line-flow" d={progressPath} pathLength={100} />}
                      </svg>
                      {plottedProgress.map(({point, x, y}, pointIndex) => {
                        const pointDate = formatProgressDate(point.captured_at);
                        const isLatest = pointIndex === plottedProgress.length - 1;
                        return (
                          <button
                            key={`${point.attempt_id}:${point.captured_at}`}
                            type="button"
                            className={`progress-point ${isLatest ? "is-latest" : ""} ${activeProgressPoint?.attempt_id === point.attempt_id ? "is-active" : ""}`}
                            style={{left: `${x}%`, top: `${y}%`}}
                            aria-label={`${pointDate}: BLI ${point.display_bli}, ${point.bli_level}, ${point.questions_answered} questions answered`}
                            onMouseEnter={() => setActiveProgressAttemptId(point.attempt_id)}
                            onFocus={() => setActiveProgressAttemptId(point.attempt_id)}
                            onClick={() => setActiveProgressAttemptId(point.attempt_id)}
                          />
                        );
                      })}
                      <div className="progress-xaxis" aria-hidden="true">
                        {progressXAxisLabels.map((lbl, i) => (
                          <span key={i} style={{ left: `${lbl.x}%` }}>{lbl.text}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {activeProgressPoint && (
                  <div className="progress-detail" aria-live="polite">
                    <div className="progress-detail-primary">
                      <strong>{formatProgressDate(activeProgressPoint.captured_at)}</strong>
                      <span>{activeProgressPoint.bli_level}</span>
                    </div>
                    <div className="progress-stat">
                      <strong>{activeProgressPoint.display_bli}</strong>
                      <span>BLI score</span>
                    </div>
                    <div className="progress-stat">
                      <strong>{activeProgressPoint.questions_answered}</strong>
                      <span>Questions answered</span>
                    </div>
                    <div className="progress-stat">
                      <strong>{formatScoreChange(activeProgressPoint.score_change)}</strong>
                      <span>From prior snapshot</span>
                    </div>
                    <Link className="progress-review-link" href={`/results/${activeProgressPoint.attempt_id}`}>
                      Review assessment
                    </Link>
                  </div>
                )}
                <p className="progress-note">
                  Ordinary movement is expected as evidence accumulates; a single change does not necessarily indicate a meaningful shift in ability.
                </p>
              </>
            )}
          </section>
        )}

        {conePanelOpen && (
          <section id="knowledge-cone-panel" className="knowledge-cone-card knowledge-cone-panel" aria-label="BLI knowledge cone">
            <div className="knowledge-cone-head">
              <div>
                <h2 className="knowledge-cone-title">Biblical Literacy Index</h2>
                <p className="knowledge-cone-sub">Knowledge expands upward from Unfamiliar to Scholar.</p>
              </div>
              <div className="knowledge-cone-score">
                {activeHasScore ? activeDisplayScore : "--"}
                <span>{activeHasScore ? activeDisplayLevel : "Not assessed"}</span>
              </div>
            </div>
            <div className="knowledge-cone-wrap">
              <div
                ref={coneRef}
                className="knowledge-cone"
                onPointerEnter={handleConePointerEnter}
                onPointerMove={handleConePointerMove}
                onPointerLeave={handleConePointerLeave}
                style={{"--marker-y": `${coneMarkerPercent(activeDisplayScore)}`} as { [key: string]: string }}
              >
                <div className="glass-vessel" aria-hidden="true">
                  <div
                    key={`water-${suiteTestament}-${activeDisplayScore}`}
                    className="water-fill"
                    style={{"--water-level": `${waterFillPercent}%`} as { [key: string]: string }}
                  >
                    <span className="water-wave water-wave-a" />
                    <span className="water-wave water-wave-b" />
                    <span className="water-wave water-wave-c" />
                  </div>
                </div>
                {[...BLI_LEVELS].reverse().map((band, index) => {
                  const topWidth = 98 - index * 7;
                  const bottomWidth = index === BLI_LEVELS.length - 1 ? topWidth - 7 : 98 - (index + 1) * 7;
                  return (
                    <button
                      key={band.name}
                      type="button"
                      className={`cone-tier ${activeHasScore && activeDisplayLevel === band.name ? "is-active" : ""} ${expandedConeLayer === band.name ? "is-expanded" : ""}`}
                      aria-expanded={expandedConeLayer === band.name}
                      onClick={() => setExpandedConeLayer(expandedConeLayer === band.name ? null : band.name)}
                      style={{
                        "--tier-color": band.color,
                        "--tier-index": String(index),
                        "--top-left": `${(100 - topWidth) / 2}%`,
                        "--top-right": `${100 - (100 - topWidth) / 2}%`,
                        "--bottom-left": `${(100 - bottomWidth) / 2}%`,
                        "--bottom-right": `${100 - (100 - bottomWidth) / 2}%`,
                        "--text-inset": `${Math.max((100 - topWidth) / 2, (100 - bottomWidth) / 2)}%`,
                      } as { [key: string]: string }}
                    >
                      <span className="cone-tier-name">{band.name}</span>
                      <span className="cone-tier-range">{band.min}-{band.max}</span>
                    </button>
                  );
                })}
                {expandedConeLayer && (() => {
                  const band = BLI_LEVELS.find((item) => item.name === expandedConeLayer);
                  const index = [...BLI_LEVELS].reverse().findIndex((item) => item.name === expandedConeLayer);
                  return band && index >= 0 ? (
                    <div
                      className="cone-layer-popover"
                      style={{"--popover-y": `${((index + 0.5) / BLI_LEVELS.length) * 100}`} as { [key: string]: string }}
                    >
                      <strong>{band.name} · {band.min}-{band.max}</strong>
                      <span>{band.description}</span>
                    </div>
                  ) : null;
                })()}
                {activeHasScore && (
                  <div className="cone-marker" aria-label={`Current BLI ${activeDisplayScore}, ${activeDisplayLevel}`}>
                    <span>{activeDisplayScore}</span>
                    <span className="cone-marker-dot" />
                  </div>
                )}
              </div>
              {!activeHasScore && (
                <p className="cone-empty-note">Take an assessment to place your score on the cone.</p>
              )}
            </div>
          </section>
        )}

        <ReadingLogWidget userId={dashboardUserId} />

        {coverageTree.sections.length > 0 && (
          <section className={`coverage-map-section is-${activeCoverageMapMode}`} aria-labelledby="coverage-map-title">
            <div className="coverage-map-head">
              <div>
                <p className="section-eyebrow">Coverage map</p>
                <h2 id="coverage-map-title" className="coverage-map-title">
                  {suiteTestament === "NT" ? "New Testament" : "Old Testament"}
                </h2>
                <p className="coverage-map-copy">{coverageModeCopy}</p>
              </div>
              {suiteTestament === "OT" && (
                <div className="coverage-mode-controls" role="tablist" aria-label="Coverage map view">
                  {[
                    {
                      key: "recommended" as const,
                      label: "Recommended",
                      disabled: !hasReadingRecommendation,
                      icon: (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3z" />
                        </svg>
                      ),
                    },
                    {
                      key: "overview" as const,
                      label: "Overview",
                      disabled: false,
                      icon: (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="4" y="4" width="6" height="6" rx="1.2" />
                          <rect x="14" y="4" width="6" height="6" rx="1.2" />
                          <rect x="4" y="14" width="6" height="6" rx="1.2" />
                          <rect x="14" y="14" width="6" height="6" rx="1.2" />
                        </svg>
                      ),
                    },
                    {
                      key: "skill" as const,
                      label: "Knowledge Gap",
                      disabled: false,
                      icon: (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 4v16" />
                          <path d="M5 8h14" />
                          <path d="M7 14h10" />
                          <path d="M9 20h6" />
                        </svg>
                      ),
                    },
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      role="tab"
                      title={mode.label}
                      aria-label={mode.label}
                      aria-selected={activeCoverageMapMode === mode.key}
                      disabled={mode.disabled}
                      className={`coverage-mode-btn ${activeCoverageMapMode === mode.key ? "is-active" : ""}`}
                      onClick={() => setCoverageMapMode(mode.key)}
                    >
                      {mode.icon}
                      <span>{mode.label}</span>
                    </button>
                  ))}
                  <Link className="coverage-map-link" href="/knowledge-map" title="Open Knowledge Map" aria-label="Open Knowledge Map">
                    <span className="cml-icon" aria-hidden="true">
                      <span className="cml-star" />
                      <span className="cml-orbit">
                        <span className="cml-planet" />
                      </span>
                    </span>
                  </Link>
                </div>
              )}
            </div>
            <div className="coverage-legend-rail">
              <CoverageLegend hasRecommendation={hasFocusRecommendation(coverageTree)} testament={suiteTestament} />
            </div>
            <div className="coverage-map-card">
            {suiteTestament === "OT" && activeCoverageMapMode === "recommended" && frontier.focusLeaf && (
              <section className="coverage-focus-card" aria-label="Recommended reading">
                <div>
                  <p className="coverage-focus-eyebrow">Recommended reading</p>
                  <h3 className="coverage-focus-title">{readableUnitLabel(frontier.focusLeaf.label)}</h3>
                  <p className="coverage-focus-meta">{passageReference(frontier.focusLeaf)}</p>
                </div>
                <div className="coverage-focus-actions">
                  <a
                    className="coverage-focus-primary"
                    href={rereadHref(frontier.focusLeaf)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Reread {compactReference(frontier.focusLeaf)}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7"/><path d="M9 7h8v8"/>
                    </svg>
                  </a>
                </div>
              </section>
            )}
            {suiteTestament === "OT" && activeCoverageMapMode === "skill" && (
              <section className="coverage-focus-card is-skill" aria-label="Recommended knowledge gap review">
                <div>
                  <div className="coverage-diagnostic-head">
                    <p className="coverage-focus-eyebrow">{knowledgeGapEyebrow}</p>
                  </div>
                  {backendRecommendation?.dimension_key ? (
                    <h3 className="coverage-focus-title">
                      <button
                        type="button"
                        className="coverage-focus-title-link"
                        onClick={() => {
                          const dimensionKey = backendRecommendation.dimension_key!;
                          const dimensionName = backendRecommendation.dimension_short_label
                            ?? backendRecommendation.dimension_label
                            ?? dimensionDisplayName(dimensionKey);
                          void openScopeDetail({
                            scopeType: "DIMENSION",
                            scopeKey: `${suiteTestament}:${dimensionKey}`,
                            label: dimensionName,
                            // This card only ever renders for suiteTestament === "OT" (see the
                            // guard above), so the subtitle doesn't need to branch on testament.
                            subtitle: "Old Testament knowledge dimension",
                          });
                        }}
                      >
                        {recommendedStudy.label}
                      </button>
                    </h3>
                  ) : (
                    <h3 className="coverage-focus-title">{recommendedStudy.label}</h3>
                  )}
                  <p className="coverage-focus-meta">{recommendedStudy.books}</p>
                  <p className="coverage-focus-copy">{recommendedStudy.focus}</p>
                  {recommendedGuidanceSteps.length > 0 && (
                    <div className="recommended-guidance">
                      <p className="recommended-guidance-title">{recommendedGuidanceLabel}</p>
                      <ul className="recommended-guidance-list">
                        {recommendedGuidanceSteps.map(step => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                      {recommendedResources.length > 0 && (
                        <div className="recommended-resources" aria-label="Study resources">
                          {recommendedResources.map(resource => (
                            <a
                              key={resource.href}
                              className="recommended-resource"
                              href={resource.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {resource.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="coverage-focus-actions">
                  <p className="coverage-focus-priority">{recommendedStudy.priority}</p>
                  {backendRecommendation && isBackendRecommendationShown && (
                    <button
                      type="button"
                      className="scope-text-btn"
                      onClick={() => {
                        // Expanding the recommendation is an explicit view.
                        void recordRecommendationView("scope_detail");
                        void openScopeDetail({
                          scopeType: "UNIT",
                          scopeKey: backendRecommendation.unit_key,
                          unitKey: backendRecommendation.unit_key,
                          label: backendRecommendation.label,
                          subtitle: `${backendRecommendation.section} · ${BOOK_NAMES[backendRecommendation.book_code] ?? backendRecommendation.book_code}`,
                        });
                      }}
                    >
                      Details
                    </button>
                  )}
                  <Link className="coverage-focus-primary" href={recommendedStudy.actionHref} onClick={handleRecommendedAction}>
                    {recommendedStudy.actionLabel}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                    </svg>
                  </Link>
                  {progressHistory[0]?.attempt_id && (
                    <Link className="recommended-review" href={`/results/${progressHistory[0].attempt_id}`}>
                      Recent results <span aria-hidden="true">›</span>
                    </Link>
                  )}
                </div>
              </section>
            )}
            <CoverageGrid
              tree={coverageTree}
              testament={suiteTestament}
              view={activeCoverageMapMode}
              showSummary={false}
              onFocusView={suiteTestament === "OT" ? () => router.push("/knowledge-map") : undefined}
              // The gold-ringed unit group (e.g. Genesis 12-50) is a whole
              // learning range; the actual "Recommended reading" card above
              // points at a narrower slice inside it (e.g. 20-22). Only wire
              // this up while that card is the one actually showing, so the
              // highlight never points at chapters unrelated to what's on
              // screen.
              focusChapterRange={
                suiteTestament === "OT" && activeCoverageMapMode === "recommended"
                  && frontier.focusLeaf?.book_code && frontier.focusLeaf.start_ch !== null
                  ? {
                      bookCode: frontier.focusLeaf.book_code,
                      startCh: frontier.focusLeaf.start_ch,
                      endCh: frontier.focusLeaf.end_ch ?? frontier.focusLeaf.start_ch,
                    }
                  : null
              }
            />
            </div>
          </section>
        )}

        <div className="legacy-knowledge-profile" hidden>
        <div className="breakdown-head">
          <p className="section-eyebrow">Knowledge profile</p>
          <div className="breakdown-controls">
            <div className="breakdown-tabs" role="tablist" aria-label="Knowledge profile breakdown">
              {[
                { key: "sections", label: "Sections" },
                { key: "books", label: "Books" },
                { key: "domains", label: "Skills" },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeBreakdownTab === tab.key}
                  className={`breakdown-tab ${activeBreakdownTab === tab.key ? "is-active" : ""}`}
                  onClick={() => setActiveBreakdownTab(tab.key as BreakdownTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="breakdown-note">
          {activeBreakdownTab === "sections" && `Major ${profileTestament} sections.`}
          {activeBreakdownTab === "books" && `${profileTestament} scores by book.`}
          {activeBreakdownTab === "domains" && `Skill areas tested across your ${profileTestament} answers.`}
        </p>
        {activeBreakdownTab === "domains" ? (() => {
          const center = 160;
          const radius = 104;
          const labelRadius = 152;
          const scores = visibleBreakdownScores;
          const pointFor = (index: number, valueRadius: number) => {
            const angle = -Math.PI / 2 + (index / Math.max(scores.length, 1)) * Math.PI * 2;
            return {
              x: center + Math.cos(angle) * valueRadius,
              y: center + Math.sin(angle) * valueRadius,
            };
          };
          const polygonFor = (valueRadius: number) => scores
            .map((_, index) => {
              const point = pointFor(index, valueRadius);
              return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
            })
            .join(" ");

          return (
            <section className="domain-radar-card" aria-label="Bible knowledge skill chart">
              <div className="domain-radar-wrap">
                <svg ref={radarSvgRef} className="domain-radar-svg" viewBox="0 0 320 320" role="img" aria-label="Skill scores radar chart">
                  {[0.2, 0.4, 0.6, 0.8, 1].map(level => (
                    <polygon key={level} className="radar-ring" points={polygonFor(radius * level)} />
                  ))}
                  {scores.map((score, index) => {
                    const end = pointFor(index, radius);
                    const label = pointFor(index, labelRadius);
                    const isLockedConnection = score.key.endsWith(":scripture_connections") && !scriptureConnectionsUnlocked;
                    return (
                      <g key={score.key}>
                        <line className="radar-axis" x1={center} y1={center} x2={end.x} y2={end.y} />
                        <text className="radar-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                          {(() => {
                            const words = score.label.split(" ");
                            const forceSplit = score.label === "Theological Reasoning";
                            // Split into two lines at the & or midpoint
                            const ampIdx = words.indexOf("&");
                            const splitAt = ampIdx > 0 ? ampIdx + 1 : Math.ceil(words.length / 2);
                            if (words.length <= 2 && !forceSplit) {
                              return <tspan>{score.label}</tspan>;
                            }
                            const line1 = words.slice(0, splitAt).join(" ");
                            const line2 = words.slice(splitAt).join(" ");
                            return (
                              <>
                                <tspan x={label.x} dy="-6">{line1}</tspan>
                                <tspan x={label.x} dy="12">{line2}</tspan>
                              </>
                            );
                          })()}
                        </text>
                        {!isLockedConnection && (
                          <text
                            className="radar-score-label"
                            x={label.x}
                            y={label.y + (score.label === "Theological Reasoning" ? 26 : score.label.split(" ").length > 2 ? 20 : 13)}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {score.displayScore ?? "--"}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="domain-radar-side">
                <div>
                  <h3 className="domain-radar-title">Knowledge by skill area</h3>
                  <p className="domain-radar-copy">
                    Knowledge types tested across your {profileTestament} answers.
                  </p>
                </div>
                <div className="domain-radar-list">
                  {scores.map(score => {
                    const isLockedConnection = score.key.endsWith(":scripture_connections") && !scriptureConnectionsUnlocked;
                    return (
                      <button
                        type="button"
                        className={`domain-radar-row ${isLockedConnection ? "is-locked" : ""}`}
                        key={score.key}
                        disabled={isLockedConnection}
                        onClick={() => void openScopeDetail(detailTargetForScore(score))}
                      >
                        <div>
                          <div className="domain-radar-name">{score.label}</div>
                          <div className="domain-radar-meta">
                            {isLockedConnection
                              ? "Locked until Torah and Former Prophets reach baseline"
                              : score.answered > 0 ? `${score.answered} answered · ${evidenceLabel(score)}` : "Untested"}
                          </div>
                        </div>
                        <div className={`domain-radar-score ${isLockedConnection ? "is-locked" : ""}`}>
                          {isLockedConnection ? "Locked" : score.displayScore ?? "--"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })() : (
          <div className={`sections-grid ${activeBreakdownTab}`}>
            {visibleBreakdownScores.map(s => {
              const hasScore = s.rawScore !== null && s.answered > 0;
              const scoreEvidence = sectionEvidence(s.answered);
              const assessmentHref = assessmentHrefForScore(s);
              const fillColor = s.className === "torah" ? "linear-gradient(90deg,#d4a017,#f5c842)"
                : s.className === "former" ? "linear-gradient(90deg,#0e8c6a,#34d399)"
                : s.className === "latter" ? "linear-gradient(90deg,#2563c4,#60a5fa)"
                : s.className === "writings" ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
                : s.className === "prophets" ? "linear-gradient(90deg,#0e8c6a,#2563c4)"
                : s.className === "ot" ? "linear-gradient(90deg,#0aa3a3,#d4a017,#2563c4,#7c3aed)"
                : s.className === "nt" ? "linear-gradient(90deg,#14b8a6,#2563eb,#7c3aed)"
                : s.className === "gospels" ? "linear-gradient(90deg,#0d9488,#2dd4bf)"
                : s.className === "acts" ? "linear-gradient(90deg,#0284c7,#38bdf8)"
                : s.className === "pauline" ? "linear-gradient(90deg,#4f46e5,#818cf8)"
                : s.className === "general" ? "linear-gradient(90deg,#7c3aed,#c084fc)"
                : s.className === "revelation" ? "linear-gradient(90deg,#be123c,#fb7185)"
                : "linear-gradient(90deg,#0aa3a3,#67e8f9)";
              return (
                <article
                  key={s.key}
                  className={`section-card ${s.className} ${hasScore ? "has-score" : ""} ${scoreEvidence.isProvisional ? "low-evidence" : ""}`}
                >
                  <button
                    type="button"
                    className="section-card-main"
                    onClick={() => void openScopeDetail(detailTargetForScore(s))}
                  >
                    <div className="sc-top">
                      <div>
                        <div className="sc-name">{s.label}</div>
                        <div className="sc-books">{s.subtitle}</div>
                      </div>
                      <div
                        className="sc-pct-empty"
                        style={{color: hasScore ? "#1b2442" : undefined}}
                        aria-label={hasScore && scoreEvidence.isProvisional ? `Early BLI estimate ${s.displayScore}` : undefined}
                      >
                        {hasScore ? s.displayScore : "--"}
                        {hasScore && scoreEvidence.isProvisional && (
                          <span className="sc-provisional-label">Early</span>
                        )}
                      </div>
                    </div>
                    <div className="sc-bar-track">
                      {hasScore && (
                        <div className="sc-bar-fill" style={{
                          width: `${Math.max(3, Math.min(100, s.rawScore ?? 0))}%`,
                          background: fillColor,
                          height: "100%", borderRadius: 999, transition: "width 1s ease"
                        }} />
                      )}
                    </div>
                  </button>
                  <div className="sc-card-footer">
                    <div className="sc-chip-row">
                      <span className={`sc-chip-empty evidence-${s.confidence}`}>
                        {hasScore ? `${s.answered} answered` : "Not yet assessed"}
                      </span>
                      {hasScore && <span className={`sc-chip-empty evidence-${s.confidence}`}>{evidenceLabel(s)}</span>}
                    </div>
                    {assessmentHref && (
                      <Link className="sc-test-link" href={assessmentHref}>
                        {hasScore ? "Retest" : "Test"}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                        </svg>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </div>
          </>
          )
        ) : (
          <section className="placeholder-dashboard" aria-label={`${activeDashboardTab === "church-history" ? "Church History" : "Biblical Languages"} dashboard placeholder`}>
            <div>
              <p className="placeholder-eyebrow">Coming soon</p>
              <h2 className="placeholder-title">
                {activeDashboardTab === "church-history" ? "Church History Dashboard" : "Biblical Languages Dashboard"}
              </h2>
              <p className="placeholder-copy">
                {activeDashboardTab === "church-history"
                  ? "This space will eventually track progress through major eras, councils, figures, doctrines, movements, and the story of the global church. For now it is a holding place while the course content is being built."
                  : "This space will eventually track progress in biblical Hebrew, Greek, vocabulary, grammar, parsing, and reading fluency. For now it is a holding place while the language pathway is being built."}
              </p>
              <div className="placeholder-list">
                <span className="placeholder-pill">Progress metrics pending</span>
                <span className="placeholder-pill">Recommendations pending</span>
                <span className="placeholder-pill">Assessment engine pending</span>
              </div>
            </div>
            <div className="placeholder-orbit" aria-hidden="true" />
          </section>
        )}
      </main>
      <SiteFooter />
      {scopeDetailTarget && (
        <div className="scope-drawer-backdrop" role="presentation" onClick={closeScopeDetail}>
          <aside
            className="scope-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scope-drawer-title"
            onClick={event => event.stopPropagation()}
          >
            <header className="scope-drawer-head">
              <div>
                <p className="scope-drawer-kicker">{scopeDetailTarget.scopeType.toLowerCase()} detail</p>
                <h2 className="scope-drawer-title" id="scope-drawer-title">{scopeDetailTarget.label}</h2>
                <p className="scope-drawer-sub">{scopeDetailTarget.subtitle}</p>
              </div>
              <button
                type="button"
                className="scope-drawer-close"
                aria-label="Close scope details"
                onClick={closeScopeDetail}
              >
                ×
              </button>
            </header>
            <div className="scope-drawer-body">
              {scopeSummaryLoading ? (
                <div className="scope-state" role="status">
                  <strong>Gathering scope evidence...</strong>
                  Loading your responses for this part of the assessment.
                </div>
              ) : scopeSummaryError ? (
                <div className="scope-state" role="status">
                  <strong>Details unavailable</strong>
                  {scopeSummaryError}
                </div>
              ) : !scopeSummary ? (
                <div className="scope-state">
                  <strong>No evidence here yet</strong>
                  Answer questions in this scope to begin building a profile.
                </div>
              ) : (
                <>
                  <div className="scope-evidence">
                    <div>
                      <span className="scope-evidence-label">{sectionEvidence(scopeSummary.answered).label}</span>
                      <p className="scope-evidence-copy">
                        {sectionEvidence(scopeSummary.answered).isProvisional
                          ? `This is still an early read. Add ${sectionEvidence(scopeSummary.answered).answersToInterpretation} more eligible responses before treating it as a clear weakness.`
                          : sectionEvidence(scopeSummary.answered).status === "developing"
                            ? "This is getting clearer, but may still move as more answers are added."
                            : "This area has a reliable sample, though ordinary score movement is still expected."}
                      </p>
                    </div>
                    <div className="scope-evidence-score">
                      {scopeSummary.accuracy === null ? "--" : `${Math.round(scopeSummary.accuracy)}%`}
                      <span>
                        {sectionEvidence(scopeSummary.answered).isProvisional
                          ? "Early accuracy"
                          : "Accuracy"}
                      </span>
                    </div>
                  </div>
                  <div className="scope-metrics">
                    <div className="scope-metric">
                      <strong>{scopeSummary.answered}</strong>
                      <span>Answered</span>
                    </div>
                    <div className="scope-metric">
                      <strong>{scopeSummary.correct}</strong>
                      <span>Correct</span>
                    </div>
                    <div className="scope-metric">
                      <strong>{scopeSummary.idk}</strong>
                      <span>Skipped</span>
                    </div>
                  </div>
                  {(scopeSummary.first_answered_at || scopeSummary.last_answered_at) && (
                    <p className="scope-period">
                      {scopeSummary.first_answered_at && `First answered ${formatProgressDate(scopeSummary.first_answered_at)}`}
                      {scopeSummary.first_answered_at && scopeSummary.last_answered_at && " · "}
                      {scopeSummary.last_answered_at && `Latest response ${formatProgressDate(scopeSummary.last_answered_at)}`}
                    </p>
                  )}
                  {scopeSummary.books.length > 0 && (
                    <section className="scope-breakdown" aria-labelledby="scope-books-heading">
                      <h3 id="scope-books-heading">Book evidence</h3>
                      {scopeSummary.books.slice(0, 10).map(book => (
                        <div className="scope-breakdown-row" key={book.book_code}>
                          <div>
                            <div className="scope-breakdown-name">{BOOK_NAMES[book.book_code] ?? book.book_code}</div>
                            <div className="scope-breakdown-meta">{book.answered} answered · {book.idk} skipped</div>
                          </div>
                          <div className="scope-breakdown-value">
                            {book.accuracy === null ? "--" : `${Math.round(book.accuracy)}%`}
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                  {scopeSummary.dimensions.length > 0 && (
                    <section className="scope-breakdown" aria-labelledby="scope-dimensions-heading">
                      <h3 id="scope-dimensions-heading">Dimension evidence</h3>
                      {scopeSummary.dimensions.slice(0, 10).map(dimension => (
                        <div className="scope-breakdown-row" key={dimension.dimension_key}>
                          <div>
                            <div className="scope-breakdown-name">{dimensionDisplayName(dimension.dimension_key)}</div>
                            <div className="scope-breakdown-meta">{dimension.answered} answered · {dimension.idk} skipped</div>
                          </div>
                          <div className="scope-breakdown-value">
                            {dimension.accuracy === null ? "--" : `${Math.round(dimension.accuracy)}%`}
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                  {scopeDetailTarget.unitKey === backendRecommendation?.unit_key && (
                    <div className="scope-focused-action">
                      <p>This focused retest follows the same rereading delay used by your dashboard recommendation.</p>
                      <Link
                        className="scope-focused-link"
                        href={recommendedStudy.actionHref}
                        onClick={event => {
                          closeScopeDetail();
                          handleRecommendedAction(event);
                        }}
                      >
                        Focused retest
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
      {pendingRetestHref && (
        <div className="retest-modal-backdrop" role="presentation" onClick={() => setPendingRetestHref(null)}>
          <div className="retest-modal" role="dialog" aria-modal="true" aria-labelledby="retest-modal-title" onClick={event => event.stopPropagation()}>
            <p className="retest-modal-kicker">Focused retest</p>
            <h2 className="retest-modal-title" id="retest-modal-title">Have you reread this section?</h2>
            <p className="retest-modal-copy">
              This retest is meant to measure learning after review. Retesting immediately may mostly measure short-term recall, so your BLI is more meaningful if you have actually reread the recommended passage.
            </p>
            <div className="retest-modal-actions">
              <button className="retest-modal-secondary" type="button" onClick={() => setPendingRetestHref(null)}>
                Not yet
              </button>
              <button className="retest-modal-primary" type="button" onClick={continuePendingRetest}>
                I reread it - continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
