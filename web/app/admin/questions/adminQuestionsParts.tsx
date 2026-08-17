// Extracted from app/admin/questions/page.tsx during a file-size cleanup.
// Pure types, constants, helper functions, and presentational subcomponents
// (QuestionBankAudit, AuditTable, ConsoleState) used by the admin console.
// No behavior change intended.

import { type ReactNode } from "react";
import { ADMIN_QUESTIONS_STYLES_2 } from "./adminQuestionsStyles";

export type RawRow = Record<string, unknown>;
export type ReviewStatus = "pending" | "approved" | "revise" | "quarantined";
export type QualityItem = {
  id: string;
  prompt: string;
  questionType: string;
  bookCode: string;
  dimensionKey: string;
  metadataStatus: string;
  responseCount: number;
  percentCorrect: number | null;
  idkCount: number;
  choiceDistribution: unknown;
  reportCount: number;
  reportCategories: unknown;
  reviewStatus: ReviewStatus;
  reviewNotes: string;
  needsAttention: boolean;
  raw: RawRow;
};
export type AuditData = {
  summary: RawRow[];
  readiness: RawRow[];
  metadata: RawRow[];
  coverage: RawRow[];
  repetition: RawRow[];
  difficulty: RawRow[];
  distractors: RawRow[];
  malformed: RawRow[];
};
export type AuditColumn = {
  key: string;
  label: string;
};

export const REVIEW_STATUSES: ReviewStatus[] = ["pending", "approved", "revise", "quarantined"];
export const DIMENSIONS = [
  ["characters_lineage", "Characters & Lineage"],
  ["events_timeline", "Events & Timeline"],
  ["geography_nations", "Geography & Nations"],
  ["law_commands", "Law & Commands"],
  ["promise_prophecy", "Promise & Prophecy"],
  ["theological_reasoning", "Theological Reasoning"],
  ["structure_cross_ref", "Structure & Cross Ref"],
] as const;
export const EMPTY_AUDIT: AuditData = {
  summary: [],
  readiness: [],
  metadata: [],
  coverage: [],
  repetition: [],
  difficulty: [],
  distractors: [],
  malformed: [],
};

