import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/authorize";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REVIEW_STATUSES = new Set(["pending", "approved", "revise", "quarantined"]);

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function GET(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) {
    return privateJson({ error: authorization.message }, { status: authorization.status });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const bookCode = url.searchParams.get("book")?.trim().toUpperCase() || null;
  const dimensionKey = url.searchParams.get("dimension")?.trim() || null;
  const needsAttention = url.searchParams.get("needs_attention") !== "false";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const reviewStatus = statusParam && REVIEW_STATUSES.has(statusParam) ? statusParam : null;

  if (url.searchParams.get("mode") === "audit") {
    const [
      { data: auditSummary, error: auditSummaryError },
      { data: readiness, error: readinessError },
      { data: metadataIssues, error: metadataError },
      { data: auditCoverage, error: auditCoverageError },
      { data: repetition, error: repetitionError },
      { data: difficulty, error: difficultyError },
      { data: distractors, error: distractorError },
    ] = await Promise.all([
      authorization.adminSupabase
        .from("obs_admin_question_bank_audit_summary")
        .select("*")
        .limit(20),
      authorization.adminSupabase
        .from("obs_admin_assessment_readiness")
        .select("*")
        .limit(20),
      authorization.adminSupabase
        .from("obs_admin_question_bank_audit")
        .select("generated_question_id,book_code,dimension_key,prompt,blocker_reasons,warning_reasons,router_eligible")
        .eq("router_eligible", false)
        .limit(100),
      authorization.adminSupabase
        .from("obs_admin_coverage_audit")
        .select("book_code,book_name,testament,section_name,dimension_key,dimension_name,minimum_active_questions,target_active_questions,router_eligible_questions,target_gap,coverage_status")
        .neq("coverage_status", "healthy")
        .order("target_gap", { ascending: false })
        .limit(100),
      authorization.adminSupabase
        .from("obs_admin_repetition_audit")
        .select("*")
        .order("active_questions", { ascending: false })
        .limit(100),
      authorization.adminSupabase
        .from("obs_admin_difficulty_audit")
        .select("generated_question_id,book_code,dimension_key,prompt,effective_irt_b,calibration_answer_count,observed_percent_correct,model_expected_percent_correct,residual_percentage_points,difficulty_status")
        .in("difficulty_status", ["review", "high_mismatch"])
        .order("calibration_answer_count", { ascending: false })
        .limit(100),
      authorization.adminSupabase
        .from("obs_admin_distractor_audit")
        .select("generated_question_id,book_code,dimension_key,prompt,choice_id,choice_text,exposure_count,selected_count,selection_percent,distractor_status")
        .in("distractor_status", ["never_selected", "weak"])
        .order("exposure_count", { ascending: false })
        .limit(100),
    ]);

    const auditError = auditSummaryError
      || readinessError
      || metadataError
      || auditCoverageError
      || repetitionError
      || difficultyError
      || distractorError;
    if (auditError) {
      return privateJson(
        { error: auditError.message || "Question-bank audit data could not be loaded." },
        { status: 500 },
      );
    }

    return privateJson({
      reviewer: authorization.email,
      audit: {
        summary: auditSummary ?? [],
        readiness: readiness ?? [],
        metadata: metadataIssues ?? [],
        coverage: auditCoverage ?? [],
        repetition: repetition ?? [],
        difficulty: difficulty ?? [],
        distractors: distractors ?? [],
      },
    });
  }

  const [
    { data: queue, error: queueError },
    { data: coverage, error: coverageError },
  ] = await Promise.all([
    authorization.adminSupabase.rpc("obs_admin_get_question_quality_queue", {
      p_review_status: reviewStatus,
      p_needs_attention: needsAttention,
      p_book_code: bookCode,
      p_dimension_key: dimensionKey,
      p_limit: limit,
      p_offset: offset,
    }),
    authorization.adminSupabase
      .from("obs_admin_coverage_audit")
      .select("*")
      .limit(500),
  ]);

  const dataError = queueError || coverageError;

  if (dataError) {
    return privateJson(
      { error: dataError.message || "Admin quality data could not be loaded." },
      { status: 500 },
    );
  }

  return privateJson({
    reviewer: authorization.email,
    queue: queue ?? [],
    coverage: coverage ?? [],
    pagination: { limit, offset, returned: queue?.length ?? 0 },
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) {
    return privateJson({ error: authorization.message }, { status: authorization.status });
  }

  let body: {
    generatedQuestionId?: string;
    reviewStatus?: string;
    reviewNotes?: string | null;
    confirmQuarantine?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "A valid JSON body is required." }, { status: 400 });
  }

  const questionId = body.generatedQuestionId?.trim() ?? "";
  const reviewStatus = body.reviewStatus?.trim() ?? "";
  if (!questionId || !REVIEW_STATUSES.has(reviewStatus)) {
    return privateJson({ error: "A question ID and valid review status are required." }, { status: 400 });
  }
  if (reviewStatus === "quarantined" && body.confirmQuarantine !== true) {
    return privateJson({ error: "Quarantine confirmation is required." }, { status: 400 });
  }

  const { data, error } = await authorization.adminSupabase.rpc("obs_admin_set_question_review_status", {
    p_generated_question_id: questionId,
    p_review_status: reviewStatus,
    p_review_notes: body.reviewNotes?.trim() || null,
  });
  if (error) {
    return privateJson({ error: error.message }, { status: 500 });
  }

  return privateJson({ updated: data ?? true });
}
