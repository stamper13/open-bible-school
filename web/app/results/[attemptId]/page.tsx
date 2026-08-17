"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
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

  const sessionAccuracy = summary
    ? summary.accuracy ?? (summary.answered > 0 ? (summary.correct / summary.answered) * 100 : null)
    : null;
  const sessionAccuracyDisplay = sessionAccuracy === null
    ? null
    : `${Math.round(Math.max(0, Math.min(100, sessionAccuracy)))}%`;
  const pageError = attemptId ? error : "This results link is incomplete.";
  const scoreLabel = "Session accuracy";
  // NOTE: despite the name, obs_get_attempt_summary's `completed_at` is
  // max(answered_at) — the time of the most recent answer, not a real
  // "attempt finished" flag. It's non-null after the very first question, so
  // it can't be used to gate this page. The standard assessment is 20
  // questions (TOTAL_INITIAL / NT_PILOT_TARGET in app/assess/page.tsx, same
  // threshold the dashboard landing uses), so answered count is the only
  // honest signal we have client-side that a real BLI result exists.
  const ASSESSMENT_COMPLETE_THRESHOLD = 20;
  const isComplete = Boolean(summary && summary.answered >= ASSESSMENT_COMPLETE_THRESHOLD);
  const questionsRemaining = summary ? Math.max(0, ASSESSMENT_COMPLETE_THRESHOLD - summary.answered) : 0;

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
        .results-summary.is-in-progress { grid-template-columns: 1fr; }
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
        .results-actions { display: flex; align-items: center; gap: 14px; margin: 22px 0 40px; }
        .action-primary, .action-secondary {
          min-height: 54px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; padding: 0 32px; font-size: 15.5px; font-weight: 750;
          text-decoration: none; cursor: pointer; font-family: inherit;
          transition: background .15s ease, transform .15s ease, box-shadow .15s ease;
        }
        .action-primary {
          color: #fff; border: 0; background: var(--navy); box-shadow: 0 12px 28px rgba(0,0,0,.3);
        }
        .action-primary:hover { background: #232f57; transform: translateY(-2px); box-shadow: 0 16px 34px rgba(0,0,0,.36); }
        .action-secondary {
          color: rgba(255,255,255,.85); border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.07);
        }
        .action-secondary:hover { background: rgba(255,255,255,.13); transform: translateY(-2px); }
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
                  <div className="score-value">
                    {sessionAccuracyDisplay ?? "--"}
                  </div>
                  <div className="score-label">{scoreLabel}</div>
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
                    : "Your score and section breakdown are only meaningful once the standard 20-question assessment is complete — finish it to see them."}
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