export function stringValue(row: RawRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function numberValue(row: RawRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

export function optionalNumberValue(row: RawRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

export function normalizeQualityItem(row: RawRow): QualityItem {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload as RawRow
    : {};
  const statusValue = stringValue(row, "review_status") as ReviewStatus;
  const needsAttention = row.needs_attention === true || row.needs_attention === "true";
  return {
    id: stringValue(row, "generated_question_id", "question_id", "id"),
    prompt: stringValue(row, "prompt", "question_prompt") || stringValue(payload, "prompt", "question"),
    questionType: stringValue(row, "question_type", "type"),
    bookCode: stringValue(row, "book_code"),
    dimensionKey: stringValue(row, "dimension_key"),
    metadataStatus: stringValue(row, "metadata_status", "metadata_quality_status") || "unknown",
    responseCount: numberValue(row, "response_count", "responses", "answered"),
    percentCorrect: optionalNumberValue(row, "percent_correct", "accuracy", "pct_correct"),
    idkCount: numberValue(row, "idk_count", "dont_know_count"),
    choiceDistribution: row.choice_distribution ?? row.answer_distribution ?? null,
    reportCount: numberValue(row, "report_count", "reports"),
    reportCategories: row.report_categories ?? row.report_category_counts ?? null,
    reviewStatus: REVIEW_STATUSES.includes(statusValue) ? statusValue : "pending",
    reviewNotes: stringValue(row, "review_notes"),
    needsAttention,
    raw: row,
  };
}

export function formatUnknown(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "Unavailable";
  }
}

export function QuestionBankAudit({ audit, loading }: { audit: AuditData; loading: boolean }) {
  if (loading) {
    return <div className="queue-state"><div><strong>Running bank audit</strong>Checking metadata, coverage, repetition, item behavior, and serving capacity.</div></div>;
  }

  return (
    <section className="audit-view" aria-label="Question bank audit">
      <div className="audit-summary">
        {audit.summary.map((metric) => {
          const severity = stringValue(metric, "severity");
          return (
            <article className={`audit-metric ${["high", "review", "ok"].includes(severity) ? severity : ""}`} key={stringValue(metric, "metric_key")}>
              <div className="audit-metric-head">
                <p className="audit-metric-label">{stringValue(metric, "label")}</p>
                <strong className="audit-metric-count">{numberValue(metric, "item_count")}</strong>
              </div>
              <p className="audit-metric-detail">{stringValue(metric, "detail")}</p>
            </article>
          );
        })}
      </div>

      <AuditTable
        title="Assessment serving readiness"
        copy="Independent eligible serving units account for stem-family reuse rules. Blocked scopes cannot produce the expected question count."
        rows={audit.readiness}
        columns={[
          { key: "scope_name", label: "Scope" },
          { key: "readiness_status", label: "Status" },
          { key: "serving_units", label: "Serving units" },
          { key: "required_serving_units", label: "Required" },
          { key: "router_eligible_questions", label: "Eligible questions" },
          { key: "books_with_eligible_questions", label: "Books covered" },
          { key: "dimensions_with_eligible_questions", label: "Dimensions" },
          { key: "blocked_coverage_cells", label: "Blocked cells" },
        ]}
      />

      <div className="audit-grid">
        <AuditTable
          title="Serving blockers"
          copy="Active questions excluded by missing or invalid required metadata."
          rows={audit.metadata}
          columns={[
            { key: "book_code", label: "Book" },
            { key: "dimension_key", label: "Dimension" },
            { key: "blocker_reasons", label: "Blockers" },
            { key: "prompt", label: "Question" },
          ]}
        />
        <AuditTable
          title="Coverage gaps"
          copy="Book-by-dimension cells below their declared minimum, target, or variety requirement."
          rows={audit.coverage}
          columns={[
            { key: "book_code", label: "Book" },
            { key: "dimension_name", label: "Dimension" },
            { key: "router_eligible_questions", label: "Eligible" },
            { key: "minimum_active_questions", label: "Minimum" },
            { key: "target_active_questions", label: "Target" },
            { key: "coverage_status", label: "Status" },
          ]}
        />
        <AuditTable
          title="Repetition"
          copy="Events, identical prompts, or stem families represented often enough to distort variety."
          rows={audit.repetition}
          columns={[
            { key: "repetition_type", label: "Type" },
            { key: "book_code", label: "Book" },
            { key: "active_questions", label: "Questions" },
            { key: "distinct_prompts", label: "Unique prompts" },
            { key: "sample_prompt", label: "Example" },
            { key: "severity", label: "Severity" },
          ]}
        />
        <AuditTable
          title="Difficulty mismatches"
          copy="Provisional 2PL residuals after at least 12 responses with an ability estimate."
          rows={audit.difficulty}
          columns={[
            { key: "book_code", label: "Book" },
            { key: "prompt", label: "Question" },
            { key: "calibration_answer_count", label: "Modeled" },
            { key: "observed_percent_correct", label: "Observed %" },
            { key: "model_expected_percent_correct", label: "Expected %" },
            { key: "residual_percentage_points", label: "Residual" },
            { key: "difficulty_status", label: "Status" },
          ]}
        />
        <AuditTable
          title="Weak distractors"
          copy="Incorrect choices selected by fewer than 5% after at least 12 non-IDK exposures."
          rows={audit.distractors}
          columns={[
            { key: "book_code", label: "Book" },
            { key: "prompt", label: "Question" },
            { key: "choice_text", label: "Distractor" },
            { key: "exposure_count", label: "Exposures" },
            { key: "selected_count", label: "Selected" },
            { key: "selection_percent", label: "Selected %" },
            { key: "distractor_status", label: "Status" },
          ]}
        />
        <AuditTable
          title="Malformed assessment questions"
          copy="Questions that failed submission or delivery, were skipped without scoring, and should be fixed or deleted."
          rows={audit.malformed}
          columns={[
            { key: "status", label: "Report" },
            { key: "is_quarantined", label: "Quarantined" },
            { key: "recorded_as_non_scoring_skip", label: "Skipped" },
            { key: "question_type", label: "Type" },
            { key: "error_code", label: "Code" },
            { key: "error_message", label: "Error" },
            { key: "prompt", label: "Question" },
          ]}
        />
      </div>
    </section>
  );
}

export function AuditTable({
  title,
  copy,
  rows,
  columns,
}: {
  title: string;
  copy: string;
  rows: RawRow[];
  columns: AuditColumn[];
}) {
  return (
    <section className="audit-panel">
      <div className="audit-panel-head">
        <div>
          <h2 className="audit-panel-title">{title}</h2>
          <p className="audit-panel-copy">{copy}</p>
        </div>
        <span className="audit-panel-count">{rows.length} flagged</span>
      </div>
      {rows.length === 0 ? (
        <div className="audit-empty">No flags currently meet this audit&apos;s evidence threshold.</div>
      ) : (
        <table className="audit-table">
          <thead>
            <tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${stringValue(row, "generated_question_id", "group_key", "scope_key", "book_code")}:${index}`}>
                {columns.map(column => <td key={column.key}>{formatUnknown(row[column.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function ConsoleState({title, copy, action}: {title: string; copy: string; action?: ReactNode}) {
  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      background: "#11182b",
      color: "#fff",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{maxWidth: 440, textAlign: "center"}}>
        <p style={{margin: 0, fontFamily: 'var(--font-crimson), Georgia, serif', fontSize: 30, fontWeight: 700}}>{title}</p>
        <p style={{margin: "10px 0 20px", color: "rgba(255,255,255,.62)", fontSize: 13, lineHeight: 1.55}}>{copy}</p>
        {action}
        <style>{ADMIN_QUESTIONS_STYLES_2}</style>
      </div>
    </main>
  );
}
