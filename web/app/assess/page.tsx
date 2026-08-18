"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { beginPendingTransfer, clearPendingTransfer, newFlowId } from "@/lib/auth/anonymousTransfer";
import { authCallbackUrl } from "@/lib/auth/redirect";
import BlackHoleEvent from "./BlackHoleEvent";
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  IDK_CHOICE,
  IDK_CHOICE_ID,
  NEBULA_STAGE_NAMES,
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
  hashString,
  isBroadSectionLevelQuestion,
  isHebrewBibleTraditionSensitiveMiss,
  isOrderResponseQuestion,
  normalizeNtSection,
  ntScopeFromKey,
  prepareChoicesForDisplay,
  promptAsksForBookAnswer,
  promptAsksForSectionAnswer,
  skyDiscoveryMilestone,
} from "./assessmentHelpers";
import { BIBLE_SKY_FACTS } from "./skyFacts";
import type {
  AssessmentMode,
  BibleSkyFact,
  BliEvidence,
  Choice,
  NtAssessmentQuestionRow,
  NtAssessmentStartRow,
  NtAssessmentStatusRow,
  NtBookMetadata,
  NtPilotQuestion,
  NtScopeOption,
  OtAssessmentRequest,
  OtAssessmentStartRow,
  OtSubmitResult,
  Phase,
  Question,
  QuestionPrefetch,
  ReportCategory,
  RpcErrorLike,
  SectionSortKey,
  SectionSortLabel,
  SectionSortSubmitResult,
  Testament,
} from "./types";
import {
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { nebulaStageIndex, useAssessmentStarfield } from "./useAssessmentStarfield";
import { ASSESS_PAGE_STYLES } from "./assessStyles";
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

function rpcErrorMessageText(err: RpcErrorLike) {
  return typeof err?.message === "string" && err.message.trim()
    ? err.message
    : "Answer submission failed without a detailed error message";
}

function rpcErrorCodeText(err: RpcErrorLike) {
  return typeof err?.code === "string" && err.code.trim() ? err.code : null;
}

function isStatementTimeoutError(err: RpcErrorLike) {
  return rpcErrorCodeText(err) === "57014"
    || /statement timeout/i.test(rpcErrorMessageText(err));
}

export default function AssessPage() {
  // ---------------------------------------------------------------------------
  // State & refs
  // ---------------------------------------------------------------------------
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("OT");
  const [modeReady, setModeReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("starting");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isDashboardTransitioning, setIsDashboardTransitioning] = useState(false);
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>("wrong_answer");
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sent">("idle");
  const [reportError, setReportError] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [ntBooks, setNtBooks] = useState<NtBookMetadata[]>([]);
  const [ntScope, setNtScope] = useState<NtScopeOption>({ kind: "all", value: "ALL", label: "All New Testament", description: "Adaptive questions across all 27 New Testament books." });
  const [ntTargetCount, setNtTargetCount] = useState(NT_PILOT_TARGET);
  const [ntRequestedScopeKey, setNtRequestedScopeKey] = useState("NT");
  const [ntRequestedTargetCount, setNtRequestedTargetCount] = useState(NT_PILOT_TARGET);
  const [ntMetadataLoaded, setNtMetadataLoaded] = useState(false);
  const [ntError, setNtError] = useState("");
  const [debugErrorMsg, setDebugErrorMsg] = useState("");
  const [startupWaitLevel, setStartupWaitLevel] = useState<0 | 1 | 2>(0);
  const [scoreEvidence, setScoreEvidence] = useState<BliEvidence | null>(null);
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
  const sequenceSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const {
    canvasRef,
    skyFrameRef,
    offsetRef,
    pendingSpawnRef,
    spawnTraveler,
    shiftSky,
  } = useAssessmentStarfield({
    answeredCount,
    scoreEvidence,
    isDashboardTransitioning,
  });

  // ---------------------------------------------------------------------------
  // Parse the initial mode/scope from the URL (?choose=1, ?testament=NT, or an
  // OT focus/scope/target request) — runs once on mount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsePositiveInteger = (value: string | null) => {
      if (!value || !/^\d+$/.test(value)) return null;
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    };
    if (params.get("choose") === "1") {
      setAssessmentMode("select");
      setPhase("starting");
    } else if (params.get("testament") === "NT") {
      setAssessmentMode(NT_PILOT_ENABLED ? "NT" : "select");
      setNtRequestedScopeKey(params.get("scope")?.trim().toUpperCase() || "NT");
      setNtRequestedTargetCount(
        Math.min(50, Math.max(5, parsePositiveInteger(params.get("target")) ?? NT_PILOT_TARGET))
      );
      setPhase("starting");
    } else {
      const requestedTarget = parsePositiveInteger(params.get("target"));
      const isFocused = params.get("mode") === "focus";
      const isScopeTest = params.get("mode") === "scope";
      const forceNew = params.get("fresh") === "1";
      if (forceNew) {
        params.delete("fresh");
        const nextSearch = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
        );
      }
      setOtRequest({
        unitKey: isFocused ? params.get("unit") : null,
        scopeKey: isScopeTest ? params.get("scope")?.toUpperCase() ?? null : null,
        bookCode: isFocused ? params.get("book")?.toUpperCase() ?? null : null,
        startChapter: isFocused ? parsePositiveInteger(params.get("start")) : null,
        endChapter: isFocused ? parsePositiveInteger(params.get("end")) : null,
        label: isFocused || isScopeTest ? params.get("label") : null,
        dimensionKey: isFocused ? params.get("dimension") : null,
        targetQuestionCount: Math.min(50, Math.max(1, requestedTarget ?? TOTAL_INITIAL)),
        forceNew,
      });
      setAssessmentMode("OT");
      setPhase("starting");
    }
    setModeReady(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Question-load lifecycle helpers (locking, begin/finish) & shared
  // score-evidence loading
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
    pendingSpawnRef.current = null;
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
  }, [pendingSpawnRef]);

  const finishQuestionLoad = useCallback((questionId: string | null = null) => {
    activeQuestionIdRef.current = questionId;
    isLoadingQuestionRef.current = false;
    isSubmittingAnswerRef.current = false;
    questionInteractionLockedUntilRef.current = 0;
    setIsLoadingNextQuestion(false);
    setIsSubmittingAnswer(false);
  }, []);

  const loadScoreEvidence = useCallback(async (uid: string, scope: Testament) => {
    const { data, error } = await supabase.rpc("obs_get_bli_uncertainty", {
      p_user_id: uid,
      p_scope: scope,
    });
    if (error) return;
    let evidence = ((data ?? [])[0] as BliEvidence | undefined) ?? null;
    if (!evidence && scope === "OT") {
      const { data: bibleData, error: bibleError } = await supabase.rpc("obs_get_bli_uncertainty", {
        p_user_id: uid,
        p_scope: "BIBLE",
      });
      if (!bibleError) evidence = ((bibleData ?? [])[0] as BliEvidence | undefined) ?? null;
    }
    setScoreEvidence(evidence);
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
    setReportCategory("wrong_answer");
    setReportText("");
    setReportStatus("idle");
    setReportError("");
    finishQuestionLoad(row.out_generated_question_id);
    setPhase("question");
    shiftSky();
  }, [finishQuestionLoad, shiftSky]);

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
    const existing = otQuestionPrefetchRef.current;
    if (
      existing
      && existing.attemptId === aid
      && existing.afterAnsweredCount === afterAnsweredCount
    ) return;

    const prefetch: QuestionPrefetch<Question> = {
      attemptId: aid,
      afterAnsweredCount,
      settled: false,
      data: null,
      error: null,
      promise: Promise.resolve(),
    };
    prefetch.promise = (async () => {
      try {
        const { data, error } = await supabase.rpc("obs_get_next_ot_assessment_question", {
          p_attempt_id: aid,
        });
        prefetch.data = (data ?? null) as Question[] | null;
        prefetch.error = error;
      } catch (error: unknown) {
        prefetch.error = error instanceof Error ? { message: error.message } : { message: "Question prefetch failed" };
      } finally {
        prefetch.settled = true;
      }
    })();
    otQuestionPrefetchRef.current = prefetch;
  }, []);

  const consumePrefetchedOtQuestion = useCallback(async (aid: string, afterAnsweredCount: number) => {
    const prefetch = otQuestionPrefetchRef.current;
    if (
      !prefetch
      || prefetch.attemptId !== aid
      || prefetch.afterAnsweredCount !== afterAnsweredCount
    ) {
      return false;
    }

    await prefetch.promise;
    if (otQuestionPrefetchRef.current !== prefetch) return false;
    otQuestionPrefetchRef.current = null;
    if (isStatementTimeoutError(prefetch.error)) return false;
    await handleOtQuestionResult(aid, prefetch.data, prefetch.error);
    return true;
  }, [handleOtQuestionResult]);

  const loadQuestion = useCallback(async (aid: string) => {
    setDebugErrorMsg("");
    setIsLoadingNextQuestion(true);
    let lastData: Question[] | null = null;
    let lastError: RpcErrorLike = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supabase.rpc("obs_get_next_ot_assessment_question", {
        p_attempt_id: aid,
      });
      lastData = (data ?? null) as Question[] | null;
      lastError = error;
      if (!isStatementTimeoutError(error)) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    await handleOtQuestionResult(aid, lastData, lastError);
  }, [handleOtQuestionResult]);

  // ---------------------------------------------------------------------------
  // NT book metadata loading, and the effects that trigger it / drive the
  // slow-startup indicator
  // ---------------------------------------------------------------------------
  const loadNtMetadata = useCallback(async () => {
    if (!NT_PILOT_ENABLED) return;
    setNtMetadataLoaded(false);
    const { data, error } = await supabase
      .from("scripture_books")
      .select("book_code,canon_order,name,nt_division")
      .eq("testament", "NT")
      .order("canon_order", { ascending: true });

    if (error) {
      setNtError(error.message);
      setNtMetadataLoaded(true);
      return;
    }

    const rows = (data ?? [])
      .map(row => {
        const ntDivision = typeof row.nt_division === "string" ? normalizeNtSection(row.nt_division) : null;
        if (
          typeof row.book_code === "string" &&
          typeof row.canon_order === "number" &&
          typeof row.name === "string" &&
          ntDivision
        ) {
          return {
            book_code: row.book_code,
            canon_order: row.canon_order,
            name: row.name,
            nt_division: ntDivision,
          };
        }
        return null;
      })
      .filter((row): row is NtBookMetadata => {
        return row !== null;
      })
      .sort((a, b) => a.canon_order - b.canon_order);
    setNtBooks(rows);
    setNtMetadataLoaded(true);
  }, []);

  useEffect(() => {
    if (!modeReady || assessmentMode !== "NT") return;
    void loadNtMetadata();
  }, [assessmentMode, loadNtMetadata, modeReady]);

  useEffect(() => {
    if (phase !== "starting" || assessmentMode === "select") {
      setStartupWaitLevel(0);
      return;
    }

    setStartupWaitLevel(0);
    const slowTimer = window.setTimeout(() => setStartupWaitLevel(1), 3200);
    const verySlowTimer = window.setTimeout(() => setStartupWaitLevel(2), 8000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(verySlowTimer);
    };
  }, [assessmentMode, phase]);

  // ---------------------------------------------------------------------------
  // Assessment session bootstrap: reuse or create an anonymous/signed-in
  // session and its user id
  // ---------------------------------------------------------------------------
  const ensureAssessmentSession = useCallback(async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (session?.user && !session.user.email) {
      const belongsToThisBrowserSession =
        sessionStorage.getItem(ANON_SESSION_ACTIVE_KEY) === "1";
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (
        !belongsToThisBrowserSession ||
        userError ||
        userData.user?.id !== session.user.id
      ) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        session = null;
      }
    }
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    const uid = session?.user?.id;
    if (!uid) throw new Error("No user ID");
    setUserId(uid);
    setIsSignedIn(Boolean(session?.user?.email));
    if (!session?.user.email) {
      sessionStorage.setItem(ANON_SESSION_ACTIVE_KEY, "1");
      sessionStorage.setItem(ANON_USER_ID_KEY, uid);
      localStorage.setItem(ANON_USER_ID_KEY, uid);
    }
    return uid;
  }, []);

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
    shiftSky();
    return true;
  }, [finishQuestionLoad, shiftSky]);

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
  }, [applyNtQuestionRow, finishQuestionLoad]);

  const prefetchNtQuestion = useCallback((aid: string, afterAnsweredCount: number) => {
    const existing = ntQuestionPrefetchRef.current;
    if (
      existing
      && existing.attemptId === aid
      && existing.afterAnsweredCount === afterAnsweredCount
    ) return;

    const prefetch: QuestionPrefetch<NtAssessmentQuestionRow> = {
      attemptId: aid,
      afterAnsweredCount,
      settled: false,
      data: null,
      error: null,
      promise: Promise.resolve(),
    };
    prefetch.promise = (async () => {
      try {
        const { data, error } = await supabase.rpc("obs_get_next_nt_assessment_question", {
          p_attempt_id: aid,
        });
        prefetch.data = (data ?? null) as NtAssessmentQuestionRow[] | null;
        prefetch.error = error;
      } catch (error: unknown) {
        prefetch.error = error instanceof Error ? { message: error.message } : { message: "Question prefetch failed" };
      } finally {
        prefetch.settled = true;
      }
    })();
    ntQuestionPrefetchRef.current = prefetch;
  }, []);

  const consumePrefetchedNtQuestion = useCallback(async (
    aid: string,
    scope: NtScopeOption,
    afterAnsweredCount: number,
  ) => {
    const prefetch = ntQuestionPrefetchRef.current;
    if (
      !prefetch
      || prefetch.attemptId !== aid
      || prefetch.afterAnsweredCount !== afterAnsweredCount
    ) {
      return false;
    }

    await prefetch.promise;
    if (ntQuestionPrefetchRef.current !== prefetch) return false;
    ntQuestionPrefetchRef.current = null;
    handleNtQuestionResult(aid, scope, prefetch.data, prefetch.error);
    return true;
  }, [handleNtQuestionResult]);

  const loadNtQuestion = useCallback(async (aid: string, scope: NtScopeOption) => {
    setIsLoadingNextQuestion(true);
    const { data, error } = await supabase.rpc("obs_get_next_nt_assessment_question", {
      p_attempt_id: aid,
    });
    handleNtQuestionResult(aid, scope, (data ?? null) as NtAssessmentQuestionRow[] | null, error);
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
  }, [ensureAssessmentSession, loadNtQuestion, loadScoreEvidence, ntRequestedTargetCount, ntScope]);

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
  }, [assessmentMode, ensureAssessmentSession, loadNtQuestion, loadScoreEvidence, modeReady, ntBooks, ntMetadataLoaded, ntRequestedScopeKey, ntRequestedTargetCount, startNtPilot]);

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
  const rpcErrorMessage = useCallback((err: RpcErrorLike) => (
    typeof err?.message === "string" && err.message.trim()
      ? err.message
      : "Answer submission failed without a detailed error message"
  ), []);

  const rpcErrorCode = useCallback((err: RpcErrorLike) => (
    typeof err?.code === "string" && err.code.trim() ? err.code : null
  ), []);

  const isChangedRetryRejection = useCallback((err: RpcErrorLike) =>
    Boolean(err && /already answered/i.test(rpcErrorMessage(err))), [rpcErrorMessage]);

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
      ? rpcErrorMessage(error)
      : "No result returned from answer submission";
    const prompt = typeof context.prompt === "string" ? context.prompt : question?.prompt ?? null;
    const feedbackText = [
      "Answer submission failed without advancing the assessment.",
      `Error code: ${rpcErrorCode(error) ?? "unknown"}`,
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
  }, [attemptId, question?.prompt, rpcErrorCode, rpcErrorMessage, userId]);

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
      code: rpcErrorCode(error),
      message: error ? rpcErrorMessage(error) : "No result returned from answer submission",
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
      p_error_code: rpcErrorCode(error),
      p_error_message: error ? rpcErrorMessage(error) : "No result returned from answer submission",
      p_context: skipContext,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (skipError) {
      await logQuestionMisfire({ submittedQuestionId, error: error ?? skipError, context });
      isSubmittingAnswerRef.current = false;
      setIsSubmittingAnswer(false);
      setDebugErrorMsg(`${rpcErrorCode(skipError) ? `${rpcErrorCode(skipError)}: ` : ""}${rpcErrorMessage(skipError)}`);
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
    rpcErrorCode,
    rpcErrorMessage,
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
      if (rpcErrorMessage(error).includes("assessment_answers_user_id_fkey")) {
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
      spawnTraveler();
    }
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    setPhase("feedback");
  }, [attemptId, userId, question, phase, isQuestionInteractionLocked, sequenceOrder, answeredCount, correctCount, failAnswerSubmission, isChangedRetryRejection, loadScoreEvidence, otTargetCount, prefetchOtQuestion, rpcErrorMessage, spawnTraveler]);

  // ---------------------------------------------------------------------------
  // Sequence-question interaction (drag-to-order events)
  // ---------------------------------------------------------------------------
  const moveSequenceItem = useCallback((itemId: string, direction: -1 | 1) => {
    if (phase !== "question" || isQuestionInteractionLocked()) return;
    setSequenceOrder(current => {
      const currentIndex = current.findIndex(item => item.id === itemId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      return arrayMove(current, currentIndex, nextIndex);
    });
  }, [isQuestionInteractionLocked, phase]);

  const handleSequenceDragEnd = useCallback((event: DragEndEvent) => {
    if (phase !== "question" || isQuestionInteractionLocked()) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSequenceOrder(current => {
      const oldIndex = current.findIndex(item => item.id === active.id);
      const newIndex = current.findIndex(item => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, [isQuestionInteractionLocked, phase]);

  const submitSequenceOrder = useCallback(() => {
    if (sequenceOrder.length === 0 || phase !== "question" || isQuestionInteractionLocked()) return;
    void submitAnswer(`__ORDER__:${JSON.stringify(sequenceOrder.map(item => item.id))}`);
  }, [isQuestionInteractionLocked, phase, sequenceOrder, submitAnswer]);

  // ---------------------------------------------------------------------------
  // Section-sort-question interaction (drag books into their canon section)
  // ---------------------------------------------------------------------------
  const sectionSortInteraction = useMemo(
    () => getSectionSortInteraction(question),
    [question],
  );

  const sectionSortLabelsByZone = useMemo(() => {
    const byZone = new Map<SectionSortKey | "UNASSIGNED", SectionSortLabel[]>();
    byZone.set("UNASSIGNED", []);
    if (!sectionSortInteraction) return byZone;
    for (const zone of sectionSortInteraction.dropZones) byZone.set(zone.id, []);

    for (const label of sectionSortInteraction.dragLabels) {
      const assignedZone = sectionSortAssignments[label.id] ?? "UNASSIGNED";
      byZone.get(assignedZone)?.push(label);
    }
    return byZone;
  }, [sectionSortAssignments, sectionSortInteraction]);

  const sectionSortReadyToSubmit = Boolean(
    sectionSortInteraction
    && sectionSortInteraction.dragLabels.length > 0
    && sectionSortInteraction.dragLabels.every(label => sectionSortAssignments[label.id]),
  );

  const handleSectionSortDragEnd = useCallback((event: DragEndEvent) => {
    if (phase !== "question" || isQuestionInteractionLocked()) return;
    const { active, over } = event;
    if (!over || !sectionSortInteraction) return;
    const zoneId = String(over.id) as SectionSortKey;
    if (!sectionSortInteraction.dropZones.some(zone => zone.id === zoneId)) return;
    if (!sectionSortInteraction.dragLabels.some(label => label.id === String(active.id))) return;

    setSectionSortAssignments(current => ({
      ...current,
      [String(active.id)]: zoneId,
    }));
  }, [isQuestionInteractionLocked, phase, sectionSortInteraction]);

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
    spawnTraveler();
    setPhase("feedback");
  }, [answeredCount, attemptId, correctCount, failAnswerSubmission, isChangedRetryRejection, isQuestionInteractionLocked, loadScoreEvidence, ntTargetCount, phase, prefetchNtQuestion, question, spawnTraveler, userId]);

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
    spawnTraveler();
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
    spawnTraveler,
    userId,
  ]);

  // ---------------------------------------------------------------------------
  // Report-a-problem submission
  // ---------------------------------------------------------------------------
  const submitQuestionReport = useCallback(async () => {
    if (!question || !userId) return;
    const trimmedFeedback = reportText.trim();
    if (reportCategory === "other" && !trimmedFeedback) {
      setReportError("Add a short note so we know what to review.");
      return;
    }

    setIsSubmittingReport(true);
    setReportError("");
    const reportSelectedChoiceId = selectedChoice
      && (selectedChoice === IDK_CHOICE_ID || question.choices.some(choice => choice.id === selectedChoice))
      ? selectedChoice
      : null;
    const { error } = await supabase
      .from("question_reports")
      .insert({
        generated_question_id: question.out_generated_question_id,
        attempt_id: attemptId,
        user_id: userId,
        report_category: reportCategory,
        feedback_text: trimmedFeedback || null,
        selected_choice_id: reportSelectedChoiceId,
        correct_choice_id: correctChoiceId,
        question_prompt: question.prompt,
      });

    setIsSubmittingReport(false);
    if (error) {
      setReportError(error.message);
      return;
    }
    setReportStatus("sent");
  }, [attemptId, correctChoiceId, question, reportCategory, reportText, selectedChoice, userId]);

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
  const choiceLabel = (id: string) => {
    if (!selectedChoice) return "";
    if (assessmentMode === "OT") return id === selectedChoice ? "recorded" : "";
    if (id === correctChoiceId) return "correct";
    if (id === IDK_CHOICE_ID && selectedChoice === IDK_CHOICE_ID) return "skipped";
    if (id === selectedChoice && !isCorrect) return "wrong";
    return "";
  };

  const visibleChoices = question
    ? [...question.choices, IDK_CHOICE]
    : [];
  const isSectionSortQuestion = question !== null
    && sectionSortInteraction !== null;
  const isSequenceQuestion = assessmentMode === "OT"
    && question !== null
    && !isSectionSortQuestion
    && isOrderResponseQuestion(question);
  const concealsBookAnswer = question ? promptAsksForBookAnswer(question) : false;
  const concealsSectionAnswer = assessmentMode === "OT" && question ? promptAsksForSectionAnswer(question) : false;
  const usesSectionLevelLabel = assessmentMode === "OT" && question ? isBroadSectionLevelQuestion(question) : false;
  const showsLocationLabels = !concealsSectionAnswer && !usesSectionLevelLabel;
  const showsBookLabel = !concealsBookAnswer && !usesSectionLevelLabel;
  const isSkipped = selectedChoice === IDK_CHOICE_ID;
  const nebulaCount = Math.max(scoreEvidence?.n_responses ?? 0, answeredCount);
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const ntProgressEnd = assessmentMode === "NT" ? Math.max(ntTargetCount, 1) : Math.max(otTargetCount, 1);
  const ntProgressPct = assessmentMode === "NT"
    ? Math.min(100, Math.max(0, (answeredCount / ntProgressEnd) * 100))
    : 0;
  const isInitialPhase = answeredCount < otTargetCount;
  const isScopeOtAssessment = Boolean(otRequest.scopeKey);
  const isTargetedOtAssessment = otAssessment?.assessment_kind === "ot_focused" || isScopeOtAssessment;
  const showsTargetedOtLabel = assessmentMode === "OT" && isTargetedOtAssessment && !concealsBookAnswer && !usesSectionLevelLabel;
  const nextMilestone = answeredCount < otTargetCount ? otTargetCount : Math.ceil((answeredCount + 1) / 10) * 10;
  const progressStart = isInitialPhase ? 0 : nextMilestone - 10;
  const progressEnd = isInitialPhase ? otTargetCount : nextMilestone;
  const progressPct = Math.min(100, Math.max(0, ((answeredCount - progressStart) / Math.max(1, progressEnd - progressStart)) * 100));
  const hasBrowserSavedProgress = !isSignedIn && answeredCount > 0;
  const navPhaseLabel = isInitialPhase
    ? (isTargetedOtAssessment
      ? isScopeOtAssessment
        ? otAssessment?.book_code ? "Book Test" : "Section Test"
        : "Focused Retest"
      : isSignedIn ? "BLI Baseline" : hasBrowserSavedProgress ? "Saved Baseline" : "Initial Assessment")
    : (isSignedIn ? "BLI Refinement" : "Browser-Saved Practice");
  const navSubLabel = isInitialPhase
    ? (isTargetedOtAssessment
      ? `${otAssessment?.label ?? otRequest.label ?? "Targeted assessment"} · ${answeredCount} of ${otTargetCount}`
      : hasBrowserSavedProgress
        ? `${answeredCount} of ${otTargetCount} answered in this browser`
        : `${Math.max(0, otTargetCount - answeredCount)} questions until first BLI snapshot`)
    : (isSignedIn ? "Your BLI refines after every answer" : "Sign in to preserve your BLI across devices");
  const displayNavPhaseLabel = assessmentMode === "NT" ? "New Testament Assessment" : navPhaseLabel;
  const displayNavSubLabel = assessmentMode === "NT"
    ? `${ntScope.label} · separate NT BLI`
    : navSubLabel;
  const displayProgressPct = assessmentMode === "NT" ? ntProgressPct : progressPct;
  const displayProgressEnd = assessmentMode === "NT" ? ntProgressEnd : progressEnd;
  const skyDiscovery = skyDiscoveryMilestone(answeredCount);
  const showSkyDiscovery = Boolean(
    skyDiscovery
    && !dismissedSkyDiscoveries.has(skyDiscovery)
    && (phase === "question" || phase === "feedback")
    && assessmentMode !== "select",
  );

  // ---------------------------------------------------------------------------
  // Auth: sign in / sign out
  // ---------------------------------------------------------------------------
  const handleSignOut = useCallback(async () => {
    // Never leave a pending capability behind for the next person on this
    // browser — it would move this visitor's guest progress into their account.
    clearPendingTransfer(localStorage);
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  const handleGoogleSignIn = async () => {
    setSaving(true);
    // Mint the transfer capability while still signed in as the guest — holding
    // that session is what proves ownership of the progress. The record goes to
    // localStorage and never into the redirect URL; putting a UUID in the URL
    // let a crafted callback link claim another visitor's progress. Starting a
    // flow replaces any earlier record, so an abandoned one cannot be completed.
    // The flow id is a random, non-secret correlator, NOT a credential: it only
    // proves this callback is the completion of this flow. The capability
    // itself stays in localStorage and never enters the URL.
    const flowId = newFlowId();
    if (userId) await beginPendingTransfer(supabase, localStorage, userId, flowId);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl({ flow: flowId }),
      },
    });
    if (error) { console.error("OAuth sign-in failed:", error); setSaving(false); setErrorMsg(error.message); }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setSaving(true);
    // Same capability, minted before the link is sent. A magic link is often
    // opened in a different tab or window, which is why the record lives in
    // localStorage (shared same-origin) rather than sessionStorage.
    const flowId = newFlowId();
    if (userId) await beginPendingTransfer(supabase, localStorage, userId, flowId);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Route through the callback so guest progress is actually claimed. This
      // previously landed on "/", which performs no transfer at all, so
      // magic-link users silently lost their guest progress. The flow id rides
      // along so the callback can prove it completes THIS request.
      options: { emailRedirectTo: authCallbackUrl({ flow: flowId }) },
    });
    setSaving(false);
    if (error) { console.error("Magic link request failed:", error); setErrorMsg(error.message); return; }
    setSaved(true);
  };

  // ---------------------------------------------------------------------------
  // Transition to dashboard (writes the starfield handoff keys the home
  // page's useHomeStarfield reads on arrival)
  // ---------------------------------------------------------------------------
  const transitionToDashboard = () => {
    if (isDashboardTransitioning) return;
    setIsDashboardTransitioning(true);
    sessionStorage.setItem("obs_dashboard_arriving", "1");
    sessionStorage.setItem("obs_dashboard_sky_rotation", "90");
    window.setTimeout(() => {
      sessionStorage.setItem("obs_dashboard_sky_frame", String(skyFrameRef.current));
      sessionStorage.setItem("obs_dashboard_sky_offset", JSON.stringify(offsetRef.current));
      window.location.href = "/";
    }, 2350);
  };

  return (
    <>
      <style>{ASSESS_PAGE_STYLES}</style>

      <canvas ref={canvasRef} className={`stars ${isDashboardTransitioning ? "dashboard-transition" : ""}`} aria-hidden="true" />
      <BlackHoleEvent answeredCount={answeredCount} userId={userId} />
      {answeredCount > 0 && !isDashboardTransitioning && (
        <div className="confidence-nebula-label" aria-hidden="true">
          <span>Evidence</span>
          <strong>{scoreEvidence?.evidence_level ?? "Gathering"}</strong>
          <small>
            {scoreEvidence ? `${scoreEvidence.n_responses} responses` : "Updating estimate"}
            {nebulaCount > 0 ? ` · ${NEBULA_STAGE_NAMES[nebulaStageIndex(nebulaCount)]}` : ""}
          </small>
        </div>
      )}
      {isDashboardTransitioning && <div className="dashboard-warp" aria-hidden="true" />}
      {assessmentMode === "NT" && phase === "feedback" && isCorrect && (
        <div key={`${answeredCount}-${question?.out_generated_question_id || "correct"}`} className="cosmic-burst" aria-hidden="true">
          <span className="firework firework-one"><i className="spark spark-a" /><i className="spark spark-b" /><i className="spark spark-c" /><i className="spark spark-d" /><i className="spark spark-e" /><i className="spark spark-f" /></span>
          <span className="firework firework-two"><i className="spark spark-a" /><i className="spark spark-b" /><i className="spark spark-c" /><i className="spark spark-d" /><i className="spark spark-e" /><i className="spark spark-f" /></span>
          <span className="firework firework-three"><i className="spark spark-a" /><i className="spark spark-b" /><i className="spark spark-c" /><i className="spark spark-d" /><i className="spark spark-e" /><i className="spark spark-f" /></span>
        </div>
      )}
      {showSkyDiscovery && skyDiscovery && (
        <button
          className="sky-discovery"
          type="button"
          aria-label="Open a Bible fact"
          title="Open a Bible fact"
          onClick={() => {
            const factIndex = hashString(`${attemptId ?? "assessment"}:${skyDiscovery}`) % BIBLE_SKY_FACTS.length;
            setActiveBibleFact(BIBLE_SKY_FACTS[factIndex]);
            setDismissedSkyDiscoveries(current => new Set(current).add(skyDiscovery));
          }}
        />
      )}

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
              onReportRequest={() => {
                setReportStatus("idle");
                setReportError("");
                setShowReportModal(true);
              }}
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
              pendingSpawnRef={pendingSpawnRef}
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
          submitQuestionReport={submitQuestionReport}
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
