"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/lib/supabase/client";
import {
  FOLLOWUP_ASSESSMENT_TARGET,
  NT_PILOT_ENABLED,
  TOTAL_INITIAL,
} from "@/app/assess/constants";
import {
  ATTEMPT_HISTORY_LIMIT,
  deriveAttemptScoreState,
  formatAttemptScore,
  type AttemptScoreState,
  type ProgressHistoryRow,
} from "@/lib/attemptScore";
import { RESULTS_PAGE_STYLES } from "./resultsStyles";

type Testament = "OT" | "NT";
type ReviewFilter = "all" | "missed" | "skipped";
type AttemptSummary = {
  attempt_id: string;
  testament: Testament;
  answered: number;
  correct: number;
  idk: number;
  accuracy: number | null;
  started_at: string | null;
  completed_at: string | null;
  snapshot: {
    attempt_id: string;
    testament: Testament;
    raw_bli: number;
    display_bli: number;
    bli_level: string;
    questions_answered: number;
    correct_answers: number;
    idk_answers: number;
    theta: number | null;
    theta_se: number | null;
    n_responses: number;
    section_scores: Record<string, unknown>;
    captured_at: string;
  } | null;
  breakdown: Array<{
    type: "section" | "book" | "dimension";
    key: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
};
type AttemptReviewRow = {
  answer_id: string;
  answered_at: string;
  generated_question_id: string;
  prompt: string;
  choices: Array<{ id: string; text: string }>;
  selected_choice_id: string | null;
  selected_choice_text: string | null;
  correct_choice_id: string;
  correct_choice_text: string | null;
  is_correct: boolean;
  is_idk: boolean;
  book_code: string;
  section: string;
  dimension_key: string;
  source_ref: string | null;
  explanation: string | null;
};

const UNKNOWN_SCORE_STATE: AttemptScoreState = { mode: "unknown", change: null };

const FILTERS: Array<{ key: ReviewFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "missed", label: "Review missed" },
  { key: "skipped", label: "Skipped" },
];

