"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  EVIDENCE_VISUAL_STRENGTH,
  IDK_CHOICE_ID,
  NT_PILOT_ENABLED,
  NT_PILOT_TARGET,
  NT_SECTION_LABELS,
  NT_ATTEMPT_ID_KEY,
  OT_ATTEMPT_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  TOTAL_INITIAL,
} from "./constants";
import {
  HEBREW_BIBLE_DIVISION_NOTE,
  clearAssessmentBrowserStorage,
  getSectionSortInteraction,
  isHebrewBibleTraditionSensitiveMiss,
  normalizeNtSection,
  ntScopeFromKey,
  parseInitialAssessmentRoute,
  prepareChoicesForDisplay,
} from "./assessmentHelpers";
import type {
  AssessmentMode,
  BibleSkyFact,
  Choice,
  NtAssessmentQuestionRow,
  NtAssessmentStartRow,
  NtAssessmentStatusRow,
  NtPilotQuestion,
  NtScopeOption,
  OtAssessmentRequest,
  OtAssessmentStartRow,
  OtSubmitResult,
  Phase,
  Question,
  QuestionPrefetch,
  RpcErrorLike,
  SectionSortKey,
  SectionSortSubmitResult,
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
import {
  fetchNextQuestion,
  isStatementTimeoutError,
  startQuestionPrefetch,
  takePrefetchedQuestion,
  type QuestionRpcResult,
} from "./questionPrefetch";
import { answerSubmissionErrorText, rpcErrorCodeText, rpcErrorMessageText } from "./rpcErrors";
import { deriveAssessmentDisplayState } from "./assessmentDisplayState";
import { useAssessmentAuthActions } from "./useAssessmentAuthActions";
import { useAssessmentSession } from "./useAssessmentSession";
import { useDashboardTransition } from "./useDashboardTransition";
import { useNtBookMetadata } from "./useNtBookMetadata";
import { useSectionSortQuestionInteraction, useSequenceQuestionInteraction } from "./useQuestionInteractions";
import { useQuestionReport } from "./useQuestionReport";
import { useStartupWaitLevel } from "./useStartupWaitLevel";

// The two testaments' "next question" RPCs. Same contract, different question
// bank; everything downstream of the call is shared.
const OT_NEXT_QUESTION_RPC = "obs_get_next_ot_assessment_question";
const NT_NEXT_QUESTION_RPC = "obs_get_next_nt_assessment_question";

export default function AssessPage() {
  // ---------------------------------------------------------------------------
  // State & refs
  // ---------------------------------------------------------------------------
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("OT");
  const [modeReady, setModeReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("starting");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [sequenceOrder, setSequenceOrder] = useState<Choice[]>([]);
  const [sectionSortAssignments, setSectionSortAssignments] = useState<Record<string, SectionSortKey | null>>({});
  const [sectionSortFeedback, setSectionSortFeedback] = useState<{ correct: number; total: number } | null>(null);
  const [sectionSortTraditionNote, setSectionSortTraditionNote] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctChoiceId, setCorrectChoiceId] = useState<string | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const isSubmittingAnswerRef = useRef(false);
  const isLoadingQuestionRef = useRef(false);
  const questionInteractionLockedUntilRef = useRef(0);
  const activeQuestionIdRef = useRef<string | null>(null);
  const pendingQuestionNoticeRef = useRef("");
  const otQuestionPrefetchRef = useRef<QuestionPrefetch<Question> | null>(null);
  const ntQuestionPrefetchRef = useRef<QuestionPrefetch<NtAssessmentQuestionRow> | null>(null);
  const ntResumeStartedRef = useRef(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  // Non-fatal notice, e.g. a duplicate submission whose first answer was kept.
  const [retryNotice, setRetryNotice] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showSavePrompt] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [ntScope, setNtScope] = useState<NtScopeOption>({ kind: "all", value: "ALL", label: "All New Testament", description: "Adaptive questions across all 27 New Testament books." });
  const [ntTargetCount, setNtTargetCount] = useState(NT_PILOT_TARGET);
  const [ntRequestedScopeKey, setNtRequestedScopeKey] = useState("NT");
  const [ntRequestedTargetCount, setNtRequestedTargetCount] = useState(NT_PILOT_TARGET);
  const [debugErrorMsg, setDebugErrorMsg] = useState("");
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
    reportCategory,
    reportError,
    reportStatus,
    reportText,
    resetQuestionReport,
    setReportCategory,
    setReportError,
    setReportText,
    setShowReportModal,
    showReportModal,
    submitQuestionReport,
  } = useQuestionReport();
  const startupWaitLevel = useStartupWaitLevel(phase, assessmentMode);
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

  // ---------------------------------------------------------------------------
  // Parse the initial mode/scope from the URL (?choose=1, ?testament=NT, or an
  // OT focus/scope/target request) — runs once on mount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const route = parseInitialAssessmentRoute(window.location.search, TOTAL_INITIAL, NT_PILOT_TARGET);
    if (route.sanitizedSearch !== null) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${route.sanitizedSearch ? `?${route.sanitizedSearch}` : ""}${window.location.hash}`,
      );
    }
    setAssessmentMode(route.assessmentMode === "NT" && !NT_PILOT_ENABLED ? "select" : route.assessmentMode);
    setPhase(route.phase);
    setNtRequestedScopeKey(route.ntRequestedScopeKey);
    setNtRequestedTargetCount(route.ntRequestedTargetCount);
    setOtRequest(route.otRequest);
    setModeReady(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Question-load lifecycle helpers (locking, begin/finish)
  // ---------------------------------------------------------------------------
  const isQuestionInteractionLocked = useCallback(() => (
    isLoadingQuestionRef.current
    || isSubmittingAnswerRef.current
    || Date.now() < questionInteractionLockedUntilRef.current
  ), []);

  const beginQuestionLoad = useCallback(() => {
    if (isLoadingQuestionRef.current) return false;
    isLoadingQuestionRef.current = true;
    isSubmittingAnswerRef.current = true;
    questionInteractionLockedUntilRef.current = Date.now() + 650;
    activeQuestionIdRef.current = null;
    starfieldRef.current?.clearPendingSpawn();
    setIsLoadingNextQuestion(true);
    setIsSubmittingAnswer(true);
    setQuestion(null);
    setSelectedChoice(null);
    setIsCorrect(null);
    setCorrectChoiceId(null);
    setSectionSortFeedback(null);
    setSectionSortTraditionNote("");
    setRetryNotice("");
    setPhase("starting");
    return true;
  }, []);

  const finishQuestionLoad = useCallback((questionId: string | null = null) => {
    activeQuestionIdRef.current = questionId;
    isLoadingQuestionRef.current = false;
    isSubmittingAnswerRef.current = false;
    questionInteractionLockedUntilRef.current = 0;
    setIsLoadingNextQuestion(false);
    setIsSubmittingAnswer(false);
  }, []);

  // ---------------------------------------------------------------------------
  // OT question loading & prefetch
  // ---------------------------------------------------------------------------
  const applyOtQuestionRow = useCallback((row: Question) => {
    let choices: Choice[] = [];
    if (Array.isArray(row.choices)) {
      choices = row.choices.map((c: { id: string; text: string }) => ({ id: c.id, text: c.text }));
    }
    const rawQuestion = {
      ...row,
    } as Question;
    const parsedQuestion = {
      ...rawQuestion,
      choices: prepareChoicesForDisplay(rawQuestion, choices),
    } as Question;
    const sectionSort = getSectionSortInteraction(parsedQuestion);
    setQuestion(parsedQuestion);
    setSequenceOrder(parsedQuestion.choices);
    setSectionSortAssignments(Object.fromEntries(
      (sectionSort?.dragLabels ?? []).map(label => [label.id, null]),
    ));
    setSectionSortFeedback(null);
    setSectionSortTraditionNote("");
    setSelectedChoice(null);
    setIsCorrect(null);
    setCorrectChoiceId(null);
    setRetryNotice(pendingQuestionNoticeRef.current);
    pendingQuestionNoticeRef.current = "";
    setShowReportModal(false);
    resetQuestionReport();
    finishQuestionLoad(row.out_generated_question_id);
    setPhase("question");
    starfieldRef.current?.shiftSky();
  }, [finishQuestionLoad, resetQuestionReport, setShowReportModal]);

  const handleOtQuestionResult = useCallback(async (
    aid: string,
    data: Question[] | null,
    error: RpcErrorLike,
  ) => {
    if (error) {
      finishQuestionLoad(null);
      if (rpcErrorMessageText(error).includes("assessment_answers_user_id_fkey")) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        setErrorMsg("Your anonymous assessment session expired after Supabase restarted. Start a fresh assessment and the questions should work again.");
      } else {
        console.error("Question load failed:", error);
        setDebugErrorMsg(`${rpcErrorCodeText(error) ? `${rpcErrorCodeText(error)}: ` : ""}${rpcErrorMessageText(error)}`);
        setErrorMsg("We could not load the next question. This is usually a temporary connection problem.");
      }
      setPhase("error");
      return;
    }
    if (!data || data.length === 0) {
      finishQuestionLoad(null);
      setPhase("complete");
      return;
    }

    setAttemptId(aid);
    applyOtQuestionRow(data[0]);
  }, [applyOtQuestionRow, finishQuestionLoad]);

  const prefetchOtQuestion = useCallback((aid: string, afterAnsweredCount: number) => {
    startQuestionPrefetch<Question>(otQuestionPrefetchRef, OT_NEXT_QUESTION_RPC, aid, afterAnsweredCount);
  }, []);

  const consumePrefetchedOtQuestion = useCallback(async (aid: string, afterAnsweredCount: number) => {
    const result = await takePrefetchedQuestion<Question>(otQuestionPrefetchRef, aid, afterAnsweredCount);
    if (!result) return false;
    // A timed-out prefetch is not worth surfacing: fall through to loadQuestion,
    // which retries before giving up.
    if (isStatementTimeoutError(result.error)) return false;
    await handleOtQuestionResult(aid, result.data, result.error);
    return true;
  }, [handleOtQuestionResult]);

  const loadQuestion = useCallback(async (aid: string) => {
    setDebugErrorMsg("");
    setIsLoadingNextQuestion(true);
    let last: QuestionRpcResult<Question> = { data: null, error: null };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      last = await fetchNextQuestion<Question>(OT_NEXT_QUESTION_RPC, aid);
      if (!isStatementTimeoutError(last.error)) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    await handleOtQuestionResult(aid, last.data, last.error);
  }, [handleOtQuestionResult]);

  // ---------------------------------------------------------------------------
  // NT question loading & prefetch, and starting the NT pilot
  // ---------------------------------------------------------------------------
  const applyNtQuestionRow = useCallback((aid: string, scope: NtScopeOption, row: NtAssessmentQuestionRow) => {
    if (!row) {
      finishQuestionLoad(null);
      setQuestion(null);
      setPhase("complete");
      return false;
    }

    const choices = Array.isArray(row.choices)
      ? row.choices
          .filter((choice): choice is Choice => {
            if (!choice || typeof choice !== "object") return false;
            const possibleChoice = choice as Partial<Choice>;
            return typeof possibleChoice.id === "string" && typeof possibleChoice.text === "string";
          })
          .map(choice => ({ id: choice.id, text: choice.text }))
      : [];
    if (!row.out_generated_question_id || !row.prompt || choices.length === 0) {
      finishQuestionLoad(null);
      setNtError("The next New Testament question could not be loaded.");
      setErrorMsg("The next New Testament question could not be loaded.");
      setPhase("error");
      return false;
    }

    const section = normalizeNtSection(row.nt_division) ?? "GOSPELS_ACTS";
    const rawParsed: NtPilotQuestion = {
      out_generated_question_id: row.out_generated_question_id,
      prompt: row.prompt,
      question_type: row.question_type ?? "nt_adaptive",
      choices,
      event_title: scope.label,
      book_code: row.book_code ?? "",
      book_name: row.book_name ?? row.book_code ?? "New Testament",
      importance_tier: 1,
      section: NT_SECTION_LABELS[section],
      nt_division: section,
    };
    const displayChoices = prepareChoicesForDisplay(rawParsed, rawParsed.choices);
    const parsed: NtPilotQuestion = {
      ...rawParsed,
      choices: displayChoices,
    };

    setAttemptId(aid);
    setAnsweredCount(Number(row.answered_count ?? 0));
    setNtTargetCount(Number(row.target_question_count ?? NT_PILOT_TARGET));
    const sectionSort = getSectionSortInteraction(parsed);
    setQuestion(parsed);
    setSequenceOrder(displayChoices);
    setSectionSortAssignments(Object.fromEntries(
      (sectionSort?.dragLabels ?? []).map(label => [label.id, null]),
    ));
    setSectionSortFeedback(null);
    setSectionSortTraditionNote("");
    setSelectedChoice(null);
    setIsCorrect(null);
    setCorrectChoiceId(null);
    finishQuestionLoad(parsed.out_generated_question_id);
    setPhase("question");
    starfieldRef.current?.shiftSky();
    return true;
  }, [finishQuestionLoad, setNtError]);

  const handleNtQuestionResult = useCallback((
    aid: string,
    scope: NtScopeOption,
    data: NtAssessmentQuestionRow[] | null,
    error: RpcErrorLike,
  ) => {
    if (error) {
      finishQuestionLoad(null);
      console.error("NT question load failed:", error);
      const friendly = "We could not load the next question. This is usually a temporary connection problem.";
      setNtError(friendly);
      setErrorMsg(friendly);
      setPhase("error");
      return;
    }

    const row = ((data ?? [])[0] as NtAssessmentQuestionRow | undefined) ?? null;
    if (!row) {
      finishQuestionLoad(null);
      setQuestion(null);
      setPhase("complete");
      return;
    }
    applyNtQuestionRow(aid, scope, row);
  }, [applyNtQuestionRow, finishQuestionLoad, setNtError]);

  const prefetchNtQuestion = useCallback((aid: string, afterAnsweredCount: number) => {
    startQuestionPrefetch<NtAssessmentQuestionRow>(ntQuestionPrefetchRef, NT_NEXT_QUESTION_RPC, aid, afterAnsweredCount);
  }, []);

  const consumePrefetchedNtQuestion = useCallback(async (
    aid: string,
    scope: NtScopeOption,
    afterAnsweredCount: number,
  ) => {
    const result = await takePrefetchedQuestion<NtAssessmentQuestionRow>(
      ntQuestionPrefetchRef, aid, afterAnsweredCount,
    );
    if (!result) return false;
    handleNtQuestionResult(aid, scope, result.data, result.error);
    return true;
  }, [handleNtQuestionResult]);

  const loadNtQuestion = useCallback(async (aid: string, scope: NtScopeOption) => {
    setIsLoadingNextQuestion(true);
    const { data, error } = await fetchNextQuestion<NtAssessmentQuestionRow>(NT_NEXT_QUESTION_RPC, aid);
    handleNtQuestionResult(aid, scope, data, error);
  }, [handleNtQuestionResult]);

  const startNtPilot = useCallback(async (
    scope: NtScopeOption = ntScope,
    targetCount: number = ntRequestedTargetCount,
  ) => {
    if (!NT_PILOT_ENABLED) {
      setNtError("The New Testament assessment is not enabled right now.");
      return;
    }
    setNtError("");
    setErrorMsg("");
    setPhase("starting");
    setAnsweredCount(0);
    setCorrectCount(0);
    setSelectedChoice(null);
    setIsCorrect(null);
    setCorrectChoiceId(null);
    ntQuestionPrefetchRef.current = null;
    localStorage.removeItem("oba_nt_pilot_summary");

    try {
      const uid = await ensureAssessmentSession();
      await loadScoreEvidence(uid, "NT");
      const { data, error } = await supabase.rpc("obs_start_nt_assessment", {
        p_section: scope.kind === "section" ? (scope.rpcValue ?? scope.value) : null,
        p_book_code: scope.kind === "book" ? scope.value : null,
        p_target_question_count: targetCount,
      });
      if (error) throw error;
      const attempt = ((data ?? [])[0] as NtAssessmentStartRow | undefined) ?? null;
      if (!attempt?.attempt_id) throw new Error("Failed to create the New Testament assessment");

      setNtScope(scope);
      setAttemptId(attempt.attempt_id);
      setUserId(attempt.user_id);
      setNtTargetCount(attempt.target_question_count);
      sessionStorage.setItem(NT_ATTEMPT_ID_KEY, attempt.attempt_id);
      await loadNtQuestion(attempt.attempt_id, scope);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start the New Testament assessment";
      setNtError(message);
      setErrorMsg(message);
      setPhase("error");
    }
  }, [ensureAssessmentSession, loadNtQuestion, loadScoreEvidence, ntRequestedTargetCount, ntScope, setNtError, setUserId]);

  // ---------------------------------------------------------------------------
  // Resume or start the NT assessment on mount (once mode + book metadata are
  // ready)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!modeReady || assessmentMode !== "NT" || !ntMetadataLoaded || ntResumeStartedRef.current) return;
    ntResumeStartedRef.current = true;
    const storedAttemptId = sessionStorage.getItem(NT_ATTEMPT_ID_KEY);
    const requestedScope = ntScopeFromKey(ntRequestedScopeKey, ntBooks);
    const requestedBackendScope = requestedScope.kind === "all"
      ? "NT"
      : requestedScope.value.toUpperCase();

    async function resumeNtAssessment() {
      if (!storedAttemptId) {
        await startNtPilot(requestedScope, ntRequestedTargetCount);
        return;
      }
      try {
        const uid = await ensureAssessmentSession();
        await loadScoreEvidence(uid, "NT");
        const { data, error } = await supabase.rpc("obs_get_nt_assessment_status", {
          p_attempt_id: storedAttemptId,
        });
        if (error) throw error;
        const status = ((data ?? [])[0] as NtAssessmentStatusRow | undefined) ?? null;
        if (!status) {
          sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
          await startNtPilot(requestedScope, ntRequestedTargetCount);
          return;
        }

        if (
          status.scope_key.toUpperCase() !== requestedBackendScope
          || status.target_reached
        ) {
          sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
          await startNtPilot(requestedScope, ntRequestedTargetCount);
          return;
        }

        const scope = ntScopeFromKey(status.scope_key, ntBooks);
        setAttemptId(status.attempt_id);
        setUserId(uid);
        setNtScope(scope);
        setAnsweredCount(status.answered_count);
        setCorrectCount(status.correct_count);
        setNtTargetCount(status.target_question_count);
        await loadNtQuestion(status.attempt_id, scope);
      } catch (err: unknown) {
        sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
        setNtError(err instanceof Error ? err.message : "Your saved New Testament attempt could not be resumed.");
        setPhase("starting");
      }
    }

    void resumeNtAssessment();
  }, [assessmentMode, ensureAssessmentSession, loadNtQuestion, loadScoreEvidence, modeReady, ntBooks, ntMetadataLoaded, ntRequestedScopeKey, ntRequestedTargetCount, setNtError, setUserId, startNtPilot]);

  // ---------------------------------------------------------------------------
  // Resume or start the OT assessment on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      if (!modeReady || assessmentMode !== "OT") return;
      try {
        setDebugErrorMsg("");
        const uid = await ensureAssessmentSession();
        await loadScoreEvidence(uid, "OT");

        const { data, error } = otRequest.scopeKey
          ? await supabase.rpc("obs_start_or_resume_ot_scope_assessment", {
              p_scope_key: otRequest.scopeKey,
              p_label: otRequest.label,
              p_target_question_count: otRequest.targetQuestionCount,
              p_force_new: otRequest.forceNew,
            })
          : await supabase.rpc("obs_start_or_resume_ot_assessment_v2", {
              p_unit_key: otRequest.unitKey,
              p_book_code: otRequest.bookCode,
              p_start_chapter: otRequest.startChapter,
              p_end_chapter: otRequest.endChapter,
              p_target_question_count: otRequest.targetQuestionCount,
              p_force_new: otRequest.forceNew,
              p_dimension_key: otRequest.dimensionKey,
            });
        if (error) throw error;

        const attempt = ((data ?? [])[0] as OtAssessmentStartRow | undefined) ?? null;
        if (!attempt?.attempt_id) throw new Error("Failed to start the Old Testament assessment");

        setOtAssessment(attempt);
        setOtTargetCount(Number(attempt.target_question_count || TOTAL_INITIAL));
        setAttemptId(attempt.attempt_id);
        setAnsweredCount(Number(attempt.answered_count || 0));
        setCorrectCount(Number(attempt.correct_count || 0));
        otQuestionPrefetchRef.current = null;
        sessionStorage.setItem(OT_ATTEMPT_ID_KEY, attempt.attempt_id);

        // A targeted retest (a specific book/section/dimension) has a real,
        // small endpoint and should still stop there. The standard baseline
        // assessment doesn't — hitting "target reached" on resume just means
        // it's time to keep going, so fall through to load another question
        // instead of blocking on the "Assessment complete" interstitial.
        const isTargetedResume = attempt.assessment_kind === "ot_focused" || Boolean(otRequest.scopeKey);
        if (attempt.target_reached && isTargetedResume) {
          setPhase("complete");
          return;
        }
        await loadQuestion(attempt.attempt_id);
      } catch (err: unknown) {
        const message = err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
            ? String((err as { message?: unknown }).message)
            : "Failed to start assessment";
        const code = typeof err === "object" && err && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
        setDebugErrorMsg(code ? `${code}: ${message}` : message);
        setErrorMsg(message);
        setPhase("error");
      }
    }
    init();
  }, [assessmentMode, ensureAssessmentSession, loadQuestion, loadScoreEvidence, modeReady, otRequest]);

  // ---------------------------------------------------------------------------
  // RPC error helpers & answer-submission failure handling
  // ---------------------------------------------------------------------------
  // The backend is first-write-wins: an exact retry returns the original
  // result, but a *changed* retry is rejected as already answered. That is not
  // a failure the user needs to see as an error — their first answer stands, so
  // recover by moving on rather than dead-ending the assessment.
  const isChangedRetryRejection = useCallback((err: RpcErrorLike) =>
    Boolean(err && /already answered/i.test(answerSubmissionErrorText(err))), []);

  const logQuestionMisfire = useCallback(async ({
    submittedQuestionId,
    error,
    context,
  }: {
    submittedQuestionId: string;
    error: RpcErrorLike;
    context: Record<string, unknown>;
  }) => {
    if (!attemptId || !userId) return;

    const errorMessage = error
      ? answerSubmissionErrorText(error)
      : "No result returned from answer submission";
    const prompt = typeof context.prompt === "string" ? context.prompt : question?.prompt ?? null;
    const feedbackText = [
      "Answer submission failed without advancing the assessment.",
      `Error code: ${rpcErrorCodeText(error) ?? "unknown"}`,
      `Error message: ${errorMessage}`,
      `Context: ${JSON.stringify(context)}`,
    ].join("\n").slice(0, 2000);

    const { error: reportError } = await supabase
      .from("question_reports")
      .insert({
        generated_question_id: submittedQuestionId,
        attempt_id: attemptId,
        user_id: userId,
        report_category: "malformed_question",
        feedback_text: feedbackText,
        selected_choice_id: null,
        correct_choice_id: null,
        question_prompt: prompt,
      });

    if (reportError) {
      console.warn("Could not log failed answer submission:", reportError);
    }
  }, [attemptId, question?.prompt, userId]);

  const failAnswerSubmission = useCallback(async ({
    submittedQuestionId,
    error,
    context,
  }: {
    submittedQuestionId: string;
    error: RpcErrorLike;
    context: Record<string, unknown>;
  }) => {
    console.warn("Answer submission failed:", {
      code: rpcErrorCodeText(error),
      message: error ? answerSubmissionErrorText(error) : "No result returned from answer submission",
      context,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;
    const skipContext = {
      ...context,
      skipped_after_submit_failure: true,
    };
    const { data: skippedData, error: skipError } = await supabase.rpc("obs_skip_broken_assessment_question", {
      p_attempt_id: attemptId,
      p_generated_question_id: submittedQuestionId,
      p_error_code: rpcErrorCodeText(error),
      p_error_message: error ? answerSubmissionErrorText(error) : "No result returned from answer submission",
      p_context: skipContext,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (skipError) {
      await logQuestionMisfire({ submittedQuestionId, error: error ?? skipError, context });
      isSubmittingAnswerRef.current = false;
      setIsSubmittingAnswer(false);
      setDebugErrorMsg(`${rpcErrorCodeText(skipError) ? `${rpcErrorCodeText(skipError)}: ` : ""}${answerSubmissionErrorText(skipError)}`);
      setErrorMsg("We could not record or skip that question. This is usually a temporary connection problem.");
      setPhase("error");
      return;
    }

    const skippedResult = skippedData?.[0] as Pick<OtSubmitResult, "answered_count" | "correct_count" | "target_question_count"> | undefined;
    const newAnswered = Number(skippedResult?.answered_count ?? answeredCount);
    const newCorrect = Number(skippedResult?.correct_count ?? correctCount);
    const newTarget = Number(skippedResult?.target_question_count ?? (assessmentMode === "NT" ? ntTargetCount : otTargetCount));
    setAnsweredCount(newAnswered);
    setCorrectCount(newCorrect);
    if (assessmentMode === "NT") setNtTargetCount(newTarget);
    else setOtTargetCount(newTarget);
    sessionStorage.setItem(SESSION_ANSWERED_KEY, String(newAnswered));
    sessionStorage.setItem(SESSION_CORRECT_KEY, String(newCorrect));
    if (userId) void loadScoreEvidence(userId, assessmentMode === "NT" ? "NT" : "OT");

    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    setDebugErrorMsg("");
    setErrorMsg("");

    // Same exception as nextQuestion() below: only block on "complete" for a
    // targeted retest, which has a real fixed endpoint. The standard
    // baseline assessment just keeps going past its initial target.
    // (Computed inline rather than via the isTargetedOtAssessment const
    // below — that's declared later in the component, so referencing it
    // from a callback defined up here would hit the temporal dead zone.)
    const isTargetedOt = otAssessment?.assessment_kind === "ot_focused" || Boolean(otRequest.scopeKey);
    const isStandardOtAssessment = assessmentMode === "OT" && !isTargetedOt;
    if (newAnswered >= newTarget && !isStandardOtAssessment) {
      setPhase("complete");
      return;
    }

    if (!attemptId || !beginQuestionLoad()) return;
    pendingQuestionNoticeRef.current = "That question misfired, so we skipped it and logged it for review. It will not count toward your total.";
    if (assessmentMode === "NT") await loadNtQuestion(attemptId, ntScope);
    else await loadQuestion(attemptId);
  }, [
    answeredCount,
    assessmentMode,
    attemptId,
    beginQuestionLoad,
    correctCount,
    loadNtQuestion,
    loadQuestion,
    loadScoreEvidence,
    logQuestionMisfire,
    ntScope,
    ntTargetCount,
    otAssessment,
    otRequest,
    otTargetCount,
    userId,
  ]);

  // ---------------------------------------------------------------------------
  // OT answer submission
  // ---------------------------------------------------------------------------
  const submitAnswer = useCallback(async (choiceId: string) => {
    if (!attemptId || !userId || !question || phase !== "question" || isQuestionInteractionLocked()) return;
    const submittedQuestionId = question.out_generated_question_id;
    const isSequenceResponse = choiceId.startsWith("__ORDER__:");
    const displayedChoices = isSequenceResponse
      ? sequenceOrder
      : question.choices;
    const selectedChoiceText = choiceId === IDK_CHOICE_ID
      ? null
      : isSequenceResponse
        ? sequenceOrder.map(item => item.text).join(" -> ")
        : question.choices.find(choice => choice.id === choiceId)?.text ?? null;
    isSubmittingAnswerRef.current = true;
    setIsSubmittingAnswer(true);
    setSelectedChoice(choiceId);

    const { data, error } = await supabase.rpc("obs_submit_ot_assessment_response_v2", {
      p_attempt_id: attemptId,
      p_generated_question_id: submittedQuestionId,
      p_response: choiceId,
      p_selected_choice_text: selectedChoiceText,
      p_displayed_choices: displayedChoices,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    const result = data?.[0] as OtSubmitResult | undefined;

    if (error) {
      if (isChangedRetryRejection(error)) {
        isSubmittingAnswerRef.current = false;
        setIsSubmittingAnswer(false);
        setRetryNotice("Your first answer to that question was already recorded, so it has been kept.");
        setPhase("feedback");
        return;
      }
      if (rpcErrorMessageText(error).includes("assessment_answers_user_id_fkey")) {
        isSubmittingAnswerRef.current = false;
        setIsSubmittingAnswer(false);
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        setErrorMsg("Your anonymous assessment session expired after Supabase restarted. Start a fresh assessment and the questions should work again.");
        setPhase("error");
      } else {
        await failAnswerSubmission({
          submittedQuestionId,
          error,
          context: {
            surface: "ot_answer",
            question_type: question.question_type,
            prompt: question.prompt,
            selected_choice_id: choiceId,
            displayed_choices: displayedChoices,
          },
        });
      }
      return;
    }

    if (!result) {
      await failAnswerSubmission({
        submittedQuestionId,
        error: null,
        context: {
          surface: "ot_answer",
          question_type: question.question_type,
          prompt: question.prompt,
          selected_choice_id: choiceId,
          no_result: true,
        },
      });
      return;
    }

    if (result) {
      setIsCorrect(result.is_correct);
      setCorrectChoiceId(result.correct_choice_id ?? null);
      const newAnswered = Number(result.answered_count ?? answeredCount + 1);
      const newCorrect = Number(result.correct_count ?? correctCount + (result.is_correct ? 1 : 0));
      const newTarget = Number(result.target_question_count ?? otTargetCount);
      setAnsweredCount(newAnswered);
      setCorrectCount(newCorrect);
      setOtTargetCount(newTarget);
      sessionStorage.setItem(SESSION_ANSWERED_KEY, String(newAnswered));
      sessionStorage.setItem(SESSION_CORRECT_KEY, String(newCorrect));
      void loadScoreEvidence(userId, "OT");
      if (newAnswered < newTarget) prefetchOtQuestion(attemptId, newAnswered);
      else otQuestionPrefetchRef.current = null;
      starfieldRef.current?.spawnTraveler();
    }
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    setPhase("feedback");
  }, [attemptId, userId, question, phase, isQuestionInteractionLocked, sequenceOrder, answeredCount, correctCount, failAnswerSubmission, isChangedRetryRejection, loadScoreEvidence, otTargetCount, prefetchOtQuestion]);

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

  // ---------------------------------------------------------------------------
  // NT answer submission
  // ---------------------------------------------------------------------------
  const submitNtAnswer = useCallback(async (choiceId: string) => {
    if (!attemptId || !question || phase !== "question" || isQuestionInteractionLocked()) return;
    const submittedQuestionId = question.out_generated_question_id;
    isSubmittingAnswerRef.current = true;
    setIsSubmittingAnswer(true);
    setSelectedChoice(choiceId);

    const { data, error } = await supabase.rpc("obs_submit_nt_assessment_answer", {
      p_attempt_id: attemptId,
      p_generated_question_id: submittedQuestionId,
      p_selected_choice_id: choiceId,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (error) {
      if (isChangedRetryRejection(error)) {
        isSubmittingAnswerRef.current = false;
        setIsSubmittingAnswer(false);
        setRetryNotice("Your first answer to that question was already recorded, so it has been kept.");
        setPhase("feedback");
        return;
      }
      await failAnswerSubmission({
        submittedQuestionId,
        error,
        context: {
          surface: "nt_answer",
          question_type: question.question_type,
          prompt: question.prompt,
          selected_choice_id: choiceId,
        },
      });
      return;
    }

    const result = data?.[0];
    if (!result) {
      await failAnswerSubmission({
        submittedQuestionId,
        error: null,
        context: {
          surface: "nt_answer",
          question_type: question.question_type,
          prompt: question.prompt,
          selected_choice_id: choiceId,
          no_result: true,
        },
      });
      return;
    }
    const correct = Boolean(result?.is_correct);
    const newAnswered = Number(result?.answered_count ?? answeredCount + 1);
    const newCorrect = Number(result?.correct_count ?? correctCount + (correct ? 1 : 0));
    const newTarget = Number(result?.target_question_count ?? ntTargetCount);
    setIsCorrect(correct);
    setCorrectChoiceId(result?.correct_choice_id ?? null);
    setAnsweredCount(newAnswered);
    setCorrectCount(newCorrect);
    setNtTargetCount(newTarget);
    if (userId) void loadScoreEvidence(userId, "NT");
    if (newAnswered < newTarget) prefetchNtQuestion(attemptId, newAnswered);
    else ntQuestionPrefetchRef.current = null;
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    starfieldRef.current?.spawnTraveler();
    setPhase("feedback");
  }, [answeredCount, attemptId, correctCount, failAnswerSubmission, isChangedRetryRejection, isQuestionInteractionLocked, loadScoreEvidence, ntTargetCount, phase, prefetchNtQuestion, question, userId]);

  // ---------------------------------------------------------------------------
  // Section-sort submission
  // ---------------------------------------------------------------------------
  const submitSectionSort = useCallback(async (submissionMode: "answer" | "skip" = "answer") => {
    if (!attemptId || !question || !sectionSortInteraction || phase !== "question" || isQuestionInteractionLocked()) return;
    const submittedQuestionId = question.out_generated_question_id;
    const assignments = sectionSortInteraction.dragLabels.map(label => ({
      text: label.text,
      section_key: submissionMode === "skip"
        ? IDK_CHOICE_ID
        : sectionSortAssignments[label.id],
    }));

    isSubmittingAnswerRef.current = true;
    setIsSubmittingAnswer(true);
    setSelectedChoice(submissionMode === "skip" ? IDK_CHOICE_ID : "__SECTION_SORT__");

    const { data, error } = await supabase.rpc("obs_submit_section_sort_answers", {
      p_attempt_id: attemptId,
      p_screen_question_id: submittedQuestionId,
      p_assignments: assignments,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (error) {
      await failAnswerSubmission({
        submittedQuestionId,
        error,
        context: {
          surface: "section_sort",
          submission_mode: submissionMode,
          question_type: question.question_type,
          prompt: question.prompt,
          assignments,
        },
      });
      return;
    }

    const result = data?.[0] as SectionSortSubmitResult | undefined;
    if (!result) {
      await failAnswerSubmission({
        submittedQuestionId,
        error: null,
        context: {
          surface: "section_sort",
          submission_mode: submissionMode,
          question_type: question.question_type,
          prompt: question.prompt,
          assignments,
          no_result: true,
        },
      });
      return;
    }

    const isScreenCorrect = Boolean(result.is_correct);
    const scoredCorrect = Number(result.scored_correct_count ?? 0);
    const scoredTotal = Number(result.scored_item_count ?? sectionSortInteraction.dragLabels.length);
    const newAnswered = Number(result.answered_count ?? answeredCount + (result.scored_item_count ?? 1));
    const newCorrect = Number(result.correct_count ?? correctCount + (result.scored_correct_count ?? 0));
    const newTarget = Number(result.target_question_count ?? (assessmentMode === "NT" ? ntTargetCount : otTargetCount));
    const hasTraditionSensitiveMiss = assessmentMode === "OT"
      && submissionMode !== "skip"
      && sectionSortInteraction.dragLabels.some(label =>
        isHebrewBibleTraditionSensitiveMiss(label, sectionSortAssignments[label.id]),
      );
    setIsCorrect(isScreenCorrect);
    setCorrectChoiceId(result.correct_choice_id ?? "A");
    setSectionSortFeedback({ correct: scoredCorrect, total: scoredTotal });
    setSectionSortTraditionNote(hasTraditionSensitiveMiss ? HEBREW_BIBLE_DIVISION_NOTE : "");
    setAnsweredCount(newAnswered);
    setCorrectCount(newCorrect);
    if (assessmentMode === "NT") setNtTargetCount(newTarget);
    else setOtTargetCount(newTarget);
    sessionStorage.setItem(SESSION_ANSWERED_KEY, String(newAnswered));
    sessionStorage.setItem(SESSION_CORRECT_KEY, String(newCorrect));
    if (userId) void loadScoreEvidence(userId, assessmentMode === "NT" ? "NT" : "OT");
    if (newAnswered < newTarget) {
      if (assessmentMode === "NT") prefetchNtQuestion(attemptId, newAnswered);
      else prefetchOtQuestion(attemptId, newAnswered);
    } else if (assessmentMode === "NT") {
      ntQuestionPrefetchRef.current = null;
    } else {
      otQuestionPrefetchRef.current = null;
    }
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    starfieldRef.current?.spawnTraveler();
    setPhase("feedback");
  }, [
    answeredCount,
    assessmentMode,
    attemptId,
    correctCount,
    loadScoreEvidence,
    ntTargetCount,
    otTargetCount,
    question,
    sectionSortAssignments,
    sectionSortInteraction,
    failAnswerSubmission,
    isQuestionInteractionLocked,
    phase,
    prefetchNtQuestion,
    prefetchOtQuestion,
    userId,
  ]);

  // ---------------------------------------------------------------------------
  // Advance to the next question
  // ---------------------------------------------------------------------------
  const nextQuestion = useCallback(async () => {
    if (phase !== "feedback" || isSubmittingAnswerRef.current || isLoadingQuestionRef.current) return;
    if (assessmentMode === "NT") {
      if (answeredCount >= ntTargetCount) {
        setPhase("complete");
        return;
      }
      if (attemptId && beginQuestionLoad()) {
        const usedPrefetch = await consumePrefetchedNtQuestion(attemptId, ntScope, answeredCount);
        if (!usedPrefetch) await loadNtQuestion(attemptId, ntScope);
      }
      return;
    }
    // Only a targeted retest (real, small, fixed endpoint) blocks on
    // "complete" here — the standard baseline assessment keeps going past
    // its initial target instead of showing that interstitial.
    const isTargetedOt = otAssessment?.assessment_kind === "ot_focused" || Boolean(otRequest.scopeKey);
    if (answeredCount >= otTargetCount && isTargetedOt) {
      setPhase("complete");
      return;
    }
    if (attemptId && beginQuestionLoad()) {
      const usedPrefetch = await consumePrefetchedOtQuestion(attemptId, answeredCount);
      if (!usedPrefetch) await loadQuestion(attemptId);
    }
  }, [
    answeredCount,
    assessmentMode,
    attemptId,
    beginQuestionLoad,
    consumePrefetchedNtQuestion,
    consumePrefetchedOtQuestion,
    loadNtQuestion,
    loadQuestion,
    ntScope,
    ntTargetCount,
    otAssessment,
    otRequest,
    otTargetCount,
    phase,
  ]);

  // ---------------------------------------------------------------------------
  // Answer-choice display + nav phase/progress derived values
  // ---------------------------------------------------------------------------
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
                nextQuestion={nextQuestion}
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
