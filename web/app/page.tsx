"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/lib/supabase/client";
import { BLI_LEVELS, levelForScore, toDisplayScore } from "@/lib/bli";
import {
  EMPTY_EXPLORE_TREE,
  EMPTY_FOCUS_PATH,
  loadExploreTree,
  loadFocusPath,
  type ExploreBook,
  type ExploreSection,
  type ExploreTree,
  type ExploreUnit,
  type FocusPath,
} from "@/lib/focusPath";
import { type CoverageGridView } from "./knowledge-map/CoverageGrid";
import ReadingLogWidget from "./ReadingLogWidget";
import ScoreMilestone from "@/components/ScoreMilestone";
import StarfieldRewardsLayer from "@/components/StarfieldRewardsLayer";
import { detectScoreMilestone, type ScoreMilestoneResult } from "@/lib/scoreMilestone";
import Starfield from "@/components/Starfield";
import { useNavMenus } from "./useNavMenus";
import { useScoreTooltips } from "./useScoreTooltips";
import { useConeSlosh } from "./useConeSlosh";
import { useDomainConstellation } from "./useDomainConstellation";
import { useHomeAccountActions } from "./useHomeAccountActions";
import { useProgressChart } from "./useProgressChart";
import { useProgressHistory } from "./useProgressHistory";
import { HOME_PAGE_STYLES } from "./homeStyles";
import {
  NT_PILOT_ENABLED,
  TOTAL_INITIAL,
} from "./assess/constants";
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
  SECTION_INTERPRETATION_FLOOR,
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
  SAVE_PROMPT_DISMISSED_KEY,
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
  type NtPilotSummary,
} from "./homeTypes";
import {
  HomeNavBar,
  DashboardHeader,
  DashboardTabsBar,
  FirstAssessmentCard,
  SaveResultsModal,
  ScoreStrip,
  ScorePanelTriggers,
  CoverageMapSection,
  PlaceholderDashboard,
} from "./homeDashboard";

const OT_RECOMMENDATION_SECTION_LABELS = ["Torah", "Former Prophets", "Latter Prophets", "Writings"] as const;
const OT_RECOMMENDATION_SECTION_SCOPES: Record<(typeof OT_RECOMMENDATION_SECTION_LABELS)[number], string> = {
  Torah: "torah",
  "Former Prophets": "former",
  "Latter Prophets": "latter",
  Writings: "writings",
};

