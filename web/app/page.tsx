"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/lib/supabase/client";
import { beginPendingTransfer, clearPendingTransfer, newFlowId } from "@/lib/auth/anonymousTransfer";
import { authCallbackUrl } from "@/lib/auth/redirect";
import { BLI_LEVELS, levelForScore, toDisplayScore } from "@/lib/bli";
import {
  EMPTY_EXPLORE_TREE,
  EMPTY_FOCUS_PATH,
  loadExploreTree,
  loadFocusPath,
  type ExploreTree,
  type FocusPath,
} from "@/lib/focusPath";
import { type CoverageGridView } from "./knowledge-map/CoverageGrid";
import ReadingLogWidget from "./ReadingLogWidget";
import StarfieldRewardsLayer from "@/components/StarfieldRewardsLayer";
import { useHomeStarfield } from "./useHomeStarfield";
import { HOME_PAGE_STYLES } from "./homeStyles";
import {
  DeleteAccountModal,
  KnowledgeConePanel,
  KnowledgeProfilePanel,
  ProgressOverTimePanel,
  RetestConfirmModal,
  ScopeDetailDrawer,
} from "./homePanels";
import {
  normalizeBliContractRow,
  type BliContractScores,
} from "@/lib/bliContract";
import {
  leastEvidenceSection,
  sectionEvidence,
} from "@/lib/bliEvidence";
import {
  BOOK_NAMES,
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
  isAnonymousSession,
  clearAssessmentBrowserStorage,
  readSessionAssessmentData,
  coneMarkerPercent,
  dimensionDisplayName,
  buildScopeScores,
  applyCanonicalBliToSectionScopes,
  hasBaselineEvidence,
  getRecommendedStudy,
  loadDimensionAwareQuestionBank,
} from "./homeHelpers";
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  RECOMMENDATION_RETEST_WAIT_MS,
} from "./homeConstants";
import { mergeKnowledgeGapGuidance } from "./homeKnowledgeGapGuidance";
import {
  type SectionScoreMap,
  type BreakdownTab,
  type DashboardTab,
  type AssessmentSnapshot,
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
} from "./homeTypes";
import {
  HomeNavBar,
  DashboardHeader,
  DashboardTabsBar,
  FirstAssessmentCard,
  SaveResultsCard,
  ScoreStrip,
  ScorePanelTriggers,
  CoverageMapSection,
  PlaceholderDashboard,
} from "./homeDashboard";

