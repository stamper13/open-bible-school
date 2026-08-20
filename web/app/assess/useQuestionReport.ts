import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { IDK_CHOICE_ID } from "./constants";
import type { Question, ReportCategory } from "./types";

type SubmitQuestionReportArgs = {
  attemptId: string | null;
  correctChoiceId: string | null;
  question: Question | null;
  selectedChoice: string | null;
  userId: string | null;
};

export function useQuestionReport() {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>("wrong_answer");
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sent">("idle");
  const [reportError, setReportError] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const resetQuestionReport = useCallback(() => {
    setReportCategory("wrong_answer");
    setReportText("");
    setReportStatus("idle");
    setReportError("");
  }, []);

  const openQuestionReport = useCallback(() => {
    setReportStatus("idle");
    setReportError("");
    setShowReportModal(true);
  }, []);

  const submitQuestionReport = useCallback(async ({
    attemptId,
    correctChoiceId,
    question,
    selectedChoice,
    userId,
  }: SubmitQuestionReportArgs) => {
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
  }, [reportCategory, reportText]);

  return {
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
  };
}