function formatDate(value: string | null) {
  if (!value) return "Recently completed";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function AnswerDisplay({ value, ordered = false }: { value: string; ordered?: boolean }) {
  const items = ordered
    ? value.split(" -> ").map(item => item.trim()).filter(Boolean)
    : [];
  if (items.length < 2) return <span>{value}</span>;
  return (
    <ol className="sequence-review-list">
      {items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}
    </ol>
  );
}

function isLegacySectionSortReview(row: Pick<AttemptReviewRow, "prompt" | "selected_choice_id">) {
  return /\bwhich group consists entirely of books in the\b/i.test(row.prompt)
    && (row.selected_choice_id === "A" || row.selected_choice_id === "B" || row.selected_choice_id === "__SECTION_SORT__");
}

function reviewPrompt(row: AttemptReviewRow) {
  if (isLegacySectionSortReview(row)) {
    return "Using Hebrew Bible divisions, drag each book to its correct section.";
  }
  return row.prompt;
}

function reviewSelectedAnswer(row: AttemptReviewRow, isSequence: boolean) {
  if (row.is_idk) return "I don't know / skipped";
  if (row.selected_choice_text) return row.selected_choice_text;
  if (isLegacySectionSortReview(row)) {
    return "Section-sort response recorded. The exact drag/drop placements were not snapshotted for this early division question.";
  }
  if (row.selected_choice_id) {
    return `Recorded choice ${row.selected_choice_id} (exact wording unavailable for this older assessment)`;
  }
  if (isSequence) return "Sequence response unavailable";
  return "No answer recorded";
}

function reviewCorrectAnswer(row: AttemptReviewRow) {
  if (isLegacySectionSortReview(row)) {
    return "Each displayed book belongs in its Hebrew Bible section: Torah, Former Prophets, Latter Prophets, or Writings.";
  }
  return row.correct_choice_text || row.correct_choice_id;
}

function reviewExplanation(row: AttemptReviewRow) {
  if (isLegacySectionSortReview(row)) {
    return "This was shown as a drag/drop division question. OBA uses Hebrew Bible/Tanakh divisions for Old Testament structure, so some books appear differently than in many English Bible contents pages.";
  }
  return row.explanation || "An explanation has not been added to this question yet.";
}

export default function AttemptResultsPage() {
  const params = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const attemptParam = params.attemptId;
  const attemptId = Array.isArray(attemptParam) ? attemptParam[0] : attemptParam;
  const [summary, setSummary] = useState<AttemptSummary | null>(null);
  const [reviewRows, setReviewRows] = useState<AttemptReviewRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("all");
  const [expandedAnswerId, setExpandedAnswerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Distinguishes what the user can actually do about the failure: sign in,
  // go back, or simply try again.
  const [errorKind, setErrorKind] = useState<"auth" | "notfound" | "failed" | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // BLI movement for this session. See lib/attemptScore.ts for why a baseline
  // cannot be recognised from score_change alone.
  const [scoreState, setScoreState] = useState<AttemptScoreState>(UNKNOWN_SCORE_STATE);

  // Standard site starfield: gradient + a soft teal nebula glow, both painted
  // into the canvas itself (matching /bli, /about, /credential, /assess) —
  // this page used to paint only twinkling stars over a flat CSS gradient
  // with no nebula, which made it look like a different background.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const skip = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let frame = 0;

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      r: (0.5 + Math.random() * 1.4) * DPR,
      opacity: 0.3 + Math.random() * 0.5,
      speed: 0.002 + Math.random() * 0.004,
      offset: Math.random() * Math.PI * 2,
    }));

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width, h = canvas.height;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0b0f1e"); g.addColorStop(0.5, "#111827"); g.addColorStop(1, "#0d1530");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const neb = ctx.createRadialGradient(w * 0.2, h * 0.25, 0, w * 0.2, h * 0.25, w * 0.42);
      neb.addColorStop(0, "rgba(10,163,163,0.07)"); neb.addColorStop(1, "transparent");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const tw = skip ? 1 : 0.6 + 0.4 * Math.sin(frame * s.speed + s.offset);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${s.opacity * tw})`;
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame++;
      if (!skip) raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    if (!attemptId) return;
    // Narrowed once here; the async body below is a closure, so TypeScript
    // cannot carry the guard above into it.
    const currentAttemptId = attemptId;
    let cancelled = false;

    async function loadResults() {
      setLoading(true);
      setError("");
      setErrorKind(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (!cancelled) {
          setError("Your assessment session is no longer available. Sign in to view saved results.");
          setErrorKind("auth");
          setLoading(false);
        }
        return;
      }

      const [{ data: summaryData, error: summaryError }, { data: reviewData, error: reviewError }] = await Promise.all([
        supabase.rpc("obs_get_attempt_summary", {
          p_user_id: userId,
          p_attempt_id: attemptId,
        }),
        supabase.rpc("obs_get_attempt_review", {
          p_user_id: userId,
          p_attempt_id: attemptId,
        }),
      ]);

      if (cancelled) return;
      if (summaryError || reviewError) {
        // Keep the database detail in the console for diagnosis; show the user
        // something they can act on instead of a raw Postgres message.
        console.error("Results load failed:", summaryError ?? reviewError);
        setError("We could not load these results just now. This is usually a temporary connection problem.");
        setErrorKind("failed");
        setLoading(false);
        return;
      }
      if (!summaryData) {
        setError("These results were not found or do not belong to this session.");
        setErrorKind("notfound");
        setLoading(false);
        return;
      }

      const loadedSummary = summaryData as AttemptSummary;
      setSummary(loadedSummary);
      setReviewRows((reviewData ?? []) as AttemptReviewRow[]);

      // The BLI delta needs the testament, so it can only be asked for once the
      // summary is back. Deliberately non-fatal: the rest of the page is already
      // usable, so a history failure falls back to showing the absolute BLI
      // rather than replacing working results with an error.
      setScoreState(UNKNOWN_SCORE_STATE);
      const { data: historyData, error: historyError } = await supabase.rpc("obs_get_progress_history", {
        p_user_id: userId,
        p_testament: loadedSummary.testament,
        p_limit: ATTEMPT_HISTORY_LIMIT,
      });
      if (cancelled) return;
      if (historyError) {
        console.error("Progress history load failed on results page:", historyError);
      } else {
        setScoreState(deriveAttemptScoreState((historyData ?? []) as ProgressHistoryRow[], currentAttemptId));
      }

      setLoading(false);
    }

    void loadResults();
    return () => {
      cancelled = true;
    };
  }, [attemptId, reloadToken]);

  const filteredRows = useMemo(() => {
    if (activeFilter === "missed") return reviewRows.filter(row => !row.is_correct && !row.is_idk);
    if (activeFilter === "skipped") return reviewRows.filter(row => row.is_idk);
    return reviewRows;
  }, [activeFilter, reviewRows]);

  const sectionBreakdown = useMemo(
    () => summary?.breakdown.filter(item => item.type === "section") ?? [],
    [summary],
  );

  const continueAssessment = () => {
    if (summary?.testament === "NT") {
      sessionStorage.removeItem("obs_nt_attempt_id");
      window.location.href = NT_PILOT_ENABLED
        ? `/assess?testament=NT&scope=NT&target=${FOLLOWUP_ASSESSMENT_TARGET}`
        : "/assess?choose=1";
      return;
    }
    window.location.href = `/assess?target=${FOLLOWUP_ASSESSMENT_TARGET}`;
  };

  const sessionAccuracy = summary
    ? summary.accuracy ?? (summary.answered > 0 ? (summary.correct / summary.answered) * 100 : null)
    : null;
  const sessionAccuracyDisplay = sessionAccuracy === null
    ? null
    : `${Math.round(Math.max(0, Math.min(100, sessionAccuracy)))}%`;
  const pageError = attemptId ? error : "This results link is incomplete.";

  const score = formatAttemptScore({
    state: scoreState,
    displayBli: summary?.snapshot?.display_bli ?? null,
    bliLevel: summary?.snapshot?.bli_level ?? null,
    accuracyDisplay: sessionAccuracyDisplay,
  });
  // NOTE: despite the name, obs_get_attempt_summary's `completed_at` is
  // max(answered_at) — the time of the most recent answer, not a real
  // "attempt finished" flag. It's non-null after the very first question, so
  // it can't be used to gate this page. The standard assessment is currently
  // 25 questions, matching app/assess/constants.ts and the dashboard landing.
  // Answered count is the only
  // honest signal we have client-side that a real BLI result exists.
  const ASSESSMENT_COMPLETE_THRESHOLD = TOTAL_INITIAL;
  const isComplete = Boolean(summary && summary.answered >= ASSESSMENT_COMPLETE_THRESHOLD);
  const questionsRemaining = summary ? Math.max(0, ASSESSMENT_COMPLETE_THRESHOLD - summary.answered) : 0;

  return (
    <>
      <style>{RESULTS_PAGE_STYLES}</style>
      <div className="results-page">
        <canvas ref={canvasRef} className="results-stars" aria-hidden="true" />
        <nav className="results-nav">
          <BrandLogo className="results-brand" />
          <Link className="results-nav-link" href="/">Dashboard</Link>
        </nav>

        {loading && attemptId ? (
          <main className="results-state">
            <div className="state-panel">
              <div className="loader" />
              <div className="state-title">Preparing your results</div>
              <p className="state-copy">Gathering your score and session review.</p>
            </div>
          </main>
        ) : pageError || !summary ? (
          <main className="results-state">
            <div className="state-panel" role="alert">
              <div className="state-title">
                {errorKind === "auth" ? "Sign in to view these results" : "Results unavailable"}
              </div>
              <p className="state-copy">{pageError || "This assessment could not be found."}</p>
              <div className="results-actions" style={{ justifyContent: "center", flexWrap: "wrap" }}>
                {errorKind === "failed" && (
                  <button
                    type="button"
                    className="action-primary"
                    onClick={() => setReloadToken(token => token + 1)}
                  >
                    Try again
                  </button>
                )}
                <Link className="action-secondary" href="/">
                  {errorKind === "auth" ? "Go to sign in" : "Return to dashboard"}
                </Link>
              </div>
            </div>
          </main>
        ) : (
          <main className="results-shell">
            <p className="results-kicker">{summary.testament === "NT" ? "New Testament assessment" : "Old Testament assessment"}</p>
            <h1 className="results-title">{isComplete ? "Your assessment results" : "Assessment in progress"}</h1>
            <p className="results-date">
              {isComplete ? formatDate(summary.completed_at) : `${summary.answered} of ${ASSESSMENT_COMPLETE_THRESHOLD} answered so far`}
            </p>

            <section className={`results-summary ${isComplete ? "" : "is-in-progress"}`} aria-label="Assessment summary">
              {isComplete && (
                <div className="score-signal">
                  <div className={`score-value${score.trendClass}`} aria-label={score.aria}>
                    {score.value ?? "--"}
                  </div>
                  <div className="score-label">{score.label}</div>
                  {score.context && <div className="score-context">{score.context}</div>}
                </div>
              )}
              <div className="summary-body">
                <h2 className="summary-heading">
                  {isComplete
                    ? (summary.testament === "NT" ? "Your NT session review" : "Your OT session review")
                    : "This assessment isn't finished yet"}
                </h2>
                <p className="summary-copy">
                  {isComplete
                    ? "Review the session below when you want to study specific misses or revisit questions you skipped."
                    : "Your score and section breakdown are only meaningful once the standard 25-question assessment is complete; finish it to see them."}
                </p>
                <div className="metric-row">
                  <div className="metric"><strong>{summary.answered}</strong><span>Answered</span></div>
                  <div className="metric"><strong>{summary.correct}</strong><span>Correct</span></div>
                  <div className="metric"><strong>{summary.idk}</strong><span>Skipped</span></div>
                  {isComplete ? (
                    <div className="metric"><strong>{Math.round(summary.accuracy ?? 0)}%</strong><span>Accuracy</span></div>
                  ) : (
                    <div className="metric"><strong>{questionsRemaining}</strong><span>Remaining</span></div>
                  )}
                </div>
                {isComplete && sectionBreakdown.length > 0 && (
                  <div className="scope-strip" aria-label="Section breakdown">
                    {sectionBreakdown.map(item => (
                      <span className="scope-chip" key={item.key}>
                        {item.key} · {item.answered} answered
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="results-actions">
              <button className="action-primary" type="button" onClick={continueAssessment}>
                Continue with assessment
              </button>
              <Link className="action-secondary" href="/">See my dashboard</Link>
            </div>

            <section className="review-section" aria-labelledby="review-heading">
              <div className="review-head">
                <div>
                  <h2 className="review-title" id="review-heading">Session review</h2>
                  <p className="review-sub">{filteredRows.length} of {reviewRows.length} responses shown</p>
                </div>
                {/* Toggle buttons rather than an ARIA tablist: there is no
                    tabpanel to own, and these filter a list in place. */}
                <div className="review-filters" role="group" aria-label="Review filters">
                  {FILTERS.map(filter => (
                    <button
                      key={filter.key}
                      className={`filter-btn ${activeFilter === filter.key ? "active" : ""}`}
                      type="button"
                      aria-pressed={activeFilter === filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="review-list" role="status" aria-live="polite">
                {filteredRows.length === 0 ? (
                  <p className="empty-review">No responses match this filter.</p>
                ) : filteredRows.map(row => {
                  const state = row.is_idk ? "skipped" : row.is_correct ? "correct" : "missed";
                  const isOpen = expandedAnswerId === row.answer_id;
                  const isSequence = row.selected_choice_id?.startsWith("__ORDER__:") ?? false;
                  return (
                    <article className="review-row" key={row.answer_id}>
                      <button
                        className="review-trigger"
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setExpandedAnswerId(isOpen ? null : row.answer_id)}
                      >
                        <span className={`status-dot ${state}`} aria-hidden="true" />
                        <span className="review-prompt">
                          {reviewPrompt(row)}
                          <span className="review-meta">
                            {row.book_code} · {row.section} · {titleCase(row.dimension_key)}
                          </span>
                        </span>
                        <span className={`review-state ${state}`}>{state}</span>
                        <span className={`chevron ${isOpen ? "open" : ""}`} aria-hidden="true">›</span>
                      </button>
                      {isOpen && (
                        <div className="review-detail">
                          <div className="answer-line">
                            <strong>Your answer</strong>
                            <AnswerDisplay
                              ordered={isSequence}
                              value={reviewSelectedAnswer(row, isSequence)}
                            />
                          </div>
                          <div className="answer-line correct-answer">
                            <strong>Correct answer</strong>
                            <AnswerDisplay
                              ordered={isSequence}
                              value={reviewCorrectAnswer(row)}
                            />
                          </div>
                          {row.source_ref && (
                            <div className="answer-line">
                              <strong>Reference</strong>
                              <span>{row.source_ref}</span>
                            </div>
                          )}
                          <div className="answer-line">
                            <strong>Explanation</strong>
                            <span className="explanation">{reviewExplanation(row)}</span>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </main>
        )}
      </div>
    </>
  );
}
