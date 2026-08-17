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
import { HOME_PAGE_STYLES } from "./homeStyles";
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

import {
  SKY_SEED_KEY,
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  OT_ATTEMPT_ID_KEY,
  NT_ATTEMPT_ID_KEY,
  RECOMMENDATION_RETEST_WAIT_MS,
  isAnonymousSession,
  clearAssessmentBrowserStorage,
  readSessionAssessmentData,
  createSeededRandom,
  getOrCreateSkySeed,
  coneMarkerPercent,
  formatProgressDate,
  formatScoreChange,
  mergeKnowledgeGapGuidance,
  detailTargetForScore,
  assessmentHrefForScore,
  dimensionDisplayName,
  sectionNameForBook,
  classNameForSection,
  confidenceForAnswers,
  scoreEvidence,
  buildScopeScores,
  canonicalBliForSectionScope,
  applyCanonicalBliToSectionScopes,
  evidenceLabel,
  hasBaselineEvidence,
  getRecommendedStudy,
  loadDimensionAwareQuestionBank,
  DASHBOARD_SUBJECTS,
  type SectionScoreMap,
  type BreakdownTab,
  type ScopeKind,
  type ScopeScore,
  type ScopeSummary,
  type ScopeDetailTarget,
  type BankRow,
  type AnswerRow,
  type BackendRecommendation,
  type BliEvidence,
  type BliSectionFollowup,
  type ProgressPoint,
  type NtPilotSummary,
  type KnowledgeGapResource,
  type KnowledgeGapGuidance,
  type KnowledgeGapGuidanceOverride,
} from "./homeHelpers";

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
      <style>{HOME_PAGE_STYLES}</style>
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
