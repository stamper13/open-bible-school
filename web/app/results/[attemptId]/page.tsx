"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let frame = 0;
    const stars = Array.from({ length: 260 }, (_, index) => ({
      x: ((index * 73) % 997) / 997,
      y: ((index * 193) % 991) / 991,
      radius: 0.45 + ((index * 17) % 18) / 10,
      alpha: 0.24 + ((index * 29) % 65) / 100,
      speed: 0.002 + ((index * 11) % 20) / 10000,
    }));

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const alpha = star.alpha * (0.72 + Math.sin(frame * star.speed + star.x * 9) * 0.28);
        context.beginPath();
        context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255,255,255,${alpha})`;
        context.fill();
      }
      frame += 1;
      if (!prefersReducedMotion) animationFrame = requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    if (!attemptId) return;
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

      setSummary(summaryData as AttemptSummary);
      setReviewRows((reviewData ?? []) as AttemptReviewRow[]);
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
      window.location.href = "/assess?testament=NT&scope=NT";
      return;
    }
    window.location.href = "/assess";
  };

  const score = summary?.snapshot?.display_bli ?? null;
  const pageError = attemptId ? error : "This results link is incomplete.";
  const scoreLabel = summary?.snapshot?.bli_level
    ? `${summary.snapshot.bli_level} · ${summary.testament === "NT" ? "New Testament BLI" : "Old Testament BLI"}`
    : summary?.testament === "NT"
      ? "New Testament assessment accuracy"
      : "Attempt accuracy";

  return (
    <>
      <style>{`
        :root {
          --navy: #1b2442;
          --accent: #0aa3a3;
          --muted: #566070;
          --gold: #d4a017;
          --card: rgba(255,255,255,.95);
          --line: rgba(27,36,66,.11);
          --soft: rgba(27,36,66,.055);
          --correct: #08785f;
          --wrong: #b63b4b;
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { background: #0b0f1e; }
        body { margin: 0; background: #0b0f1e; color: var(--navy); font-family: var(--font-inter), system-ui, sans-serif; }
        .results-page { min-height: 100vh; position: relative; isolation: isolate; padding-bottom: 72px; }
        .action-primary:focus-visible,
        .action-secondary:focus-visible,
        .results-nav-link:focus-visible,
        .results-brand:focus-visible,
        .filter-btn:focus-visible,
        .review-trigger:focus-visible {
          outline: 2px solid #4fd6d6; outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
          }
        }
        .results-page::before {
          content: ""; position: fixed; inset: 0; z-index: -3;
          background: linear-gradient(180deg, #0b0f1e 0%, #111827 54%, #0d1530 100%);
        }
        .results-stars { position: fixed; inset: 0; z-index: -2; pointer-events: none; }
        .results-nav {
          min-height: 64px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(8,12,25,.78); backdrop-filter: blur(14px);
        }
        .results-brand { color: #fff; text-decoration: none; font: 700 17px var(--font-crimson), Georgia, serif; }
        .results-nav-link {
          color: rgba(255,255,255,.67); text-decoration: none; font-size: 13px; font-weight: 650;
          padding: 8px 13px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px;
        }
        .results-shell { width: min(980px, calc(100% - 32px)); margin: 0 auto; padding-top: 52px; }
        .results-kicker {
          color: rgba(255,255,255,.58); font-size: 11px; font-weight: 800;
          letter-spacing: .16em; text-transform: uppercase; margin: 0 0 10px;
        }
        .results-title {
          color: #fff; font: 700 clamp(30px, 5vw, 48px)/1.02 var(--font-crimson), Georgia, serif;
          letter-spacing: 0; margin: 0;
        }
        .results-date { color: rgba(255,255,255,.56); font-size: 13px; margin: 9px 0 26px; }
        .results-summary {
          display: grid; grid-template-columns: 250px minmax(0, 1fr);
          background: var(--card); border: 1px solid rgba(255,255,255,.55);
          border-radius: 8px; box-shadow: 0 24px 70px rgba(0,0,0,.34); overflow: hidden;
        }
        .score-signal {
          min-height: 220px; padding: 28px; display: flex; flex-direction: column; justify-content: center;
          border-right: 1px solid var(--line); background: rgba(10,163,163,.07);
        }
        .score-value { font: 750 66px/1 var(--font-crimson), Georgia, serif; color: var(--navy); }
        .score-value span { font: 700 28px/1 var(--font-inter), sans-serif; }
        .score-label { margin-top: 8px; color: var(--muted); font-size: 12px; font-weight: 750; line-height: 1.45; }
        .summary-body { min-width: 0; padding: 28px 30px; }
        .summary-heading { margin: 0; font: 700 25px/1.1 var(--font-crimson), Georgia, serif; }
        .summary-copy { color: var(--muted); font-size: 14px; line-height: 1.55; margin: 7px 0 24px; }
        .metric-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid var(--line); }
        .metric { padding: 15px 12px; border-right: 1px solid var(--line); }
        .metric:first-child { padding-left: 0; }
        .metric:last-child { border-right: 0; }
        .metric strong { display: block; font: 750 23px/1 var(--font-crimson), Georgia, serif; }
        .metric span { display: block; color: var(--muted); font-size: 11px; font-weight: 700; margin-top: 5px; }
        .scope-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
        .scope-chip { color: var(--navy); background: var(--soft); border: 1px solid var(--line); border-radius: 999px; padding: 7px 10px; font-size: 11px; font-weight: 700; }
        .results-actions { display: flex; align-items: center; gap: 10px; margin: 18px 0 38px; }
        .action-primary, .action-secondary {
          min-height: 43px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; padding: 0 18px; font-size: 13px; font-weight: 750;
          text-decoration: none; cursor: pointer; font-family: inherit;
        }
        .action-primary { color: #fff; border: 0; background: var(--navy); box-shadow: 0 10px 24px rgba(0,0,0,.25); }
        .action-secondary { color: rgba(255,255,255,.78); border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); }
        .review-section { background: var(--card); border: 1px solid rgba(255,255,255,.46); border-radius: 8px; overflow: hidden; }
        .review-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; padding: 24px 26px 18px; border-bottom: 1px solid var(--line); }
        .review-title { margin: 0; font: 700 25px/1.1 var(--font-crimson), Georgia, serif; }
        .review-sub { color: var(--muted); font-size: 12px; margin: 5px 0 0; }
        .review-filters { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); }
        .filter-btn {
          border: 0; border-radius: 999px; padding: 8px 12px; background: transparent;
          color: var(--muted); font: 700 11px var(--font-inter), sans-serif; cursor: pointer;
        }
        .filter-btn.active { color: var(--navy); background: #fff; box-shadow: 0 2px 8px rgba(27,36,66,.11); }
        .review-list { display: block; }
        .review-row { border-bottom: 1px solid var(--line); }
        .review-row:last-child { border-bottom: 0; }
        .review-trigger {
          width: 100%; display: grid; grid-template-columns: 30px minmax(0,1fr) auto 24px;
          gap: 12px; align-items: center; padding: 17px 24px; border: 0; background: transparent;
          color: var(--navy); text-align: left; cursor: pointer; font-family: inherit;
        }
        .review-trigger:hover { background: rgba(10,163,163,.04); }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; justify-self: center; background: var(--correct); box-shadow: 0 0 0 5px rgba(8,120,95,.10); }
        .status-dot.missed { background: var(--wrong); box-shadow: 0 0 0 5px rgba(182,59,75,.10); }
        .status-dot.skipped { background: #6b7280; box-shadow: 0 0 0 5px rgba(107,114,128,.10); }
        .review-prompt { min-width: 0; font-size: 13px; font-weight: 700; line-height: 1.4; }
        .review-meta { color: var(--muted); font-size: 10px; font-weight: 650; margin-top: 4px; }
        .review-state { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--correct); }
        .review-state.missed { color: var(--wrong); }
        .review-state.skipped { color: #6b7280; }
        .chevron { font-size: 18px; color: var(--muted); transform: rotate(0); transition: transform .18s ease; }
        .chevron.open { transform: rotate(90deg); }
        .review-detail { padding: 0 24px 22px 66px; }
        .answer-line { display: grid; grid-template-columns: 112px minmax(0,1fr); gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 12px; line-height: 1.5; }
        .answer-line strong { color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
        .answer-line.correct-answer span { color: var(--correct); font-weight: 700; }
        .sequence-review-list {
          list-style: none; display: grid; gap: 7px; margin: 0; padding: 0;
          counter-reset: sequence-review;
        }
        .sequence-review-list li {
          counter-increment: sequence-review; display: grid;
          grid-template-columns: 23px minmax(0,1fr); align-items: start; gap: 8px;
          color: var(--navy); font-weight: 600;
        }
        .sequence-review-list li::before {
          content: counter(sequence-review); width: 21px; height: 21px;
          display: grid; place-items: center; border-radius: 50%;
          background: rgba(27,36,66,.08); color: var(--navy);
          font-size: 10px; font-weight: 800;
        }
        .correct-answer .sequence-review-list li { color: var(--correct); }
        .correct-answer .sequence-review-list li::before {
          background: rgba(8,120,95,.10); color: var(--correct);
        }
        .explanation { color: var(--muted); }
        .empty-review { color: var(--muted); font-size: 13px; padding: 30px 26px; }
        .results-state {
          min-height: calc(100vh - 64px); display: grid; place-items: center; padding: 30px;
          color: #fff; text-align: center;
        }
        .state-panel { width: min(430px, 100%); }
        .state-title { font: 700 30px var(--font-crimson), Georgia, serif; margin-bottom: 8px; }
        .state-copy { color: rgba(255,255,255,.62); font-size: 13px; line-height: 1.55; }
        .loader { width: 34px; height: 34px; margin: 0 auto 18px; border-radius: 50%; border: 3px solid rgba(255,255,255,.15); border-top-color: var(--accent); animation: spin .75s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .results-nav { padding: 0 16px; }
          .results-shell { width: min(100% - 20px, 980px); padding-top: 32px; }
          .results-summary { grid-template-columns: 1fr; }
          .score-signal { min-height: 150px; border-right: 0; border-bottom: 1px solid var(--line); padding: 22px; }
          .score-value { font-size: 56px; }
          .summary-body { padding: 22px 18px; }
          .metric-row { grid-template-columns: repeat(2, 1fr); }
          .metric:nth-child(2) { border-right: 0; }
          .metric:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
          .metric:nth-child(3) { padding-left: 0; }
          .results-actions { align-items: stretch; flex-direction: column; }
          .review-head { align-items: stretch; flex-direction: column; padding: 21px 18px 16px; }
          .review-filters { width: 100%; }
          .filter-btn { flex: 1; padding-inline: 6px; }
          .review-trigger { grid-template-columns: 22px minmax(0,1fr) 20px; padding: 15px 14px; gap: 9px; }
          .review-state { display: none; }
          .review-detail { padding: 0 14px 18px 45px; }
          .answer-line { grid-template-columns: 1fr; gap: 4px; }
        }
      `}</style>
      <div className="results-page">
        <canvas ref={canvasRef} className="results-stars" aria-hidden="true" />
        <nav className="results-nav">
          <Link className="results-brand" href="/">Open Bible Assessment</Link>
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
            <h1 className="results-title">Your assessment results</h1>
            <p className="results-date">{formatDate(summary.completed_at)}</p>

            <section className="results-summary" aria-label="Assessment summary">
              <div className="score-signal">
                <div className="score-value">
                  {score ?? Math.round(summary.accuracy ?? 0)}
                  {score === null && <span>%</span>}
                </div>
                <div className="score-label">{scoreLabel}</div>
              </div>
              <div className="summary-body">
                <h2 className="summary-heading">
                  {summary.testament === "NT" ? "Your latest NT BLI snapshot" : "Your latest OT BLI snapshot"}
                </h2>
                <p className="summary-copy">
                  Review the session below when you want to study specific misses or revisit questions you skipped.
                </p>
                <div className="metric-row">
                  <div className="metric"><strong>{summary.answered}</strong><span>Answered</span></div>
                  <div className="metric"><strong>{summary.correct}</strong><span>Correct</span></div>
                  <div className="metric"><strong>{summary.idk}</strong><span>Skipped</span></div>
                  <div className="metric"><strong>{Math.round(summary.accuracy ?? 0)}%</strong><span>Accuracy</span></div>
                </div>
                {sectionBreakdown.length > 0 && (
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
                Continue assessment
              </button>
              <Link className="action-secondary" href="/">Dashboard</Link>
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
                          {row.prompt}
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
                              value={
                                row.is_idk
                                  ? "I don't know / skipped"
                                  : row.selected_choice_text
                                    || (row.selected_choice_id
                                      ? `Recorded choice ${row.selected_choice_id} (exact wording unavailable for this older assessment)`
                                      : "No answer recorded")
                              }
                            />
                          </div>
                          <div className="answer-line correct-answer">
                            <strong>Correct answer</strong>
                            <AnswerDisplay
                              ordered={isSequence}
                              value={row.correct_choice_text || row.correct_choice_id}
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
                            <span className="explanation">{row.explanation || "An explanation has not been added to this question yet."}</span>
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
