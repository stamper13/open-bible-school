"use client";

import { useState, useRef } from "react";
import {
  EVIDENCE_VISUAL_STRENGTH,
  NT_PILOT_TARGET,
  TOTAL_INITIAL,
} from "./constants";
import type {
  AssessmentMode,
  BibleSkyFact,
  NtScopeOption,
  OtAssessmentRequest,
  OtAssessmentStartRow,
} from "./types";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { StarfieldHandle } from "@/components/Starfield";
import { ASSESS_PAGE_STYLES } from "./assessStyles";
import { AssessmentAtmosphere } from "./AssessmentAtmosphere";
import {
  AssessmentErrorScreen,
  BibleFactModal,
  ModeSelectScreen,
  NtCompleteScreen,
  NtStartingScreen,
  OtCompleteScreen,
  OtResultsOverlay,
  OtStartingScreen,
  ReportQuestionModal,
} from "./assessScreens";
import { FeedbackPanel, AssessNavBar, QuestionHead, QuestionInteraction } from "./assessCore";
import { deriveAssessmentDisplayState } from "./assessmentDisplayState";
import { useAssessmentAnswerFlow } from "./useAssessmentAnswerFlow";
import { useAssessmentAuthActions } from "./useAssessmentAuthActions";
import { useAssessmentQuestionLoader } from "./useAssessmentQuestionLoader";
import { useAssessmentStartup } from "./useAssessmentStartup";
import { useAssessmentSession } from "./useAssessmentSession";
import { useDashboardTransition } from "./useDashboardTransition";
import { useNtBookMetadata } from "./useNtBookMetadata";
import { useSectionSortQuestionInteraction, useSequenceQuestionInteraction } from "./useQuestionInteractions";
import { useQuestionReport } from "./useQuestionReport";
import { useStartupWaitLevel } from "./useStartupWaitLevel";

