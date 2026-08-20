import { type Dispatch, type RefObject, type SetStateAction, useCallback, useRef, useState } from "react";
import type { StarfieldHandle } from "@/components/Starfield";
import { supabase } from "@/lib/supabase/client";
import {
  NT_PILOT_TARGET,
  NT_SECTION_LABELS,
} from "./constants";
import {
  clearAssessmentBrowserStorage,
  getSectionSortInteraction,
  normalizeNtSection,
  prepareChoicesForDisplay,
} from "./assessmentHelpers";
import {
  fetchNextQuestion,
  isStatementTimeoutError,
  startQuestionPrefetch,
  takePrefetchedQuestion,
  type QuestionRpcResult,
} from "./questionPrefetch";
import { rpcErrorCodeText, rpcErrorMessageText } from "./rpcErrors";
import type {
  Choice,
  NtAssessmentQuestionRow,
  NtPilotQuestion,
  NtScopeOption,
  Phase,
  Question,
  QuestionPrefetch,
  RpcErrorLike,
  SectionSortKey,
} from "./types";

const OT_NEXT_QUESTION_RPC = "obs_get_next_ot_assessment_question";
const NT_NEXT_QUESTION_RPC = "obs_get_next_nt_assessment_question";

type AssessmentQuestionLoaderOptions = {
  resetQuestionReport: () => void;
  setAnsweredCount: Dispatch<SetStateAction<number>>;
  setNtError: Dispatch<SetStateAction<string>>;
  setShowReportModal: Dispatch<SetStateAction<boolean>>;
  starfieldRef: RefObject<StarfieldHandle | null>;
};

