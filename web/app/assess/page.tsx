"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { beginPendingTransfer, clearPendingTransfer, newFlowId } from "@/lib/auth/anonymousTransfer";
import { authCallbackUrl } from "@/lib/auth/redirect";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { BOOK_NAMES } from "@/lib/bibleTaxonomy";
import BlackHoleEvent from "./BlackHoleEvent";
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  NEBULA_STAGE_NAMES,
  NT_PILOT_ENABLED,
  NT_PILOT_TARGET,
  NT_SECTION_LABELS,
  NT_ATTEMPT_ID_KEY,
  OT_ATTEMPT_ID_KEY,
  SECTION_COLORS,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  TOTAL_INITIAL,
} from "./constants";
import {
  HEBREW_BIBLE_DIVISION_NOTE,
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
import {
  SectionSortDropZone,
  SectionSortLabelChip,
  SortableSequenceItem,
} from "./QuestionInteractionItems";
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
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { nebulaStageIndex, useAssessmentStarfield } from "./useAssessmentStarfield";

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

const IDK_CHOICE_ID = "__IDK__";
const IDK_CHOICE: Choice = { id: IDK_CHOICE_ID, text: "I don't know" };
const REPORT_OPTIONS: { value: ReportCategory; label: string }[] = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "inaccurate", label: "Inaccurate" },
  { value: "poorly_worded", label: "Poorly worded" },
  { value: "other", label: "Other" },
];

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
  sessionStorage.removeItem(OT_ATTEMPT_ID_KEY);
  sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
}