export default function AssessPage() {
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("OT");
  const [modeReady, setModeReady] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showSavePrompt] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ntScope, setNtScope] = useState<NtScopeOption>({ kind: "all", value: "ALL", label: "All New Testament", description: "Adaptive questions across all 27 New Testament books." });
  const [ntRequestedScopeKey, setNtRequestedScopeKey] = useState("NT");
  const [ntRequestedTargetCount, setNtRequestedTargetCount] = useState(NT_PILOT_TARGET);
  const [activeBibleFact, setActiveBibleFact] = useState<BibleSkyFact | null>(null);
  const [dismissedSkyDiscoveries, setDismissedSkyDiscoveries] = useState<Set<number>>(() => new Set());
  const [otRequest, setOtRequest] = useState<OtAssessmentRequest>({
    unitKey: null,
    scopeKey: null,
    bookCode: null,
    startChapter: null,
    endChapter: null,
    label: null,
    dimensionKey: null,
    targetQuestionCount: TOTAL_INITIAL,
    forceNew: false,
  });
  const [otAssessment, setOtAssessment] = useState<OtAssessmentStartRow | null>(null);
  const [otTargetCount, setOtTargetCount] = useState(TOTAL_INITIAL);
  const {
    ensureAssessmentSession,
    isSignedIn,
    loadScoreEvidence,
    scoreEvidence,
    setUserId,
    userId,
  } = useAssessmentSession();
  const {
    isSubmittingReport,
    openQuestionReport,
    qualityRating,
    reportCategory,
    reportError,
    reportStatus,
    reportText,
    resetQuestionReport,
    setReportCategory,
    setReportError,
    setReportText,
    setQualityRating,
    setShowReportModal,
    showReportModal,
    submitQuestionReport,
  } = useQuestionReport();
  const {
    ntBooks,
    ntError,
    ntMetadataLoaded,
    setNtError,
  } = useNtBookMetadata({
    assessmentMode,
    modeReady,
  });
  const sequenceSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const starfieldRef = useRef<StarfieldHandle>(null);
  const {
    activeQuestionIdRef,
    attemptId,
    beginQuestionLoad,
    clearAssessmentError,
    correctChoiceId,
    debugErrorMsg,
    errorMsg,
    finishAnswerSubmission,
    consumePrefetchedNtQuestion,
    consumePrefetchedOtQuestion,
    isCorrect,
    isLoadingNextQuestion,
    isLoadingQuestionRef,
    isQuestionInteractionLocked,
    isSubmittingAnswer,
    isSubmittingAnswerRef,
    loadNtQuestion,
    loadQuestion,
    ntTargetCount,
    ntQuestionPrefetchRef,
    otQuestionPrefetchRef,
    pendingQuestionNoticeRef,
    phase,
    prefetchNtQuestion,
    prefetchOtQuestion,
    question,
    recordChoiceFeedback,
    recordSectionSortFeedback,
    retryNotice,
    sectionSortAssignments,
    sectionSortFeedback,
    sectionSortTraditionNote,
    selectedChoice,
    sequenceOrder,
    showChangedRetryFeedback,
    showFatalAssessmentError,
    showFeedbackPhase,
    startAnswerSubmission,
    setAttemptId,
    setCorrectChoiceId,
    setDebugErrorMsg,
    setErrorMsg,
    setIsCorrect,
    setNtTargetCount,
    setPhase,
    setQuestion,
    setRetryNotice,
    setSectionSortAssignments,
    setSelectedChoice,
    setSequenceOrder,
  } = useAssessmentQuestionLoader({
    resetQuestionReport,
    setAnsweredCount,
    setNtError,
    setShowReportModal,
    starfieldRef,
  });
  const startupWaitLevel = useStartupWaitLevel(phase, assessmentMode);
  const {
    isDashboardTransitioning,
    transitionToDashboard,
  } = useDashboardTransition(starfieldRef);
  const {
    handleGoogleSignIn,
    handleMagicLink,
    handleSignOut,
  } = useAssessmentAuthActions({
    email,
    setErrorMsg,
    setSaved,
    setSaving,
    userId,
  });
  // Lifetime evidence responses drive the nebula; the in-session answered
  // counter resets each session, so the nebula uses whichever is larger.
  const nebulaAnswered = Math.max(scoreEvidence?.n_responses ?? 0, answeredCount);
  const evidenceStrength = scoreEvidence ? EVIDENCE_VISUAL_STRENGTH[scoreEvidence.evidence_level] : 0;

  const { startNtPilot } = useAssessmentStartup({
    assessmentMode,
    ensureAssessmentSession,
    loadNtQuestion,
    loadQuestion,
    loadScoreEvidence,
    modeReady,
    ntBooks,
    ntMetadataLoaded,
    ntQuestionPrefetchRef,
    ntRequestedScopeKey,
    ntRequestedTargetCount,
    ntScope,
    otQuestionPrefetchRef,
    otRequest,
    setAnsweredCount,
    setAssessmentMode,
    setAttemptId,
    setCorrectChoiceId,
    setCorrectCount,
    setDebugErrorMsg,
    setErrorMsg,
    setIsCorrect,
    setModeReady,
    setNtError,
    setNtRequestedScopeKey,
    setNtRequestedTargetCount,
    setNtScope,
    setNtTargetCount,
    setOtAssessment,
    setOtRequest,
    setOtTargetCount,
    setPhase,
    setQuestion,
    setSelectedChoice,
    setSequenceOrder,
    setUserId,
  });

  const {
    handleSectionSortDragEnd,
    sectionSortInteraction,
    sectionSortLabelsByZone,
    sectionSortReadyToSubmit,
  } = useSectionSortQuestionInteraction({
    isQuestionInteractionLocked,
    phase,
    question,
    sectionSortAssignments,
    setSectionSortAssignments,
  });

  const {
    nextQuestion,
    submitAnswer,
    submitNtAnswer,
    submitSectionSort,
  } = useAssessmentAnswerFlow({
    activeQuestionIdRef,
    answeredCount,
    assessmentMode,
    attemptId,
    beginQuestionLoad,
    clearAssessmentError,
    consumePrefetchedNtQuestion,
    consumePrefetchedOtQuestion,
    correctCount,
    finishAnswerSubmission,
    isLoadingQuestionRef,
    isQuestionInteractionLocked,
    isSubmittingAnswerRef,
    loadNtQuestion,
    loadQuestion,
    loadScoreEvidence,
    ntQuestionPrefetchRef,
    ntScope,
    ntTargetCount,
    otAssessment,
    otQuestionPrefetchRef,
    otRequest,
    otTargetCount,
    pendingQuestionNoticeRef,
    phase,
    prefetchOtQuestion,
    prefetchNtQuestion,
    question,
    recordChoiceFeedback,
    recordSectionSortFeedback,
    sectionSortAssignments,
    sectionSortInteraction,
    sequenceOrder,
    setAnsweredCount,
    setCorrectCount,
    setNtTargetCount,
    setOtTargetCount,
    setPhase,
    showChangedRetryFeedback,
    showFatalAssessmentError,
    showFeedbackPhase,
    startAnswerSubmission,
    starfieldRef,
    userId,
  });

  const {
    handleSequenceDragEnd,
    moveSequenceItem,
    submitSequenceOrder,
  } = useSequenceQuestionInteraction({
    isQuestionInteractionLocked,
    phase,
    sequenceOrder,
    setSequenceOrder,
    submitAnswer,
  });

  // Answer-choice display + nav phase/progress derived values
  const {
    accuracy,
    choiceLabel,
    displayNavPhaseLabel,
    displayNavSubLabel,
    displayProgressEnd,
    displayProgressPct,
    isSectionSortQuestion,
    isSequenceQuestion,
    isSkipped,
    isScopeOtAssessment,
    isTargetedOtAssessment,
    nebulaCount,
    nextMilestone,
    showsBookLabel,
    showsLocationLabels,
    showsTargetedOtLabel,
    visibleChoices,
  } = deriveAssessmentDisplayState({
    assessmentMode,
    answeredCount,
    correctChoiceId,
    correctCount,
    isCorrect,
    isSignedIn,
    ntScope,
    ntTargetCount,
    otAssessment,
    otRequest,
    otTargetCount,
    question,
    scoreEvidence,
    sectionSortInteraction,
    selectedChoice,
  });

  return (
    <>
      <style>{ASSESS_PAGE_STYLES}</style>

      <AssessmentAtmosphere
        assessmentMode={assessmentMode}
        answeredCount={answeredCount}
        attemptId={attemptId}
        dismissedSkyDiscoveries={dismissedSkyDiscoveries}
        evidenceStrength={evidenceStrength}
        isCorrect={isCorrect}
        isDashboardTransitioning={isDashboardTransitioning}
        nebulaAnswered={nebulaAnswered}
        nebulaCount={nebulaCount}
        phase={phase}
        questionId={question?.out_generated_question_id ?? null}
        scoreEvidence={scoreEvidence}
        setActiveBibleFact={setActiveBibleFact}
        setDismissedSkyDiscoveries={setDismissedSkyDiscoveries}
        starfieldRef={starfieldRef}
        userId={userId}
      />

      {/* Nav */}
      <AssessNavBar
        isDashboardTransitioning={isDashboardTransitioning}
        displayNavPhaseLabel={displayNavPhaseLabel}
        displayNavSubLabel={displayNavSubLabel}
        answeredCount={answeredCount}
        displayProgressPct={displayProgressPct}
        displayProgressEnd={displayProgressEnd}
        assessmentMode={assessmentMode}
        isSignedIn={isSignedIn}
        handleSignOut={handleSignOut}
        setShowResults={setShowResults}
        attemptId={attemptId}
      />

      <div className={`scene ${isDashboardTransitioning ? "dashboard-transition" : ""}`}>
        {assessmentMode === "select" && (
          <ModeSelectScreen />
        )}

        {assessmentMode === "NT" && phase === "starting" && (
          <NtStartingScreen
            isLoadingNextQuestion={isLoadingNextQuestion}
            ntRequestedScopeKey={ntRequestedScopeKey}
            ntBooks={ntBooks}
            startupWaitLevel={startupWaitLevel}
            ntError={ntError}
          />
        )}

        {assessmentMode === "OT" && phase === "starting" && (
          <OtStartingScreen isLoadingNextQuestion={isLoadingNextQuestion} startupWaitLevel={startupWaitLevel} />
        )}

        {phase === "error" && assessmentMode !== "select" && (
          <AssessmentErrorScreen
            errorMsg={errorMsg}
            debugErrorMsg={debugErrorMsg}
            attemptId={attemptId}
            setErrorMsg={setErrorMsg}
            setDebugErrorMsg={setDebugErrorMsg}
            setRetryNotice={setRetryNotice}
            assessmentMode={assessmentMode}
            loadNtQuestion={loadNtQuestion}
            ntScope={ntScope}
            loadQuestion={loadQuestion}
          />
        )}

        {(phase === "question" || phase === "feedback") && question && assessmentMode !== "select" && (
          <div className="card">
            {retryNotice && (
              <div className="retry-notice" role="status" aria-live="polite">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
                <span>{retryNotice}</span>
                <button type="button" onClick={() => setRetryNotice("")} aria-label="Dismiss notice">×</button>
              </div>
            )}
            {/* Location graphic */}
            <QuestionHead
              showsLocationLabels={showsLocationLabels}
              question={question}
              assessmentMode={assessmentMode}
              showsBookLabel={showsBookLabel}
              showsTargetedOtLabel={showsTargetedOtLabel}
              otAssessment={otAssessment}
              otRequest={otRequest}
              onReportRequest={openQuestionReport}
            />

            <p className="card-prompt">{sectionSortInteraction?.prompt ?? question.prompt}</p>

            <QuestionInteraction
              isSectionSortQuestion={isSectionSortQuestion}
              sectionSortInteraction={sectionSortInteraction}
              sequenceSensors={sequenceSensors}
              handleSectionSortDragEnd={handleSectionSortDragEnd}
              sectionSortLabelsByZone={sectionSortLabelsByZone}
              phase={phase}
              isSubmittingAnswer={isSubmittingAnswer}
              isLoadingNextQuestion={isLoadingNextQuestion}
              sectionSortReadyToSubmit={sectionSortReadyToSubmit}
              submitSectionSort={submitSectionSort}
              onSpawnPoint={(x, y) => starfieldRef.current?.setPendingSpawn(x, y)}
              isSequenceQuestion={isSequenceQuestion}
              handleSequenceDragEnd={handleSequenceDragEnd}
              sequenceOrder={sequenceOrder}
              moveSequenceItem={moveSequenceItem}
              submitAnswer={submitAnswer}
              submitSequenceOrder={submitSequenceOrder}
              visibleChoices={visibleChoices}
              choiceLabel={choiceLabel}
              isQuestionInteractionLocked={isQuestionInteractionLocked}
              assessmentMode={assessmentMode}
              submitNtAnswer={submitNtAnswer}
            />

            {phase === "feedback" && (
              <FeedbackPanel
                assessmentMode={assessmentMode}
                isSkipped={isSkipped}
                isCorrect={isCorrect}
                sectionSortFeedback={sectionSortFeedback}
                nextQuestion={assessmentMode === "OT" && answeredCount === otTargetCount
                  ? async () => { setPhase("complete"); }
                  : nextQuestion}
                isLoadingNextQuestion={isLoadingNextQuestion}
                sectionSortTraditionNote={sectionSortTraditionNote}
                answeredCount={answeredCount}
                correctCount={correctCount}
                accuracy={accuracy}
                otTargetCount={otTargetCount}
                isTargetedOtAssessment={isTargetedOtAssessment}
                isScopeOtAssessment={isScopeOtAssessment}
                otAssessment={otAssessment}
                attemptId={attemptId}
                transitionToDashboard={transitionToDashboard}
              />
            )}
          </div>
        )}

        {phase === "complete" && assessmentMode === "NT" && (
          <NtCompleteScreen
            accuracy={accuracy}
            correctCount={correctCount}
            answeredCount={answeredCount}
            ntScope={ntScope}
            attemptId={attemptId}
            startNtPilot={startNtPilot}
            transitionToDashboard={transitionToDashboard}
          />
        )}

        {phase === "complete" && assessmentMode === "OT" && (
          <OtCompleteScreen
            accuracy={accuracy}
            isTargetedOtAssessment={isTargetedOtAssessment}
            otAssessment={otAssessment}
            isScopeOtAssessment={isScopeOtAssessment}
            correctCount={correctCount}
            answeredCount={answeredCount}
            attemptId={attemptId}
            transitionToDashboard={transitionToDashboard}
          />
        )}
      </div>

      {showReportModal && question && (
        <ReportQuestionModal
          setShowReportModal={setShowReportModal}
          reportStatus={reportStatus}
          question={question}
          qualityRating={qualityRating}
          setQualityRating={setQualityRating}
          reportCategory={reportCategory}
          setReportCategory={setReportCategory}
          setReportError={setReportError}
          reportText={reportText}
          setReportText={setReportText}
          reportError={reportError}
          submitQuestionReport={() => submitQuestionReport({
            attemptId,
            correctChoiceId,
            question,
            selectedChoice,
            userId,
          })}
          isSubmittingReport={isSubmittingReport}
        />
      )}

      {activeBibleFact && (
        <BibleFactModal setActiveBibleFact={setActiveBibleFact} activeBibleFact={activeBibleFact} />
      )}

      {/* Results overlay */}
      {assessmentMode === "OT" && showResults && (
        <OtResultsOverlay
          setShowResults={setShowResults}
          accuracy={accuracy}
          answeredCount={answeredCount}
          correctCount={correctCount}
          nextMilestone={nextMilestone}
          showSavePrompt={showSavePrompt}
          handleGoogleSignIn={handleGoogleSignIn}
          saving={saving}
          saved={saved}
          email={email}
          setEmail={setEmail}
          handleMagicLink={handleMagicLink}
        />
      )}
    </>
  );
}
