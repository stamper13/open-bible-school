import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  NT_ATTEMPT_ID_KEY,
  NT_PILOT_ENABLED,
  NT_PILOT_TARGET,
  OT_ATTEMPT_ID_KEY,
  TOTAL_INITIAL,
} from "./constants";
import {
  ntScopeFromKey,
  parseInitialAssessmentRoute,
} from "./assessmentHelpers";
import type {
  AssessmentMode,
  Choice,
  NtAssessmentStartRow,
  NtAssessmentStatusRow,
  NtBookMetadata,
  NtScopeOption,
  OtAssessmentRequest,
  OtAssessmentStartRow,
  Phase,
  Question,
  Testament,
} from "./types";

type ResettableRef = { current: unknown };

type AssessmentStartupOptions = {
  assessmentMode: AssessmentMode;
  ensureAssessmentSession: () => Promise<string>;
  loadNtQuestion: (attemptId: string, scope: NtScopeOption) => Promise<void>;
  loadQuestion: (attemptId: string) => Promise<void>;
  loadScoreEvidence: (userId: string, scope: Testament) => Promise<void>;
  modeReady: boolean;
  ntBooks: NtBookMetadata[];
  ntMetadataLoaded: boolean;
  ntQuestionPrefetchRef: ResettableRef;
  ntRequestedScopeKey: string;
  ntRequestedTargetCount: number;
  ntScope: NtScopeOption;
  otQuestionPrefetchRef: ResettableRef;
  otRequest: OtAssessmentRequest;
  setAnsweredCount: Dispatch<SetStateAction<number>>;
  setAssessmentMode: Dispatch<SetStateAction<AssessmentMode>>;
  setAttemptId: Dispatch<SetStateAction<string | null>>;
  setCorrectChoiceId: Dispatch<SetStateAction<string | null>>;
  setCorrectCount: Dispatch<SetStateAction<number>>;
  setDebugErrorMsg: Dispatch<SetStateAction<string>>;
  setErrorMsg: Dispatch<SetStateAction<string>>;
  setIsCorrect: Dispatch<SetStateAction<boolean | null>>;
  setModeReady: Dispatch<SetStateAction<boolean>>;
  setNtError: Dispatch<SetStateAction<string>>;
  setNtRequestedScopeKey: Dispatch<SetStateAction<string>>;
  setNtRequestedTargetCount: Dispatch<SetStateAction<number>>;
  setNtScope: Dispatch<SetStateAction<NtScopeOption>>;
  setNtTargetCount: Dispatch<SetStateAction<number>>;
  setOtAssessment: Dispatch<SetStateAction<OtAssessmentStartRow | null>>;
  setOtRequest: Dispatch<SetStateAction<OtAssessmentRequest>>;
  setOtTargetCount: Dispatch<SetStateAction<number>>;
  setPhase: Dispatch<SetStateAction<Phase>>;
  setQuestion: Dispatch<SetStateAction<Question | null>>;
  setSelectedChoice: Dispatch<SetStateAction<string | null>>;
  setSequenceOrder: Dispatch<SetStateAction<Choice[]>>;
  setUserId: Dispatch<SetStateAction<string | null>>;
};

export function useAssessmentStartup({
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
}: AssessmentStartupOptions) {
  const ntResumeStartedRef = useRef(false);

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
  }, [
    setAssessmentMode,
    setModeReady,
    setNtRequestedScopeKey,
    setNtRequestedTargetCount,
    setOtRequest,
    setPhase,
  ]);

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
    setQuestion(null);
    setSequenceOrder([]);
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
  }, [
    ensureAssessmentSession,
    loadNtQuestion,
    loadScoreEvidence,
    ntQuestionPrefetchRef,
    ntRequestedTargetCount,
    ntScope,
    setAnsweredCount,
    setAttemptId,
    setCorrectChoiceId,
    setCorrectCount,
    setErrorMsg,
    setIsCorrect,
    setNtError,
    setNtScope,
    setNtTargetCount,
    setPhase,
    setQuestion,
    setSelectedChoice,
    setSequenceOrder,
    setUserId,
  ]);

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
  }, [
    assessmentMode,
    ensureAssessmentSession,
    loadNtQuestion,
    loadScoreEvidence,
    modeReady,
    ntBooks,
    ntMetadataLoaded,
    ntRequestedScopeKey,
    ntRequestedTargetCount,
    setAnsweredCount,
    setAttemptId,
    setCorrectCount,
    setNtError,
    setNtScope,
    setNtTargetCount,
    setPhase,
    setUserId,
    startNtPilot,
  ]);

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
  }, [
    assessmentMode,
    ensureAssessmentSession,
    loadQuestion,
    loadScoreEvidence,
    modeReady,
    otQuestionPrefetchRef,
    otRequest,
    setAnsweredCount,
    setAttemptId,
    setCorrectCount,
    setDebugErrorMsg,
    setErrorMsg,
    setOtAssessment,
    setOtTargetCount,
    setPhase,
  ]);

  return { startNtPilot };
}
