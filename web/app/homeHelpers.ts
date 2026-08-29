// Real helper functions for the home dashboard: session-storage bookkeeping,
// score/date formatting, and the scope-score/recommendation computation that
// turns raw answer rows into what the dashboard displays. Types now live in
// ./homeTypes, small constants in ./homeConstants, and the knowledge-gap
// guidance content in ./homeKnowledgeGapGuidance — this file is left with
// just the functions. No behavior change from the original
// app/page.tsx-extraction intent, just a further split of what had become
// its own grab-bag.

import { loadPublicQuestionMetadata } from "@/lib/supabase/questionMetadata";
import { clearPendingTransfer } from "@/lib/auth/anonymousTransfer";
import { BLI_LEVELS, toDisplayScore } from "@/lib/bli";
import {
  FOLLOWUP_ASSESSMENT_TARGET,
  NT_PILOT_ENABLED,
} from "./assess/constants";
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
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  OT_ATTEMPT_ID_KEY,
  NT_ATTEMPT_ID_KEY,
} from "@/lib/assessmentSessionKeys";
import type {
  AnswerRow,
  BankRow,
  RecommendedStudy,
  ScopeDetailTarget,
  ScopeKind,
  ScopeScore,
  SectionScoreMap,
} from "./homeTypes";

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
  if (score.testament === "NT" && !NT_PILOT_ENABLED) return null;

  if (score.kind === "canon") {
    const targetParam = score.answered > 0
      ? `&target=${FOLLOWUP_ASSESSMENT_TARGET}`
      : "";
    return score.testament === "NT"
      ? `/assess?testament=NT&scope=NT${targetParam}`
      : score.answered > 0
        ? `/assess?target=${FOLLOWUP_ASSESSMENT_TARGET}`
        : "/assess";
  }

  if (score.testament === "NT") {
    if (score.kind === "domain") return null;
    const params = new URLSearchParams({
      testament: "NT",
      scope: score.backendScopeKey,
      target: String(FOLLOWUP_ASSESSMENT_TARGET),
    });
    return `/assess?${params.toString()}`;
  }

  const params = new URLSearchParams({
    mode: "scope",
    label: score.label,
    target: String(FOLLOWUP_ASSESSMENT_TARGET),
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
      target: String(FOLLOWUP_ASSESSMENT_TARGET),
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
    actionHref: `/assess?target=${FOLLOWUP_ASSESSMENT_TARGET}`,
    actionLabel: "Continue assessment",
  };
}