export default function HomePage() {
  // ---------------------------------------------------------------------------
  // State & refs
  // ---------------------------------------------------------------------------
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
  const [assessmentData, setAssessmentData] = useState<AssessmentSnapshot | null>(null);
  const [sessionAssessmentData, setSessionAssessmentData] = useState<AssessmentSnapshot | null>(null);
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
  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>("bli");
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
  // ---------------------------------------------------------------------------
  // Derived display values: current BLI score, level, and knowledge-cone fill
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Initial hydration from browser storage (signed-out session snapshot, NT
  // pilot summary)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Recommendation engine: what to study next, and the copy/links to show for
  // it (evidence-gap interstitial, backend unit/dimension recommendation, or
  // the local fallback in getRecommendedStudy)
  // ---------------------------------------------------------------------------
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
  // ---------------------------------------------------------------------------
  // Knowledge-profile breakdown scores & progress-over-time chart data
  // ---------------------------------------------------------------------------
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
  // ---------------------------------------------------------------------------
  // Coverage-map mode & assessment-completion status
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Recommendation view/interaction tracking (analytics)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Scope-detail drawer & score-panel open/close handling
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Recommendation click-through & retest confirmation
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Score-strip tooltip hover handling (BLI info popover, level popover)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Knowledge-cone water-slosh interaction
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Auth: sign in / sign out / delete account
  // ---------------------------------------------------------------------------
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

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
    clearAssessmentBrowserStorage();
    setUserEmail(null);
    setAssessmentData(null);
    setTestamentScores(null);
    setSectionScores({});
    setScopeScores(buildScopeScores([], []));
    setBackendRecommendation(null);
  };

  const handleDeleteAccountRequest = () => {
    setAccountMenuOpen(false);
    setDeleteConfirm("");
    setDeleteError(null);
    setDeleteOpen(true);
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

  // ---------------------------------------------------------------------------
  // Dashboard bootstrap: session, canonical BLI scores, and recommendation
  // data, all loaded together once a user id is known
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Knowledge-map / coverage-map / progress-history data loads
  // ---------------------------------------------------------------------------
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

  const { canvasRef } = useHomeStarfield({
    activeBreakdownTab,
    profileTestament,
    domainScores: scopeScores.domains,
    scriptureConnectionsUnlocked,
  });

  return (
    <>
      <style>{HOME_PAGE_STYLES}</style>
      <canvas ref={canvasRef} className="stars" aria-hidden="true" />
      <StarfieldRewardsLayer userId={dashboardUserId} />

      {deleteOpen && userEmail && (
        <DeleteAccountModal
          userEmail={userEmail}
          deleteBusy={deleteBusy}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          deleteError={deleteError}
          setDeleteOpen={setDeleteOpen}
          handleDeleteAccount={handleDeleteAccount}
        />
      )}

      <HomeNavBar
        userEmail={userEmail}
        accountMenuOpen={accountMenuOpen}
        accountMenuRef={accountMenuRef}
        setAccountMenuOpen={setAccountMenuOpen}
        learnMoreOpen={learnMoreOpen}
        learnMoreRef={learnMoreRef}
        setLearnMoreOpen={setLearnMoreOpen}
        handleSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onDeleteAccountRequest={handleDeleteAccountRequest}
      />

      <main className={`page ${isNewAssessmentLanding ? "is-new-assessment-landing" : ""} ${isDashboardLoading ? "is-dashboard-loading" : ""}`}>
        {!isNewAssessmentLanding && !isDashboardLoading && (
          <DashboardHeader
            activeDashboardTab={activeDashboardTab}
            setActiveDashboardTab={setActiveDashboardTab}
            subjectMenuOpen={subjectMenuOpen}
            setSubjectMenuOpen={setSubjectMenuOpen}
            subjectMenuRef={subjectMenuRef}
            dashboardHydrated={dashboardHydrated}
            testamentScores={testamentScores}
            visibleAssessmentData={visibleAssessmentData}
            suiteTestament={suiteTestament}
            setSuiteTestament={setSuiteTestament}
          />
        )}

        {!hasCompletedAssessment && !isDashboardLoading && (
          <DashboardTabsBar
            activeDashboardTab={activeDashboardTab}
            setActiveDashboardTab={setActiveDashboardTab}
          />
        )}

        {activeDashboardTab === "bli" ? (
          !dashboardHydrated ? (
            <section className="dashboard-loading-card" aria-label="Loading dashboard" aria-live="polite">
              <div className="dashboard-loading-orbit" aria-hidden="true" />
              <span className="dashboard-loading-sr">Loading your dashboard</span>
            </section>
          ) : !hasCompletedAssessment ? (
            <>
              <FirstAssessmentCard
                inProgressTestament={inProgressTestament}
                firstAssessmentChooserOpen={firstAssessmentChooserOpen}
                setFirstAssessmentChooserOpen={setFirstAssessmentChooserOpen}
              />
            </>
          ) : (
          <>
        {!userEmail && visibleAssessmentData && (
          <SaveResultsCard handleSignIn={handleSignIn} />
        )}


        <ScoreStrip
          suiteTestament={suiteTestament}
          currentDisplayScore={currentDisplayScore}
          currentDisplayLevel={currentDisplayLevel}
          currentDisplayBand={currentDisplayBand}
          bliEvidence={bliEvidence}
          testamentScores={testamentScores}
          ntBliEvidence={ntBliEvidence}
          combinedBliEvidence={combinedBliEvidence}
          visibleAssessmentData={visibleAssessmentData}
          userEmail={userEmail}
          showLevelTooltip={showLevelTooltip}
          setShowLevelTooltip={setShowLevelTooltip}
          cancelLevelTooltipClose={cancelLevelTooltipClose}
          closeLevelTooltipSoon={closeLevelTooltipSoon}
          showBliTooltip={showBliTooltip}
          setShowBliTooltip={setShowBliTooltip}
          openBliTooltip={openBliTooltip}
          closeBliTooltipSoon={closeBliTooltipSoon}
          showEvidenceTooltip={showEvidenceTooltip}
          setShowEvidenceTooltip={setShowEvidenceTooltip}
          handleSignIn={handleSignIn}
        />

        <ScorePanelTriggers
          knowledgeProfileOpen={knowledgeProfileOpen}
          setKnowledgeProfileOpen={setKnowledgeProfileOpen}
          progressPanelOpen={progressPanelOpen}
          setProgressPanelOpen={setProgressPanelOpen}
          conePanelOpen={conePanelOpen}
          setConePanelOpen={setConePanelOpen}
        />

        {knowledgeProfileOpen && (
          <KnowledgeProfilePanel
            activeBreakdownTab={activeBreakdownTab}
            setActiveBreakdownTab={setActiveBreakdownTab}
            profileTestament={profileTestament}
            visibleBreakdownScores={visibleBreakdownScores}
            openScopeDetail={openScopeDetail}
          />
        )}

        {progressPanelOpen && (
          <ProgressOverTimePanel
            progressHistory={progressHistory}
            progressTestament={progressTestament}
            progressLoading={progressLoading}
            progressError={progressError}
            plottedProgress={plottedProgress}
            progressAxisLabels={progressAxisLabels}
            progressAreaPath={progressAreaPath}
            progressPath={progressPath}
            activeProgressPoint={activeProgressPoint}
            setActiveProgressAttemptId={setActiveProgressAttemptId}
            progressXAxisLabels={progressXAxisLabels}
          />
        )}

        {conePanelOpen && (
          <KnowledgeConePanel
            activeHasScore={activeHasScore}
            activeDisplayScore={activeDisplayScore}
            activeDisplayLevel={activeDisplayLevel}
            coneRef={coneRef}
            handleConePointerEnter={handleConePointerEnter}
            handleConePointerMove={handleConePointerMove}
            handleConePointerLeave={handleConePointerLeave}
            waterFillPercent={waterFillPercent}
            suiteTestament={suiteTestament}
            expandedConeLayer={expandedConeLayer}
            setExpandedConeLayer={setExpandedConeLayer}
          />
        )}

        <ReadingLogWidget userId={dashboardUserId} />

        {coverageTree.sections.length > 0 && (
          <CoverageMapSection
            coverageTree={coverageTree}
            activeCoverageMapMode={activeCoverageMapMode}
            setCoverageMapMode={setCoverageMapMode}
            suiteTestament={suiteTestament}
            coverageModeCopy={coverageModeCopy}
            hasReadingRecommendation={hasReadingRecommendation}
            frontier={frontier}
            backendRecommendation={backendRecommendation}
            knowledgeGapEyebrow={knowledgeGapEyebrow}
            isBackendRecommendationShown={isBackendRecommendationShown}
            recommendedStudy={recommendedStudy}
            recommendedGuidanceLabel={recommendedGuidanceLabel}
            recommendedGuidanceSteps={recommendedGuidanceSteps}
            recommendedResources={recommendedResources}
            progressHistory={progressHistory}
            openScopeDetail={openScopeDetail}
            recordRecommendationView={recordRecommendationView}
            handleRecommendedAction={handleRecommendedAction}
            router={router}
          />
        )}

          </>
          )
        ) : (
          <PlaceholderDashboard activeDashboardTab={activeDashboardTab} />
        )}
      </main>
      <SiteFooter />
      {scopeDetailTarget && (
        <ScopeDetailDrawer
          scopeDetailTarget={scopeDetailTarget}
          closeScopeDetail={closeScopeDetail}
          scopeSummaryLoading={scopeSummaryLoading}
          scopeSummaryError={scopeSummaryError}
          scopeSummary={scopeSummary}
          backendRecommendation={backendRecommendation}
          recommendedStudy={recommendedStudy}
          handleRecommendedAction={handleRecommendedAction}
        />
      )}
      {pendingRetestHref && (
        <RetestConfirmModal setPendingRetestHref={setPendingRetestHref} continuePendingRetest={continuePendingRetest} />
      )}
    </>
  );
}
