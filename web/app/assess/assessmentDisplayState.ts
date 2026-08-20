import {
  IDK_CHOICE,
  IDK_CHOICE_ID,
} from "./constants";
import {
  isBroadSectionLevelQuestion,
  isOrderResponseQuestion,
  promptAsksForBookAnswer,
  promptAsksForSectionAnswer,
} from "./assessmentHelpers";
import type {
  AssessmentMode,
  BliEvidence,
  Choice,
  NtScopeOption,
  OtAssessmentRequest,
  OtAssessmentStartRow,
  Question,
  SectionSortInteraction,
} from "./types";

type AssessmentDisplayStateInput = {
  assessmentMode: AssessmentMode;
  answeredCount: number;
  correctChoiceId: string | null;
  correctCount: number;
  isCorrect: boolean | null;
  isSignedIn: boolean;
  ntScope: NtScopeOption;
  ntTargetCount: number;
  otAssessment: OtAssessmentStartRow | null;
  otRequest: OtAssessmentRequest;
  otTargetCount: number;
  question: Question | null;
  scoreEvidence: BliEvidence | null;
  sectionSortInteraction: SectionSortInteraction | null;
  selectedChoice: string | null;
};

export function deriveAssessmentDisplayState({
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
}: AssessmentDisplayStateInput) {
  const choiceLabel = (id: string) => {
    if (!selectedChoice) return "";
    if (assessmentMode === "OT") return id === selectedChoice ? "recorded" : "";
    if (id === correctChoiceId) return "correct";
    if (id === IDK_CHOICE_ID && selectedChoice === IDK_CHOICE_ID) return "skipped";
    if (id === selectedChoice && !isCorrect) return "wrong";
    return "";
  };

  const isSectionSortQuestion = question !== null
    && sectionSortInteraction !== null;
  const isSequenceQuestion = assessmentMode === "OT"
    && question !== null
    && !isSectionSortQuestion
    && isOrderResponseQuestion(question);
  const concealsBookAnswer = question ? promptAsksForBookAnswer(question) : false;
  const concealsSectionAnswer = assessmentMode === "OT" && question ? promptAsksForSectionAnswer(question) : false;
  const usesSectionLevelLabel = assessmentMode === "OT" && question ? isBroadSectionLevelQuestion(question) : false;
  const isInitialPhase = answeredCount < otTargetCount;
  const isScopeOtAssessment = Boolean(otRequest.scopeKey);
  const isTargetedOtAssessment = otAssessment?.assessment_kind === "ot_focused" || isScopeOtAssessment;
  const hasBrowserSavedProgress = !isSignedIn && answeredCount > 0;

  const ntProgressEnd = assessmentMode === "NT" ? Math.max(ntTargetCount, 1) : Math.max(otTargetCount, 1);
  const ntProgressPct = assessmentMode === "NT"
    ? boundedProgress(answeredCount, 0, ntProgressEnd)
    : 0;
  const nextMilestone = answeredCount < otTargetCount ? otTargetCount : Math.ceil((answeredCount + 1) / 10) * 10;
  const progressStart = isInitialPhase ? 0 : nextMilestone - 10;
  const progressEnd = isInitialPhase ? otTargetCount : nextMilestone;
  const progressPct = boundedProgress(answeredCount, progressStart, progressEnd);

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
        : scoreEvidence
          ? `${Math.max(0, otTargetCount - answeredCount)} questions until your BLI updates`
          : `${Math.max(0, otTargetCount - answeredCount)} questions until first BLI snapshot`)
    : (isSignedIn ? "Your BLI refines after every answer" : "Sign in to preserve your BLI across devices");

  return {
    accuracy: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0,
    choiceLabel,
    displayNavPhaseLabel: assessmentMode === "NT" ? "New Testament Assessment" : navPhaseLabel,
    displayNavSubLabel: assessmentMode === "NT" ? `${ntScope.label} · separate NT BLI` : navSubLabel,
    displayProgressEnd: assessmentMode === "NT" ? ntProgressEnd : progressEnd,
    displayProgressPct: assessmentMode === "NT" ? ntProgressPct : progressPct,
    isInitialPhase,
    isSectionSortQuestion,
    isSequenceQuestion,
    isSkipped: selectedChoice === IDK_CHOICE_ID,
    isScopeOtAssessment,
    isTargetedOtAssessment,
    nebulaCount: Math.max(scoreEvidence?.n_responses ?? 0, answeredCount),
    nextMilestone,
    showsBookLabel: !concealsBookAnswer && !usesSectionLevelLabel,
    showsLocationLabels: !concealsSectionAnswer && !usesSectionLevelLabel,
    showsTargetedOtLabel: assessmentMode === "OT" && isTargetedOtAssessment && !concealsBookAnswer && !usesSectionLevelLabel,
    visibleChoices: question ? [...question.choices, IDK_CHOICE] as Choice[] : [],
  };
}

function boundedProgress(value: number, start: number, end: number) {
  return Math.min(100, Math.max(0, ((value - start) / Math.max(1, end - start)) * 100));
}