export function useAssessmentQuestionLoader({
  resetQuestionReport,
  setAnsweredCount,
  setNtError,
  setShowReportModal,
  starfieldRef,
}: AssessmentQuestionLoaderOptions) {
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
  const [errorMsg, setErrorMsg] = useState("");
  const [retryNotice, setRetryNotice] = useState("");
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [ntTargetCount, setNtTargetCount] = useState(NT_PILOT_TARGET);
  const [debugErrorMsg, setDebugErrorMsg] = useState("");

  const isSubmittingAnswerRef = useRef(false);
  const isLoadingQuestionRef = useRef(false);
  const questionInteractionLockedUntilRef = useRef(0);
  const activeQuestionIdRef = useRef<string | null>(null);
  const pendingQuestionNoticeRef = useRef("");
  const otQuestionPrefetchRef = useRef<QuestionPrefetch<Question> | null>(null);
  const ntQuestionPrefetchRef = useRef<QuestionPrefetch<NtAssessmentQuestionRow> | null>(null);

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
  }, [
    setCorrectChoiceId,
    setIsCorrect,
    setIsLoadingNextQuestion,
    setIsSubmittingAnswer,
    setPhase,
    setQuestion,
    setRetryNotice,
    setSectionSortFeedback,
    setSectionSortTraditionNote,
    setSelectedChoice,
    starfieldRef,
  ]);

  const finishQuestionLoad = useCallback((questionId: string | null = null) => {
    activeQuestionIdRef.current = questionId;
    isLoadingQuestionRef.current = false;
    isSubmittingAnswerRef.current = false;
    questionInteractionLockedUntilRef.current = 0;
    setIsLoadingNextQuestion(false);
    setIsSubmittingAnswer(false);
  }, [setIsLoadingNextQuestion, setIsSubmittingAnswer]);

  const startAnswerSubmission = useCallback((choiceId: string) => {
    isSubmittingAnswerRef.current = true;
    setIsSubmittingAnswer(true);
    setSelectedChoice(choiceId);
  }, []);

  const finishAnswerSubmission = useCallback(() => {
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
  }, []);

  const showChangedRetryFeedback = useCallback(() => {
    finishAnswerSubmission();
    setRetryNotice("Your first answer to that question was already recorded, so it has been kept.");
    setPhase("feedback");
  }, [finishAnswerSubmission]);

  const recordChoiceFeedback = useCallback((result: {
    isCorrect: boolean;
    correctChoiceId: string | null;
  }) => {
    setIsCorrect(result.isCorrect);
    setCorrectChoiceId(result.correctChoiceId);
  }, []);

  const recordSectionSortFeedback = useCallback((result: {
    isCorrect: boolean;
    correctChoiceId: string;
    scoredCorrect: number;
    scoredTotal: number;
    traditionNote: string;
  }) => {
    setIsCorrect(result.isCorrect);
    setCorrectChoiceId(result.correctChoiceId);
    setSectionSortFeedback({ correct: result.scoredCorrect, total: result.scoredTotal });
    setSectionSortTraditionNote(result.traditionNote);
  }, []);

  const showFeedbackPhase = useCallback(() => {
    finishAnswerSubmission();
    setPhase("feedback");
  }, [finishAnswerSubmission]);

  const showFatalAssessmentError = useCallback((error: {
    message: string;
    debugMessage?: string;
  }) => {
    finishAnswerSubmission();
    setDebugErrorMsg(error.debugMessage ?? "");
    setErrorMsg(error.message);
    setPhase("error");
  }, [finishAnswerSubmission]);

  const clearAssessmentError = useCallback(() => {
    setDebugErrorMsg("");
    setErrorMsg("");
  }, []);

  const applyOtQuestionRow = useCallback((row: Question) => {
    let choices: Choice[] = [];
    if (Array.isArray(row.choices)) {
      choices = row.choices.map((choice: { id: string; text: string }) => ({
        id: choice.id,
        text: choice.text,
      }));
    }
    const rawQuestion = { ...row } as Question;
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
  }, [
    finishQuestionLoad,
    resetQuestionReport,
    setCorrectChoiceId,
    setIsCorrect,
    setPhase,
    setQuestion,
    setRetryNotice,
    setSectionSortAssignments,
    setSectionSortFeedback,
    setSectionSortTraditionNote,
    setSelectedChoice,
    setSequenceOrder,
    setShowReportModal,
    starfieldRef,
  ]);

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
  }, [
    applyOtQuestionRow,
    finishQuestionLoad,
    setAttemptId,
    setDebugErrorMsg,
    setErrorMsg,
    setPhase,
  ]);

  const prefetchOtQuestion = useCallback((aid: string, afterAnsweredCount: number) => {
    startQuestionPrefetch<Question>(otQuestionPrefetchRef, OT_NEXT_QUESTION_RPC, aid, afterAnsweredCount);
  }, []);

  const consumePrefetchedOtQuestion = useCallback(async (aid: string, afterAnsweredCount: number) => {
    const result = await takePrefetchedQuestion<Question>(otQuestionPrefetchRef, aid, afterAnsweredCount);
    if (!result) return false;
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
  }, [handleOtQuestionResult, setDebugErrorMsg, setIsLoadingNextQuestion]);

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
    setQuestion(parsed);
    setAnsweredCount(Number(row.answered_count ?? 0));
    setNtTargetCount(Number(row.target_question_count ?? NT_PILOT_TARGET));
    const sectionSort = getSectionSortInteraction(parsed);
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
  }, [
    finishQuestionLoad,
    setAnsweredCount,
    setAttemptId,
    setCorrectChoiceId,
    setErrorMsg,
    setIsCorrect,
    setNtError,
    setNtTargetCount,
    setPhase,
    setQuestion,
    setSectionSortAssignments,
    setSectionSortFeedback,
    setSectionSortTraditionNote,
    setSelectedChoice,
    setSequenceOrder,
    starfieldRef,
  ]);

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
  }, [
    applyNtQuestionRow,
    finishQuestionLoad,
    setErrorMsg,
    setNtError,
    setPhase,
    setQuestion,
  ]);

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
  }, [handleNtQuestionResult, setIsLoadingNextQuestion]);

  return {
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
    setIsSubmittingAnswer,
    setNtTargetCount,
    setPhase,
    setQuestion,
    setRetryNotice,
    setSectionSortAssignments,
    setSectionSortFeedback,
    setSectionSortTraditionNote,
    setSelectedChoice,
    setSequenceOrder,
  };
}
