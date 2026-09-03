import { type RefObject, useCallback } from "react";
import type { StarfieldHandle } from "@/components/Starfield";
import { persistAssessmentProgressSnapshot } from "@/lib/assessmentProgressStorage";
import { supabase } from "@/lib/supabase/client";
import {
  IDK_CHOICE_ID,
} from "./constants";
import { isStatementTimeoutError } from "./questionPrefetch";
import {
  HEBREW_BIBLE_DIVISION_NOTE,
  clearAssessmentBrowserStorage,
  isHebrewBibleTraditionSensitiveMiss,
} from "./assessmentHelpers";
import { answerSubmissionErrorText, rpcErrorCodeText, rpcErrorMessageText } from "./rpcErrors";
import type {
  AssessmentMode,
  Choice,
  NtScopeOption,
  OtAssessmentRequest,
  OtAssessmentStartRow,
  OtSubmitResult,
  Phase,
  Question,
  QuestionPrefetch,
  RpcErrorLike,
  SectionSortInteraction,
  SectionSortKey,
  SectionSortSubmitResult,
  Testament,
} from "./types";

type CurrentRef<T> = { current: T };

const ANSWER_RPC_TIMEOUT_RETRY_DELAYS_MS = [350, 1000] as const;

async function retryStatementTimeout<T>(
  call: () => Promise<{ data: T | null; error: RpcErrorLike }>,
) {
  let last: { data: T | null; error: RpcErrorLike } = { data: null, error: null };
  for (let attempt = 0; attempt <= ANSWER_RPC_TIMEOUT_RETRY_DELAYS_MS.length; attempt += 1) {
    last = await call();
    if (!isStatementTimeoutError(last.error)) return last;
    const retryDelay = ANSWER_RPC_TIMEOUT_RETRY_DELAYS_MS[attempt];
    if (retryDelay === undefined) break;
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  return last;
}

type AssessmentAnswerFlowOptions = {
  activeQuestionIdRef: CurrentRef<string | null>;
  answeredCount: number;
  assessmentMode: AssessmentMode;
  attemptId: string | null;
  beginQuestionLoad: () => boolean;
  clearAssessmentError: () => void;
  consumePrefetchedNtQuestion: (attemptId: string, scope: NtScopeOption, afterAnsweredCount: number) => Promise<boolean>;
  consumePrefetchedOtQuestion: (attemptId: string, afterAnsweredCount: number) => Promise<boolean>;
  correctCount: number;
  finishAnswerSubmission: () => void;
  isLoadingQuestionRef: CurrentRef<boolean>;
  isQuestionInteractionLocked: () => boolean;
  isSignedIn: boolean;
  isSubmittingAnswerRef: CurrentRef<boolean>;
  loadNtQuestion: (attemptId: string, scope: NtScopeOption) => Promise<void>;
  loadQuestion: (attemptId: string) => Promise<void>;
  loadScoreEvidence: (userId: string, scope: Testament) => Promise<void>;
  ntQuestionPrefetchRef: CurrentRef<QuestionPrefetch<unknown> | null>;
  ntScope: NtScopeOption;
  ntTargetCount: number;
  otAssessment: OtAssessmentStartRow | null;
  otQuestionPrefetchRef: CurrentRef<QuestionPrefetch<unknown> | null>;
  otRequest: OtAssessmentRequest;
  otTargetCount: number;
  pendingQuestionNoticeRef: CurrentRef<string>;
  phase: Phase;
  prefetchNtQuestion: (attemptId: string, afterAnsweredCount: number) => void;
  prefetchOtQuestion: (attemptId: string, afterAnsweredCount: number) => void;
  question: Question | null;
  recordChoiceFeedback: (result: { isCorrect: boolean; correctChoiceId: string | null }) => void;
  recordSectionSortFeedback: (result: {
    isCorrect: boolean;
    correctChoiceId: string;
    scoredCorrect: number;
    scoredTotal: number;
    traditionNote: string;
  }) => void;
  sectionSortAssignments: Record<string, SectionSortKey | null>;
  sectionSortInteraction: SectionSortInteraction | null;
  sequenceOrder: Choice[];
  setAnsweredCount: (value: number) => void;
  setCorrectCount: (value: number) => void;
  setNtTargetCount: (value: number) => void;
  setOtTargetCount: (value: number) => void;
  setPhase: (phase: Phase) => void;
  showChangedRetryFeedback: () => void;
  showFatalAssessmentError: (error: { message: string; debugMessage?: string }) => void;
  showFeedbackPhase: () => void;
  startAnswerSubmission: (choiceId: string) => void;
  starfieldRef: RefObject<StarfieldHandle | null>;
  userId: string | null;
};

export function useAssessmentAnswerFlow({
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
  isSignedIn,
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
  prefetchNtQuestion,
  prefetchOtQuestion,
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
}: AssessmentAnswerFlowOptions) {
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
    const { data: skippedData, error: skipError } = await retryStatementTimeout(async () =>
      supabase.rpc("obs_skip_broken_assessment_question", {
        p_attempt_id: attemptId,
        p_generated_question_id: submittedQuestionId,
        p_error_code: rpcErrorCodeText(error),
        p_error_message: error ? answerSubmissionErrorText(error) : "No result returned from answer submission",
        p_context: skipContext,
      }));

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (skipError) {
      await logQuestionMisfire({ submittedQuestionId, error: error ?? skipError, context });
      showFatalAssessmentError({
        debugMessage: `${rpcErrorCodeText(skipError) ? `${rpcErrorCodeText(skipError)}: ` : ""}${answerSubmissionErrorText(skipError)}`,
        message: "We could not record or skip that question. This is usually a temporary connection problem.",
      });
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
    persistAssessmentProgressSnapshot({
      answered: newAnswered,
      attemptId,
      correct: newCorrect,
      durable: assessmentMode === "OT",
      anonymousUserId: isSignedIn ? null : userId,
      testament: assessmentMode === "NT" ? "NT" : "OT",
    });
    if (userId) void loadScoreEvidence(userId, assessmentMode === "NT" ? "NT" : "OT");

    finishAnswerSubmission();
    clearAssessmentError();

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
    activeQuestionIdRef,
    answeredCount,
    assessmentMode,
    attemptId,
    beginQuestionLoad,
    clearAssessmentError,
    correctCount,
    finishAnswerSubmission,
    loadNtQuestion,
    loadQuestion,
    loadScoreEvidence,
    logQuestionMisfire,
    ntScope,
    ntTargetCount,
    otAssessment,
    otRequest,
    otTargetCount,
    isSignedIn,
    pendingQuestionNoticeRef,
    setAnsweredCount,
    setCorrectCount,
    setNtTargetCount,
    setOtTargetCount,
    setPhase,
    showFatalAssessmentError,
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
    startAnswerSubmission(choiceId);

    const { data, error } = await retryStatementTimeout(async () =>
      supabase.rpc("obs_submit_ot_assessment_response_v2", {
        p_attempt_id: attemptId,
        p_generated_question_id: submittedQuestionId,
        p_response: choiceId,
        p_selected_choice_text: selectedChoiceText,
        p_displayed_choices: displayedChoices,
      }));

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    const result = data?.[0] as OtSubmitResult | undefined;

    if (error) {
      if (isChangedRetryRejection(error)) {
        showChangedRetryFeedback();
        return;
      }
      if (rpcErrorMessageText(error).includes("assessment_answers_user_id_fkey")) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        showFatalAssessmentError({
          message: "Your anonymous assessment session expired after Supabase restarted. Start a fresh assessment and the questions should work again.",
        });
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

    recordChoiceFeedback({
      isCorrect: result.is_correct,
      correctChoiceId: result.correct_choice_id ?? null,
    });
    const newAnswered = Number(result.answered_count ?? answeredCount + 1);
    const newCorrect = Number(result.correct_count ?? correctCount + (result.is_correct ? 1 : 0));
    const newTarget = Number(result.target_question_count ?? otTargetCount);
    setAnsweredCount(newAnswered);
    setCorrectCount(newCorrect);
    setOtTargetCount(newTarget);
    persistAssessmentProgressSnapshot({
      answered: newAnswered,
      attemptId,
      correct: newCorrect,
      anonymousUserId: isSignedIn ? null : userId,
      testament: "OT",
    });
    void loadScoreEvidence(userId, "OT");
    if (newAnswered < newTarget) prefetchOtQuestion(attemptId, newAnswered);
    else otQuestionPrefetchRef.current = null;
    starfieldRef.current?.spawnTraveler();
    showFeedbackPhase();
  }, [
    activeQuestionIdRef,
    answeredCount,
    attemptId,
    correctCount,
    failAnswerSubmission,
    isChangedRetryRejection,
    isQuestionInteractionLocked,
    isSignedIn,
    loadScoreEvidence,
    otQuestionPrefetchRef,
    otTargetCount,
    phase,
    prefetchOtQuestion,
    question,
    recordChoiceFeedback,
    sequenceOrder,
    setAnsweredCount,
    setCorrectCount,
    setOtTargetCount,
    showChangedRetryFeedback,
    showFatalAssessmentError,
    showFeedbackPhase,
    startAnswerSubmission,
    starfieldRef,
    userId,
  ]);

  const submitNtAnswer = useCallback(async (choiceId: string) => {
    if (!attemptId || !question || phase !== "question" || isQuestionInteractionLocked()) return;
    const submittedQuestionId = question.out_generated_question_id;
    startAnswerSubmission(choiceId);

    const { data, error } = await retryStatementTimeout(async () =>
      supabase.rpc("obs_submit_nt_assessment_answer", {
        p_attempt_id: attemptId,
        p_generated_question_id: submittedQuestionId,
        p_selected_choice_id: choiceId,
      }));

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (error) {
      if (isChangedRetryRejection(error)) {
        showChangedRetryFeedback();
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
    recordChoiceFeedback({
      isCorrect: correct,
      correctChoiceId: result?.correct_choice_id ?? null,
    });
    setAnsweredCount(newAnswered);
    setCorrectCount(newCorrect);
    setNtTargetCount(newTarget);
    persistAssessmentProgressSnapshot({
      answered: newAnswered,
      attemptId,
      correct: newCorrect,
      durable: false,
      anonymousUserId: isSignedIn ? null : userId,
      testament: "NT",
    });
    if (userId) void loadScoreEvidence(userId, "NT");
    if (newAnswered < newTarget) prefetchNtQuestion(attemptId, newAnswered);
    else ntQuestionPrefetchRef.current = null;
    starfieldRef.current?.spawnTraveler();
    showFeedbackPhase();
  }, [
    activeQuestionIdRef,
    answeredCount,
    attemptId,
    correctCount,
    failAnswerSubmission,
    isChangedRetryRejection,
    isQuestionInteractionLocked,
    isSignedIn,
    loadScoreEvidence,
    ntQuestionPrefetchRef,
    ntTargetCount,
    phase,
    prefetchNtQuestion,
    question,
    recordChoiceFeedback,
    setAnsweredCount,
    setCorrectCount,
    setNtTargetCount,
    showChangedRetryFeedback,
    showFeedbackPhase,
    startAnswerSubmission,
    starfieldRef,
    userId,
  ]);

  const submitSectionSort = useCallback(async (submissionMode: "answer" | "skip" = "answer") => {
    if (!attemptId || !question || !sectionSortInteraction || phase !== "question" || isQuestionInteractionLocked()) return;
    const submittedQuestionId = question.out_generated_question_id;
    const assignments = sectionSortInteraction.dragLabels.map(label => ({
      text: label.text,
      section_key: submissionMode === "skip"
        ? IDK_CHOICE_ID
        : sectionSortAssignments[label.id],
    }));

    startAnswerSubmission(submissionMode === "skip" ? IDK_CHOICE_ID : "__SECTION_SORT__");

    const { data, error } = await retryStatementTimeout(async () =>
      supabase.rpc("obs_submit_section_sort_answers", {
        p_attempt_id: attemptId,
        p_screen_question_id: submittedQuestionId,
        p_assignments: assignments,
      }));

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
    recordSectionSortFeedback({
      isCorrect: isScreenCorrect,
      correctChoiceId: result.correct_choice_id ?? "A",
      scoredCorrect,
      scoredTotal,
      traditionNote: hasTraditionSensitiveMiss ? HEBREW_BIBLE_DIVISION_NOTE : "",
    });
    setAnsweredCount(newAnswered);
    setCorrectCount(newCorrect);
    if (assessmentMode === "NT") setNtTargetCount(newTarget);
    else setOtTargetCount(newTarget);
    persistAssessmentProgressSnapshot({
      answered: newAnswered,
      attemptId,
      correct: newCorrect,
      durable: assessmentMode === "OT",
      anonymousUserId: isSignedIn ? null : userId,
      testament: assessmentMode === "NT" ? "NT" : "OT",
    });
    if (userId) void loadScoreEvidence(userId, assessmentMode === "NT" ? "NT" : "OT");
    if (newAnswered < newTarget) {
      if (assessmentMode === "NT") prefetchNtQuestion(attemptId, newAnswered);
      else prefetchOtQuestion(attemptId, newAnswered);
    } else if (assessmentMode === "NT") {
      ntQuestionPrefetchRef.current = null;
    } else {
      otQuestionPrefetchRef.current = null;
    }
    starfieldRef.current?.spawnTraveler();
    showFeedbackPhase();
  }, [
    activeQuestionIdRef,
    answeredCount,
    assessmentMode,
    attemptId,
    correctCount,
    failAnswerSubmission,
    isQuestionInteractionLocked,
    isSignedIn,
    loadScoreEvidence,
    ntQuestionPrefetchRef,
    ntTargetCount,
    otQuestionPrefetchRef,
    otTargetCount,
    phase,
    prefetchNtQuestion,
    prefetchOtQuestion,
    question,
    recordSectionSortFeedback,
    sectionSortAssignments,
    sectionSortInteraction,
    setAnsweredCount,
    setCorrectCount,
    setNtTargetCount,
    setOtTargetCount,
    showFeedbackPhase,
    startAnswerSubmission,
    starfieldRef,
    userId,
  ]);

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

    if (answeredCount >= otTargetCount) {
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
    isLoadingQuestionRef,
    isSubmittingAnswerRef,
    loadNtQuestion,
    loadQuestion,
    ntScope,
    ntTargetCount,
    otTargetCount,
    phase,
    setPhase,
  ]);

  return {
    nextQuestion,
    submitAnswer,
    submitNtAnswer,
    submitSectionSort,
  };
}