function clearCoverageTreeRecommendation(tree: ExploreTree): ExploreTree {
  return {
    sections: tree.sections.map((section): ExploreSection => ({
      ...section,
      isFocus: false,
      books: section.books.map((book): ExploreBook => ({
        ...book,
        isFocus: false,
        units: book.units.map((unit): ExploreUnit => ({ ...unit, isFocus: false })),
      })),
    })),
  };
}

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
  // Account controls collapse behind the email; a click opens the menu.
  const {
    accountMenuOpen,
    setAccountMenuOpen,
    accountMenuRef,
    learnMoreOpen,
    setLearnMoreOpen,
    learnMoreRef,
    subjectMenuOpen,
    setSubjectMenuOpen,
    subjectMenuRef,
  } = useNavMenus();
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
  const {
    showBliTooltip,
    setShowBliTooltip,
    showEvidenceTooltip,
    setShowEvidenceTooltip,
    showLevelTooltip,
    setShowLevelTooltip,
    openBliTooltip,
    closeBliTooltipSoon,
    cancelLevelTooltipClose,
    closeLevelTooltipSoon,
  } = useScoreTooltips(suiteTestament);
  const [expandedConeLayer, setExpandedConeLayer] = useState<string | null>(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>("bli");
  const [coverageMapMode, setCoverageMapMode] = useState<CoverageGridView>("recommended");
  const [backendRecommendation, setBackendRecommendation] = useState<BackendRecommendation | null>(null);
  const [sectionFollowup, setSectionFollowup] = useState<BliSectionFollowup | null>(null);
  const [bliEvidence, setBliEvidence] = useState<BliEvidence | null>(null);
  const [ntBliEvidence, setNtBliEvidence] = useState<BliEvidence | null>(null);
  const [combinedBliEvidence, setCombinedBliEvidence] = useState<BliEvidence | null>(null);
  const progressTestament = suiteTestament;
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
  // Starts dismissed so the popup cannot flash before the effect below has
  // read the real answer out of sessionStorage.
  const [savePromptDismissed, setSavePromptDismissed] = useState(true);
  const scopeRequestRef = useRef(0);
  // Guards ONE in-flight explicit recommendation interaction so a double-click
  // or a concurrent handler cannot start a second logical event. It is not a
  // correctness guard for duplicates: the interaction UUID plus the database
  // partial unique index is what makes recording exactly-once.
  const recommendationInteractionRef = useRef<string | null>(null);
  const { coneRef, handleConePointerEnter, handleConePointerMove, handleConePointerLeave } = useConeSlosh();
  const {
    activeProgressAttemptId,
    progressError,
    progressHistory,
    progressLoading,
    setActiveProgressAttemptId,
  } = useProgressHistory(dashboardUserId, progressTestament);

  /**
   * Crossing a hundred, celebrated once.
   *
   * Two gates, doing different jobs. `obs_dashboard_arriving` is set by
   * useDashboardTransition when a round hands off to the dashboard, so the
   * moment only fires on the way back from answering questions and never on
   * an ordinary visit — it was being written and never read until now, so it
   * is cleared here as it is consumed. The localStorage key is the durable
   * one: it survives reloads, so a refresh on the dashboard cannot replay the
   * celebration for an attempt already seen.
   *
   * Both are deliberately checked after the history has loaded, or the
   * arriving flag would be spent on the first empty render.
   */
  const [milestone, setMilestone] = useState<ScoreMilestoneResult | null>(null);

  useEffect(() => {
    if (!progressHistory.length) return;
    if (sessionStorage.getItem("obs_dashboard_arriving") !== "1") return;
    sessionStorage.removeItem("obs_dashboard_arriving");

    const found = detectScoreMilestone(progressHistory);
    if (!found) return;

    const key = `obs_milestone_seen:${found.attemptId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // A browser with storage blocked still gets the moment; it just cannot
      // remember that it happened. Better than swallowing it entirely.
    }
    setMilestone(found);
  }, [progressHistory]);

  /**
   * Preview the milestone overlay without earning one:
   *
   *   /?milestone=demo      587 -> 602, the plain crossing
   *   /?milestone=499-513   crosses 500 and changes band, so the band is named
   *   /?milestone=587-599   no crossing, so nothing shows (also worth seeing)
   *
   * It runs the real detectScoreMilestone over a fabricated history rather
   * than hand-building a result, so previewing exercises the same rules the
   * live path does — a pair that should not celebrate will not celebrate here
   * either.
   *
   * Deliberately writes nothing: no seen-key, and it never touches
   * obs_dashboard_arriving. Previewing cannot burn a real celebration, and a
   * real one cannot be hidden by having previewed.
   */
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("milestone");
    if (!raw) return;
    const pair = /^(\d{1,3})-(\d{1,3})$/.exec(raw);
    const from = pair ? Number(pair[1]) : 587;
    const to = pair ? Number(pair[2]) : 602;
    const demo = detectScoreMilestone([
      { attempt_id: "milestone-demo", display_bli: to, bli_level: levelForScore(to) },
      { attempt_id: "milestone-demo-prev", display_bli: from, bli_level: levelForScore(from) },
    ]);
    if (demo) setMilestone(demo);
  }, []);
  const {
    deleteBusy,
    deleteConfirm,
    deleteError,
    deleteOpen,
    handleDeleteAccount,
    handleDeleteAccountRequest,
    handleSignIn,
    handleSignOut,
    setDeleteConfirm,
    setDeleteOpen,
  } = useHomeAccountActions({
    setAccountMenuOpen,
    setAssessmentData,
    setBackendRecommendation,
    setScopeScores,
    setSectionScores,
    setTestamentScores,
    setUserEmail,
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

  // ---------------------------------------------------------------------------
  // Initial hydration from browser storage (signed-out session snapshot, NT
  // pilot summary)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setSessionAssessmentData(readSessionAssessmentData());
    setSavePromptDismissed(sessionStorage.getItem(SAVE_PROMPT_DISMISSED_KEY) === "1");
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
  const recommendationEvidence = useMemo(() => {
    const otSections = OT_RECOMMENDATION_SECTION_LABELS.map(label => {
      const score = scopeScores.sections.find(section => (
        section.testament === "OT"
        && section.kind === "section"
        && section.label === label
      ));
      const answered = score?.answered ?? 0;
      return {
        label,
        answered,
        answersNeeded: Math.max(0, SECTION_INTERPRETATION_FLOOR - answered),
      };
    });
    const weakestSection = [...otSections].sort((left, right) => (
      left.answered - right.answered
      || OT_RECOMMENDATION_SECTION_LABELS.indexOf(left.label) - OT_RECOMMENDATION_SECTION_LABELS.indexOf(right.label)
    ))[0];
    return {
      canRecommend: otSections.every(section => section.answersNeeded === 0),
      answersNeeded: otSections.reduce((sum, section) => sum + section.answersNeeded, 0),
      weakestSection,
    };
  }, [scopeScores.sections]);
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
  const isRecommendationEvidenceBlocked = Boolean(visibleAssessmentData) && !recommendationEvidence.canRecommend;
  // This card used to say "not enough evidence yet" four times over - in the
  // eyebrow, the title, the meta line and again in a two-sentence paragraph -
  // and then put the one fact a reader actually needs (how many answers are
  // left) in small print off to the side. The count is now the headline, the
  // meta line says where to spend those answers, and the paragraph is gone.
  const uncertaintyRecommendation = visibleAssessmentData && isRecommendationEvidenceBlocked ? {
    label: `${recommendationEvidence.answersNeeded} more ${recommendationEvidence.answersNeeded === 1 ? "answer" : "answers"}`,
    books: `Start with ${recommendationEvidence.weakestSection.label}`,
    actionHref: `/assess?${new URLSearchParams({
      mode: "scope",
      label: uncertaintyFollowup?.label ?? recommendationEvidence.weakestSection.label,
      scope: uncertaintyFollowup?.scopeKey ?? OT_RECOMMENDATION_SECTION_SCOPES[recommendationEvidence.weakestSection.label],
      target: String(uncertaintyFollowup?.target ?? Math.max(5, recommendationEvidence.weakestSection.answersNeeded)),
    }).toString()}`,
    actionLabel: "Continue assessment",
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
      // With a dimension, show just the dimension name (e.g. "Law"). Without
      // one, keep the card compact: passage, section, and one sentence about
      // why the dimension is still pending.
      label: hasDimensionTarget && dimensionName
        ? dimensionName
        : backendRecommendation.label,
      books: hasDimensionTarget
        ? `${bookName} · ${backendRecommendation.label}`
        : `${backendRecommendation.section} · dimension pending`,
      focus: hasDimensionTarget
        ? (backendRecommendation.dimension_focus_text
          ?? `Test ${dimensionName?.toLowerCase() ?? "this dimension"} questions inside ${backendRecommendation.label}. The passage is the context; the gap is the dimension.`)
        : "Answer a short focused set so OBA can name the weakest dimension here.",
      priority: hasDimensionTarget && backendRecommendation.dimension_display_score
        ? `${backendRecommendation.dimension_display_score} BLI · ${backendRecommendation.dimension_answered ?? 0} ${dimensionName ?? "dimension"} answers`
        : backendRecommendation.display_score
        ? `${backendRecommendation.display_score} BLI in this passage`
        : "Needs focused answers before a dimension gap can be named",
      actionHref: `/assess?${params.toString()}`,
      actionLabel: hasDimensionTarget && dimensionName ? `Retest ${dimensionName}` : "Narrow the gap",
      guidanceLabel: dimensionGuidance?.label,
      guidanceSteps: dimensionGuidance?.steps ?? [],
      resources: dimensionGuidance?.resources ?? [],
    };
  })() : getRecommendedStudy(sectionScores, !!visibleAssessmentData, scopeScores.books));
  const isBackendRecommendationShown = !isRecommendationEvidenceBlocked && Boolean(backendRecommendation);
  const knowledgeGapEyebrow = isRecommendationEvidenceBlocked
    ? "Before recommendations"
    : backendRecommendation?.dimension_key
      ? "Dimension gap"
      : backendRecommendation
        ? "Next focus"
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
  const {
    activeProgressPoint,
    plottedProgress,
    progressAreaPath,
    progressAxisLabels,
    progressPath,
    progressXAxisLabels,
  } = useProgressChart(progressHistory, activeProgressAttemptId);
  // ---------------------------------------------------------------------------
  // Coverage-map mode & assessment-completion status
  // ---------------------------------------------------------------------------
  const hasReadingRecommendation = !isRecommendationEvidenceBlocked && Boolean(frontier.focusLeaf);
  const visibleCoverageTree = useMemo(
    () => (isRecommendationEvidenceBlocked ? clearCoverageTreeRecommendation(coverageTree) : coverageTree),
    [coverageTree, isRecommendationEvidenceBlocked],
  );
  const activeCoverageMapMode: CoverageGridView = suiteTestament === "OT"
    ? (coverageMapMode === "recommended" && !hasReadingRecommendation && !isRecommendationEvidenceBlocked ? "overview" : coverageMapMode)
    : "overview";
  const coverageModeCopy = suiteTestament === "NT"
    ? (NT_PILOT_ENABLED
      ? "Every New Testament chapter, ready for NT recommendations when that engine comes online."
      : "New Testament coverage is coming soon after the V7 router is ready for the NT bank.")
    : isRecommendationEvidenceBlocked
      ? "Every Old Testament chapter in context."
    : activeCoverageMapMode === "skill"
      ? "Current focus and practice steps."
      : activeCoverageMapMode === "overview"
        ? "Every Old Testament chapter in its full section and book context."
        : "The next reading range is pulled forward; Overview snaps it back into the full map.";
  // The dashboard only switches from the "new learner" landing to full
  // results once a standard assessment is actually complete. The current
  // target is 25 questions; see app/assess/constants.ts. Anything
  // short of that is a partial attempt: leaving mid-test and coming back to
  // the dashboard should not surface a half-answered score as if it were a
  // finished result.
  const ASSESSMENT_COMPLETE_THRESHOLD = TOTAL_INITIAL;
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

  // ---------------------------------------------------------------------------
  // Save-progress prompt: popup first, inline card after it is closed
  // ---------------------------------------------------------------------------
  // A signed-out learner whose result exists only in this browser meets the
  // ask as a popup. Closing it does not drop the ask - the save-progress slot
  // in the score strip, right beside the BLI, keeps it one click away without
  // holding the dashboard hostage. There used to be a second full-width card
  // above the strip saying the same thing; two prompts for one action read as
  // nagging, so the strip slot is now the only one.
  const hasUnsavedResult = Boolean(!userEmail && visibleAssessmentData);
  const showSavePromptModal = Boolean(
    hasUnsavedResult &&
    !savePromptDismissed &&
    dashboardHydrated &&
    hasCompletedAssessment &&
    activeDashboardTab === "bli"
  );

  const dismissSavePrompt = useCallback(() => {
    sessionStorage.setItem(SAVE_PROMPT_DISMISSED_KEY, "1");
    setSavePromptDismissed(true);
  }, []);

  useEffect(() => {
    if (!showSavePromptModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissSavePrompt();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismissSavePrompt, showSavePromptModal]);

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
    //
    // Confirming "I reread it" IS recorded, as router antievidence. It is not
    // an analytics event and it never moves a score: it tells the router that
    // its standing thesis about this unit may be out of date, so v6 retests
    // the unit rather than continuing to treat old misses as current
    // weakness. See docs/router/MODES.md#antievidence.
    //
    // Fire-and-forget on purpose. The retest must never be blocked or delayed
    // by this write, and obs_mark_unit_reread already collapses repeat marks
    // within an hour, so a double-click cannot hold the unit stale.
    const unitKey = backendRecommendation?.unit_key;
    if (dashboardUserId && unitKey) {
      void supabase
        .rpc("obs_mark_unit_reread", {
          p_user_id: dashboardUserId,
          p_unit_key: unitKey,
          p_source: "retest_interstitial",
        })
        .then(({ error }) => {
          if (error) console.warn("Reread mark was not recorded:", error);
        });
    }
    window.location.href = pendingRetestHref;
  };

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
        // Only call the dashboard hydrated here when there is no session whose
        // scores are still on their way. Declaring it hydrated the moment a
        // local snapshot exists opened a window where dashboardHydrated was
        // true but testamentScores was still null, so hasCompletedAssessment
        // was computed from the thin local snapshot alone - the dashboard
        // showed "Take your first Bible assessment" to someone who already has
        // a score, then swapped in their real BLI once the fetch landed. The
        // loading card is the honest thing to show in that gap.
        if (!session?.user?.id) setDashboardHydrated(true);
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

  const constellation = useDomainConstellation({
    activeBreakdownTab,
    profileTestament,
    scopeScores: scopeScores.domains,
    scriptureConnectionsUnlocked,
  });

  return (
    <>
      <style>{HOME_PAGE_STYLES}</style>
      <Starfield variant="home" constellationActive={constellation.active} constellationPoints={constellation.points} />
      <StarfieldRewardsLayer userId={dashboardUserId} />

      {milestone && <ScoreMilestone milestone={milestone} onClose={() => setMilestone(null)} />}

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

        {/* The exact inverse of the DashboardHeader condition above, so the
            landing and the header never both render a subject control. */}
        {isNewAssessmentLanding && !isDashboardLoading && (
          <DashboardTabsBar
            activeDashboardTab={activeDashboardTab}
            setActiveDashboardTab={setActiveDashboardTab}
            subjectMenuOpen={subjectMenuOpen}
            setSubjectMenuOpen={setSubjectMenuOpen}
            subjectMenuRef={subjectMenuRef}
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

        {visibleCoverageTree.sections.length > 0 && (
          <CoverageMapSection
            coverageTree={visibleCoverageTree}
            activeCoverageMapMode={activeCoverageMapMode}
            setCoverageMapMode={setCoverageMapMode}
            suiteTestament={suiteTestament}
            coverageModeCopy={coverageModeCopy}
            hasReadingRecommendation={hasReadingRecommendation}
            frontier={frontier}
            backendRecommendation={backendRecommendation}
            knowledgeGapEyebrow={knowledgeGapEyebrow}
            isRecommendationEvidenceBlocked={isRecommendationEvidenceBlocked}
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
      {showSavePromptModal && (
        <SaveResultsModal handleSignIn={handleSignIn} dismissSavePrompt={dismissSavePrompt} />
      )}
    </>
  );
}
