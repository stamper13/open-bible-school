import type { BibleSectionKey } from "@/lib/bibleTaxonomy";

export type Choice = { id: string; text: string };
export type Testament = "OT" | "NT";
export type AssessmentMode = Testament | "select";
export type NtSectionKey = "GOSPELS_ACTS" | "PAULINE" | "GENERAL" | "APOCALYPSE";
export type SectionSortKey = BibleSectionKey;
export type SectionSortLabel = Choice & { sectionKey: SectionSortKey };
export type SectionSortZone = { id: SectionSortKey; label: string };
export type SectionSortInteraction = {
  prompt: string;
  targetSection: SectionSortKey | null;
  dragLabels: SectionSortLabel[];
  dropZones: SectionSortZone[];
};
export type Question = {
  out_generated_question_id: string;
  prompt: string;
  question_type: string;
  choices: Choice[];
  event_title: string;
  book_code: string;
  importance_tier: number;
  section: string;
  map?: unknown;
};
export type Phase = "starting" | "question" | "feedback" | "complete" | "error";
export type ReportCategory = "wrong_answer" | "inaccurate" | "poorly_worded" | "other" | "malformed_question";
export type QuestionQualityRating = 1 | 2 | 3;
export type NtBookMetadata = {
  book_code: string;
  canon_order: number;
  name: string;
  nt_division: NtSectionKey;
};
export type NtScopeOption = {
  kind: "all" | "section" | "book";
  value: string;
  rpcValue?: string;
  label: string;
  description: string;
};
export type NtPilotQuestion = Question & {
  book_name: string;
  nt_division: NtSectionKey;
};
export type NtAssessmentQuestionRow = {
  out_generated_question_id: string | null;
  prompt: string | null;
  question_type: string | null;
  choices: unknown;
  book_code: string | null;
  book_name: string | null;
  nt_division: string | null;
  answered_count: number | null;
  target_question_count: number | null;
};
export type NtAssessmentStartRow = {
  attempt_id: string;
  user_id: string;
  testament: "NT";
  scope_key: string;
  target_question_count: number;
  available_question_count: number;
};
export type NtAssessmentStatusRow = {
  attempt_id: string;
  scope_key: string;
  answered_count: number;
  correct_count: number;
  idk_count: number;
  target_question_count: number;
  target_reached: boolean;
  completed_at: string | null;
};
export type OtAssessmentRequest = {
  unitKey: string | null;
  scopeKey: string | null;
  bookCode: string | null;
  startChapter: number | null;
  endChapter: number | null;
  label: string | null;
  dimensionKey: string | null;
  targetQuestionCount: number;
  forceNew: boolean;
};
export type InitialAssessmentRoute = {
  assessmentMode: AssessmentMode;
  phase: Phase;
  ntRequestedScopeKey: string;
  ntRequestedTargetCount: number;
  otRequest: OtAssessmentRequest;
  sanitizedSearch: string | null;
};
export type OtAssessmentStartRow = {
  attempt_id: string;
  user_id: string;
  assessment_kind: "ot_adaptive" | "ot_focused";
  scope_key: string;
  unit_key: string | null;
  label: string;
  book_code: string | null;
  start_chapter: number | null;
  end_chapter: number | null;
  target_question_count: number;
  available_question_count: number;
  answered_count: number;
  correct_count: number;
  idk_count: number;
  target_reached: boolean;
  resumed: boolean;
};
export type OtSubmitResult = {
  is_correct: boolean;
  is_idk?: boolean;
  correct_choice_id: string | null;
  answered_count: number | null;
  correct_count?: number | null;
  target_question_count?: number | null;
  target_reached?: boolean | null;
  remaining_count?: number | null;
  assessment_kind?: string | null;
  unit_key?: string | null;
};
export type SectionSortSubmitResult = {
  is_correct: boolean;
  is_idk?: boolean | null;
  correct_choice_id: string | null;
  answered_count: number | null;
  correct_count: number | null;
  target_question_count: number | null;
  target_reached: boolean | null;
  remaining_count: number | null;
  scored_item_count: number | null;
  scored_correct_count: number | null;
};
export type RpcErrorLike = { code?: string; message?: string; details?: string | null; hint?: string | null } | null;
export type QuestionPrefetch<T> = {
  attemptId: string;
  afterAnsweredCount: number;
  promise: Promise<void>;
  settled: boolean;
  data: T[] | null;
  error: RpcErrorLike;
};
export type BibleSkyFact = {
  title: string;
  fact: string;
  reference?: string;
};
export type BliEvidence = {
  scope: string;
  theta: number;
  theta_se: number;
  theta_lower_95: number;
  theta_upper_95: number;
  n_responses: number;
  evidence_level: "Very limited" | "Limited" | "Developing" | "Strong" | "Very strong";
  evidence_description: string;
};