export default function AssessPage() {
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
      <style>{`
        :root {
          --navy: #1b2442; --accent: #0aa3a3; --muted: #566070;
          --accent-dim: rgba(10,163,163,.10); --accent-line: rgba(10,163,163,.22);
          --card: rgba(255,255,255,.93); --border: rgba(27,36,66,.09);
          --shadow: 0 24px 64px rgba(0,0,0,.40), 0 4px 16px rgba(0,0,0,.2);
          --correct: #059669; --correct-bg: #ecfdf5; --correct-line: rgba(5,150,105,.2);
          --wrong: #dc2626; --wrong-bg: #fef2f2; --wrong-line: rgba(220,38,38,.2);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body {
          font-family: var(--font-inter), system-ui, sans-serif;
          min-height: 100vh; background: #0b0f1e;
          display: flex; flex-direction: column; overflow-x: hidden;
        }
        canvas.stars {
          position: fixed; left: 50%; top: 50%; z-index: 0; pointer-events: none;
          transform-origin: 50% 50%; transform: translate3d(-50%,-50%,0);
        }
        .confidence-nebula-label {
          position: fixed; right: 110px; bottom: 26px; z-index: 1;
          transform: translateX(50%);
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          pointer-events: none; text-align: center;
        }
        .confidence-nebula-label span {
          font-size: 13px; font-weight: 850; letter-spacing: .18em;
          text-transform: uppercase; color: rgba(255,255,255,.62);
          text-shadow: 0 2px 10px rgba(0,0,0,.7);
        }
        .confidence-nebula-label strong {
          max-width: 150px; font-size: 17px; line-height: 1.05; font-weight: 800; color: rgba(255,255,255,.92);
          text-shadow: 0 2px 14px rgba(0,0,0,.75);
        }
        .confidence-nebula-label small {
          font-size: 10px; font-weight: 700; color: rgba(255,255,255,.48);
          text-shadow: 0 2px 10px rgba(0,0,0,.7);
        }
        canvas.stars.dashboard-transition { animation: starSpinDissolve 2.35s linear both; }
        @keyframes starSpinDissolve {
          0% { transform: translate3d(-50%,-50%,0) rotate(0deg); filter: brightness(1); opacity: 1; }
          100% { transform: translate3d(-50%,-50%,0) rotate(90deg); filter: brightness(1.14) saturate(1.06); opacity: .98; }
        }
        .dashboard-warp {
          position: fixed; inset: 0; z-index: 35; pointer-events: none;
          background:
            radial-gradient(circle at 50% 45%, rgba(10,163,163,.24), transparent 32%),
            radial-gradient(circle at 70% 32%, rgba(212,160,23,.15), transparent 28%),
            linear-gradient(100deg, transparent 0%, rgba(255,255,255,.08) 44%, rgba(173,232,255,.16) 50%, rgba(255,255,255,.07) 56%, transparent 100%);
          mix-blend-mode: screen;
          animation: dashboardWarp 1.9s ease-in-out both;
        }
        @keyframes dashboardWarp {
          0% { opacity: 0; transform: translateX(-8vw) scale(1.02); }
          38% { opacity: .82; }
          68% { opacity: .5; }
          100% { opacity: 0; transform: translateX(8vw) scale(1.02); }
        }

        /* Nav */
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 760px) minmax(0, 1fr);
          align-items: center; column-gap: 16px;
          padding: 13px 28px; background: rgba(11,15,30,.85);
          backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.07);
        }
        .scene.dashboard-transition,
        .nav.dashboard-transition,
        .results-fab.dashboard-transition {
          opacity: 0;
          transform: translateY(-4px) scale(.99);
          pointer-events: none;
          transition: opacity .78s ease, transform .78s ease;
        }
        .nav-brand {
          font-family: var(--font-crimson), Georgia, serif; font-weight: 600; font-size: 17px;
          color: #fff; text-decoration: none; opacity: .85;
        }
        .brand-wrap { display: inline-flex; align-items: center; gap: 8px; justify-self: start; }
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

        .nav-center { display: flex; flex-direction: column; align-items: center; justify-self: center; gap: 5px; width: 100%; min-width: 0; }
        .nav > .nav-actions { justify-self: end; }
        .nav-phase {
          font-size: 12px; font-weight: 850; letter-spacing: .12em;
          text-transform: uppercase; color: var(--accent);
        }
        .nav-subphase { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.52); line-height: 1; }
        .nav-progress-row { display: flex; align-items: center; gap: 10px; }
        .nav-count { font-size: 12.5px; color: rgba(255,255,255,.58); min-width: 44px; text-align: right; font-weight: 650; }
        .progress-bar-track {
          width: 230px; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,.12); overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%; border-radius: 999px; background: var(--accent);
          transition: width .5s cubic-bezier(.4,0,.2,1);
        }
        .nav-count-right { font-size: 12.5px; color: rgba(255,255,255,.58); min-width: 44px; font-weight: 650; }
        .nav-exit {
          font-size: 12.5px; font-weight: 650; color: rgba(255,255,255,.72); text-decoration: none;
          padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.045);
          transition: color .14s, background .14s, border-color .14s;
        }
        .nav-exit:hover, .nav-exit:focus-visible {
          color: #fff; background: rgba(255,255,255,.10); border-color: rgba(255,255,255,.28);
          outline: none;
        }
        .nav-actions {
          display: flex; align-items: center; gap: 8px;
        }
        .nav-action-button {
          cursor: pointer; font-family: inherit;
        }

        /* Scene */
        .scene {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 32px 24px 80px; position: relative; z-index: 1;
        }
        .card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 24px; padding: 46px 54px;
          box-shadow: var(--shadow); backdrop-filter: blur(20px);
          width: 100%; max-width: 760px;
          animation: cardIn .3s ease;
        }
        @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        /* Location graphic */
        .location-bar {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 18px; flex-wrap: wrap;
        }
        .question-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 14px; margin-bottom: 18px;
        }
        .question-head .location-bar { margin-bottom: 0; flex: 1; }
        .loc-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: .04em;
          border: 1px solid; white-space: nowrap;
        }
        .loc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .loc-sep { font-size: 11px; color: rgba(27,36,66,.25); }
        .tier-star { font-size: 11px; }
        .report-trigger {
          width: 34px; height: 34px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid rgba(27,36,66,.10); background: rgba(255,255,255,.62);
          color: rgba(86,96,112,.82); cursor: pointer; flex-shrink: 0;
          transition: background .13s, color .13s, transform .11s, border-color .13s;
        }
        .report-trigger:hover {
          background: #fff7ed; border-color: rgba(180,83,9,.22);
          color: #b45309; transform: translateY(-1px);
        }
        .report-trigger svg { width: 17px; height: 17px; }

        /* Question */
        .card-prompt {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 600; line-height: 1.42;
          color: var(--navy); margin-bottom: 30px;
        }
        .choices { display: flex; flex-direction: column; gap: 12px; }
        .choice {
          display: flex; align-items: center; gap: 15px;
          padding: 16px 18px; border-radius: 15px;
          border: 1.5px solid var(--border); background: rgba(255,255,255,.65);
          cursor: pointer; font-size: 15px; color: var(--navy); line-height: 1.45;
          transition: border-color .13s, background .13s, transform .11s;
          text-align: left; width: 100%; font-family: inherit;
        }
        .choice:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
          transform: translateX(3px);
        }
        .choice:disabled { cursor: default; }
        .choice.correct { border-color: var(--correct-line); background: var(--correct-bg); }
        .choice.wrong   { border-color: var(--wrong-line);   background: var(--wrong-bg); }
        .choice.skipped { border-color: rgba(86,96,112,.22); background: rgba(27,36,66,.045); }
        .choice.recorded { border-color: var(--accent-line); background: var(--accent-dim); }
        .choice-letter {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          background: rgba(27,36,66,.07); color: var(--muted);
          transition: background .13s, color .13s;
        }
        .choice.correct .choice-letter { background: var(--correct); color: #fff; }
        .choice.wrong   .choice-letter { background: var(--wrong);   color: #fff; }
        .choice.skipped .choice-letter { background: var(--muted); color: #fff; }
        .choice.recorded .choice-letter { background: var(--accent); color: #fff; }
        .sequence-instruction {
          margin: -18px 0 14px; color: var(--muted);
          font-size: 13px; line-height: 1.45;
        }
        .sequence-list { display: flex; flex-direction: column; gap: 9px; }
        .sequence-item {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 32px 38px minmax(0,1fr) auto;
          align-items: center; gap: 10px; min-height: 66px; padding: 10px 12px;
          border: 1.5px solid var(--border); border-radius: 8px;
          background: rgba(255,255,255,.76); color: var(--navy);
          box-shadow: 0 4px 12px rgba(27,36,66,.045);
        }
        .sequence-item.is-dragging {
          z-index: 4; border-color: var(--accent);
          background: #fff; box-shadow: 0 16px 34px rgba(27,36,66,.18);
        }
        .sequence-number {
          width: 30px; height: 30px; border-radius: 50%;
          display: grid; place-items: center;
          background: var(--navy); color: #fff;
          font-size: 12px; font-weight: 800;
        }
        .sequence-handle {
          width: 36px; height: 36px; border-radius: 7px;
          display: grid; place-items: center; border: 1px solid var(--border);
          background: rgba(27,36,66,.045); color: var(--muted);
          font: 800 20px/1 system-ui, sans-serif; cursor: grab;
          touch-action: none;
        }
        .sequence-handle:active { cursor: grabbing; }
        .sequence-handle:disabled { cursor: default; opacity: .5; }
        .sequence-text { font-size: 14.5px; line-height: 1.4; font-weight: 600; }
        .sequence-step-controls { display: inline-flex; gap: 5px; }
        .sequence-step-controls button {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--border); background: rgba(255,255,255,.78);
          color: var(--navy); font: 800 14px/1 system-ui, sans-serif; cursor: pointer;
        }
        .sequence-step-controls button:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
        }
        .sequence-step-controls button:disabled { opacity: .28; cursor: default; }
        .sequence-actions {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 16px;
        }
        .sequence-submit, .sequence-skip {
          min-height: 43px; border-radius: 999px; padding: 0 19px;
          font: 750 13px/1 inherit; cursor: pointer;
        }
        .sequence-submit {
          border: 0; background: var(--navy); color: #fff;
          box-shadow: 0 9px 22px rgba(27,36,66,.22);
        }
        .sequence-submit:hover:not(:disabled) { background: #253566; transform: translateY(-1px); }
        .sequence-skip {
          border: 1px solid var(--border); background: rgba(255,255,255,.64);
          color: var(--muted);
        }
        .sequence-submit:disabled, .sequence-skip:disabled { opacity: .55; cursor: default; }
        .section-sort-question { display: flex; flex-direction: column; gap: 16px; }
        .section-sort-bank {
          min-height: 62px; display: flex; align-items: center; flex-wrap: wrap; gap: 9px;
          padding: 12px; border-radius: 8px;
          border: 1.5px dashed rgba(27,36,66,.16);
          background: rgba(27,36,66,.035);
        }
        .section-sort-chip {
          position: relative; z-index: 2;
          min-height: 34px; padding: 0 12px; border-radius: 999px;
          border: 1px solid rgba(27,36,66,.12);
          background: #fff; color: var(--navy);
          font: 760 13px/1 var(--font-inter), system-ui, sans-serif;
          box-shadow: 0 4px 11px rgba(27,36,66,.075);
          cursor: grab; touch-action: none;
        }
        .section-sort-chip:active { cursor: grabbing; }
        .section-sort-chip:disabled { cursor: default; opacity: .68; }
        .section-sort-chip.is-dragging {
          z-index: 8; opacity: .92;
          box-shadow: 0 16px 34px rgba(27,36,66,.18);
        }
        .section-sort-zones {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
        }
        .section-sort-zone {
          min-height: 154px; padding: 13px; border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px;
          border: 1.5px solid rgba(27,36,66,.12);
          background: rgba(255,255,255,.62);
          box-shadow: inset 0 0 0 8px rgba(10,163,163,.035);
          transition: border-color .14s, background .14s, transform .12s;
        }
        .section-sort-zone.is-over {
          border-color: var(--accent);
          background: rgba(10,163,163,.10);
          transform: scale(1.015);
        }
        .section-sort-zone-title {
          max-width: 112px; text-align: center;
          color: var(--navy); font-size: 12px; font-weight: 850; line-height: 1.15;
        }
        .section-sort-zone-labels {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; min-height: 38px;
        }
        .section-sort-zone .section-sort-chip {
          min-height: 30px; padding: 0 10px; font-size: 12px;
        }
        .section-sort-empty {
          color: rgba(86,96,112,.52); font-size: 12px; font-weight: 650;
        }

        /* Feedback */
        .retry-notice {
          display: flex; align-items: flex-start; gap: 10px;
          margin-bottom: 16px; padding: 11px 13px; border-radius: 10px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a5f5f; font-size: 13px; line-height: 1.5;
        }
        .retry-notice svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
        .retry-notice span { flex: 1; }
        .retry-notice button {
          flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px;
          border: 0; background: transparent; cursor: pointer;
          color: #0a5f5f; font-size: 17px; line-height: 1; font-family: inherit;
        }
        .retry-notice button:hover { background: rgba(10,163,163,.16); }
        .retry-notice button:focus-visible { outline: 2px solid #0aa3a3; outline-offset: 1px; }
        .feedback-bar {
          margin-top: 20px; padding: 14px 18px; border-radius: 13px;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .feedback-bar.correct { background: var(--correct-bg); border: 1px solid var(--correct-line); }
        .feedback-bar.wrong   { background: var(--wrong-bg);   border: 1px solid var(--wrong-line); }
        .feedback-bar.skipped { background: rgba(27,36,66,.045); border: 1px solid rgba(86,96,112,.18); }
        .feedback-bar.recorded { background: var(--accent-dim); border: 1px solid var(--accent-line); }
        .feedback-text { font-size: 13.5px; font-weight: 600; }
        .feedback-bar.correct .feedback-text { color: var(--correct); }
        .feedback-bar.wrong   .feedback-text { color: var(--wrong); }
        .feedback-bar.skipped .feedback-text { color: var(--muted); }
        .feedback-bar.recorded .feedback-text { color: #0a6969; }
        .canon-note {
          margin-top: 12px; padding: 13px 15px; border-radius: 10px;
          background: rgba(212,160,23,.11); border: 1px solid rgba(212,160,23,.28);
          color: #5f4308; font-size: 13px; line-height: 1.55;
          display: grid; gap: 3px;
        }
        .canon-note strong {
          color: #3b2a05; font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
        }
        .next-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px; border-radius: 999px;
          background: var(--navy); color: #fff;
          font-size: 13px; font-weight: 600; border: none; cursor: pointer;
          white-space: nowrap; flex-shrink: 0; font-family: inherit;
          transition: background .13s, transform .11s; text-decoration: none;
        }
        .next-btn:hover { background: #253566; transform: translateY(-1px); }

        /* Score row */
        .score-row {
          display: flex; gap: 20px; margin-top: 20px; padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .score-item { font-size: 12.5px; color: var(--muted); }
        .score-item strong { color: var(--navy); font-size: 15px; display: block; }

        /* Milestone banner — this fires once, at the moment a full baseline
           or targeted test actually finishes, so it earns a bit more
           presence than the routine teal UI around it: gold marks
           achievement elsewhere in the app (first-assessment-card, Torah
           bar), so this borrows that language instead of the standard
           interactive teal. */
        .milestone-banner {
          position: relative; overflow: hidden;
          margin-top: 16px; padding: 16px 18px; border-radius: 14px;
          background:
            linear-gradient(135deg, rgba(245,200,66,.20), rgba(212,160,23,.07)),
            rgba(255,255,255,.7);
          border: 1px solid rgba(212,160,23,.38);
          box-shadow: 0 10px 28px rgba(212,160,23,.12);
          font-size: 13px; color: #4a3a08; font-weight: 500;
          display: flex; align-items: center; gap: 14px;
          animation: milestoneIn .5s cubic-bezier(.22,.72,.18,1) both;
        }
        @keyframes milestoneIn {
          from { opacity: 0; transform: translateY(6px) scale(.98); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .milestone-banner { animation: none; }
        }
        .milestone-icon {
          flex-shrink: 0; width: 34px; height: 34px; border-radius: 999px;
          display: grid; place-items: center;
          background: radial-gradient(circle at 34% 30%, #fff4bd, #e6ad12 60%, #91680e);
          box-shadow: 0 0 0 4px rgba(230,173,18,.14), 0 4px 14px rgba(212,160,23,.35);
        }
        .milestone-icon svg { width: 17px; height: 17px; color: #4a3208; }
        .milestone-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; line-height: 1.45; }
        .milestone-kicker {
          font-size: 10.5px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase;
          color: #8a6208;
        }
        .milestone-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .milestone-results, .milestone-dashboard {
          min-height: 36px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; padding: 0 14px; font: 750 12px var(--font-inter), sans-serif;
          text-decoration: none; cursor: pointer; white-space: nowrap;
        }
        .milestone-results {
          color: #241a02; background: linear-gradient(135deg, #f5c842, #d4a017);
          border: 1px solid rgba(212,160,23,.5);
          box-shadow: 0 8px 20px rgba(212,160,23,.32);
        }
        .milestone-dashboard { color: #4a3a08; background: rgba(255,255,255,.65); border: 1px solid rgba(212,160,23,.28); }

        .cosmic-burst {
          position: fixed; inset: 0; z-index: 12; pointer-events: none; overflow: hidden;
          mix-blend-mode: screen;
        }
        .firework {
          --spark-length: 34px;
          --delay: 0s;
          position: absolute; width: 112px; height: 96px;
          left: 10vw; top: 24vh;
          color: rgba(173,232,255,1);
          opacity: 0;
          animation: fireworkPop 1.75s ease-out var(--delay) both;
        }
        .firework::before {
          content: ""; position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 18px currentColor, 0 0 36px rgba(255,255,255,.32);
          transform: translate(-50%, -50%);
          animation: fireworkCore 1.75s ease-out var(--delay) both;
        }
        .spark {
          position: absolute; left: 50%; top: 50%;
          width: var(--spark-length); height: 3px; border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,.95), currentColor 55%, transparent);
          filter: drop-shadow(0 0 7px currentColor);
          transform-origin: 0 50%;
          opacity: 0;
          animation: fireworkSpark 1.75s ease-out var(--delay) both;
        }
        .spark-a { --x: -7px;  --y: -8px;  --r: -125deg; }
        .spark-b { --x: -3px;  --y: -10px; --r: -98deg; }
        .spark-c { --x: 4px;   --y: -8px;  --r: -62deg; }
        .spark-d { --x: 8px;   --y: -2px;  --r: -28deg; }
        .spark-e { --x: 4px;   --y: 7px;   --r: 32deg; opacity: .72; }
        .spark-f { --x: -8px;  --y: 6px;   --r: 148deg; opacity: .72; }
        .firework-one { left: 8vw; top: 25vh; color: rgba(173,232,255,1); --delay: 0s; }
        .firework-two { left: 13vw; top: 18vh; color: rgba(212,160,23,.98); --delay: .16s; transform: scale(.9); }
        .firework-three { left: 17vw; top: 28vh; color: rgba(10,163,163,.98); --delay: .32s; transform: scale(.82); }
        @keyframes fireworkPop {
          0% { opacity: 0; }
          12% { opacity: 1; }
          72% { opacity: .88; }
          100% { opacity: 0; }
        }
        @keyframes fireworkCore {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.25); }
          16% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(.55); }
        }
        @keyframes fireworkSpark {
          0% { opacity: 0; width: 8px; transform: translate(var(--x), var(--y)) rotate(var(--r)) scaleX(.2); }
          18% { opacity: 1; width: var(--spark-length); }
          100% { opacity: 0; width: calc(var(--spark-length) * 1.12); transform: translate(calc(var(--x) * 3.2), calc(var(--y) * 3.2)) rotate(var(--r)) scaleX(1); }
        }

        /* Floating results button */
        .results-fab {
          position: fixed; bottom: 28px; right: 28px; z-index: 30;
          display: flex; align-items: center; gap: 11px;
          padding: 18px 28px; border-radius: 999px;
          background: linear-gradient(135deg, var(--navy), #253566 58%, #0a6e6e);
          color: #fff;
          font-size: 16px; font-weight: 800; border: none; cursor: pointer;
          box-shadow: 0 16px 38px rgba(0,0,0,.32), 0 0 28px rgba(10,163,163,.18);
          transition: transform .12s, box-shadow .15s;
          animation: fabIn .4s ease;
        }
        @keyframes fabIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .results-fab:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(0,0,0,.36), 0 0 34px rgba(10,163,163,.24); }
        .results-fab svg { width: 18px; height: 18px; }

        /* Results overlay */
        .overlay-backdrop {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,.6); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
        }
        .overlay-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 24px; padding: 36px 40px;
          box-shadow: var(--shadow); width: 100%; max-width: 480px;
          position: relative; animation: cardIn .25s ease;
        }
        .overlay-close {
          position: absolute; top: 16px; right: 16px;
          width: 32px; height: 32px; border-radius: 999px;
          background: rgba(27,36,66,.07); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); transition: background .13s;
        }
        .overlay-close:hover { background: rgba(27,36,66,.12); }
        .report-card { max-width: 520px; }
        .report-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 650; color: var(--navy); margin-bottom: 8px;
        }
        .report-desc { font-size: 13.5px; color: var(--muted); line-height: 1.55; margin-bottom: 16px; }
        .report-question {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(27,36,66,.045); border: 1px solid rgba(27,36,66,.08);
          color: var(--navy); font-size: 13.5px; line-height: 1.45; margin-bottom: 16px;
        }
        .report-options {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; margin-bottom: 14px;
        }
        .report-option {
          border: 1.5px solid var(--border); background: rgba(255,255,255,.72);
          color: var(--navy); border-radius: 12px; padding: 11px 12px;
          font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: inherit;
          transition: border-color .13s, background .13s, color .13s;
        }
        .report-option.is-active {
          background: var(--accent-dim); border-color: var(--accent-line); color: #0a5a5a;
        }
        .report-textarea {
          width: 100%; min-height: 108px; resize: vertical;
          border: 1.5px solid var(--border); border-radius: 12px;
          padding: 12px 14px; font-size: 14px; line-height: 1.5;
          font-family: inherit; color: var(--navy); outline: none;
          background: rgba(255,255,255,.74);
        }
        .report-textarea:focus { border-color: var(--accent-line); background: #fff; }
        .report-error { color: var(--wrong); font-size: 12.5px; font-weight: 650; margin-top: 10px; }
        .report-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; margin-top: 16px;
        }
        .report-submit {
          border: none; border-radius: 999px; background: var(--navy); color: #fff;
          padding: 10px 18px; font-size: 13.5px; font-weight: 750;
          cursor: pointer; font-family: inherit;
        }
        .report-submit:disabled { opacity: .62; cursor: default; }
        .report-cancel {
          border: 1px solid var(--border); border-radius: 999px;
          background: rgba(255,255,255,.58); color: var(--muted);
          padding: 9px 16px; font-size: 13px; font-weight: 650;
          cursor: pointer; font-family: inherit;
        }
        .report-sent {
          padding: 22px 6px 4px; text-align: center;
          color: var(--correct); font-size: 15px; font-weight: 750;
        }
        .overlay-score {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 64px; font-weight: 700; color: var(--navy);
          line-height: 1; text-align: center; margin-bottom: 4px;
        }
        .overlay-label { text-align: center; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 20px; }
        .overlay-stats { display: flex; justify-content: center; gap: 28px; margin-bottom: 24px; }
        .overlay-stat { text-align: center; }
        .overlay-stat strong { display: block; font-size: 20px; font-weight: 700; color: var(--navy); font-family: var(--font-crimson), Georgia, serif; }
        .overlay-stat span { font-size: 12px; color: var(--muted); }
        .overlay-divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
        .overlay-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 18px; font-weight: 600; color: var(--navy); margin-bottom: 12px; }
        .overlay-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin-bottom: 16px; }
        .google-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px 20px; border-radius: 12px;
          background: #fff; color: #1f2937; font-size: 14px; font-weight: 600;
          border: 1.5px solid rgba(27,36,66,.12); cursor: pointer; font-family: inherit;
          box-shadow: 0 2px 8px rgba(0,0,0,.08); transition: box-shadow .14s, transform .12s;
          margin-bottom: 12px;
        }
        .google-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); transform: translateY(-1px); }
        .google-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
        .divider-or { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
        .divider-or::before, .divider-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
        .divider-or span { font-size: 12px; color: var(--muted); }
        .magic-row { display: flex; gap: 8px; }
        .magic-input {
          flex: 1; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid var(--border); font-size: 14px; font-family: inherit;
          outline: none; transition: border-color .13s;
        }
        .magic-input:focus { border-color: var(--accent-line); }
        .magic-btn {
          padding: 11px 18px; border-radius: 10px;
          background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 600;
          border: none; cursor: pointer; font-family: inherit; white-space: nowrap;
          transition: background .13s;
        }
        .magic-btn:hover { background: #253566; }
        .save-success { font-size: 13.5px; color: var(--correct); font-weight: 600; text-align: center; padding: 12px; }
        .skip-link { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: var(--muted); cursor: pointer; }
        .skip-link:hover { color: var(--navy); }

        /* Center card (loading/error/complete) */
        .center-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
        .big-num { font-family: var(--font-crimson), Georgia, serif; font-size: 72px; font-weight: 700; color: var(--navy); line-height: 1; }
        .card-heading { font-family: var(--font-crimson), Georgia, serif; font-size: 26px; font-weight: 600; color: var(--navy); }
        .card-sub { font-size: 15px; color: var(--muted); line-height: 1.6; max-width: 400px; }
        .btn-primary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--navy); color: #fff; font-size: 15px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 10px 28px rgba(27,36,66,.35); transition: background .15s, transform .13s;
        }
        .btn-primary:hover { background: #253566; transform: translateY(-2px); }
        .btn-secondary {
          font-size: 14px; color: var(--muted); text-decoration: none;
          padding: 10px 20px; border-radius: 999px;
          border: 1px solid var(--border); background: rgba(255,255,255,.5);
          transition: color .14s, background .14s;
        }
        .btn-secondary:hover { color: var(--navy); background: rgba(255,255,255,.8); }
        .spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid rgba(27,36,66,.1); border-top-color: var(--accent);
          animation: spin .8s linear infinite; margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .orbit-loader {
          position: relative; width: 96px; height: 96px; margin: 0 auto 2px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 50%, rgba(255,246,201,.96) 0 9px, rgba(212,160,23,.96) 10px 21px, transparent 22px),
            radial-gradient(circle at 50% 50%, rgba(10,163,163,.08), transparent 62%);
          box-shadow: 0 18px 42px rgba(27,36,66,.16), inset 0 0 34px rgba(10,163,163,.08);
          isolation: isolate;
        }
        .orbit-loader::before,
        .orbit-loader::after {
          content: ""; position: absolute; border-radius: 50%;
          pointer-events: none;
        }
        .orbit-loader::before {
          inset: 18px; border: 1px dashed rgba(10,163,163,.42);
          transform: rotate(-16deg) scaleX(1.36);
        }
        .orbit-loader::after {
          width: 14px; height: 14px; left: 50%; top: 50%;
          margin: -7px 0 0 -7px;
          background: radial-gradient(circle at 35% 30%, #dbfffb, #0aa3a3 68%, #076d6d);
          box-shadow: 0 0 18px rgba(10,163,163,.58);
          animation: orbitLoaderTravel 1.45s linear infinite;
          transform-origin: 7px 7px;
        }
        .orbit-loader-star {
          position: absolute; left: 50%; top: 50%; z-index: 1;
          width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
          background:
            radial-gradient(circle at 38% 32%, #fffdf0 0 8px, #f4c73b 9px 25px, #b27608 100%);
          box-shadow: 0 0 26px rgba(212,160,23,.62), 0 0 52px rgba(212,160,23,.22);
        }
        .orbit-loader-spark {
          position: absolute; border-radius: 50%; background: rgba(255,255,255,.82);
          box-shadow: 0 0 10px rgba(255,255,255,.72);
        }
        .orbit-loader-spark.one { width: 3px; height: 3px; left: 18px; top: 30px; animation: orbitSpark 1.8s ease-in-out infinite; }
        .orbit-loader-spark.two { width: 2px; height: 2px; right: 20px; bottom: 28px; animation: orbitSpark 2.1s ease-in-out .4s infinite; }
        .orbit-loader-spark.three { width: 2px; height: 2px; right: 28px; top: 19px; animation: orbitSpark 1.6s ease-in-out .7s infinite; }
        @keyframes orbitLoaderTravel {
          from { transform: rotate(0deg) translateX(42px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(42px) rotate(-360deg); }
        }
        @keyframes orbitSpark {
          0%, 100% { opacity: .25; transform: scale(.72); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        .between-question-loader {
          align-items: center; text-align: center;
          /* Transparent dark glass instead of the near-opaque card
             background — this loader sits over the starfield only for a
             moment between questions, so let it show through rather than
             blotting it out with a solid card. .card's own 20px
             backdrop-filter blur was smearing the stars into an indistinct
             haze even at low alpha, so this drops the blur way down and
             lightens the tint further to actually read as glass. */
          background:
            radial-gradient(circle at 50% 22%, rgba(212,160,23,.14), transparent 34%),
            radial-gradient(circle at 82% 70%, rgba(10,163,163,.12), transparent 34%),
            rgba(11,15,30,.16);
          border-color: rgba(255,255,255,.16);
          backdrop-filter: blur(3px);
          box-shadow: 0 20px 50px rgba(0,0,0,.28);
        }
        .between-question-loader .startup-title { color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.5); }
        .between-question-loader .startup-note { color: rgba(255,255,255,.72); text-shadow: 0 2px 10px rgba(0,0,0,.4); }
        .startup-status {
          display: grid; gap: 7px; max-width: 440px;
        }
        .startup-title {
          font-size: 15px; font-weight: 750; color: var(--navy);
        }
        .startup-note {
          font-size: 13px; line-height: 1.55; color: var(--muted);
        }
        .startup-actions {
          display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 4px;
        }
        .selection-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px; width: 100%;
        }
        .testament-card {
          text-align: left; border: 1.5px solid var(--border);
          background: rgba(255,255,255,.68); border-radius: 18px;
          padding: 22px; cursor: pointer; font-family: inherit;
          transition: transform .14s, border-color .14s, background .14s, box-shadow .14s;
        }
        .testament-card:hover,
        .testament-card:focus-visible {
          outline: none; transform: translateY(-2px);
          border-color: var(--accent-line); background: #fff;
          box-shadow: 0 14px 30px rgba(27,36,66,.13);
        }
        .testament-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .testament-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 24px; font-weight: 700; color: var(--navy);
        }
        .pilot-badge {
          display: inline-flex; align-items: center; border-radius: 999px;
          padding: 5px 9px; font-size: 10.5px; font-weight: 850;
          letter-spacing: .08em; text-transform: uppercase;
          background: #fef3c7; color: #92400e; border: 1px solid #fde68a;
        }
        .testament-desc { color: var(--muted); font-size: 14px; line-height: 1.55; }
        .nt-scope-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; width: 100%; max-height: 330px; overflow: auto; padding-right: 4px;
        }
        .nt-scope-btn {
          text-align: left; border: 1.5px solid var(--border);
          border-radius: 13px; background: rgba(255,255,255,.66);
          padding: 12px 13px; cursor: pointer; font-family: inherit;
          transition: border-color .13s, background .13s, transform .11s;
        }
        .nt-scope-btn:hover,
        .nt-scope-btn:focus-visible {
          outline: none; border-color: var(--accent-line);
          background: var(--accent-dim); transform: translateY(-1px);
        }
        .nt-scope-btn.is-active {
          border-color: var(--accent-line); background: var(--accent-dim);
        }
        .nt-scope-btn strong { display: block; color: var(--navy); font-size: 13.5px; margin-bottom: 3px; }
        .nt-scope-btn span { color: var(--muted); font-size: 11.5px; line-height: 1.35; }
        .pilot-note {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(212,160,23,.12); border: 1px solid rgba(212,160,23,.26);
          color: #744a08; font-size: 13px; line-height: 1.5; font-weight: 600;
        }
        .nt-results-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px; width: 100%;
        }
        .nt-result-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 11px 13px; border-radius: 12px; background: rgba(27,36,66,.045);
          color: var(--navy); font-size: 13px;
        }
        .nt-result-row span { color: var(--muted); font-weight: 650; }
        .sky-discovery {
          position: fixed; z-index: 12;
          top: clamp(112px, 18vh, 180px); right: clamp(22px, 9vw, 150px);
          width: 32px; height: 32px; border-radius: 999px; border: 0;
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,.98) 0 8%, rgba(255,234,166,.96) 18%, rgba(212,160,23,.92) 44%, rgba(111,78,14,.88) 100%);
          box-shadow: 0 0 12px rgba(255,226,153,.72), 0 0 28px rgba(212,160,23,.28);
          cursor: pointer; animation: discoveryFloat 4.6s ease-in-out infinite;
        }
        .sky-discovery::after {
          content: ""; position: absolute; inset: -7px; border-radius: 999px;
          border: 1px solid rgba(255,231,169,.34);
          transform: rotate(-16deg) scaleX(1.38);
        }
        .sky-discovery:hover,
        .sky-discovery:focus-visible {
          outline: none; transform: translateY(-2px) scale(1.06);
          box-shadow: 0 0 16px rgba(255,238,190,.86), 0 0 38px rgba(212,160,23,.38);
        }
        @keyframes discoveryFloat {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -8px; }
        }
        .fact-card { max-width: 500px; }
        .fact-kicker {
          color: #9a6a09; font-size: 11px; font-weight: 850;
          text-transform: uppercase; letter-spacing: .08em; margin-bottom: 7px;
        }
        .fact-title {
          font-family: var(--font-crimson), Georgia, serif;
          color: var(--navy); font-size: 27px; font-weight: 700; margin-bottom: 8px;
        }
        .fact-copy { color: var(--muted); font-size: 15px; line-height: 1.62; }

        @media (prefers-reduced-motion: reduce) {
          /* Keep every transition/animation functional but instant, so the
             assessment still navigates without the slosh, spin, and fireworks. */
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
            scroll-behavior: auto !important;
          }
          canvas.stars.dashboard-transition { animation: none !important; }
          .dashboard-warp { display: none !important; }
        }
        .testament-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
        @media (max-width: 640px) {
          .card { padding: 30px 22px; max-width: 100%; }
          .nav { display: flex; justify-content: space-between; padding: 12px 16px; }
          .card-prompt { font-size: 20px; }
          .question-head { align-items: flex-start; }
          .report-options { grid-template-columns: 1fr; }
          .nav-center { min-width: 0; }
          .nav-subphase { display: none; }
          .progress-bar-track { width: 112px; }
          .results-fab { bottom: 16px; right: 16px; padding: 10px 16px; font-size: 13px; }
          .overlay-card { padding: 28px 24px; }
          .overlay-score { font-size: 52px; }
          .selection-grid, .nt-scope-grid, .nt-results-grid { grid-template-columns: 1fr; }
          .milestone-banner { align-items: stretch; flex-direction: column; }
          .milestone-actions { display: grid; grid-template-columns: 1fr 1fr; }
          .sequence-item { grid-template-columns: 30px 34px minmax(0,1fr); padding: 9px; gap: 8px; }
          .sequence-step-controls { grid-column: 2 / -1; justify-content: flex-end; }
          .sequence-actions { align-items: stretch; flex-direction: column-reverse; }
          .sequence-submit, .sequence-skip { width: 100%; }
          .section-sort-zones { grid-template-columns: 1fr; }
          .section-sort-zone { min-height: 132px; border-radius: 8px; }
          .section-sort-zone-title { max-width: none; }
        }
      `}</style>

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
      <nav className={`nav ${isDashboardTransitioning ? "dashboard-transition" : ""}`}>
        <span className="brand-wrap">
          <BrandLogo className="nav-brand" />
          <span className="beta-badge" tabIndex={0}>
            Beta
            <span className="beta-tooltip" role="tooltip">
              Open Bible Assessment is still in active development. Scores and questions are being refined, so your results may shift as the platform matures.
            </span>
          </span>
        </span>
        <div className="nav-center">
          <span className="nav-phase">{displayNavPhaseLabel}</span>
          <span className="nav-subphase">{displayNavSubLabel}</span>
          <div className="nav-progress-row">
            <span className="nav-count">{answeredCount}</span>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${displayProgressPct}%` }} />
            </div>
            <span className="nav-count-right">{displayProgressEnd}</span>
          </div>
        </div>
        <div className="nav-actions">
          {assessmentMode === "OT" && (isSignedIn ? (
            <button
              onClick={handleSignOut}
              className="nav-exit nav-action-button"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setShowResults(true)}
              className="nav-exit nav-action-button"
            >
              Sign in
            </button>
          ))}
          {attemptId && answeredCount > 0 && (
            <Link className="nav-exit" href={`/results/${attemptId}`}>Review session</Link>
          )}
          <Link className="nav-exit" href="/">Exit</Link>
        </div>
      </nav>

      <div className={`scene ${isDashboardTransitioning ? "dashboard-transition" : ""}`}>
        {assessmentMode === "select" && (
          <div className="card center-card">
            <p className="pilot-badge">Choose assessment</p>
            <div className="card-heading">What would you like to assess?</div>
            <p className="card-sub">Choose an adaptive Old or New Testament assessment. Each builds its own 0-800 BLI score.</p>
            <div className="selection-grid">
              <button className="testament-card" type="button" onClick={() => window.location.href = "/assess"}>
                <div className="testament-top">
                  <strong className="testament-title">Old Testament Assessment</strong>
                </div>
                <p className="testament-desc">Full adaptive assessment across the Old Testament.</p>
              </button>
              <button className="testament-card" type="button" onClick={() => window.location.href = NT_PILOT_ENABLED ? "/assess?testament=NT&scope=NT" : "/assess?choose=1"}>
                <div className="testament-top">
                  <strong className="testament-title">New Testament Assessment</strong>
                  <span className="pilot-badge">NT BLI</span>
                </div>
                <p className="testament-desc">Adaptive questions across all 27 New Testament books, scored as a separate NT BLI.</p>
              </button>
            </div>
            {!NT_PILOT_ENABLED && <p className="card-sub">The New Testament assessment is currently unavailable.</p>}
          </div>
        )}

        {assessmentMode === "NT" && phase === "starting" && (
          <div className={`card center-card ${isLoadingNextQuestion ? "between-question-loader" : ""}`}>
            <span className="pilot-badge">NT BLI</span>
            <div className="card-heading">Preparing {ntScopeFromKey(ntRequestedScopeKey, ntBooks).label}</div>
            {isLoadingNextQuestion && (
              <div className="orbit-loader" aria-hidden="true">
                <span className="orbit-loader-star" />
                <span className="orbit-loader-spark one" />
                <span className="orbit-loader-spark two" />
                <span className="orbit-loader-spark three" />
              </div>
            )}
            <div className="startup-status" aria-live="polite">
              <p className="startup-title">
                {isLoadingNextQuestion
                  ? "Charting the next question..."
                  : startupWaitLevel === 0
                  ? "Building your question sequence..."
                  : startupWaitLevel === 1
                    ? "Still setting up your assessment..."
                    : "This is taking longer than usual."}
              </p>
              <p className="startup-note">
                {isLoadingNextQuestion
                  ? "The assessment is checking your latest answer and choosing the next useful signal."
                  : startupWaitLevel === 0
                  ? "We are preparing an adaptive New Testament sequence and checking your saved progress."
                  : startupWaitLevel === 1
                    ? "First-time startup can take a few seconds while the anonymous session and question bank warm up."
                    : "You can keep waiting, or restart the setup if the connection stalled."}
              </p>
            </div>
            {ntError && <p className="pilot-note">{ntError}</p>}
            {!isLoadingNextQuestion && <div className="spinner" />}
            <p className="pilot-note">Your NT answers contribute only to the NT BLI, not the OT BLI.</p>
            <div className="startup-actions">
              {startupWaitLevel === 2 && (
                <button className="btn-secondary" type="button" onClick={() => window.location.reload()}>
                  Try again
                </button>
              )}
              <Link className="btn-secondary" href="/assess?choose=1">Back to assessment choices</Link>
            </div>
          </div>
        )}

        {assessmentMode === "OT" && phase === "starting" && (
          <div className={`card center-card ${isLoadingNextQuestion ? "between-question-loader" : ""}`}>
            {isLoadingNextQuestion ? (
              <div className="orbit-loader" aria-hidden="true">
                <span className="orbit-loader-star" />
                <span className="orbit-loader-spark one" />
                <span className="orbit-loader-spark two" />
                <span className="orbit-loader-spark three" />
              </div>
            ) : (
              <div className="spinner" />
            )}
            <div className="startup-status" aria-live="polite">
              <p className="startup-title">
                {isLoadingNextQuestion
                  ? "Plotting the next question..."
                  : startupWaitLevel === 0
                  ? "Loading your assessment..."
                  : startupWaitLevel === 1
                    ? "Setting up your first question..."
                    : "This is taking longer than usual."}
              </p>
              <p className="startup-note">
                {isLoadingNextQuestion
                  ? "OBA is moving through the question map and finding the next useful signal."
                  : startupWaitLevel === 0
                  ? "We are checking your session and preparing the next adaptive question."
                  : startupWaitLevel === 1
                    ? "First-time startup can take a few seconds while the anonymous session and question bank warm up."
                    : "You can keep waiting, or start a fresh setup if the connection stalled."}
              </p>
              {startupWaitLevel === 2 && (
                <div className="startup-actions">
                  <Link className="btn-secondary" href="/assess?fresh=1">Start fresh</Link>
                  <button className="btn-secondary" type="button" onClick={() => window.location.reload()}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === "error" && assessmentMode !== "select" && (
          <div className="card center-card">
            <div className="card-heading">Something went wrong</div>
            <p className="card-sub">{errorMsg}</p>
            {debugErrorMsg && (
              <p className="pilot-note" style={{wordBreak: "break-word"}}>
                Debug: {debugErrorMsg}
              </p>
            )}
            <div className="startup-actions">
              {attemptId && (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    setDebugErrorMsg("");
                    setRetryNotice("Continuing the same assessment.");
                    if (assessmentMode === "NT") void loadNtQuestion(attemptId, ntScope);
                    else void loadQuestion(attemptId);
                  }}
                >
                  Continue this assessment
                </button>
              )}
              {assessmentMode === "NT" ? (
                <Link className="btn-secondary" href="/">Choose another NT scope</Link>
              ) : (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    clearAssessmentBrowserStorage();
                    window.location.href = "/assess?fresh=1";
                  }}
                >
                  Start fresh assessment
                </button>
              )}
            </div>
          </div>
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
            <div className="question-head">
              {showsLocationLabels && (
                <div className="location-bar">
                  <span
                    className="loc-pill"
                    style={{
                      color: SECTION_COLORS[question.section] || "#0aa3a3",
                      background: (SECTION_COLORS[question.section] || "#0aa3a3") + "18",
                      borderColor: (SECTION_COLORS[question.section] || "#0aa3a3") + "30",
                    }}
                  >
                    <span
                      className="loc-dot"
                      style={{ background: SECTION_COLORS[question.section] || "#0aa3a3" }}
                    />
                    {assessmentMode === "NT" ? "New Testament" : question.section}
                  </span>
                  {showsBookLabel && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#566070", background: "rgba(27,36,66,.05)", borderColor: "rgba(27,36,66,.09)" }}>
                        {assessmentMode === "NT" ? ((question as NtPilotQuestion).book_name || question.book_code) : BOOK_NAMES[question.book_code] || question.book_code}
                      </span>
                    </>
                  )}
                  {showsTargetedOtLabel && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#087f7f", background: "rgba(10,163,163,.10)", borderColor: "rgba(10,163,163,.22)" }}>
                        {otAssessment?.label ?? otRequest.label ?? "Targeted assessment"}
                      </span>
                    </>
                  )}
                  {assessmentMode === "NT" && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#92400e", background: "#fef3c7", borderColor: "#fde68a" }}>
                        NT BLI
                      </span>
                    </>
                  )}
                  {question.importance_tier === 1 && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#b45309", background: "#fef3c7", borderColor: "#fde68a" }}>
                        <span className="tier-star">★</span> Tier 1
                      </span>
                    </>
                  )}
                </div>
              )}
              {assessmentMode === "OT" && (
                <button
                  className="report-trigger"
                  type="button"
                  aria-label="Report a problem with this question"
                  title="Report a problem"
                  onClick={() => {
                    setReportStatus("idle");
                    setReportError("");
                    setShowReportModal(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <path d="M4 22V15" />
                  </svg>
                </button>
              )}
            </div>

            <p className="card-prompt">{sectionSortInteraction?.prompt ?? question.prompt}</p>

            {isSectionSortQuestion && sectionSortInteraction ? (
              <div className="section-sort-question">
                <DndContext
                  sensors={sequenceSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionSortDragEnd}
                >
                  <div className="section-sort-bank" aria-label="Book labels">
                    {(sectionSortLabelsByZone.get("UNASSIGNED") ?? []).map(label => (
                      <SectionSortLabelChip
                        key={label.id}
                        label={label}
                        disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                      />
                    ))}
                  </div>
                  <div className="section-sort-zones">
                    {sectionSortInteraction.dropZones.map(zone => (
                      <SectionSortDropZone
                        key={zone.id}
                        zone={zone}
                        labels={sectionSortLabelsByZone.get(zone.id) ?? []}
                        disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                      />
                    ))}
                  </div>
                </DndContext>
                {phase === "question" && (
                  <div className="sequence-actions">
                    <button
                      className="sequence-skip"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion}
                      onClick={() => {
                        void submitSectionSort("skip");
                      }}
                    >
                      I don&apos;t know
                    </button>
                    <button
                      className="sequence-submit"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion || !sectionSortReadyToSubmit}
                      onClick={(event) => {
                        pendingSpawnRef.current = { x: event.clientX, y: event.clientY };
                        void submitSectionSort();
                      }}
                    >
                      Submit groups
                    </button>
                  </div>
                )}
              </div>
            ) : isSequenceQuestion ? (
              <div className="sequence-question">
                <p className="sequence-instruction">Drag the events into order, earliest first.</p>
                <DndContext
                  sensors={sequenceSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSequenceDragEnd}
                >
                  <SortableContext
                    items={sequenceOrder.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="sequence-list" aria-label="Events in chronological order">
                      {sequenceOrder.map((item, index) => (
                        <SortableSequenceItem
                          key={item.id}
                          item={item}
                          index={index}
                          disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                          isFirst={index === 0}
                          isLast={index === sequenceOrder.length - 1}
                          onMove={moveSequenceItem}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                {phase === "question" && (
                  <div className="sequence-actions">
                    <button
                      className="sequence-skip"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion}
                      onClick={() => submitAnswer(IDK_CHOICE_ID)}
                    >
                      I don&apos;t know
                    </button>
                    <button
                      className="sequence-submit"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion || sequenceOrder.length === 0}
                      onClick={(event) => {
                        pendingSpawnRef.current = { x: event.clientX, y: event.clientY };
                        submitSequenceOrder();
                      }}
                    >
                      Submit order
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="choices">
                {visibleChoices.map((choice, index) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`choice ${phase === "feedback" ? choiceLabel(choice.id) : ""}`}
                    onClick={(e) => {
                      if (phase !== "question" || isSubmittingAnswer || isLoadingNextQuestion || isQuestionInteractionLocked()) return;
                      pendingSpawnRef.current = { x: e.clientX, y: e.clientY };
                      if (assessmentMode === "NT") submitNtAnswer(choice.id);
                      else submitAnswer(choice.id);
                    }}
                    disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                  >
                    <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                    {choice.text}
                  </button>
                ))}
              </div>
            )}

            {phase === "feedback" && (
              <>
                <div className={`feedback-bar ${assessmentMode === "OT" ? "recorded" : isSkipped ? "skipped" : isCorrect ? "correct" : "wrong"}`}>
                  <span className="feedback-text">
                    {sectionSortFeedback
                      ? "Response recorded."
                      : assessmentMode === "OT"
                        ? "Answer recorded."
                        : isSkipped
                        ? "Skipped — the correct answer is highlighted."
                        : isCorrect
                          ? "Correct!"
                          : "Not quite — the correct answer is highlighted."}
                  </span>
                  <button className="next-btn" type="button" onClick={nextQuestion} disabled={isLoadingNextQuestion}>
                    {isLoadingNextQuestion ? "Plotting..." : "Next →"}
                  </button>
                </div>

                {sectionSortTraditionNote && (
                  <div className="canon-note" role="note">
                    <strong>Why this placement matters</strong>
                    <span>{sectionSortTraditionNote}</span>
                  </div>
                )}

                {assessmentMode === "NT" && (
                  <div className="score-row">
                    <div className="score-item"><strong>{answeredCount}</strong>answered</div>
                    <div className="score-item"><strong>{correctCount}</strong>correct</div>
                    <div className="score-item"><strong>{accuracy}%</strong>accuracy</div>
                  </div>
                )}

                {assessmentMode === "OT" && answeredCount === otTargetCount && (
                  <div className="milestone-banner">
                    <div className="milestone-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l2.6 6.15L21 9l-4.9 4.3L17.4 21 12 17.6 6.6 21l1.3-7.7L3 9l6.4-.85z"/>
                      </svg>
                    </div>
                    <span className="milestone-copy">
                      <span className="milestone-kicker">
                        {isTargetedOtAssessment
                          ? isScopeOtAssessment ? "Test complete" : "Retest complete"
                          : "Baseline complete"}
                      </span>
                      {isTargetedOtAssessment
                        ? isScopeOtAssessment
                          ? `${otAssessment?.label ?? "Targeted"} test complete. Your BLI has been updated.`
                          : `${otAssessment?.label} retest complete. Your recommendation is being recalculated.`
                        : "Your BLI snapshot is ready."}
                    </span>
                    <span className="milestone-actions">
                      {attemptId && <Link className="milestone-results" href={`/results/${attemptId}`}>See results →</Link>}
                      <button className="milestone-dashboard" type="button" onClick={transitionToDashboard}>Dashboard</button>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {phase === "complete" && assessmentMode === "NT" && (
          <div className="card center-card">
            <span className="pilot-badge">NT BLI</span>
            <div className="big-num">{accuracy}<span style={{ fontSize: 32 }}>%</span></div>
            <div className="card-heading">New Testament assessment complete</div>
            <p className="card-sub">You answered {correctCount} of {answeredCount} questions correctly in {ntScope.label}.</p>
            <p className="pilot-note">Your separate NT BLI snapshot is ready. Review the session for your score and answer history.</p>
            {attemptId && <Link className="btn-primary" href={`/results/${attemptId}`}>Review session results</Link>}
            <button className="btn-primary" type="button" onClick={() => startNtPilot(ntScope)}>Retry same scope</button>
            <Link className="btn-secondary" href="/">Choose another NT scope from your BLI profile</Link>
            <button className="btn-secondary" type="button" onClick={transitionToDashboard}>Back to dashboard</button>
          </div>
        )}

        {phase === "complete" && assessmentMode === "OT" && (
          <div className="card center-card">
            <div className="big-num">{accuracy}<span style={{ fontSize: 32 }}>%</span></div>
            <div className="card-heading">
              {isTargetedOtAssessment
                ? `${otAssessment?.label ?? "Targeted"} ${isScopeOtAssessment ? "test" : "retest"} complete`
                : "Assessment complete"}
            </div>
            <p className="card-sub">
              {isTargetedOtAssessment
                ? isScopeOtAssessment
                  ? "Your new evidence has been added to your BLI and the dashboard will reflect this book or section."
                  : "Your new evidence has been added to your BLI. The dashboard will now recalculate this learning unit and your next recommendation."
                : `You answered ${correctCount} of ${answeredCount} questions correctly.`}
            </p>
            {attemptId && <Link className="btn-primary" href={`/results/${attemptId}`}>Review session results</Link>}
            <button className="btn-primary" type="button" onClick={transitionToDashboard}>View your dashboard</button>
            {!isTargetedOtAssessment && (
              <Link className="btn-secondary" href="/assess">Keep going</Link>
            )}
          </div>
        )}
      </div>

      {showReportModal && question && (
        <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setShowReportModal(false)}>
          <div className="overlay-card report-card">
            <button className="overlay-close" type="button" onClick={() => setShowReportModal(false)} aria-label="Close report form">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            {reportStatus === "sent" ? (
              <div className="report-sent">Thanks. This question has been flagged for review.</div>
            ) : (
              <>
                <h2 className="report-title">Report this question</h2>
                <p className="report-desc">Choose what looks wrong and add a note if it would help the review.</p>
                <div className="report-question">{question.prompt}</div>

                <div className="report-options" role="group" aria-label="Report reason">
                  {REPORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`report-option ${reportCategory === option.value ? "is-active" : ""}`}
                      onClick={() => {
                        setReportCategory(option.value);
                        setReportError("");
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <textarea
                  className="report-textarea"
                  value={reportText}
                  maxLength={2000}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="Optional note"
                />
                {reportError && <p className="report-error">{reportError}</p>}

                <div className="report-actions">
                  <button type="button" className="report-cancel" onClick={() => setShowReportModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="report-submit"
                    onClick={submitQuestionReport}
                    disabled={isSubmittingReport || (reportCategory === "other" && reportText.trim().length === 0)}
                  >
                    {isSubmittingReport ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeBibleFact && (
        <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setActiveBibleFact(null)}>
          <div className="overlay-card fact-card">
            <button className="overlay-close" type="button" onClick={() => setActiveBibleFact(null)} aria-label="Close Bible fact">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <p className="fact-kicker">Sky Fact</p>
            <h2 className="fact-title">{activeBibleFact.title}</h2>
            <p className="fact-copy">{activeBibleFact.fact}</p>
          </div>
        </div>
      )}

      {/* Results overlay */}
      {assessmentMode === "OT" && showResults && (
        <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setShowResults(false)}>
          <div className="overlay-card">
            <button className="overlay-close" onClick={() => setShowResults(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            <div className="overlay-score">{accuracy}<span style={{ fontSize: 28 }}>%</span></div>
            <div className="overlay-label">BLI Score (preliminary)</div>

            <div className="overlay-stats">
              <div className="overlay-stat"><strong>{answeredCount}</strong><span>answered</span></div>
              <div className="overlay-stat"><strong>{correctCount}</strong><span>correct</span></div>
              <div className="overlay-stat"><strong>{nextMilestone - answeredCount}</strong><span>to next update</span></div>
            </div>

            <hr className="overlay-divider" />

            {!showSavePrompt ? (
              <>
                <p className="overlay-heading">Save your progress</p>
                <p className="overlay-desc">Create a free account to save your BLI score and track your knowledge over time. Your progress so far will be linked automatically.</p>
                <button className="google-btn" onClick={handleGoogleSignIn} disabled={saving}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
                <div className="divider-or"><span>or</span></div>
                {saved ? (
                  <p className="save-success">Check your email for a sign-in link!</p>
                ) : (
                  <div className="magic-row">
                    <input
                      className="magic-input"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                    />
                    <button className="magic-btn" onClick={handleMagicLink} disabled={saving || !email}>
                      {saving ? "..." : "Send link"}
                    </button>
                  </div>
                )}
                <span className="skip-link" onClick={() => setShowResults(false)}>Keep going without saving</span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
