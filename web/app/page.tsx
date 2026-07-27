"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { loadPublicQuestionMetadata, type PublicQuestionMetadataRow } from "@/lib/supabase/questionMetadata";
import { BLI_LEVELS, levelForScore, toDisplayScore } from "@/lib/bli";
import { BOOK_NAMES, OT_BOOK_CODES, SECTION_BOOKS, sectionForBook } from "@/lib/bibleTaxonomy";

const SKY_SEED_KEY = "obs_sky_seed";
const ANON_SESSION_ACTIVE_KEY = "obs_anon_session_active";
const ANON_USER_ID_KEY = "obs_anon_user_id";
const SESSION_ANSWERED_KEY = "obs_session_answered";
const SESSION_CORRECT_KEY = "obs_session_correct";
const RECOMMENDATION_RETEST_WAIT_MS = 20 * 60 * 1000;

function isAnonymousSession(session: { user?: { email?: string | null } } | null) {
  return Boolean(session?.user && !session.user.email);
}

function clearAssessmentBrowserStorage() {
  localStorage.removeItem("obs_answered");
  localStorage.removeItem("obs_correct");
  localStorage.removeItem("obs_attempt_id");
  localStorage.removeItem("obs_user_id");
  localStorage.removeItem(ANON_USER_ID_KEY);
  sessionStorage.removeItem(ANON_SESSION_ACTIVE_KEY);
  sessionStorage.removeItem(ANON_USER_ID_KEY);
  sessionStorage.removeItem(SESSION_ANSWERED_KEY);
  sessionStorage.removeItem(SESSION_CORRECT_KEY);
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

type SectionScoreMap = Record<string, {pct: number, total: number, weighted_pct: number}>;
type BreakdownTab = "sections" | "books" | "domains";
type ScopeKind = "canon" | "section" | "book" | "domain";
type ScopeScore = {
  key: string;
  label: string;
  subtitle: string;
  kind: ScopeKind;
  className: string;
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
  { key: "ot", label: "Old Testament", subtitle: "Genesis - Malachi", kind: "canon" as const, className: "ot", books: OT_BOOK_CODES },
  { key: "torah", label: "Torah", subtitle: "Genesis - Deuteronomy", kind: "section" as const, className: "torah", books: SECTION_BOOKS.Torah },
  { key: "prophets", label: "Prophets", subtitle: "Former + Latter Prophets", kind: "section" as const, className: "prophets", books: [...SECTION_BOOKS["Former Prophets"], ...SECTION_BOOKS["Latter Prophets"]] },
  { key: "former", label: "Former Prophets", subtitle: "Joshua - Kings", kind: "section" as const, className: "former", books: SECTION_BOOKS["Former Prophets"] },
  { key: "latter", label: "Latter Prophets", subtitle: "Isaiah - Malachi", kind: "section" as const, className: "latter", books: SECTION_BOOKS["Latter Prophets"] },
  { key: "writings", label: "Writings", subtitle: "Psalms, Proverbs, Job...", kind: "section" as const, className: "writings", books: SECTION_BOOKS.Writings },
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

function detailTargetForScore(score: ScopeScore): ScopeDetailTarget {
  if (score.kind === "canon") {
    return { scopeType: "TESTAMENT", scopeKey: "OT", label: score.label, subtitle: score.subtitle };
  }
  if (score.kind === "book") {
    return {
      scopeType: "BOOK",
      scopeKey: score.key.replace("book:", ""),
      label: score.label,
      subtitle: score.subtitle,
    };
  }
  if (score.kind === "domain") {
    const domain = DOMAIN_META.find(item => `domain:${item.key}` === score.key);
    return {
      scopeType: "DIMENSION",
      scopeKey: domain?.backendKey ?? score.key.replace("domain:", ""),
      label: score.label,
      subtitle: "Knowledge dimension",
    };
  }
  return { scopeType: "SECTION", scopeKey: score.label, label: score.label, subtitle: score.subtitle };
}

function assessmentHrefForScore(score: ScopeScore): string | null {
  if (score.kind === "canon") return "/assess?testament=OT";

  const params = new URLSearchParams({
    mode: "scope",
    label: score.label,
    target: score.kind === "book" ? "15" : "20",
  });

  if (score.kind === "book") {
    params.set("scope", score.key.replace("book:", ""));
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
  return "ot";
}

function confidenceForAnswers(answered: number): ScopeScore["confidence"] {
  if (answered >= 20) return "high";
  if (answered >= 8) return "moderate";
  if (answered >= 3) return "low";
  return "none";
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
    rows: typeof evidence,
  ): ScopeScore => {
    const rawScore = scoreEvidence(rows);
    return {
      key,
      label,
      subtitle,
      kind,
      className,
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
    evidence.filter(row => scope.books.includes(row.bookCode)),
  ));

  const books = OT_BOOK_CODES.map(bookCode => makeScore(
    `book:${bookCode}`,
    BOOK_NAMES[bookCode] ?? bookCode,
    sectionNameForBook(bookCode),
    "book",
    classNameForSection(sectionNameForBook(bookCode)),
    evidence.filter(row => row.bookCode === bookCode),
  ));

  const domains = DOMAIN_META.map(domain => makeScore(
    `domain:${domain.key}`,
    domain.label,
    "Question dimension",
    "domain",
    `domain-${domain.key}`,
    evidence.filter(row => row.dimensionKey === domain.backendKey || (!row.dimensionKey && domain.match(row.questionType))),
  ));

  return { sections, books, domains };
}

function evidenceLabel(score: ScopeScore) {
  if (score.confidence === "high") return "High evidence";
  if (score.confidence === "moderate") return "Moderate evidence";
  if (score.confidence === "low") return "Low evidence";
  return "Needs more evidence";
}

function hasBaselineEvidence(score: ScopeScore | undefined) {
  if (!score || score.rawScore === null) return false;
  return score.answered >= 3 && (score.displayScore ?? 0) >= 513;
}

function getRecommendedStudy(sectionScores: SectionScoreMap, hasAssessment: boolean, bookScores: ScopeScore[]) {
  if (!hasAssessment) {
    return {
      label: "Take your first assessment",
      books: "Personalized recommendation pending",
      focus: "Answer a short set of questions first. Then Open Bible Assessment can identify the earliest major gap in your Old Testament knowledge and recommend a natural place to begin.",
      priority: "Your reading recommendation will become more specific after your first BLI snapshot.",
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
        ? `${score.displayScore ?? "--"} BLI across ${score.answered} answered questions here. Reread this range, then retest it.`
        : "Not enough evidence here yet. Reread this range, then take a focused retest.",
      actionHref: `/assess?${params.toString()}`,
      actionLabel: "I reread this - retest me",
    };
  }

  const earliestMajorGap = SECTION_RECOMMENDATIONS.find(section => {
    const score = sectionScores[section.name];
    return !score || score.total < 4 || score.pct < 70;
  });
  const target = earliestMajorGap ?? [...SECTION_RECOMMENDATIONS]
    .sort((a, b) => (sectionScores[a.name]?.pct ?? 100) - (sectionScores[b.name]?.pct ?? 100))[0];
  const score = sectionScores[target.name];

  return {
    label: earliestMajorGap ? target.name : `Deepen ${target.name}`,
    books: target.books,
    focus: target.focus,
    priority: score
      ? `${score.pct}% across ${score.total} answered questions. ${target.priority}`
      : `Not enough answers here yet. ${target.priority}`,
    actionHref: "/assess",
    actionLabel: "Continue assessment",
  };
}

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dashboardUserId, setDashboardUserId] = useState<string | null>(null);
  const [assessmentData, setAssessmentData] = useState<{answered: number, correct: number, bli?: number} | null>(null);
  const [sectionScores, setSectionScores] = useState<Record<string, {pct: number, total: number, weighted_pct: number}>>({});
  const [scopeScores, setScopeScores] = useState<{sections: ScopeScore[]; books: ScopeScore[]; domains: ScopeScore[]}>(() => buildScopeScores([], []));
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<BreakdownTab>("sections");
  const [prophetsExpanded, setProphetsExpanded] = useState(false);
  const [showBliTooltip, setShowBliTooltip] = useState(false);
  const [showEvidenceTooltip, setShowEvidenceTooltip] = useState(false);
  const [expandedConeLayer, setExpandedConeLayer] = useState<string | null>(null);
  const [isAssessmentCharging, setIsAssessmentCharging] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<"bli" | "church-history" | "biblical-languages">("bli");
  const [isAnonymousDashboard, setIsAnonymousDashboard] = useState(false);
  const [backendRecommendation, setBackendRecommendation] = useState<BackendRecommendation | null>(null);
  const [bliEvidence, setBliEvidence] = useState<BliEvidence | null>(null);
  const [progressTestament, setProgressTestament] = useState<"OT" | "NT">("OT");
  const [progressHistory, setProgressHistory] = useState<ProgressPoint[]>([]);
  const [activeProgressAttemptId, setActiveProgressAttemptId] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [scopeDetailTarget, setScopeDetailTarget] = useState<ScopeDetailTarget | null>(null);
  const [scopeSummary, setScopeSummary] = useState<ScopeSummary | null>(null);
  const [scopeSummaryLoading, setScopeSummaryLoading] = useState(false);
  const [scopeSummaryError, setScopeSummaryError] = useState<string | null>(null);
  const [ntPilotSummary, setNtPilotSummary] = useState<NtPilotSummary | null>(null);
  const [pendingRetestHref, setPendingRetestHref] = useState<string | null>(null);
  const tooltipCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assessmentHoldDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assessmentHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBackfillAttemptedRef = useRef<string | null>(null);
  const scopeRequestRef = useRef(0);
  const recordedRecommendationRef = useRef<string | null>(null);
  const coneRef = useRef<HTMLDivElement>(null);
  const sloshRef = useRef({
    x1: 0, v1: 0, x2: 0, v2: 0,
    lastPointerX: null as number | null,
    lastPointerT: 0,
    raf: 0,
    running: false,
    lastFrameT: 0,
  });
  const currentDisplayScore = assessmentData
    ? toDisplayScore(assessmentData.bli ?? Math.round((assessmentData.correct / assessmentData.answered) * 100))
    : 0;
  const currentDisplayLevel = levelForScore(currentDisplayScore);
  const currentDisplayBand = BLI_LEVELS.find((band) => band.name === currentDisplayLevel) ?? BLI_LEVELS[0];
  const waterFillPercent = assessmentData ? 100 - coneMarkerPercent(currentDisplayScore) : 0;

  useEffect(() => {
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

  const recommendedStudy = backendRecommendation ? (() => {
    const hasDimensionTarget =
      backendRecommendation.recommendation_kind === "DIMENSION" &&
      !!backendRecommendation.dimension_key;
    const dimensionName =
      backendRecommendation.dimension_short_label ??
      backendRecommendation.dimension_label;
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
      label: hasDimensionTarget && dimensionName
        ? `${dimensionName} in ${backendRecommendation.label}`
        : backendRecommendation.label,
      books: `${backendRecommendation.section} · ${BOOK_NAMES[backendRecommendation.book_code] ?? backendRecommendation.book_code}${hasDimensionTarget ? " · Focused skill review" : ""}`,
      focus: hasDimensionTarget
        ? `${backendRecommendation.dimension_focus_text ?? `Review ${dimensionName} in this passage range.`} Keep the people, places, and events anchored in ${backendRecommendation.label}.`
        : backendRecommendation.focus_text,
      priority: hasDimensionTarget && backendRecommendation.dimension_display_score
        ? `${backendRecommendation.dimension_display_score} BLI from ${backendRecommendation.dimension_answered ?? 0} ${dimensionName ?? "dimension"} answers here. This is the clearest supported weakness inside your earliest priority reading.`
        : backendRecommendation.display_score
        ? `${backendRecommendation.display_score} BLI across ${backendRecommendation.answered} answered questions here. ${backendRecommendation.reason}.`
        : `${backendRecommendation.reason}. Reread this range, then take a focused retest.`,
      actionHref: `/assess?${params.toString()}`,
      actionLabel: "I reread this - retest me",
    };
  })() : getRecommendedStudy(sectionScores, !!assessmentData, scopeScores.books);
  const visibleBreakdownScores = useMemo(() => {
    if (activeBreakdownTab === "sections") {
      return scopeScores.sections.filter(score => (
        prophetsExpanded
        || (score.key !== "former" && score.key !== "latter")
      ));
    }
    if (activeBreakdownTab === "domains") return scopeScores.domains;
    return scopeScores.books;
  }, [activeBreakdownTab, prophetsExpanded, scopeScores]);
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

  useEffect(() => {
    if (!recommendedStudy.actionHref.startsWith("/assess?")) return;
    const key = `obs_recommendation_seen:${recommendedStudy.actionHref}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, String(Date.now()));
  }, [recommendedStudy.actionHref]);

  const recordStudyEvent = useCallback(async (
    eventType: "recommendation_viewed" | "reading_started" | "reading_completed" | "retest_started" | "retest_completed" | "recommendation_dismissed",
    unitKey: string,
  ) => {
    if (!dashboardUserId) return;
    await supabase.rpc("obs_record_study_event", {
      p_user_id: dashboardUserId,
      p_unit_key: unitKey,
      p_event_type: eventType,
      p_attempt_id: null,
      p_metadata: { source: "dashboard_recommendation" },
    });
  }, [dashboardUserId]);

  useEffect(() => {
    if (!dashboardUserId || !backendRecommendation?.unit_key) return;
    const eventKey = `${dashboardUserId}:${backendRecommendation.unit_key}`;
    if (recordedRecommendationRef.current === eventKey) return;
    recordedRecommendationRef.current = eventKey;
    void recordStudyEvent("recommendation_viewed", backendRecommendation.unit_key);
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
      setScopeSummaryError(error.message || "This scope could not be loaded.");
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

  const handleRecommendedAction = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!recommendedStudy.actionHref.startsWith("/assess?")) return;
    const key = `obs_recommendation_seen:${recommendedStudy.actionHref}`;
    const firstSeen = Number(localStorage.getItem(key) || Date.now());
    const isFresh = Date.now() - firstSeen < RECOMMENDATION_RETEST_WAIT_MS;
    if (isFresh) {
      event.preventDefault();
      setPendingRetestHref(recommendedStudy.actionHref);
      return;
    }
    if (backendRecommendation?.unit_key) void recordStudyEvent("retest_started", backendRecommendation.unit_key);
  };

  const continuePendingRetest = () => {
    if (!pendingRetestHref) return;
    if (backendRecommendation?.unit_key) void recordStudyEvent("retest_started", backendRecommendation.unit_key);
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

  // Press-and-hold to charge into the assessment. Triggered by pointerdown
  // (never hover), with a short grace period so a normal click doesn't flash
  // the charging state. Releasing or leaving cancels; a plain click still
  // navigates instantly via the link.
  const startAssessmentHold = () => {
    if (assessmentHoldDelayRef.current) clearTimeout(assessmentHoldDelayRef.current);
    if (assessmentHoldRef.current) clearTimeout(assessmentHoldRef.current);
    assessmentHoldDelayRef.current = setTimeout(() => {
      setIsAssessmentCharging(true);
      assessmentHoldRef.current = setTimeout(() => {
        window.location.href = assessmentData ? "/assess" : "/assess?choose=1";
      }, 2000);
    }, 150);
  };

  const cancelAssessmentHold = () => {
    if (assessmentHoldDelayRef.current) clearTimeout(assessmentHoldDelayRef.current);
    if (assessmentHoldRef.current) clearTimeout(assessmentHoldRef.current);
    assessmentHoldDelayRef.current = null;
    assessmentHoldRef.current = null;
    setIsAssessmentCharging(false);
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
    const anonId = isAnonymousSession(session) ? session?.user?.id : null;
    if (anonId) {
      localStorage.setItem(ANON_USER_ID_KEY, anonId);
      sessionStorage.setItem(ANON_USER_ID_KEY, anonId);
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" + (anonId ? "?anon=" + anonId : "") },
    });
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(sloshRef.current.raf);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      let session = data.session;
      if (isAnonymousSession(session) && !sessionStorage.getItem(ANON_SESSION_ACTIVE_KEY)) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        session = null;
      }
      setDashboardUserId(session?.user?.id ?? null);
      setIsAnonymousDashboard(isAnonymousSession(session));
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        setIsAnonymousDashboard(false);
        sessionStorage.removeItem(ANON_SESSION_ACTIVE_KEY);
        sessionStorage.removeItem(ANON_USER_ID_KEY);
        sessionStorage.removeItem(SESSION_ANSWERED_KEY);
        sessionStorage.removeItem(SESSION_CORRECT_KEY);
      }
      if (session?.user?.id) {
        const [
          { data: bliData },
          bankData,
          { data: answerData },
          { data: recommendationData },
          { data: evidenceData },
        ] = await Promise.all([
          supabase.rpc("compute_bli", { p_user_id: session.user.id }),
          loadDimensionAwareQuestionBank(),
          supabase
            .from("assessment_answers")
            .select(
              "generated_question_id,is_correct,is_idk,scoring_eligible"
            )
            .eq("user_id", session.user.id),
          supabase.rpc("obs_get_user_recommendation_v2", { p_user_id: session.user.id }),
          supabase.rpc("obs_get_bli_uncertainty", {
            p_user_id: session.user.id,
            p_scope: "OT",
          }),
        ]);
        setBackendRecommendation(((recommendationData ?? [])[0] as BackendRecommendation | undefined) ?? null);
        let resolvedEvidence = ((evidenceData ?? [])[0] as BliEvidence | undefined) ?? null;
        if (!resolvedEvidence) {
          const { data: bibleEvidenceData, error: bibleEvidenceError } = await supabase.rpc("obs_get_bli_uncertainty", {
            p_user_id: session.user.id,
            p_scope: "BIBLE",
          });
          if (!bibleEvidenceError) {
            resolvedEvidence = ((bibleEvidenceData ?? [])[0] as BliEvidence | undefined) ?? null;
          }
        }
        setBliEvidence(resolvedEvidence);

        const scoped = buildScopeScores((bankData ?? []) as BankRow[], (answerData ?? []) as AnswerRow[]);
        setScopeScores(scoped);
        const sectionMap: Record<string, {pct: number, total: number, weighted_pct: number}> = {};
        scoped.sections
          .filter(score => ["Torah", "Former Prophets", "Latter Prophets", "Writings"].includes(score.label) && score.rawScore !== null)
          .forEach(score => {
            sectionMap[score.label] = {
              pct: Math.round(score.rawScore ?? 0),
              total: score.answered,
              weighted_pct: Math.round(score.rawScore ?? 0),
            };
          });
        setSectionScores(sectionMap);

        if (bliData && bliData.length > 0) {
          const b = bliData[0];
          if (b.questions_answered > 0) {
            setAssessmentData({
              answered: b.questions_answered,
              correct: Math.round(b.total_weighted_earned),
              bli: parseFloat(b.bli_score)
            });
          }
        }
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
      setDashboardUserId(session?.user?.id ?? null);
      setIsAnonymousDashboard(isAnonymousSession(session));
    });
    return () => subscription.unsubscribe();
  }, []);

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
        setProgressError(error.message || "Progress history is temporarily unavailable.");
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
  // Domain constellation: when the Domains tab is active, a few sky stars fly
  // into a polygon whose vertex radii correspond exactly to domain scores.
  const constellationRef = useRef<{ active: boolean; t: number; points: { angle: number; pct: number }[]; lastTargets?: { x: number; y: number }[] }>({ active: false, t: 0, points: [] });
  const radarSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const constellation = constellationRef.current;
    if (activeBreakdownTab !== "domains") {
      constellation.active = false;
      return;
    }
    const domains = scopeScores.domains;
    constellation.points = domains.map((score, index) => {
      const isLockedConnection = score.key === "domain:scripture_connections" && !scriptureConnectionsUnlocked;
      const pct = isLockedConnection || score.rawScore === null || score.answered === 0 ? 0 : Math.max(0, Math.min(100, score.rawScore));
      const angle = -Math.PI / 2 + (index / Math.max(domains.length, 1)) * Math.PI * 2;
      return { angle, pct };
    });
    constellation.active = true;
  }, [activeBreakdownTab, scopeScores.domains, scriptureConnectionsUnlocked]);

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

    const shootingPalettes = [
      { core: "255,255,255", glow: "173,232,255" },
      { core: "240,253,255", glow: "10,163,163" },
      { core: "255,248,214", glow: "212,160,23" },
      { core: "245,240,255", glow: "124,58,237" },
    ];
    const createShootingStar = (startFrame: number) => {
      const fromLeft = random() > 0.28;
      const palette = shootingPalettes[Math.floor(random() * shootingPalettes.length)];
      return {
        x: fromLeft ? -0.22 : 1.08,
        y: 0.02 + random() * 0.48,
        dx: (fromLeft ? 1 : -1) * (0.26 + random() * 0.20),
        dy: 0.08 + random() * 0.24,
        startFrame,
        duration: 104 + Math.floor(random() * 64),
        length: (105 + random() * 95) * DPR,
        width: (1.25 + random() * 0.8) * DPR,
        palette,
      };
    };
    const shootingStars = Array.from({ length: 3 }, () => createShootingStar(120 + Math.floor(random() * 900)));

    function resetShootingStar(star: (typeof shootingStars)[number]) {
      Object.assign(star, createShootingStar(frame + 420 + Math.floor(random() * 1100)));
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
        const streak = ctx.createLinearGradient(tailX, tailY, headX, headY);
        streak.addColorStop(0, "rgba(255,255,255,0)");
        streak.addColorStop(0.52, `rgba(${star.palette.glow},${opacity * 0.46})`);
        streak.addColorStop(0.86, `rgba(${star.palette.glow},${opacity * 0.72})`);
        streak.addColorStop(1, `rgba(${star.palette.core},${opacity})`);

        ctx.save();
        ctx.lineCap = "round";
        ctx.shadowColor = `rgba(${star.palette.glow},${opacity * 0.45})`;
        ctx.shadowBlur = 10 * DPR;
        ctx.lineWidth = star.width;
        ctx.strokeStyle = streak;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        ctx.restore();
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
          --card: rgba(255,255,255,.92); --border: rgba(27,36,66,.09);
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
          font-family: "Inter", system-ui, -apple-system, sans-serif;
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
          font-family: "Crimson Pro", Georgia, serif;
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
        .page {
          max-width: 900px; margin: 0 auto; padding: 44px 24px 88px; position: relative; z-index: 1;
          animation: dashboardPageReveal 2.1s cubic-bezier(.22,.72,.18,1) .22s both;
        }
        @keyframes dashboardPageReveal {
          0%, 26% { opacity: 0; transform: translateY(10px); filter: blur(1.5px); }
          100% { opacity: 1; transform: none; filter: blur(0); }
        }
        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 36px; flex-wrap: wrap;
        }
        .page-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 30px; font-weight: 600; line-height: 1.1;
          color: #fff; letter-spacing: .005em;
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
          gap: 6px; width: 100%; max-width: 720px;
          padding: 6px; margin: -14px 0 28px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
          background: rgba(255,255,255,.07); backdrop-filter: blur(14px);
          box-shadow: 0 16px 40px rgba(0,0,0,.22);
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
        .save-results-card {
          position: relative; overflow: hidden;
          background:
            radial-gradient(circle at 16% 18%, rgba(10,163,163,.22), transparent 34%),
            radial-gradient(circle at 88% 76%, rgba(212,160,23,.18), transparent 36%),
            linear-gradient(135deg, rgba(255,255,255,.96), rgba(236,253,245,.90));
          border: 1px solid var(--accent-line); border-radius: 20px;
          box-shadow: var(--shadow), inset 0 0 48px rgba(10,163,163,.10);
          backdrop-filter: blur(16px);
          padding: 26px 30px; margin-bottom: 28px;
          display: grid; grid-template-columns: minmax(0, 1fr) auto;
          gap: 22px; align-items: center;
        }
        .save-results-card::before {
          content: ""; position: absolute; inset: -46%;
          background: conic-gradient(from 120deg, transparent, rgba(10,163,163,.16), transparent 30%, rgba(212,160,23,.14), transparent 62%);
          animation: saveResultsGlow 15s linear infinite;
          pointer-events: none;
        }
        .save-results-content,
        .save-results-actions { position: relative; z-index: 1; }
        .save-results-kicker {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 11px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a6e6e; font-size: 11px; font-weight: 850;
          letter-spacing: .11em; text-transform: uppercase;
          margin-bottom: 10px;
        }
        .save-results-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 30px; font-weight: 650; line-height: 1.05;
          color: var(--navy); margin-bottom: 7px;
        }
        .save-results-copy {
          color: var(--muted); font-size: 14px; line-height: 1.55;
          max-width: 560px;
        }
        .save-results-actions {
          display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        }
        .save-results-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          border: none; border-radius: 999px; padding: 15px 24px;
          background: linear-gradient(135deg, var(--navy), #253566 58%, #0a6e6e);
          color: #fff; font-family: inherit; font-size: 15px; font-weight: 850;
          cursor: pointer; box-shadow: 0 16px 34px rgba(27,36,66,.34), 0 0 28px rgba(10,163,163,.20);
          transition: transform .13s ease, box-shadow .15s ease;
          white-space: nowrap;
        }
        .save-results-btn:hover { transform: translateY(-2px); box-shadow: 0 20px 42px rgba(27,36,66,.38), 0 0 34px rgba(10,163,163,.26); }
        .save-results-note {
          font-size: 12px; color: rgba(86,96,112,.82); font-weight: 650;
          text-align: right;
        }
        @keyframes saveResultsGlow { to { transform: rotate(1turn); } }
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
          font-family: "Crimson Pro", Georgia, serif; font-size: 36px; line-height: 1.04;
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
        .score-strip {
          display: grid; grid-template-columns: auto 1fr auto;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: var(--shadow);
          backdrop-filter: blur(16px); overflow: visible;
          margin-bottom: 28px; position: relative; z-index: 40;
        }
        .score-strip::after {
          content: ""; position: absolute; inset: 0;
          background: repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.18) 60px,rgba(255,255,255,.18) 120px);
          pointer-events: none; border-radius: 20px;
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer { 0%,100%{opacity:0} 50%{opacity:1} }
        .progress-card {
          position: relative; z-index: 3; overflow: hidden;
          margin: 0 0 18px; padding: 24px 26px 20px;
          color: #f8fafc; background: rgba(8,17,34,.82);
          border: 1px solid rgba(148,163,184,.24); border-radius: 18px;
          box-shadow: 0 18px 44px rgba(0,0,0,.22);
          backdrop-filter: blur(14px);
        }
        .progress-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 14% 26%, rgba(255,255,255,.72) 0 1px, transparent 1.6px),
            radial-gradient(circle at 76% 18%, rgba(112,218,221,.62) 0 1px, transparent 1.7px),
            radial-gradient(circle at 88% 72%, rgba(245,200,66,.54) 0 1px, transparent 1.8px),
            radial-gradient(circle at 38% 82%, rgba(255,255,255,.48) 0 1px, transparent 1.5px);
          opacity: .72;
        }
        .progress-head {
          position: relative; z-index: 1;
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 22px; margin-bottom: 18px;
        }
        .progress-eyebrow {
          margin-bottom: 5px; color: #6fdadd;
          font-size: 10px; font-weight: 850; letter-spacing: .13em;
          text-transform: uppercase;
        }
        .progress-title {
          color: #fff; font-family: "Crimson Pro", Georgia, serif;
          font-size: 25px; font-weight: 650; line-height: 1.1;
        }
        .progress-sub {
          max-width: 500px; margin-top: 5px;
          color: rgba(226,232,240,.70); font-size: 12.5px; line-height: 1.45;
        }
        .progress-controls { display: flex; align-items: center; gap: 13px; }
        .progress-tabs {
          display: inline-grid; grid-template-columns: repeat(2, 1fr); padding: 3px;
          border: 1px solid rgba(148,163,184,.25); border-radius: 999px;
          background: rgba(255,255,255,.06);
        }
        .progress-tab {
          min-width: 48px; border: 0; border-radius: 999px; padding: 7px 11px;
          color: rgba(226,232,240,.68); background: transparent;
          font: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
        }
        .progress-tab:hover, .progress-tab:focus-visible { color: #fff; outline: none; }
        .progress-tab.is-active {
          color: var(--navy); background: #f8fafc; box-shadow: 0 3px 10px rgba(0,0,0,.18);
        }
        .progress-latest {
          min-width: 66px; text-align: right;
          color: #fff; font-family: "Crimson Pro", Georgia, serif;
          font-size: 27px; font-weight: 700; line-height: 1;
        }
        .progress-latest span {
          display: block; margin-top: 3px; color: rgba(226,232,240,.58);
          font-family: "Inter", system-ui, sans-serif; font-size: 9px;
          font-weight: 750; letter-spacing: .10em; text-transform: uppercase;
        }
        .progress-chart-shell {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 34px minmax(0,1fr); gap: 9px;
        }
        .progress-axis {
          height: 174px; display: flex; flex-direction: column;
          justify-content: space-between; padding: 3px 0 2px;
          color: #8fe6e9; font-size: 11.5px; font-weight: 800;
          text-align: right; letter-spacing: .02em;
          text-shadow: 0 1px 6px rgba(0,0,0,.6);
        }
        .progress-chart-scroll {
          min-width: 0; overflow-x: auto; overflow-y: hidden;
          scrollbar-width: thin; scrollbar-color: rgba(111,218,221,.35) transparent;
        }
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
          color: rgba(226,232,240,.66); font-size: 10.5px; font-weight: 750;
          letter-spacing: .04em; white-space: nowrap;
        }
        .progress-xaxis span:first-child { transform: translateX(-20%); }
        .progress-xaxis span:last-child { transform: translateX(-80%); }
        .progress-chart svg {
          position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
        }
        .progress-guide {
          stroke: rgba(148,163,184,.24); stroke-width: 1; vector-effect: non-scaling-stroke;
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
          fill: none; stroke: rgba(240,253,255,.85); stroke-width: 1.6;
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
          border: 1px solid rgba(223,250,251,.85); background: #0f2537;
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
          border-top: 1px solid rgba(148,163,184,.17);
        }
        .progress-detail-primary strong {
          display: block; color: #fff; font-family: "Crimson Pro", Georgia, serif;
          font-size: 20px; line-height: 1.1;
        }
        .progress-detail-primary span,
        .progress-stat span {
          display: block; margin-top: 4px; color: rgba(226,232,240,.58);
          font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
        }
        .progress-stat strong { color: #fff; font-size: 13px; font-weight: 750; }
        .progress-review-link {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 34px; padding: 0 13px; border-radius: 999px;
          border: 1px solid rgba(111,218,221,.28);
          background: rgba(111,218,221,.08); color: rgba(238,254,255,.92);
          font-size: 11px; font-weight: 800; text-decoration: none; white-space: nowrap;
          transition: background .15s ease, border-color .15s ease;
        }
        .progress-review-link:hover, .progress-review-link:focus-visible {
          background: rgba(111,218,221,.16); border-color: rgba(111,218,221,.52);
          outline: none;
        }
        .progress-note {
          position: relative; z-index: 1; margin-top: 13px;
          color: rgba(226,232,240,.52); font-size: 10.5px; line-height: 1.4;
        }
        .progress-empty {
          position: relative; z-index: 1; min-height: 132px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; color: rgba(226,232,240,.68);
        }
        .progress-empty strong {
          color: #fff; font-family: "Crimson Pro", Georgia, serif;
          font-size: 20px; font-weight: 650;
        }
        .progress-empty span { max-width: 420px; margin-top: 6px; font-size: 12px; line-height: 1.5; }
        .progress-error { color: #fcd5d5; }
        .score-block {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 30px 36px; gap: 4px; border-right: 1px solid var(--border);
          position: relative; z-index: 2;
        }
        .score-number {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 56px; font-weight: 700; line-height: 1;
          color: rgba(27,36,66,.22); letter-spacing: -.02em; user-select: none;
        }
        .score-label {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: var(--muted);
        }
        .score-label-row {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px;
        }
        .bli-info-btn {
          width: 18px; height: 18px; border-radius: 50%;
          border: 1px solid rgba(27,36,66,.16);
          background: rgba(255,255,255,.72); color: var(--navy);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; line-height: 1;
          cursor: pointer; font-family: inherit;
          box-shadow: 0 2px 8px rgba(27,36,66,.10);
        }
        .bli-info-btn:hover, .bli-info-btn:focus-visible {
          border-color: var(--accent-line); color: #0a6e6e; outline: none;
          background: #fff;
        }
        .bli-tooltip {
          position: absolute; top: 28px; left: 50%; transform: translateX(-50%);
          width: min(320px, calc(100vw - 48px));
          background: #fff; color: var(--navy);
          border: 1px solid var(--border); border-radius: 12px;
          box-shadow: var(--shadow-sm); padding: 14px 15px;
          text-align: left; z-index: 80;
          font-size: 12.5px; line-height: 1.55; font-weight: 500;
          letter-spacing: 0; text-transform: none; text-decoration: none;
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity .12s ease, visibility .12s ease;
        }
        .score-label-row:hover .bli-tooltip,
        .score-label-row:focus-within .bli-tooltip,
        .bli-tooltip.is-open {
          opacity: 1; visibility: visible; pointer-events: auto;
        }
        .bli-tooltip::before {
          content: ""; position: absolute; top: -6px; left: 50%;
          width: 12px; height: 12px; transform: translateX(-50%) rotate(45deg);
          background: #fff; border-left: 1px solid var(--border); border-top: 1px solid var(--border);
        }
        .bli-tooltip span {
          display: inline-flex; margin-top: 8px;
          color: #0a6e6e; font-weight: 700; text-decoration: none;
        }
        .bli-tooltip:hover span { text-decoration: underline; }
        .level-block {
          padding: 30px 32px;
          display: flex; flex-direction: column; justify-content: center; gap: 10px;
        }
        .level-badge-empty {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(27,36,66,.05); border: 1px solid var(--border);
          border-radius: 999px; padding: 5px 13px;
          font-size: 12px; font-weight: 700; color: var(--muted);
          letter-spacing: .05em; text-transform: uppercase; width: fit-content;
        }
        .level-badge-empty::before {
          content: ""; width: 7px; height: 7px;
          border-radius: 50%; background: rgba(27,36,66,.2);
        }
        .level-desc-empty {
          font-size: 14.5px; line-height: 1.6; color: var(--muted); max-width: 420px;
        }
        .level-desc-empty strong { color: var(--navy); }
        .knowledge-cone-card {
          position: relative; z-index: 1;
          background: rgba(255,255,255,.94); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: var(--shadow);
          backdrop-filter: blur(16px); padding: 28px 32px 30px;
          margin-bottom: 18px; overflow: visible;
        }
        .knowledge-cone-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-bottom: 22px;
        }
        .knowledge-cone-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 25px; font-weight: 650; color: var(--navy); line-height: 1.1;
        }
        .knowledge-cone-sub { font-size: 13px; color: var(--muted); margin-top: 5px; }
        .knowledge-cone-score {
          display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
          color: var(--navy); font-weight: 700; font-size: 28px;
          font-family: "Crimson Pro", Georgia, serif;
        }
        .knowledge-cone-score span {
          font-family: "Inter", system-ui, sans-serif; font-size: 10px;
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
        .cone-marker {
          position: absolute; right: -118px;
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
          border-left: 1px solid var(--border); min-width: 210px; position: relative;
        }
        .conf-empty-label {
          display: inline-flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
          font-size: 13px; font-weight: 850; letter-spacing: .075em;
          text-transform: uppercase; color: rgba(27,36,66,.56); text-align: left;
        }
        .conf-percent {
          font-family: "Crimson Pro", Georgia, serif; font-size: 27px; line-height: 1;
          font-weight: 750; color: var(--navy); letter-spacing: 0; text-transform: none;
        }
        .conf-note { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--muted); text-align: left; line-height: 1.35; }
        .conf-level {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 5px 10px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a6e6e; font-size: 12px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase;
        }
        .evidence-info-btn {
          width: 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%; border: 1px solid rgba(27,36,66,.14); background: rgba(255,255,255,.58);
          color: var(--muted); font: 800 11px "Inter", sans-serif; cursor: pointer;
        }
        .evidence-tooltip {
          position: absolute; right: 22px; top: calc(100% - 10px); z-index: 80;
          width: min(300px, calc(100vw - 42px)); padding: 13px 15px; border-radius: 8px;
          background: #fff; border: 1px solid var(--border); box-shadow: var(--shadow-sm);
          color: var(--navy); font-size: 12px; font-weight: 600; line-height: 1.5;
          opacity: 0; visibility: hidden; transform: translateY(-5px);
          transition: opacity .14s, transform .14s, visibility .14s; pointer-events: none;
        }
        .evidence-tooltip.is-open { opacity: 1; visibility: visible; transform: translateY(0); pointer-events: auto; }
        .assessment-suite {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px; margin-bottom: 28px;
        }
        .assessment-suite-card {
          position: relative; overflow: hidden;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 18px; padding: 22px 22px 20px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          display: flex; flex-direction: column; gap: 12px;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .assessment-suite-card::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
        }
        .assessment-suite-card::after {
          content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
        }
        .assessment-suite-card > * { position: relative; z-index: 1; }
        .assessment-suite-card:hover {
          transform: translateY(-2px); box-shadow: 0 20px 40px rgba(0,0,0,.14);
        }
        .assessment-suite-card.is-ot::before {
          background: linear-gradient(90deg, #d4a017, #f5c842, #d4a017);
        }
        .assessment-suite-card.is-ot::after {
          background: radial-gradient(120% 80% at 100% 0%, rgba(245,200,66,.12), transparent 60%);
        }
        .assessment-suite-card.is-ot:hover { border-color: rgba(212,160,23,.42); }
        .assessment-suite-card.is-nt::before {
          background: linear-gradient(90deg, #7c3aed, #a855f7, #7c3aed);
        }
        .assessment-suite-card.is-nt::after {
          background: radial-gradient(120% 80% at 100% 0%, rgba(124,58,237,.12), transparent 60%);
        }
        .assessment-suite-card.is-nt:hover { border-color: rgba(124,58,237,.42); }
        .assessment-suite-top {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .assessment-suite-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 24px; font-weight: 700; color: var(--navy); line-height: 1;
        }
        .assessment-suite-badge {
          display: inline-flex; align-items: center; border-radius: 999px;
          padding: 5px 9px; font-size: 10.5px; font-weight: 850;
          letter-spacing: .08em; text-transform: uppercase;
          background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe;
        }
        .assessment-suite-badge.is-verified {
          background: #d1fae5; color: #065f46; border-color: #a7f3d0;
        }
        .assessment-suite-copy { color: var(--muted); font-size: 13.5px; line-height: 1.5; }
        .assessment-suite-stats {
          display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--muted);
        }
        .assessment-suite-stats span {
          display: inline-flex; border-radius: 999px; padding: 5px 9px;
          background: rgba(27,36,66,.055); border: 1px solid rgba(27,36,66,.08);
          font-weight: 700;
        }
        .assessment-suite-link {
          display: inline-flex; align-items: center; gap: 8px; align-self: flex-start;
          margin-top: auto; color: var(--navy); text-decoration: none;
          font-size: 13.5px; font-weight: 800;
          transition: gap .16s ease, color .16s ease;
        }
        .assessment-suite-link:hover { color: #0a6e6e; gap: 11px; }
        .assessment-suite-actions {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: auto;
        }
        .assessment-suite-actions .assessment-suite-link { margin-top: 0; }
        .scope-text-btn {
          border: 0; padding: 5px 0; background: transparent; color: var(--muted);
          font: inherit; font-size: 11.5px; font-weight: 750; cursor: pointer;
        }
        .scope-text-btn:hover, .scope-text-btn:focus-visible { color: #0a6e6e; outline: none; }
        .is-nt .assessment-suite-link:hover { color: #7c3aed; }
        .start-hero {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 48px 40px;
          box-shadow: var(--shadow); backdrop-filter: blur(16px);
          margin-bottom: 28px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 20px;
        }
        .start-hero.compact {
          position: relative; overflow: hidden;
          min-height: 154px; padding: 30px 24px; margin-bottom: 28px;
          display: flex; align-items: center; justify-content: center;
          background:
            linear-gradient(115deg, rgba(255,255,255,.95), rgba(255,255,255,.86)),
            radial-gradient(circle at 28% 35%, rgba(10,163,163,.20), transparent 34%),
            radial-gradient(circle at 72% 70%, rgba(212,160,23,.18), transparent 36%);
        }
        .start-hero.compact::before {
          content: ""; position: absolute; inset: -42%;
          background: conic-gradient(from 120deg, transparent, rgba(10,163,163,.18), transparent 30%, rgba(212,160,23,.16), transparent 62%);
          animation: assessmentAura 13s linear infinite;
          pointer-events: none;
        }
        .start-hero.compact::after {
          content: ""; position: absolute; inset: 18px; border-radius: 16px;
          border: 1px solid rgba(10,163,163,.16);
          box-shadow: inset 0 0 36px rgba(10,163,163,.10);
          pointer-events: none;
        }
        .assessment-cta-wrap {
          position: absolute; inset: 0; z-index: 1;
          display: grid; place-items: center; padding: 30px 24px;
          transition: padding 2s cubic-bezier(.16,.84,.18,1);
        }
        .assessment-cta-wrap::before,
        .assessment-cta-wrap::after {
          content: ""; position: absolute; inset: -16px; border-radius: 999px;
          border: 1px solid rgba(10,163,163,.24);
          animation: assessmentPulse 2.8s ease-out infinite;
          pointer-events: none;
        }
        .assessment-cta-wrap::after { inset: -28px; animation-delay: .9s; opacity: .58; }
        .start-hero.compact.is-charging .assessment-cta-wrap::before,
        .start-hero.compact.is-charging .assessment-cta-wrap::after { opacity: 0; animation-play-state: paused; }
        .start-hero.compact.is-charging .assessment-cta-wrap { padding: 0; }
        .start-hero.compact .start-btn {
          position: relative; z-index: 1; width: 238px; min-width: 238px; height: 58px;
          justify-content: center; padding: 18px 34px; font-size: 16px;
          font-family: "Inter", system-ui, sans-serif; font-weight: 760; letter-spacing: .01em;
          white-space: nowrap;
          background: linear-gradient(135deg, #1b2442 0%, #253566 58%, #0a6e6e 100%);
          box-shadow: 0 18px 38px rgba(27,36,66,.38), 0 0 28px rgba(10,163,163,.22);
          transition: width 2s cubic-bezier(.16,.84,.18,1), height 2s cubic-bezier(.16,.84,.18,1), border-radius 2s cubic-bezier(.16,.84,.18,1), transform .13s ease, box-shadow .15s ease;
        }
        .start-hero.compact.is-charging .start-btn {
          width: 100%; height: 100%; border-radius: 20px;
          transform: none; box-shadow: 0 24px 54px rgba(27,36,66,.42), 0 0 42px rgba(10,163,163,.30);
        }
        .start-hero.compact .start-btn::before {
          content: ""; position: absolute; inset: 1px; border-radius: inherit;
          background: linear-gradient(110deg, transparent 0 28%, rgba(255,255,255,.24) 45%, transparent 62% 100%);
          transform: translateX(-120%); animation: assessmentShine 3.8s ease-in-out infinite;
          pointer-events: none;
        }
        .start-hero.compact .start-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 22px 44px rgba(27,36,66,.44), 0 0 34px rgba(10,163,163,.28); }
        .start-hero.compact.is-charging .start-btn:hover { transform: none; }
        @keyframes assessmentAura { to { transform: rotate(1turn); } }
        @keyframes assessmentPulse { 0% { transform: scale(.92); opacity: .72; } 100% { transform: scale(1.16); opacity: 0; } }
        @keyframes assessmentShine { 0%, 44% { transform: translateX(-120%); } 72%, 100% { transform: translateX(120%); } }
        .start-btn {
          position: relative; overflow: hidden;
          display: flex; align-items: center; gap: 10px;
          padding: 16px 36px; border-radius: 999px;
          background: var(--navy); color: #fff;
          font-size: 16px; font-weight: 600;
          border: none; cursor: pointer; text-decoration: none;
          box-shadow: 0 12px 32px rgba(27,36,66,.4);
          transition: background .15s ease, transform .13s ease, box-shadow .15s ease;
        }
        .start-btn:hover { background: #253566; transform: translateY(-2px); }
        .start-btn svg { width: 20px; height: 20px; flex: 0 0 auto; }
        .start-btn-label { display: inline-block; white-space: nowrap; line-height: 1; }
        .recommended-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 24px 26px; margin-bottom: 28px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 18px; align-items: center;
          position: relative; overflow: hidden;
        }
        .recommended-card::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg, var(--accent), #d4a017);
        }
        .recommended-eyebrow { font-size: 11px; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; color: #0a6e6e; margin-bottom: 7px; }
        .recommended-title { font-family: "Crimson Pro", Georgia, serif; font-size: 26px; font-weight: 650; color: var(--navy); line-height: 1.05; }
        .recommended-books { margin-top: 5px; font-size: 13px; color: var(--muted); font-weight: 650; }
        .recommended-focus { margin-top: 13px; font-size: 14px; line-height: 1.55; color: rgba(27,36,66,.76); max-width: 660px; }
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
          font-family: "Crimson Pro", Georgia, serif;
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
        .breakdown-tabs {
          display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px;
          background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.12);
          backdrop-filter: blur(10px);
        }
        .breakdown-tab {
          border: none; border-radius: 999px; padding: 7px 12px;
          background: transparent; color: rgba(255,255,255,.62);
          font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
        }
        .breakdown-tab.is-active { background: rgba(255,255,255,.92); color: var(--navy); }
        .breakdown-note {
          margin: -4px 0 14px; color: rgba(255,255,255,.52);
          font-size: 12.5px; line-height: 1.45;
        }
        .sections-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .sections-grid.books { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .sections-grid.domains { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .sections-grid.sections.is-prophets-expanded > .section-card.prophets-parent,
        .sections-grid.sections.is-prophets-expanded > .section-card.writings {
          grid-column: 1 / -1;
        }
        .domain-radar-card {
          position: relative; overflow: hidden;
          background:
            radial-gradient(circle at 18% 20%, rgba(10,163,163,.14), transparent 32%),
            radial-gradient(circle at 82% 78%, rgba(212,160,23,.10), transparent 34%),
            rgba(7,12,28,.38);
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 18px; padding: 26px 28px;
          box-shadow: 0 24px 60px rgba(0,0,0,.34), inset 0 0 0 1px rgba(255,255,255,.06);
          backdrop-filter: blur(8px);
          display: grid; grid-template-columns: minmax(300px, 1fr) minmax(250px, .85fr);
          gap: 28px; align-items: center;
        }
        .domain-radar-card::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(circle at 50% 48%, rgba(10,163,163,.18), transparent 32%),
            radial-gradient(circle at 50% 48%, rgba(255,255,255,.08), transparent 54%);
          opacity: .55;
        }
        .domain-radar-card::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 0 42%, rgba(255,255,255,.09) 50%, transparent 58% 100%);
          opacity: .34;
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
          fill: none; stroke: rgba(255,255,255,.08); stroke-width: .9;
        }
        .radar-axis {
          stroke: rgba(255,255,255,.09); stroke-width: .8;
        }
        .radar-shape {
          fill: rgba(10,163,163,.08);
          stroke: rgba(173,232,255,.82); stroke-width: 1.8;
          filter: drop-shadow(0 0 12px rgba(103,232,249,.42));
          animation: constellationPulse 4.8s ease-in-out infinite;
        }
        .radar-point {
          fill: #fff; stroke: rgba(173,232,255,.96); stroke-width: 2.5;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 8px rgba(255,255,255,.85)) drop-shadow(0 0 16px rgba(103,232,249,.75));
          animation: constellationStar 3.8s ease-in-out infinite;
        }
        .radar-point-glow {
          fill: rgba(103,232,249,.18);
          stroke: rgba(173,232,255,.20);
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
          fill: rgba(255,255,255,.90); font-size: 10.5px; font-weight: 850;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .radar-score-label {
          fill: rgba(255,255,255,.82); font-size: 14px; font-weight: 800;
        }
        .domain-radar-side {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; gap: 12px;
        }
        .domain-radar-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 26px; line-height: 1.08; color: #fff;
          font-weight: 650; margin-bottom: 2px;
        }
        .domain-radar-copy {
          color: rgba(255,255,255,.70); font-size: 13.5px; line-height: 1.55;
          margin-bottom: 8px;
        }
        .domain-radar-list {
          display: grid; gap: 8px;
        }
        .domain-radar-row {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px;
          align-items: center; padding: 9px 11px; border-radius: 12px;
          background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.13);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.03);
          width: 100%; color: inherit; font: inherit; text-align: left; cursor: pointer;
          transition: background .15s ease, border-color .15s ease, transform .15s ease;
        }
        .domain-radar-row:hover, .domain-radar-row:focus-visible {
          background: rgba(255,255,255,.15); border-color: rgba(111,218,221,.45);
          transform: translateX(2px); outline: none;
        }
        .domain-radar-row.is-locked {
          background: rgba(255,255,255,.06);
          border-style: dashed;
          opacity: .72; cursor: default;
        }
        .domain-radar-name {
          color: rgba(255,255,255,.92); font-size: 13px; font-weight: 760;
        }
        .domain-radar-meta {
          color: rgba(255,255,255,.55); font-size: 11.5px; font-weight: 650;
        }
        .domain-radar-score {
          color: #fff; font-family: "Crimson Pro", Georgia, serif;
          font-size: 20px; font-weight: 700;
        }
        .domain-radar-score.is-locked {
          font-family: "Inter", system-ui, sans-serif;
          font-size: 11px; letter-spacing: .09em; text-transform: uppercase;
          color: rgba(255,255,255,.56);
        }
        .section-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 16px; padding: 20px 22px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          position: relative; overflow: hidden; opacity: .75;
          width: 100%; color: inherit; font: inherit; text-align: left;
          transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, opacity .16s ease;
        }
        .section-card:hover, .section-card:focus-within {
          transform: translateY(-2px); border-color: rgba(10,163,163,.32);
          box-shadow: 0 13px 30px rgba(0,0,0,.22); outline: none;
        }
        .section-card.prophet-child {
          animation: prophetChildIn .24s cubic-bezier(.22,.72,.18,1) both;
        }
        .section-card.prophets-parent.is-expanded {
          border-color: rgba(10,163,163,.34);
          box-shadow: 0 12px 30px rgba(0,0,0,.20), inset 0 -24px 40px rgba(10,163,163,.04);
        }
        @keyframes prophetChildIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .section-card.has-score { opacity: 1; }
        .section-card.low-evidence { opacity: .82; }
        .section-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .section-card.ot::before { background: linear-gradient(90deg,#0aa3a3,#d4a017,#2563c4,#7c3aed); }
        .section-card.torah::before   { background: var(--torah-bar); }
        .section-card.former::before  { background: var(--former-bar); }
        .section-card.latter::before  { background: var(--latter-bar); }
        .section-card.prophets::before { background: linear-gradient(90deg,#0e8c6a,#2563c4); }
        .section-card.writings::before { background: var(--writings-bar); }
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
        .sc-parent-label {
          display: inline-flex; align-items: center; gap: 6px; margin-bottom: 5px;
          color: #087979; font-size: 9px; font-weight: 850;
          letter-spacing: .1em; text-transform: uppercase;
        }
        .sc-parent-label::before {
          content: ""; width: 13px; height: 2px; border-radius: 999px;
          background: linear-gradient(90deg,#0e8c6a,#2563c4);
        }
        .sc-name { font-size: 15px; font-weight: 650; color: var(--navy); }
        .sc-books { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .sc-pct-empty { font-family: "Crimson Pro",Georgia,serif; font-size: 24px; font-weight: 700; color: rgba(27,36,66,.18); line-height: 1; }
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
        .sc-expand-icon { transition: transform .18s ease; }
        .sc-test-link[aria-expanded="true"] .sc-expand-icon { transform: rotate(180deg); }
        @media (min-width: 641px) {
          .sections-grid.sections.is-prophets-expanded > .section-card.prophets-parent,
          .sections-grid.sections.is-prophets-expanded > .section-card.prophet-child {
            overflow: visible;
          }
          .sections-grid.sections.is-prophets-expanded > .section-card.prophets-parent::after {
            content: ""; position: absolute; z-index: 2; top: 100%; left: 50%;
            width: 2px; height: 14px; transform: translateX(-1px);
            background: linear-gradient(180deg,rgba(10,163,163,.72),rgba(37,99,196,.56));
            pointer-events: none;
          }
          .sections-grid.sections.is-prophets-expanded > .section-card.prophet-child {
            margin-top: 24px;
          }
          .sections-grid.sections.is-prophets-expanded > .section-card.prophet-child::after {
            content: ""; position: absolute; z-index: 2; top: -25px; height: 25px;
            border-top: 2px solid rgba(10,163,163,.52);
            pointer-events: none;
          }
          .sections-grid.sections.is-prophets-expanded > .section-card.prophet-child.former::after {
            left: 50%; right: -7px;
            border-left: 2px solid rgba(14,140,106,.58);
            border-top-left-radius: 10px;
          }
          .sections-grid.sections.is-prophets-expanded > .section-card.prophet-child.latter::after {
            left: -7px; right: 50%;
            border-right: 2px solid rgba(37,99,196,.58);
            border-top-right-radius: 10px;
          }
        }
        .scope-drawer-backdrop {
          position: fixed; inset: 0; z-index: 120; display: flex; justify-content: flex-end;
          background: rgba(3,8,20,.58); backdrop-filter: blur(5px);
          animation: scopeBackdropIn .18s ease-out both;
        }
        .scope-drawer {
          width: min(480px, 100%); height: 100%; overflow-y: auto;
          background: #f7f9fb; color: var(--navy);
          border-left: 1px solid rgba(255,255,255,.42);
          box-shadow: -24px 0 60px rgba(0,0,0,.32);
          animation: scopeDrawerIn .24s cubic-bezier(.22,.72,.18,1) both;
        }
        @keyframes scopeBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scopeDrawerIn { from { transform: translateX(34px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .scope-drawer-head {
          position: sticky; top: 0; z-index: 2; display: flex;
          justify-content: space-between; align-items: flex-start; gap: 18px;
          padding: 28px 28px 20px; background: rgba(247,249,251,.94);
          border-bottom: 1px solid rgba(27,36,66,.10); backdrop-filter: blur(12px);
        }
        .scope-drawer-kicker {
          margin-bottom: 6px; color: #0a7b7b; font-size: 10px;
          font-weight: 850; letter-spacing: .12em; text-transform: uppercase;
        }
        .scope-drawer-title {
          font-family: "Crimson Pro", Georgia, serif; font-size: 31px;
          font-weight: 700; line-height: 1.05;
        }
        .scope-drawer-sub { margin-top: 5px; color: var(--muted); font-size: 12.5px; }
        .scope-drawer-close {
          flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid rgba(27,36,66,.13); background: #fff; color: var(--navy);
          font: 500 24px/1 system-ui, sans-serif; cursor: pointer;
        }
        .scope-drawer-close:hover, .scope-drawer-close:focus-visible {
          border-color: var(--accent-line); color: #0a6e6e; outline: none;
        }
        .scope-drawer-body { padding: 24px 28px 34px; }
        .scope-state {
          min-height: 280px; display: grid; place-content: center; text-align: center;
          color: var(--muted); font-size: 13px; line-height: 1.55;
        }
        .scope-state strong {
          display: block; margin-bottom: 5px; color: var(--navy);
          font-family: "Crimson Pro", Georgia, serif; font-size: 22px;
        }
        .scope-evidence {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          padding-bottom: 20px; border-bottom: 1px solid rgba(27,36,66,.10);
        }
        .scope-evidence-label {
          display: inline-flex; padding: 6px 10px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a6e6e; font-size: 11px; font-weight: 850;
        }
        .scope-evidence-copy { margin-top: 7px; color: var(--muted); font-size: 12px; line-height: 1.45; }
        .scope-evidence-score {
          color: var(--navy); font-family: "Crimson Pro", Georgia, serif;
          font-size: 32px; font-weight: 700; text-align: right;
        }
        .scope-evidence-score span {
          display: block; margin-top: 2px; color: var(--muted);
          font-family: "Inter", system-ui, sans-serif; font-size: 9px;
          font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
        }
        .scope-metrics {
          display: grid; grid-template-columns: repeat(3,1fr);
          padding: 19px 0; border-bottom: 1px solid rgba(27,36,66,.10);
        }
        .scope-metric { padding-right: 12px; }
        .scope-metric strong { display: block; font-size: 17px; }
        .scope-metric span {
          color: var(--muted); font-size: 9px; font-weight: 800;
          letter-spacing: .08em; text-transform: uppercase;
        }
        .scope-period { padding: 15px 0; color: var(--muted); font-size: 11.5px; line-height: 1.5; }
        .scope-breakdown { padding-top: 18px; border-top: 1px solid rgba(27,36,66,.10); }
        .scope-breakdown + .scope-breakdown { margin-top: 20px; }
        .scope-breakdown h3 {
          margin-bottom: 9px; font-size: 10px; font-weight: 850;
          letter-spacing: .11em; text-transform: uppercase; color: var(--muted);
        }
        .scope-breakdown-row {
          display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px;
          padding: 10px 0; border-bottom: 1px solid rgba(27,36,66,.07);
        }
        .scope-breakdown-row:last-child { border-bottom: 0; }
        .scope-breakdown-name { font-size: 13px; font-weight: 750; }
        .scope-breakdown-meta { color: var(--muted); font-size: 11px; margin-top: 2px; }
        .scope-breakdown-value { font-size: 13px; font-weight: 800; text-align: right; }
        .scope-focused-action {
          display: flex; justify-content: space-between; align-items: center; gap: 18px;
          margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(27,36,66,.10);
        }
        .scope-focused-action p { color: var(--muted); font-size: 11.5px; line-height: 1.45; }
        .scope-focused-link {
          flex: 0 0 auto; border-radius: 999px; padding: 10px 15px;
          color: #fff; background: var(--navy); text-decoration: none;
          font-size: 12px; font-weight: 800; box-shadow: 0 8px 20px rgba(27,36,66,.22);
        }
        @media (max-width: 640px) {
          .score-strip { grid-template-columns: 1fr; }
          .score-block { border-right: none; border-bottom: 1px solid var(--border); }
          .conf-block { border-left: none; border-top: 1px solid var(--border); align-items: center; text-align: center; }
          .progress-card { padding: 22px 16px 18px; }
          .progress-head { flex-direction: column; gap: 14px; }
          .progress-controls { width: 100%; justify-content: space-between; }
          .progress-chart { min-width: 560px; }
          .progress-detail { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px 12px; }
          .progress-detail-primary { grid-column: 1 / -1; }
          .progress-review-link { grid-column: 1 / -1; }
          .breakdown-head { flex-direction: column; align-items: flex-start; }
          .breakdown-tabs { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); }
          .breakdown-tab { padding-inline: 8px; }
          .sections-grid,
          .sections-grid.books,
          .sections-grid.domains { grid-template-columns: 1fr; }
          .sections-grid.sections.is-prophets-expanded > .section-card.prophet-child {
            width: calc(100% - 18px); margin-left: 18px;
            border-left: 3px solid rgba(10,163,163,.42);
          }
          .domain-radar-card { grid-template-columns: 1fr; padding: 22px 18px; }
          .domain-radar-wrap { min-height: 330px; }
          .domain-radar-svg { width: min(100%, 340px); }
          .recommended-card { grid-template-columns: 1fr; }
          .recommended-side, .recommended-actions { align-items: flex-start; }
          .recommended-priority { max-width: none; }
          .retest-modal { padding: 24px 22px; }
          .retest-modal-actions { align-items: stretch; flex-direction: column-reverse; }
          .retest-modal-primary,
          .retest-modal-secondary { width: 100%; }
          .save-results-card { grid-template-columns: 1fr; padding: 24px 20px; }
          .save-results-actions { align-items: stretch; }
          .save-results-btn { width: 100%; }
          .save-results-note { text-align: center; }
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
          .start-hero { padding: 36px 24px; }
          .start-hero.compact { min-height: 144px; padding: 28px 18px; }
          .assessment-cta-wrap { padding: 28px 18px; }
          .start-hero.compact.is-charging .assessment-cta-wrap { padding: 0; }
          .start-hero.compact .start-btn { width: min(100%, 330px); min-width: min(100%, 330px); justify-content: center; padding: 17px 24px; }
          .assessment-suite { grid-template-columns: 1fr; }
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
          .nav { padding: 13px 16px; }
          .page { padding: 28px 16px 72px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .water-fill, .water-fill::before, .water-fill::after,
          .water-wave, .water-wave::before,
          .assessment-cta-wrap::before, .assessment-cta-wrap::after,
          .start-hero.compact .start-btn::before,
          .progress-point,
          .scope-drawer-backdrop, .scope-drawer,
          .placeholder-orbit, .placeholder-orbit::before, .placeholder-orbit::after {
            animation: none !important;
          }
        }
      `}</style>
      <canvas ref={canvasRef} className="stars" aria-hidden="true" />

      <nav className="nav">
        <span className="brand-wrap">
          <Link className="nav-brand" href="/">Open Bible Assessment</Link>
          <span className="beta-badge" tabIndex={0}>
            Beta
            <span className="beta-tooltip" role="tooltip">
              Open Bible Assessment is still in active development. Scores and questions are being refined, so your results may shift as the platform matures.
            </span>
          </span>
        </span>
        <div className="nav-right">
          <Link className="nav-btn" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-btn" href="/about">About</Link>
          <Link className="nav-btn" href="/credential">For Churches</Link>
          {userEmail ? (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:"var(--muted)",padding:"6px 12px",borderRadius:999,border:"1px solid var(--border)",background:"rgba(255,255,255,.5)"}}>
                {userEmail}
              </span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  clearAssessmentBrowserStorage();
                  setUserEmail(null);
                  setAssessmentData(null);
                  setSectionScores({});
                  setScopeScores(buildScopeScores([], []));
                  setBackendRecommendation(null);
                }}
                style={{fontSize:12,color:"var(--muted)",padding:"6px 12px",borderRadius:999,border:"1px solid var(--border)",background:"rgba(255,255,255,.5)",cursor:"pointer",fontFamily:"inherit",transition:"color .14s"}}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button className="nav-btn" onClick={handleSignIn}>Sign in</button>
          )}
        </div>
      </nav>

      <main className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Your Learning Dashboard</h1>
            <p className="page-meta">
              {activeDashboardTab === "bli" && (assessmentData ? `${assessmentData.answered} questions answered` : "No assessment taken yet")}
              {activeDashboardTab === "church-history" && "Church History dashboard coming soon"}
              {activeDashboardTab === "biblical-languages" && "Biblical Languages dashboard coming soon"}
            </p>
          </div>
        </header>

        <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
          <button
            type="button"
            role="tab"
            aria-selected={activeDashboardTab === "bli"}
            className={`dashboard-tab ${activeDashboardTab === "bli" ? "is-active" : ""}`}
            onClick={() => setActiveDashboardTab("bli")}
          >
            <strong>BLI</strong>
            <span>Old Testament literacy</span>
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

        {activeDashboardTab === "bli" ? (
          <>
        {isAnonymousDashboard && assessmentData && (
          <section className="save-results-card" aria-label="Save assessment results">
            <div className="save-results-content">
              <span className="save-results-kicker">Browser-only results</span>
              <h2 className="save-results-title">Save your results by creating an account.</h2>
              <p className="save-results-copy">
                Your BLI is available in this browser session. Create a free account to keep your score, preserve your answer history, and continue refining your dashboard across devices.
              </p>
            </div>
            <div className="save-results-actions">
              <button className="save-results-btn" type="button" onClick={handleSignIn}>
                Save results
                <span aria-hidden="true">→</span>
              </button>
              <span className="save-results-note">After you sign in, this message will disappear.</span>
            </div>
          </section>
        )}

        <section className="assessment-suite" aria-label="Assessment dashboards">
          <div className="assessment-suite-card is-ot">
            <div className="assessment-suite-top">
              <h2 className="assessment-suite-title">Old Testament</h2>
              <span className="assessment-suite-badge is-verified">Credential</span>
            </div>
            <p className="assessment-suite-copy">Full adaptive assessment across the Old Testament. This is the verified BLI track.</p>
            <div className="assessment-suite-stats">
              <span>{assessmentData ? `${assessmentData.answered} answered` : "Not yet assessed"}</span>
              <span>{assessmentData ? `BLI ${currentDisplayScore}` : "Credential track"}</span>
            </div>
            <div className="assessment-suite-actions">
              <Link className="assessment-suite-link" href="/assess?choose=1">
                {assessmentData ? "Continue OT assessment" : "Start OT assessment"} →
              </Link>
              <button
                type="button"
                className="scope-text-btn"
                onClick={() => void openScopeDetail({
                  scopeType: "TESTAMENT",
                  scopeKey: "OT",
                  label: "Old Testament",
                  subtitle: "Genesis - Malachi",
                })}
              >
                View details
              </button>
            </div>
          </div>
          <div className="assessment-suite-card is-nt">
            <div className="assessment-suite-top">
              <h2 className="assessment-suite-title">New Testament Pilot</h2>
              <span className="assessment-suite-badge">Pilot</span>
            </div>
            <p className="assessment-suite-copy">Preview questions across all 27 New Testament books. Results are developmental and not credential-grade.</p>
            <div className="assessment-suite-stats">
              <span>{ntPilotSummary ? `${ntPilotSummary.accuracy}% latest` : "No pilot attempt yet"}</span>
              <span>{ntPilotSummary ? `${ntPilotSummary.booksAttempted} books attempted` : "Separate from BLI"}</span>
            </div>
            <div className="assessment-suite-actions">
              <Link className="assessment-suite-link" href="/assess?testament=NT">
                Explore NT pilot →
              </Link>
              <button
                type="button"
                className="scope-text-btn"
                onClick={() => void openScopeDetail({
                  scopeType: "TESTAMENT",
                  scopeKey: "NT",
                  label: "New Testament",
                  subtitle: "Matthew - Revelation",
                })}
              >
                View details
              </button>
            </div>
          </div>
        </section>

        <div className="score-strip">
          <div className="score-block">
            {assessmentData ? (
              <>
                <span className="score-number" style={{color:"#1b2442"}}>
                  {currentDisplayScore}
                </span>
                <span
                  className="score-label score-label-row"
                  onMouseEnter={openBliTooltip}
                  onMouseLeave={closeBliTooltipSoon}
                >
                  BLI Score
                  <button
                    type="button"
                    className="bli-info-btn"
                    aria-label="About the Bible Literacy Index"
                    aria-expanded={showBliTooltip}
                    onFocus={openBliTooltip}
                    onBlur={closeBliTooltipSoon}
                    onClick={() => setShowBliTooltip(v => !v)}
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
                    Your Bible Literacy Index measures your knowledge of the Old Testament across four sections, weighted by the theological importance of each book and passage. Scores range from 0 (Unfamiliar) to 800 (Scholar).
                    <span>Learn more →</span>
                  </Link>
                </span>
              </>
            ) : (
              <>
                <span className="score-number">?</span>
                <span
                  className="score-label score-label-row"
                  onMouseEnter={openBliTooltip}
                  onMouseLeave={closeBliTooltipSoon}
                >
                  BLI Score
                  <button
                    type="button"
                    className="bli-info-btn"
                    aria-label="About the Bible Literacy Index"
                    aria-expanded={showBliTooltip}
                    onFocus={openBliTooltip}
                    onBlur={closeBliTooltipSoon}
                    onClick={() => setShowBliTooltip(v => !v)}
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
                    Your Bible Literacy Index measures your knowledge of the Old Testament across four sections, weighted by the theological importance of each book and passage. Scores range from 0 (Unfamiliar) to 800 (Scholar).
                    <span>Learn more →</span>
                  </Link>
                </span>
              </>
            )}
          </div>
          <div className="level-block">
            {assessmentData ? (
              <>
                <div className="level-badge-empty" style={{background:"var(--accent-dim)",borderColor:"var(--accent-line)",color:"#0a6e6e"}}>
                  {currentDisplayLevel}
                </div>
                <p className="level-desc-empty">
                  {currentDisplayBand.description}
                </p>
              </>
            ) : (
              <>
                <div className="level-badge-empty">Not yet assessed</div>
                <p className="level-desc-empty">
                  Take your first assessment to find out where you stand. The engine will build a picture of your knowledge across the Old Testament — <strong>starting with the events that matter most.</strong>
                </p>
              </>
            )}
          </div>
          <div className="conf-block">
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
                onClick={() => setShowEvidenceTooltip(value => !value)}
              >
                i
              </button>
            </span>
            <span className="conf-note">
              {bliEvidence ? (
                <>
                  <span className="conf-level">{bliEvidence.evidence_level}</span>
                  <span>{bliEvidence.n_responses} responses</span>
                </>
              ) : "Answer questions to establish evidence"}
            </span>
            <span className={`evidence-tooltip ${showEvidenceTooltip ? "is-open" : ""}`} role="tooltip">
              {bliEvidence?.evidence_description || "Score evidence reflects the amount and consistency of psychometric evidence supporting your current estimate."}
            </span>
          </div>
        </div>

        <section className="progress-card" aria-labelledby="progress-title">
          <div className="progress-head">
            <div>
              <p className="progress-eyebrow">Assessment snapshots</p>
              <h2 className="progress-title" id="progress-title">Progress over time</h2>
              <p className="progress-sub">
                A record of completed assessments, shown on the full 0-800 BLI scale.
              </p>
            </div>
            <div className="progress-controls">
              <div className="progress-tabs" role="tablist" aria-label="Progress testament">
                {(["OT", "NT"] as const).map(testament => (
                  <button
                    key={testament}
                    type="button"
                    role="tab"
                    aria-selected={progressTestament === testament}
                    className={`progress-tab ${progressTestament === testament ? "is-active" : ""}`}
                    onClick={() => setProgressTestament(testament)}
                  >
                    {testament}
                  </button>
                ))}
              </div>
              <div className="progress-latest">
                {progressHistory[0]?.display_bli ?? "--"}
                <span>Latest BLI</span>
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

        <div className={`start-hero compact ${isAssessmentCharging ? "is-charging" : ""}`}>
          <div className="assessment-cta-wrap">
            <Link
              className="start-btn"
              href={assessmentData ? "/assess" : "/assess?choose=1"}
              onPointerDown={startAssessmentHold}
              onPointerUp={cancelAssessmentHold}
              onPointerLeave={cancelAssessmentHold}
              onPointerCancel={cancelAssessmentHold}
              onClick={cancelAssessmentHold}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h13"/><path d="M11 5l7 7-7 7"/>
              </svg>
              <span className="start-btn-label">{assessmentData ? "Continue assessment" : "Start assessment"}</span>
            </Link>
          </div>
        </div>

        <section className="knowledge-cone-card" aria-label="BLI knowledge cone">
          <div className="knowledge-cone-head">
            <div>
              <h2 className="knowledge-cone-title">Biblical Literacy Index</h2>
              <p className="knowledge-cone-sub">Knowledge expands upward from Unfamiliar to Scholar.</p>
            </div>
            <div className="knowledge-cone-score">
              {assessmentData ? currentDisplayScore : "--"}
              <span>{assessmentData ? currentDisplayLevel : "Not assessed"}</span>
            </div>
          </div>
          <div className="knowledge-cone-wrap">
            <div
              ref={coneRef}
              className="knowledge-cone"
              onPointerEnter={handleConePointerEnter}
              onPointerMove={handleConePointerMove}
              onPointerLeave={handleConePointerLeave}
              style={{"--marker-y": `${coneMarkerPercent(currentDisplayScore)}`} as { [key: string]: string }}
            >
              <div className="glass-vessel" aria-hidden="true">
                <div
                  key={`water-${currentDisplayScore}-${assessmentData?.answered ?? 0}`}
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
                    className={`cone-tier ${assessmentData && currentDisplayLevel === band.name ? "is-active" : ""} ${expandedConeLayer === band.name ? "is-expanded" : ""}`}
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
              {assessmentData && (
                <div className="cone-marker" aria-label={`Current BLI ${currentDisplayScore}, ${currentDisplayLevel}`}>
                  <span>{currentDisplayScore}</span>
                  <span className="cone-marker-dot" />
                </div>
              )}
            </div>
            {!assessmentData && (
              <p className="cone-empty-note">Take an assessment to place your score on the cone.</p>
            )}
          </div>
        </section>

        <section className="recommended-card" aria-label="Recommended reading">
          <div>
            <p className="recommended-eyebrow">Recommendation &amp; review</p>
            <h2 className="recommended-title">{recommendedStudy.label}</h2>
            <p className="recommended-books">{recommendedStudy.books}</p>
            <p className="recommended-focus">{recommendedStudy.focus}</p>
          </div>
          <div className="recommended-side">
            <p className="recommended-priority">{recommendedStudy.priority}</p>
            {backendRecommendation && (
              <button
                type="button"
                className="scope-text-btn"
                onClick={() => void openScopeDetail({
                  scopeType: "UNIT",
                  scopeKey: backendRecommendation.unit_key,
                  unitKey: backendRecommendation.unit_key,
                  label: backendRecommendation.label,
                  subtitle: `${backendRecommendation.section} · ${BOOK_NAMES[backendRecommendation.book_code] ?? backendRecommendation.book_code}`,
                })}
              >
                View learning details
              </button>
            )}
            <div className="recommended-actions">
              <Link className="recommended-action" href={recommendedStudy.actionHref} onClick={handleRecommendedAction}>
                {recommendedStudy.actionLabel}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                </svg>
              </Link>
              {progressHistory[0]?.attempt_id && (
                <Link className="recommended-review" href={`/results/${progressHistory[0].attempt_id}`}>
                  Review recent assessment <span aria-hidden="true">›</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        <div className="breakdown-head">
          <p className="section-eyebrow">BLI profile</p>
          <div className="breakdown-tabs" role="tablist" aria-label="BLI profile breakdown">
            {[
              { key: "sections", label: "Sections" },
              { key: "books", label: "Books" },
              { key: "domains", label: "Domains" },
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
        <p className="breakdown-note">
          {activeBreakdownTab === "sections" && "Scoped BLI uses the same guess-discounted evidence as the main score, grouped by canon and OT section."}
          {activeBreakdownTab === "books" && "Book scores are useful once there are several answered questions in that book; low-evidence cards are intentionally muted."}
          {activeBreakdownTab === "domains" && "Dimensions show the kind of knowledge being tested. Cross Ref unlocks after baseline competence in Torah and Former Prophets."}
        </p>
        {activeBreakdownTab === "domains" ? (() => {
          const center = 160;
          const radius = 104;
          const labelRadius = 152;
          const scores = scopeScores.domains;
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
            <section className="domain-radar-card" aria-label="BLI dimension radar chart">
              <div className="domain-radar-wrap">
                <svg ref={radarSvgRef} className="domain-radar-svg" viewBox="0 0 320 320" role="img" aria-label="Dimension scores radar chart">
                  {[0.2, 0.4, 0.6, 0.8, 1].map(level => (
                    <polygon key={level} className="radar-ring" points={polygonFor(radius * level)} />
                  ))}
                  {scores.map((score, index) => {
                    const end = pointFor(index, radius);
                    const label = pointFor(index, labelRadius);
                    const isLockedConnection = score.key === "domain:scripture_connections" && !scriptureConnectionsUnlocked;
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
                  <h3 className="domain-radar-title">Knowledge by Dimension</h3>
                  <p className="domain-radar-copy">
                    This profile shows the kinds of Old Testament knowledge being tested. Cross Ref stays locked until the earlier foundation is stable enough for cross-reference questions.
                  </p>
                </div>
                <div className="domain-radar-list">
                  {scores.map(score => {
                    const isLockedConnection = score.key === "domain:scripture_connections" && !scriptureConnectionsUnlocked;
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
          <div className={`sections-grid ${activeBreakdownTab} ${activeBreakdownTab === "sections" && prophetsExpanded ? "is-prophets-expanded" : ""}`}>
            {visibleBreakdownScores.map(s => {
              const hasScore = s.rawScore !== null && s.answered > 0;
              const isProphetsParent = activeBreakdownTab === "sections" && s.key === "prophets";
              const isProphetsChild = activeBreakdownTab === "sections" && (s.key === "former" || s.key === "latter");
              const assessmentHref = assessmentHrefForScore(s);
              const fillColor = s.className === "torah" ? "linear-gradient(90deg,#d4a017,#f5c842)"
                : s.className === "former" ? "linear-gradient(90deg,#0e8c6a,#34d399)"
                : s.className === "latter" ? "linear-gradient(90deg,#2563c4,#60a5fa)"
                : s.className === "writings" ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
                : s.className === "prophets" ? "linear-gradient(90deg,#0e8c6a,#2563c4)"
                : s.className === "ot" ? "linear-gradient(90deg,#0aa3a3,#d4a017,#2563c4,#7c3aed)"
                : "linear-gradient(90deg,#0aa3a3,#67e8f9)";
              return (
                <article
                  key={s.key}
                  className={`section-card ${s.className} ${isProphetsParent ? "prophets-parent" : ""} ${isProphetsParent && prophetsExpanded ? "is-expanded" : ""} ${isProphetsChild ? "prophet-child" : ""} ${hasScore ? "has-score" : ""} ${s.confidence === "low" || s.confidence === "none" ? "low-evidence" : ""}`}
                >
                  <button
                    type="button"
                    className="section-card-main"
                    aria-expanded={isProphetsParent ? prophetsExpanded : undefined}
                    onClick={() => {
                      if (isProphetsParent) {
                        setProphetsExpanded(expanded => !expanded);
                        return;
                      }
                      void openScopeDetail(detailTargetForScore(s));
                    }}
                  >
                    <div className="sc-top">
                      <div>
                        {isProphetsChild && <div className="sc-parent-label">Prophets</div>}
                        <div className="sc-name">{s.label}</div>
                        <div className="sc-books">{s.subtitle}</div>
                      </div>
                      <div className="sc-pct-empty" style={{color: hasScore ? "#1b2442" : undefined}}>
                        {hasScore ? s.displayScore : "--"}
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
                    {assessmentHref ? (
                      <Link className="sc-test-link" href={assessmentHref}>
                        {hasScore ? "Retest" : "Test"}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                        </svg>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="sc-test-link"
                        aria-expanded={prophetsExpanded}
                        onClick={() => setProphetsExpanded(expanded => !expanded)}
                      >
                        {prophetsExpanded ? "Hide sections" : "Choose section"}
                        <svg className="sc-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m6 9 6 6 6-6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
          </>
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
                      <span className="scope-evidence-label">{scopeSummary.evidence_level}</span>
                      <p className="scope-evidence-copy">
                        {scopeSummary.evidence_level === "Needs more evidence" || scopeSummary.evidence_level === "Low evidence"
                          ? "The sample is still small, so accuracy may move substantially."
                          : "There is enough response evidence for this scope to be more informative."}
                      </p>
                    </div>
                    <div className="scope-evidence-score">
                      {scopeSummary.accuracy === null ? "--" : `${Math.round(scopeSummary.accuracy)}%`}
                      <span>
                        {scopeSummary.evidence_level === "Needs more evidence" || scopeSummary.evidence_level === "Low evidence"
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
