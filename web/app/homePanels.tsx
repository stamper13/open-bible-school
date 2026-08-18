"use client";

// Extracted from app/page.tsx during a file-size cleanup. These are the
// homepage's modal/panel sections -- each one is only ever shown behind a
// single boolean or nullable state value, so the parent still owns that
// state and decides *whether* to render; these components just render.
// No behavior change intended.

import Link from "next/link";
import { type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { BLI_LEVELS } from "@/lib/bli";
import { BOOK_NAMES, type Testament as BibleTestament } from "@/lib/bibleTaxonomy";
import { sectionEvidence } from "@/lib/bliEvidence";
import {
  assessmentHrefForScore,
  coneMarkerPercent,
  detailTargetForScore,
  dimensionDisplayName,
  evidenceLabel,
  formatProgressDate,
  formatScoreChange,
  type BackendRecommendation,
  type BreakdownTab,
  type ProgressPoint,
  type ScopeDetailTarget,
  type ScopeScore,
  type ScopeSummary,
} from "./homeHelpers";

// ---------------------------------------------------------------------------

export function DeleteAccountModal({
  userEmail,
  deleteBusy,
  deleteConfirm,
  setDeleteConfirm,
  deleteError,
  setDeleteOpen,
  handleDeleteAccount,
}: {
  userEmail: string;
  deleteBusy: boolean;
  deleteConfirm: string;
  setDeleteConfirm: (value: string) => void;
  deleteError: string | null;
  setDeleteOpen: (open: boolean) => void;
  handleDeleteAccount: () => void | Promise<void>;
}) {
  return (
    <div
      onClick={() => { if (!deleteBusy) setDeleteOpen(false); }}
      style={{position:"fixed",inset:0,zIndex:80,background:"rgba(12,16,28,.55)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={e => e.stopPropagation()}
        style={{width:"100%",maxWidth:460,background:"#fff",border:"1px solid var(--border)",borderRadius:18,padding:"26px 26px 22px",boxShadow:"0 30px 80px rgba(0,0,0,.28)"}}
      >
        <h2 id="delete-account-title" style={{fontFamily:"var(--font-crimson), Georgia, serif",fontSize:23,fontWeight:600,color:"var(--navy)",marginBottom:10}}>
          Delete your account
        </h2>
        <p style={{fontSize:14,lineHeight:1.65,color:"var(--muted)",marginBottom:14}}>
          This permanently removes your account and every assessment attempt, answer,
          and score attached to it. It cannot be undone, and nothing is kept in a backup
          you could ask us to restore from.
        </p>
        <label style={{display:"block",fontSize:12.5,fontWeight:700,color:"var(--navy)",marginBottom:7}}>
          Type <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace"}}>{userEmail}</span> to confirm
        </label>
        <input
          value={deleteConfirm}
          onChange={e => setDeleteConfirm(e.target.value)}
          disabled={deleteBusy}
          autoComplete="off"
          spellCheck={false}
          aria-label="Type your email address to confirm deletion"
          style={{width:"100%",padding:"11px 13px",borderRadius:10,border:"1px solid var(--border)",fontSize:14.5,fontFamily:"inherit",color:"var(--navy)",outline:"none",marginBottom:deleteError?10:18}}
        />
        {deleteError && (
          <p role="alert" style={{fontSize:13,lineHeight:1.55,color:"#b4402f",marginBottom:16}}>{deleteError}</p>
        )}
        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button
            onClick={() => setDeleteOpen(false)}
            disabled={deleteBusy}
            style={{padding:"10px 18px",borderRadius:999,border:"1px solid var(--border)",background:"transparent",color:"var(--muted)",fontSize:14,fontWeight:600,fontFamily:"inherit",cursor:deleteBusy?"not-allowed":"pointer"}}
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteBusy || deleteConfirm.trim().toLowerCase() !== userEmail.trim().toLowerCase()}
            style={{padding:"10px 18px",borderRadius:999,border:"none",background:deleteConfirm.trim().toLowerCase() === userEmail.trim().toLowerCase() && !deleteBusy ? "#b4402f" : "rgba(180,64,47,.35)",color:"#fff",fontSize:14,fontWeight:600,fontFamily:"inherit",cursor:deleteBusy||deleteConfirm.trim().toLowerCase()!==userEmail.trim().toLowerCase()?"not-allowed":"pointer"}}
          >
            {deleteBusy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function KnowledgeProfilePanel({
  activeBreakdownTab,
  setActiveBreakdownTab,
  profileTestament,
  visibleBreakdownScores,
  openScopeDetail,
}: {
  activeBreakdownTab: BreakdownTab;
  setActiveBreakdownTab: (tab: BreakdownTab) => void;
  profileTestament: BibleTestament;
  visibleBreakdownScores: ScopeScore[];
  openScopeDetail: (target: ScopeDetailTarget) => void | Promise<void>;
}) {
  return (
    <section id="knowledge-profile-panel" className="knowledge-profile-panel" aria-labelledby="knowledge-profile-title">
      <div className="breakdown-head">
        <p className="section-eyebrow" id="knowledge-profile-title">Knowledge profile</p>
        <div className="breakdown-controls">
          <div className="breakdown-tabs" role="tablist" aria-label="Knowledge profile breakdown">
            {[
              { key: "sections", label: "Sections" },
              { key: "books", label: "Books" },
              { key: "domains", label: "Skills" },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeBreakdownTab === tab.key}
                className={`breakdown-tab ${activeBreakdownTab === tab.key ? "is-active" : ""}`}
                onClick={() => setActiveBreakdownTab(tab.key as BreakdownTab)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="breakdown-note">
        {activeBreakdownTab === "sections" && `Major ${profileTestament} sections.`}
        {activeBreakdownTab === "books" && `${profileTestament} scores by book.`}
        {activeBreakdownTab === "domains" && `Skill areas tested across your ${profileTestament} answers.`}
      </p>
      <div className={`sections-grid ${activeBreakdownTab}`}>
        {visibleBreakdownScores.map(s => {
          const hasScore = s.rawScore !== null && s.answered > 0;
          const scoreEvidence = sectionEvidence(s.answered);
          const assessmentHref = assessmentHrefForScore(s);
          const fillColor = s.className === "torah" ? "linear-gradient(90deg,#d4a017,#f5c842)"
            : s.className === "former" ? "linear-gradient(90deg,#0e8c6a,#34d399)"
            : s.className === "latter" ? "linear-gradient(90deg,#2563c4,#60a5fa)"
            : s.className === "writings" ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
            : s.className === "prophets" ? "linear-gradient(90deg,#0e8c6a,#2563c4)"
            : s.className === "ot" ? "linear-gradient(90deg,#0aa3a3,#d4a017,#2563c4,#7c3aed)"
            : s.className === "nt" ? "linear-gradient(90deg,#14b8a6,#2563eb,#7c3aed)"
            : s.className === "gospels" ? "linear-gradient(90deg,#0d9488,#2dd4bf)"
            : s.className === "acts" ? "linear-gradient(90deg,#0284c7,#38bdf8)"
            : s.className === "pauline" ? "linear-gradient(90deg,#4f46e5,#818cf8)"
            : s.className === "general" ? "linear-gradient(90deg,#7c3aed,#c084fc)"
            : s.className === "revelation" ? "linear-gradient(90deg,#be123c,#fb7185)"
            : "linear-gradient(90deg,#0aa3a3,#67e8f9)";
          return (
            <article
              key={s.key}
              className={`section-card ${s.className} ${hasScore ? "has-score" : ""} ${scoreEvidence.isProvisional ? "low-evidence" : ""}`}
            >
              <button
                type="button"
                className="section-card-main"
                onClick={() => void openScopeDetail(detailTargetForScore(s))}
              >
                <div className="sc-top">
                  <div>
                    <div className="sc-name">{s.label}</div>
                    <div className="sc-books">{s.subtitle}</div>
                  </div>
                  <div
                    className="sc-pct-empty"
                    style={{color: hasScore ? "#1b2442" : undefined}}
                    aria-label={hasScore && scoreEvidence.isProvisional ? `Early BLI estimate ${s.displayScore}` : undefined}
                  >
                    {hasScore ? s.displayScore : "--"}
                    {hasScore && scoreEvidence.isProvisional && (
                      <span className="sc-provisional-label">Early</span>
                    )}
                  </div>
                </div>
                <div className="sc-bar-track">
                  {hasScore && (
                    <div className="sc-bar-fill" style={{
                      width: `${Math.max(3, Math.min(100, s.rawScore ?? 0))}%`,
                      background: fillColor,
                      height: "100%", borderRadius: 999, transition: "width 1s ease"
                    }} />
                  )}
                </div>
              </button>
              <div className="sc-card-footer">
                <div className="sc-chip-row">
                  <span className={`sc-chip-empty evidence-${s.confidence}`}>
                    {hasScore ? `${s.answered} answered` : "Not yet assessed"}
                  </span>
                  {hasScore && <span className={`sc-chip-empty evidence-${s.confidence}`}>{evidenceLabel(s)}</span>}
                </div>
                {assessmentHref && (
                  <Link className="sc-test-link" href={assessmentHref}>
                    {hasScore ? "Retest" : "Test"}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                    </svg>
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function ProgressOverTimePanel({
  progressHistory,
  progressTestament,
  progressLoading,
  progressError,
  plottedProgress,
  progressAxisLabels,
  progressAreaPath,
  progressPath,
  activeProgressPoint,
  setActiveProgressAttemptId,
  progressXAxisLabels,
}: {
  progressHistory: ProgressPoint[];
  progressTestament: BibleTestament;
  progressLoading: boolean;
  progressError: string | null;
  plottedProgress: Array<{ point: ProgressPoint; x: number; y: number }>;
  progressAxisLabels: number[];
  progressAreaPath: string;
  progressPath: string;
  activeProgressPoint: ProgressPoint | undefined;
  setActiveProgressAttemptId: (id: string) => void;
  progressXAxisLabels: Array<{ x: number; text: string }>;
}) {
  return (
    <section id="progress-over-time-panel" className="progress-card progress-panel" aria-labelledby="progress-title">
      <div className="progress-head">
        <div>
          <p className="progress-eyebrow">Assessment snapshots</p>
          <h2 className="progress-title" id="progress-title">Knowledge over time</h2>
          <p className="progress-sub">
            A record of completed assessments, shown on the full 0-800 BLI scale.
          </p>
        </div>
        <div className="progress-controls">
          <div className="progress-latest">
            {progressHistory[0]?.display_bli ?? "--"}
            <span>Latest {progressTestament} BLI</span>
          </div>
        </div>
      </div>

      {progressLoading ? (
        <div className="progress-empty" role="status">
          <strong>Plotting your progress...</strong>
          <span>Loading completed assessment snapshots.</span>
        </div>
      ) : progressError ? (
        <div className="progress-empty progress-error" role="status">
          <strong>Progress is temporarily unavailable</strong>
          <span>{progressError}</span>
        </div>
      ) : plottedProgress.length === 0 ? (
        <div className="progress-empty">
          <strong>No {progressTestament} snapshots yet</strong>
          <span>
            Complete an {progressTestament} assessment to begin a durable progress record.
          </span>
        </div>
      ) : (
        <>
          <div className="progress-chart-shell">
            <div className="progress-axis" aria-hidden="true">
              {progressAxisLabels.map((v, i) => <span key={i}>{v}</span>)}
            </div>
            <div className="progress-chart-scroll">
              <div className="progress-chart">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="progressArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(111,218,221,.34)" />
                      <stop offset="55%" stopColor="rgba(111,218,221,.10)" />
                      <stop offset="100%" stopColor="rgba(111,218,221,0)" />
                    </linearGradient>
                    <linearGradient id="progressStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3ba8ab" />
                      <stop offset="62%" stopColor="#6fdadd" />
                      <stop offset="88%" stopColor="#b8ecd9" />
                      <stop offset="100%" stopColor="#f5c842" />
                    </linearGradient>
                  </defs>
                  <line className="progress-guide" x1="0" y1="8" x2="100" y2="8" />
                  <line className="progress-guide" x1="0" y1="50" x2="100" y2="50" />
                  <line className="progress-guide" x1="0" y1="92" x2="100" y2="92" />
                  {progressAreaPath && <path className="progress-area" d={progressAreaPath} />}
                  {progressPath && <path className="progress-line-glow" d={progressPath} />}
                  {progressPath && <path className="progress-line" d={progressPath} />}
                  {progressPath && <path className="progress-line-flow" d={progressPath} pathLength={100} />}
                </svg>
                {plottedProgress.map(({point, x, y}, pointIndex) => {
                  const pointDate = formatProgressDate(point.captured_at);
                  const isLatest = pointIndex === plottedProgress.length - 1;
                  return (
                    <button
                      key={`${point.attempt_id}:${point.captured_at}`}
                      type="button"
                      className={`progress-point ${isLatest ? "is-latest" : ""} ${activeProgressPoint?.attempt_id === point.attempt_id ? "is-active" : ""}`}
                      style={{left: `${x}%`, top: `${y}%`}}
                      aria-label={`${pointDate}: BLI ${point.display_bli}, ${point.bli_level}, ${point.questions_answered} questions answered`}
                      onMouseEnter={() => setActiveProgressAttemptId(point.attempt_id)}
                      onFocus={() => setActiveProgressAttemptId(point.attempt_id)}
                      onClick={() => setActiveProgressAttemptId(point.attempt_id)}
                    />
                  );
                })}
                <div className="progress-xaxis" aria-hidden="true">
                  {progressXAxisLabels.map((lbl, i) => (
                    <span key={i} style={{ left: `${lbl.x}%` }}>{lbl.text}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeProgressPoint && (
            <div className="progress-detail" aria-live="polite">
              <div className="progress-detail-primary">
                <strong>{formatProgressDate(activeProgressPoint.captured_at)}</strong>
                <span>{activeProgressPoint.bli_level}</span>
              </div>
              <div className="progress-stat">
                <strong>{activeProgressPoint.display_bli}</strong>
                <span>BLI score</span>
              </div>
              <div className="progress-stat">
                <strong>{activeProgressPoint.questions_answered}</strong>
                <span>Questions answered</span>
              </div>
              <div className="progress-stat">
                <strong>{formatScoreChange(activeProgressPoint.score_change)}</strong>
                <span>From prior snapshot</span>
              </div>
              <Link className="progress-review-link" href={`/results/${activeProgressPoint.attempt_id}`}>
                Review assessment
              </Link>
            </div>
          )}
          <p className="progress-note">
            Ordinary movement is expected as evidence accumulates; a single change does not necessarily indicate a meaningful shift in ability.
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

export function KnowledgeConePanel({
  activeHasScore,
  activeDisplayScore,
  activeDisplayLevel,
  coneRef,
  handleConePointerEnter,
  handleConePointerMove,
  handleConePointerLeave,
  waterFillPercent,
  suiteTestament,
  expandedConeLayer,
  setExpandedConeLayer,
}: {
  activeHasScore: boolean;
  activeDisplayScore: number;
  activeDisplayLevel: string;
  coneRef: RefObject<HTMLDivElement | null>;
  handleConePointerEnter: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleConePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleConePointerLeave: () => void;
  waterFillPercent: number;
  suiteTestament: BibleTestament;
  expandedConeLayer: string | null;
  setExpandedConeLayer: (name: string | null) => void;
}) {
  return (
    <section id="knowledge-cone-panel" className="knowledge-cone-card knowledge-cone-panel" aria-label="BLI knowledge cone">
      <div className="knowledge-cone-head">
        <div>
          <h2 className="knowledge-cone-title">Biblical Literacy Index</h2>
          <p className="knowledge-cone-sub">Knowledge expands upward from Unfamiliar to Scholar.</p>
        </div>
        <div className="knowledge-cone-score">
          {activeHasScore ? activeDisplayScore : "--"}
          <span>{activeHasScore ? activeDisplayLevel : "Not assessed"}</span>
        </div>
      </div>
      <div className="knowledge-cone-wrap">
        <div
          ref={coneRef}
          className="knowledge-cone"
          onPointerEnter={handleConePointerEnter}
          onPointerMove={handleConePointerMove}
          onPointerLeave={handleConePointerLeave}
          style={{"--marker-y": `${coneMarkerPercent(activeDisplayScore)}`} as { [key: string]: string }}
        >
          <div className="glass-vessel" aria-hidden="true">
            <div
              key={`water-${suiteTestament}-${activeDisplayScore}`}
              className="water-fill"
              style={{"--water-level": `${waterFillPercent}%`} as { [key: string]: string }}
            >
              <span className="water-wave water-wave-a" />
              <span className="water-wave water-wave-b" />
              <span className="water-wave water-wave-c" />
            </div>
          </div>
          {[...BLI_LEVELS].reverse().map((band, index) => {
            const topWidth = 98 - index * 7;
            const bottomWidth = index === BLI_LEVELS.length - 1 ? topWidth - 7 : 98 - (index + 1) * 7;
            return (
              <button
                key={band.name}
                type="button"
                className={`cone-tier ${activeHasScore && activeDisplayLevel === band.name ? "is-active" : ""} ${expandedConeLayer === band.name ? "is-expanded" : ""}`}
                aria-expanded={expandedConeLayer === band.name}
                onClick={() => setExpandedConeLayer(expandedConeLayer === band.name ? null : band.name)}
                style={{
                  "--tier-color": band.color,
                  "--tier-index": String(index),
                  "--top-left": `${(100 - topWidth) / 2}%`,
                  "--top-right": `${100 - (100 - topWidth) / 2}%`,
                  "--bottom-left": `${(100 - bottomWidth) / 2}%`,
                  "--bottom-right": `${100 - (100 - bottomWidth) / 2}%`,
                  "--text-inset": `${Math.max((100 - topWidth) / 2, (100 - bottomWidth) / 2)}%`,
                } as { [key: string]: string }}
              >
                <span className="cone-tier-name">{band.name}</span>
                <span className="cone-tier-range">{band.min}-{band.max}</span>
              </button>
            );
          })}
          {expandedConeLayer && (() => {
            const band = BLI_LEVELS.find((item) => item.name === expandedConeLayer);
            const index = [...BLI_LEVELS].reverse().findIndex((item) => item.name === expandedConeLayer);
            return band && index >= 0 ? (
              <div
                className="cone-layer-popover"
                style={{"--popover-y": `${((index + 0.5) / BLI_LEVELS.length) * 100}`} as { [key: string]: string }}
              >
                <strong>{band.name} · {band.min}-{band.max}</strong>
                <span>{band.description}</span>
              </div>
            ) : null;
          })()}
          {activeHasScore && (
            <div className="cone-marker" aria-label={`Current BLI ${activeDisplayScore}, ${activeDisplayLevel}`}>
              <span>{activeDisplayScore}</span>
              <span className="cone-marker-dot" />
            </div>
          )}
        </div>
        {!activeHasScore && (
          <p className="cone-empty-note">Take an assessment to place your score on the cone.</p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function ScopeDetailDrawer({
  scopeDetailTarget,
  closeScopeDetail,
  scopeSummaryLoading,
  scopeSummaryError,
  scopeSummary,
  backendRecommendation,
  recommendedStudy,
  handleRecommendedAction,
}: {
  scopeDetailTarget: ScopeDetailTarget;
  closeScopeDetail: () => void;
  scopeSummaryLoading: boolean;
  scopeSummaryError: string | null;
  scopeSummary: ScopeSummary | null;
  backendRecommendation: BackendRecommendation | null;
  recommendedStudy: { actionHref: string };
  handleRecommendedAction: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div className="scope-drawer-backdrop" role="presentation" onClick={closeScopeDetail}>
      <aside
        className="scope-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-drawer-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="scope-drawer-head">
          <div>
            <p className="scope-drawer-kicker">{scopeDetailTarget.scopeType.toLowerCase()} detail</p>
            <h2 className="scope-drawer-title" id="scope-drawer-title">{scopeDetailTarget.label}</h2>
            <p className="scope-drawer-sub">{scopeDetailTarget.subtitle}</p>
          </div>
          <button
            type="button"
            className="scope-drawer-close"
            aria-label="Close scope details"
            onClick={closeScopeDetail}
          >
            ×
          </button>
        </header>
        <div className="scope-drawer-body">
          {scopeSummaryLoading ? (
            <div className="scope-state" role="status">
              <strong>Gathering scope evidence...</strong>
              Loading your responses for this part of the assessment.
            </div>
          ) : scopeSummaryError ? (
            <div className="scope-state" role="status">
              <strong>Details unavailable</strong>
              {scopeSummaryError}
            </div>
          ) : !scopeSummary ? (
            <div className="scope-state">
              <strong>No evidence here yet</strong>
              Answer questions in this scope to begin building a profile.
            </div>
          ) : (
            <>
              <div className="scope-evidence">
                <div>
                  <span className="scope-evidence-label">{sectionEvidence(scopeSummary.answered).label}</span>
                  <p className="scope-evidence-copy">
                    {sectionEvidence(scopeSummary.answered).isProvisional
                      ? `This is still an early read. Add ${sectionEvidence(scopeSummary.answered).answersToInterpretation} more eligible responses before treating it as a clear weakness.`
                      : sectionEvidence(scopeSummary.answered).status === "developing"
                        ? "This is getting clearer, but may still move as more answers are added."
                        : "This area has a reliable sample, though ordinary score movement is still expected."}
                  </p>
                </div>
                <div className="scope-evidence-score">
                  {scopeSummary.accuracy === null ? "--" : `${Math.round(scopeSummary.accuracy)}%`}
                  <span>
                    {sectionEvidence(scopeSummary.answered).isProvisional
                      ? "Early accuracy"
                      : "Accuracy"}
                  </span>
                </div>
              </div>
              <div className="scope-metrics">
                <div className="scope-metric">
                  <strong>{scopeSummary.answered}</strong>
                  <span>Answered</span>
                </div>
                <div className="scope-metric">
                  <strong>{scopeSummary.correct}</strong>
                  <span>Correct</span>
                </div>
                <div className="scope-metric">
                  <strong>{scopeSummary.idk}</strong>
                  <span>Skipped</span>
                </div>
              </div>
              {(scopeSummary.first_answered_at || scopeSummary.last_answered_at) && (
                <p className="scope-period">
                  {scopeSummary.first_answered_at && `First answered ${formatProgressDate(scopeSummary.first_answered_at)}`}
                  {scopeSummary.first_answered_at && scopeSummary.last_answered_at && " · "}
                  {scopeSummary.last_answered_at && `Latest response ${formatProgressDate(scopeSummary.last_answered_at)}`}
                </p>
              )}
              {scopeSummary.books.length > 0 && (
                <section className="scope-breakdown" aria-labelledby="scope-books-heading">
                  <h3 id="scope-books-heading">Book evidence</h3>
                  {scopeSummary.books.slice(0, 10).map(book => (
                    <div className="scope-breakdown-row" key={book.book_code}>
                      <div>
                        <div className="scope-breakdown-name">{BOOK_NAMES[book.book_code] ?? book.book_code}</div>
                        <div className="scope-breakdown-meta">{book.answered} answered · {book.idk} skipped</div>
                      </div>
                      <div className="scope-breakdown-value">
                        {book.accuracy === null ? "--" : `${Math.round(book.accuracy)}%`}
                      </div>
                    </div>
                  ))}
                </section>
              )}
              {scopeSummary.dimensions.length > 0 && (
                <section className="scope-breakdown" aria-labelledby="scope-dimensions-heading">
                  <h3 id="scope-dimensions-heading">Dimension evidence</h3>
                  {scopeSummary.dimensions.slice(0, 10).map(dimension => (
                    <div className="scope-breakdown-row" key={dimension.dimension_key}>
                      <div>
                        <div className="scope-breakdown-name">{dimensionDisplayName(dimension.dimension_key)}</div>
                        <div className="scope-breakdown-meta">{dimension.answered} answered · {dimension.idk} skipped</div>
                      </div>
                      <div className="scope-breakdown-value">
                        {dimension.accuracy === null ? "--" : `${Math.round(dimension.accuracy)}%`}
                      </div>
                    </div>
                  ))}
                </section>
              )}
              {scopeDetailTarget.unitKey === backendRecommendation?.unit_key && (
                <div className="scope-focused-action">
                  <p>This focused retest follows the same rereading delay used by your dashboard recommendation.</p>
                  <Link
                    className="scope-focused-link"
                    href={recommendedStudy.actionHref}
                    onClick={event => {
                      closeScopeDetail();
                      handleRecommendedAction(event);
                    }}
                  >
                    Focused retest
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function RetestConfirmModal({
  setPendingRetestHref,
  continuePendingRetest,
}: {
  setPendingRetestHref: (href: string | null) => void;
  continuePendingRetest: () => void;
}) {
  return (
    <div className="retest-modal-backdrop" role="presentation" onClick={() => setPendingRetestHref(null)}>
      <div className="retest-modal" role="dialog" aria-modal="true" aria-labelledby="retest-modal-title" onClick={event => event.stopPropagation()}>
        <p className="retest-modal-kicker">Focused retest</p>
        <h2 className="retest-modal-title" id="retest-modal-title">Have you reread this section?</h2>
        <p className="retest-modal-copy">
          This retest is meant to measure learning after review. Retesting immediately may mostly measure short-term recall, so your BLI is more meaningful if you have actually reread the recommended passage.
        </p>
        <div className="retest-modal-actions">
          <button className="retest-modal-secondary" type="button" onClick={() => setPendingRetestHref(null)}>
            Not yet
          </button>
          <button className="retest-modal-primary" type="button" onClick={continuePendingRetest}>
            I reread it - continue
          </button>
        </div>
      </div>
    </div>
  );
}
