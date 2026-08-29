"use client";

// Extracted from app/assess/page.tsx during a file-size cleanup. These are
// the assessment flow's standalone screens/modals -- each one is only ever
// shown behind a single piece of state, so AssessPage still owns that state
// and decides *whether* to render; these components just render.
// No behavior change intended.

import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { NT_PILOT_ENABLED, QUESTION_RATING_OPTIONS, REPORT_OPTIONS } from "./constants";
import { clearAssessmentBrowserStorage, ntScopeFromKey } from "./assessmentHelpers";
import type {
  AssessmentMode,
  BibleSkyFact,
  NtBookMetadata,
  NtScopeOption,
  OtAssessmentStartRow,
  Question,
  QuestionQualityRating,
  ReportCategory,
} from "./types";

// ---------------------------------------------------------------------------

export function ModeSelectScreen() {
  return (
    <div className="card center-card">
      <p className="pilot-badge">Assessment</p>
      <h1 className="card-heading">What would you like to assess?</h1>
      <p className="card-sub">Choose a section of Scripture to begin.</p>
      <div className="selection-grid">
        <button className="testament-card" type="button" onClick={() => window.location.href = "/assess"}>
          <div className="testament-top">
            <strong className="testament-title">Old Testament Assessment</strong>
          </div>
          <p className="testament-desc">Start with questions from Genesis through Malachi.</p>
        </button>
        <button
          className="testament-card"
          type="button"
          disabled={!NT_PILOT_ENABLED}
          onClick={() => {
            if (NT_PILOT_ENABLED) window.location.href = "/assess?testament=NT&scope=NT";
          }}
        >
          <div className="testament-top">
            <strong className="testament-title">New Testament Assessment</strong>
            <span className="pilot-badge">{NT_PILOT_ENABLED ? "NT BLI" : "Coming soon"}</span>
          </div>
          <p className="testament-desc">
            {NT_PILOT_ENABLED
              ? "Questions from Matthew through Revelation, scored separately from the Old Testament."
              : "Coming soon."}
          </p>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function NtStartingScreen({
  isLoadingNextQuestion,
  ntRequestedScopeKey,
  ntBooks,
  startupWaitLevel,
  ntError,
}: {
  isLoadingNextQuestion: boolean;
  ntRequestedScopeKey: string;
  ntBooks: NtBookMetadata[];
  startupWaitLevel: 0 | 1 | 2;
  ntError: string;
}) {
  return (
    <div className={`card center-card ${isLoadingNextQuestion ? "between-question-loader" : ""}`}>
      <span className="pilot-badge">NT BLI</span>
      <div className="card-heading">Preparing {ntScopeFromKey(ntRequestedScopeKey, ntBooks).label}</div>
      {isLoadingNextQuestion && (
        <div className="orbit-loader" aria-hidden="true">
          <span className="orbit-loader-star" />
          <span className="orbit-loader-spark one" />
          <span className="orbit-loader-spark two" />
          <span className="orbit-loader-spark three" />
        </div>
      )}
      <div className="startup-status" aria-live="polite">
        <p className="startup-title">
          {isLoadingNextQuestion
            ? "Charting the next question..."
            : startupWaitLevel === 0
            ? "Building your question sequence..."
            : startupWaitLevel === 1
              ? "Still setting up your assessment..."
              : "This is taking longer than usual."}
        </p>
        <p className="startup-note">
          {isLoadingNextQuestion
            ? "The assessment is checking your latest answer and choosing what to ask next."
            : startupWaitLevel === 0
            ? "We are preparing your New Testament questions and checking your saved progress."
            : startupWaitLevel === 1
              ? "This can take a few seconds the first time you start."
              : "You can keep waiting, or restart the setup if the connection stalled."}
        </p>
      </div>
      {ntError && <p className="pilot-note">{ntError}</p>}
      {!isLoadingNextQuestion && <div className="spinner" />}
      <p className="pilot-note">New Testament results are tracked separately from Old Testament results.</p>
      <div className="startup-actions">
        {startupWaitLevel === 2 && (
          <button className="btn-secondary" type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        )}
        <Link className="btn-secondary" href="/assess?choose=1">Back to assessment choices</Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function OtStartingScreen({
  isLoadingNextQuestion,
  startupWaitLevel,
}: {
  isLoadingNextQuestion: boolean;
  startupWaitLevel: 0 | 1 | 2;
}) {
  return (
    <div className={`card center-card ${isLoadingNextQuestion ? "between-question-loader" : ""}`}>
      {isLoadingNextQuestion ? (
        <div className="orbit-loader" aria-hidden="true">
          <span className="orbit-loader-star" />
          <span className="orbit-loader-spark one" />
          <span className="orbit-loader-spark two" />
          <span className="orbit-loader-spark three" />
        </div>
      ) : (
        <div className="spinner" />
      )}
      <div className="startup-status" aria-live="polite">
        <p className="startup-title">
          {isLoadingNextQuestion
            ? "Plotting the next question..."
            : startupWaitLevel === 0
            ? "Loading your assessment..."
            : startupWaitLevel === 1
              ? "Setting up your first question..."
              : "This is taking longer than usual."}
        </p>
        <p className="startup-note">
          {isLoadingNextQuestion
            ? "The assessment is choosing the next question."
            : startupWaitLevel === 0
            ? "We are checking your session and preparing the next adaptive question."
            : startupWaitLevel === 1
              ? "This can take a few seconds the first time you start."
              : "You can keep waiting, or start a fresh setup if the connection stalled."}
        </p>
        {startupWaitLevel === 2 && (
          <div className="startup-actions">
            <Link className="btn-secondary" href="/assess?fresh=1">Start fresh</Link>
            <button className="btn-secondary" type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AssessmentErrorScreen({
  errorMsg,
  debugErrorMsg,
  attemptId,
  setErrorMsg,
  setDebugErrorMsg,
  setRetryNotice,
  assessmentMode,
  loadNtQuestion,
  ntScope,
  loadQuestion,
}: {
  errorMsg: string;
  debugErrorMsg: string;
  attemptId: string | null;
  setErrorMsg: (value: string) => void;
  setDebugErrorMsg: (value: string) => void;
  setRetryNotice: (value: string) => void;
  assessmentMode: AssessmentMode;
  loadNtQuestion: (aid: string, scope: NtScopeOption) => void | Promise<void>;
  ntScope: NtScopeOption;
  loadQuestion: (aid: string) => void | Promise<void>;
}) {
  return (
    <div className="card center-card">
      <div className="card-heading">Something went wrong</div>
      <p className="card-sub">{errorMsg}</p>
      {debugErrorMsg && (
        <p className="pilot-note" style={{wordBreak: "break-word"}}>
          Debug: {debugErrorMsg}
        </p>
      )}
      <div className="startup-actions">
        {attemptId && (
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              setErrorMsg("");
              setDebugErrorMsg("");
              setRetryNotice("Continuing the same assessment.");
              if (assessmentMode === "NT") void loadNtQuestion(attemptId, ntScope);
              else void loadQuestion(attemptId);
            }}
          >
            Continue this assessment
          </button>
        )}
        {assessmentMode === "NT" ? (
          <Link className="btn-secondary" href="/">Choose another NT scope</Link>
        ) : (
          <button
            className="btn-secondary"
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              clearAssessmentBrowserStorage();
              window.location.href = "/assess?fresh=1";
            }}
          >
            Start fresh assessment
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function NtCompleteScreen({
  accuracy,
  correctCount,
  answeredCount,
  ntScope,
  attemptId,
  startNtPilot,
  transitionToDashboard,
}: {
  accuracy: number;
  correctCount: number;
  answeredCount: number;
  ntScope: NtScopeOption;
  attemptId: string | null;
  startNtPilot: (scope: NtScopeOption) => void | Promise<void>;
  transitionToDashboard: () => void;
}) {
  return (
    <div className="card center-card">
      <span className="pilot-badge">NT BLI</span>
      <div className="big-num">{accuracy}<span style={{ fontSize: 32 }}>%</span></div>
      <div className="card-heading">New Testament assessment complete</div>
      <p className="card-sub">You answered {correctCount} of {answeredCount} questions correctly in {ntScope.label}.</p>
      <p className="pilot-note">Your New Testament result is ready. Review the session for your score and answer history.</p>
      {attemptId && <Link className="btn-primary" href={`/results/${attemptId}`}>Review session results</Link>}
      <button className="btn-primary" type="button" onClick={() => startNtPilot(ntScope)}>Retry same scope</button>
      <Link className="btn-secondary" href="/">Choose another New Testament area</Link>
      <button className="btn-secondary" type="button" onClick={transitionToDashboard}>Back to dashboard</button>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function OtCompleteScreen({
  accuracy,
  isTargetedOtAssessment,
  otAssessment,
  isScopeOtAssessment,
  correctCount,
  answeredCount,
  attemptId,
  transitionToDashboard,
}: {
  accuracy: number;
  isTargetedOtAssessment: boolean;
  otAssessment: OtAssessmentStartRow | null;
  isScopeOtAssessment: boolean;
  correctCount: number;
  answeredCount: number;
  attemptId: string | null;
  transitionToDashboard: () => void;
}) {
  return (
    <div className="card center-card">
      <div className="big-num">{accuracy}<span style={{ fontSize: 32 }}>%</span></div>
      <div className="card-heading">
        {isTargetedOtAssessment
          ? `${otAssessment?.label ?? "Targeted"} ${isScopeOtAssessment ? "test" : "retest"} complete`
          : "Assessment complete"}
      </div>
      <p className="card-sub">
        {isTargetedOtAssessment
          ? isScopeOtAssessment
            ? "Your new evidence has been added to your BLI and the dashboard will reflect this book or section."
            : "Your new evidence has been added to your BLI. The dashboard will now recalculate this learning unit and your next recommendation."
          : `You answered ${correctCount} of ${answeredCount} questions correctly.`}
      </p>
      {attemptId && <Link className="btn-primary" href={`/results/${attemptId}`}>Review session results</Link>}
      <button className="btn-primary" type="button" onClick={transitionToDashboard}>View your dashboard</button>
      {!isTargetedOtAssessment && (
        <Link className="btn-secondary" href="/assess">Keep going</Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ReportQuestionModal({
  setShowReportModal,
  reportStatus,
  question,
  qualityRating,
  setQualityRating,
  reportCategory,
  setReportCategory,
  setReportError,
  reportText,
  setReportText,
  reportError,
  submitQuestionReport,
  isSubmittingReport,
}: {
  setShowReportModal: (open: boolean) => void;
  reportStatus: "idle" | "sent";
  question: Question;
  qualityRating: QuestionQualityRating | null;
  setQualityRating: (value: QuestionQualityRating | null) => void;
  reportCategory: ReportCategory | null;
  setReportCategory: (value: ReportCategory | null) => void;
  setReportError: (value: string) => void;
  reportText: string;
  setReportText: (value: string) => void;
  reportError: string;
  submitQuestionReport: () => void | Promise<void>;
  isSubmittingReport: boolean;
}) {
  return (
    <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setShowReportModal(false)}>
      <div className="overlay-card report-card">
        <button className="overlay-close" type="button" onClick={() => setShowReportModal(false)} aria-label="Close report form">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        {reportStatus === "sent" ? (
          <div className="report-sent">Thanks. Your feedback was saved.</div>
        ) : (
          <>
            <h2 className="report-title">Question feedback</h2>
            <p className="report-desc">Rate the question quality, flag a specific issue, or both.</p>
            <div className="report-question">{question.prompt}</div>

            <div className="quality-rating" role="group" aria-label="Question quality rating">
              {QUESTION_RATING_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`quality-rating-option ${qualityRating === option.value ? "is-active" : ""}`}
                  aria-pressed={qualityRating === option.value}
                  onClick={() => {
                    setQualityRating(qualityRating === option.value ? null : option.value);
                    setReportError("");
                  }}
                >
                  <span className="quality-stars" aria-hidden="true">
                    {"★".repeat(option.value)}{"☆".repeat(3 - option.value)}
                  </span>
                  <span className="quality-rating-copy">
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="report-options" role="group" aria-label="Report reason">
              {REPORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`report-option ${reportCategory === option.value ? "is-active" : ""}`}
                  onClick={() => {
                    setReportCategory(reportCategory === option.value ? null : option.value);
                    setReportError("");
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <textarea
              className="report-textarea"
              value={reportText}
              maxLength={2000}
              onChange={e => setReportText(e.target.value)}
              placeholder="Optional note about the rating or report"
            />
            {reportError && <p className="report-error">{reportError}</p>}

            <div className="report-actions">
              <button type="button" className="report-cancel" onClick={() => setShowReportModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="report-submit"
                onClick={submitQuestionReport}
                disabled={
                  isSubmittingReport
                  || (!qualityRating && !reportCategory)
                  || (reportCategory === "other" && reportText.trim().length === 0)
                }
              >
                {isSubmittingReport ? "Saving..." : "Save feedback"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function BibleFactModal({
  setActiveBibleFact,
  activeBibleFact,
}: {
  setActiveBibleFact: (fact: BibleSkyFact | null) => void;
  activeBibleFact: BibleSkyFact;
}) {
  return (
    <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setActiveBibleFact(null)}>
      <div className="overlay-card fact-card">
        <button className="overlay-close" type="button" onClick={() => setActiveBibleFact(null)} aria-label="Close Bible fact">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <p className="fact-kicker">Sky Fact</p>
        <h2 className="fact-title">{activeBibleFact.title}</h2>
        <p className="fact-copy">{activeBibleFact.fact}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function OtResultsOverlay({
  setShowResults,
  accuracy,
  answeredCount,
  correctCount,
  nextMilestone,
  showSavePrompt,
  handleGoogleSignIn,
  saving,
  saved,
  email,
  setEmail,
  handleMagicLink,
}: {
  setShowResults: (open: boolean) => void;
  accuracy: number;
  answeredCount: number;
  correctCount: number;
  nextMilestone: number;
  showSavePrompt: boolean;
  handleGoogleSignIn: () => void | Promise<void>;
  saving: boolean;
  saved: boolean;
  email: string;
  setEmail: (value: string) => void;
  handleMagicLink: () => void | Promise<void>;
}) {
  return (
    <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setShowResults(false)}>
      <div className="overlay-card">
        <button className="overlay-close" onClick={() => setShowResults(false)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        <div className="overlay-score">{accuracy}<span style={{ fontSize: 28 }}>%</span></div>
        <div className="overlay-label">BLI Score (preliminary)</div>

        <div className="overlay-stats">
          <div className="overlay-stat"><strong>{answeredCount}</strong><span>answered</span></div>
          <div className="overlay-stat"><strong>{correctCount}</strong><span>correct</span></div>
          <div className="overlay-stat"><strong>{nextMilestone - answeredCount}</strong><span>to next update</span></div>
        </div>

        <hr className="overlay-divider" />

        {!showSavePrompt ? (
          <>
            <p className="overlay-heading">Save your progress</p>
            <p className="overlay-desc">Create a free account to save your BLI score and track your knowledge over time. Your progress so far will be linked automatically.</p>
            <button className="google-btn" onClick={handleGoogleSignIn} disabled={saving}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <div className="divider-or"><span>or</span></div>
            {saved ? (
              <p className="save-success">Check your email for a sign-in link!</p>
            ) : (
              <div className="magic-row">
                <input
                  className="magic-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                />
                <button className="magic-btn" onClick={handleMagicLink} disabled={saving || !email}>
                  {saving ? "..." : "Send link"}
                </button>
              </div>
            )}
            <span className="skip-link" onClick={() => setShowResults(false)}>Keep going without saving</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
