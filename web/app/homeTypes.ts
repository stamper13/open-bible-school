// Types for the home dashboard's data model: score breakdowns, recommendation
// payloads, and progress/evidence shapes. Split out of homeHelpers.ts (which
// used to hold types, constants, and functions together) so this can be the
// one place to jump to for "what shape is a ScopeScore" — mirrors
// app/assess/types.ts doing the same job for the assess flow.

import type { PublicQuestionMetadataRow } from "@/lib/supabase/questionMetadata";
import type { Testament as BibleTestament } from "@/lib/bibleTaxonomy";

export type SectionScoreMap = Record<string, {
  accuracy_pct: number;
  raw_bli_pct: number;
  total: number;
}>;
export type BreakdownTab = "sections" | "books" | "domains";
export type DashboardTab = "bli" | "church-history" | "biblical-languages";
export type AssessmentSnapshot = { answered: number; correct: number; bli?: number };
export type RecommendedStudy = {
  label: string;
  books: string;
  /**
   * Optional because the "not enough evidence yet" recommendation has nothing
   * useful to put here: its headline already carries the whole message. The
   * cards skip the element entirely rather than rendering an empty paragraph.
   */
  focus?: string;
  priority?: string;
  actionHref: string;
  actionLabel: string;
};
export type ScopeKind = "canon" | "section" | "book" | "domain";
export type ScopeScore = {
  key: string;
  label: string;
  subtitle: string;
  kind: ScopeKind;
  className: string;
  testament: BibleTestament;
  backendScopeKey: string;
  rawScore: number | null;
  displayScore: number | null;
  answered: number;
  correct: number;
  confidence: "none" | "low" | "moderate" | "high";
};
export type ScopeSummary = {
  scope_type: string;
  scope_key: string;
  answered: number;
  correct: number;
  idk: number;
  accuracy: number | null;
  first_answered_at: string | null;
  last_answered_at: string | null;
  evidence_level: "Needs more evidence" | "Low evidence" | "Moderate evidence" | "High evidence";
  books: Array<{
    book_code: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
  dimensions: Array<{
    dimension_key: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
};
export type ScopeDetailTarget = {
  scopeType: "TESTAMENT" | "SECTION" | "BOOK" | "DIMENSION" | "UNIT";
  scopeKey: string;
  label: string;
  subtitle: string;
  unitKey?: string;
};
export type BankRow = PublicQuestionMetadataRow;
export type AnswerRow = {
  generated_question_id: string | null;
  is_correct: boolean;
  is_idk?: boolean | null;
  scoring_eligible?: boolean | null;
};
export type BackendRecommendation = {
  unit_key: string;
  label: string;
  section: string;
  book_code: string;
  start_chapter: number;
  end_chapter: number;
  answered: number;
  display_score: number | null;
  retest_question_target: number;
  focus_text: string;
  reason: string;
  recommendation_kind: "UNIT" | "DIMENSION";
  dimension_key: string | null;
  dimension_label: string | null;
  dimension_short_label: string | null;
  dimension_answered: number | null;
  dimension_correct: number | null;
  dimension_display_score: number | null;
  dimension_available_questions: number | null;
  dimension_focus_text: string | null;
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
export type BliSectionFollowup = {
  scoring_version: "bli_weighted_v2";
  testament: BibleTestament;
  section_name: string;
  scope_key: string;
  answered: number;
  minimum_reliable_answers: number;
  established_answers: number;
  answers_needed: number;
  suggested_question_count: number;
  evidence_status: "provisional" | "developing" | "established";
  is_provisional: boolean;
};
export type ProgressPoint = {
  attempt_id: string;
  captured_at: string;
  raw_bli: number;
  display_bli: number;
  bli_level: string;
  questions_answered: number;
  correct_answers: number;
  idk_answers: number;
  theta: number | null;
  theta_se: number | null;
  n_responses: number;
  score_change: number;
};
export type NtPilotSummary = {
  answered: number;
  correct: number;
  accuracy: number;
  scope: string;
  booksAttempted: number;
  updatedAt: string;
};

export type KnowledgeGapResource = { label: string; href: string };
export type KnowledgeGapGuidance = {
  label: string;
  steps: string[];
  resources?: KnowledgeGapResource[];
};
export type KnowledgeGapGuidanceOverride = Partial<KnowledgeGapGuidance>;
