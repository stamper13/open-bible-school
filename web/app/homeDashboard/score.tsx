"use client";

import { type CSSProperties, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { BLI_LEVELS, levelForScore, type BliLevel, type BliLevelBand } from "@/lib/bli";
import { type Testament as BibleTestament } from "@/lib/bibleTaxonomy";
import type { BliContractScores } from "@/lib/bliContract";
import { verseOfTheDay } from "@/lib/verseOfTheDay";
import type { AssessmentSnapshot, BliEvidence } from "../homeTypes";

// ---------------------------------------------------------------------------

export function ScoreStrip({
  suiteTestament,
  currentDisplayScore,
  currentDisplayLevel,
  currentDisplayBand,
  bliEvidence,
  testamentScores,
  ntBliEvidence,
  combinedBliEvidence,
  visibleAssessmentData,
  userEmail,
  showLevelTooltip,
  setShowLevelTooltip,
  cancelLevelTooltipClose,
  closeLevelTooltipSoon,
  showBliTooltip,
  setShowBliTooltip,
  openBliTooltip,
  closeBliTooltipSoon,
  showEvidenceTooltip,
  setShowEvidenceTooltip,
  handleSignIn,
}: {
  suiteTestament: BibleTestament;
  currentDisplayScore: number;
  currentDisplayLevel: BliLevel;
  currentDisplayBand: BliLevelBand;
  bliEvidence: BliEvidence | null;
  testamentScores: BliContractScores | null;
  ntBliEvidence: BliEvidence | null;
  combinedBliEvidence: BliEvidence | null;
  visibleAssessmentData: AssessmentSnapshot | null;
  userEmail: string | null;
  showLevelTooltip: boolean;
  setShowLevelTooltip: Dispatch<SetStateAction<boolean>>;
  cancelLevelTooltipClose: () => void;
  closeLevelTooltipSoon: () => void;
  showBliTooltip: boolean;
  setShowBliTooltip: Dispatch<SetStateAction<boolean>>;
  openBliTooltip: () => void;
  closeBliTooltipSoon: () => void;
  showEvidenceTooltip: boolean;
  setShowEvidenceTooltip: Dispatch<SetStateAction<boolean>>;
  handleSignIn: () => Promise<void>;
}) {
          // The three tabs share one description-band system (lib/bli.ts),
          // whose wording is written for the OT by default; swap in the
          // right noun for NT / Combined rather than forking the copy.
          const testamentize = (description: string, noun: string) =>
            description.replace(/the Old Testament/g, noun);

          const todaysVerse = verseOfTheDay();

          const otHasData = Boolean(visibleAssessmentData);
          const ntHasData = Boolean(testamentScores?.nt_questions_answered);
          const combinedHasData = Boolean(testamentScores?.combined_available);

          const ntLevel: BliLevel = ntHasData && testamentScores ? testamentScores.nt_bli_level : "Unfamiliar";
          const ntBand = BLI_LEVELS.find((b) => b.name === ntLevel) ?? BLI_LEVELS[0];
          const combinedScore = testamentScores?.combined_display_bli ?? null;
          const combinedLevel: BliLevel = combinedHasData && combinedScore !== null ? levelForScore(combinedScore) : "Unfamiliar";
          const combinedBand = BLI_LEVELS.find((b) => b.name === combinedLevel) ?? BLI_LEVELS[0];

          const tabs = {
            OT: {
              name: "OT BLI", accent: "#d4a017", hasData: otHasData,
              score: currentDisplayScore, level: currentDisplayLevel,
              description: currentDisplayBand.description,
              emptyDescription: <>Take your first assessment to place your score and get a next step.</>,
              evidence: bliEvidence,
              tooltip: "Your OT Bible Literacy Index measures Old Testament knowledge across four sections. The NT BLI is scored separately, and the combined score adds both 0-800 indexes for a total up to 1600.",
              range: otHasData ? `${currentDisplayLevel} · 0-800` : "Complete the OT assessment · 0-800",
            },
            NT: {
              name: "NT BLI", accent: "#7c3aed", hasData: ntHasData,
              score: testamentScores?.nt_display_bli ?? 0, level: ntLevel,
              description: testamentize(ntBand.description, "the New Testament"),
              emptyDescription: <>Take the New Testament assessment to find out where you stand. It builds its own <strong>separate 0-800 score</strong>, distinct from the OT BLI.</>,
              evidence: ntBliEvidence,
              tooltip: "Your NT Bible Literacy Index measures New Testament knowledge across the Gospels, Acts, the Epistles, and Revelation. It is scored separately from the OT BLI.",
              range: ntHasData ? `${ntLevel} · 0-800` : "Complete the NT assessment · 0-800",
            },
            COMBINED: {
              name: "Combined BLI", accent: "#0aa3a3", hasData: combinedHasData,
              score: combinedScore ?? 0, level: combinedLevel,
              description: testamentize(combinedBand.description, "the whole Bible"),
              emptyDescription: <>Complete both the OT and NT assessments to unlock a single, <strong>pooled picture</strong> of your whole-Bible literacy.</>,
              evidence: combinedBliEvidence,
              tooltip: "Your combined score pools evidence from both testaments into one 0-800 picture of whole-Bible literacy, available once both assessments have some evidence.",
              range: combinedHasData ? "Pooled OT + NT · 0-800" : "Available after both assessments · 0-800",
            },
          } as const;
          // The header's OT/NT toggle now drives this panel directly — no
          // separate OT/NT/Combined tab row. Combined isn't a testament you
          // can "switch to" (there's no combined assessment to continue), so
          // it surfaces as a small standing note instead — see combinedNote
          // below — rather than a third toggle position.
          const active = tabs[suiteTestament];

          return (
            <>
              {combinedHasData && (
                <p className="combined-note">
                  <span className="combined-note-dot" aria-hidden="true" />
                  Combined BLI <strong>{combinedScore}</strong> · pooled across both testaments
                </p>
              )}

              <div className="score-strip" style={{ "--score-accent": active.accent } as CSSProperties}>
                <div className={`score-block ${active.hasData ? "has-score" : ""}`} key={`score-${suiteTestament}`}>
                  <span className="score-number">
                    {active.hasData ? active.score : "?"}
                  </span>
                  {/* The level name now doubles as the score's caption — no
                      more separate "OT BLI" label. The small ⓘ next to it
                      still explains what the index itself measures. */}
                  <div
                    className="level-label-row"
                    onMouseEnter={cancelLevelTooltipClose}
                    onMouseLeave={closeLevelTooltipSoon}
                  >
                    {active.hasData && (
                      <>
                        <button
                          type="button"
                          className="level-badge-empty level-badge-btn"
                          aria-expanded={showLevelTooltip}
                          aria-label={`What does ${active.level} mean?`}
                          onClick={() => setShowLevelTooltip((v) => !v)}
                          onFocus={cancelLevelTooltipClose}
                          onBlur={closeLevelTooltipSoon}
                        >
                          {active.level}
                        </button>
                        <Link
                          className={`level-tooltip ${showLevelTooltip ? "is-open" : ""}`}
                          role="tooltip"
                          href="/bli#score-bands"
                          onClick={() => setShowLevelTooltip(false)}
                          onFocus={cancelLevelTooltipClose}
                          onBlur={closeLevelTooltipSoon}
                        >
                          {active.description}
                          <span>Learn more →</span>
                        </Link>
                      </>
                    )}
                    <span
                      className="score-label-row"
                      onMouseEnter={openBliTooltip}
                      onMouseLeave={closeBliTooltipSoon}
                    >
                      <button
                        type="button"
                        className="bli-info-btn"
                        aria-label={`About the ${active.name}`}
                        aria-expanded={showBliTooltip}
                        onFocus={openBliTooltip}
                        onBlur={closeBliTooltipSoon}
                        onClick={() => setShowBliTooltip((v) => !v)}
                      >
                        ⓘ
                      </button>
                      <Link
                        className={`bli-tooltip ${showBliTooltip ? "is-open" : ""}`}
                        role="tooltip"
                        href="/about"
                        onMouseEnter={openBliTooltip}
                        onMouseLeave={closeBliTooltipSoon}
                        onFocus={openBliTooltip}
                        onBlur={closeBliTooltipSoon}
                      >
                        {active.tooltip}
                        <span>Learn more →</span>
                      </Link>
                    </span>
                  </div>
                </div>
                {/* Once there's a score, the level moved under the score
                    number above, so this middle column used to just be
                    breathing room — now it holds the verse of the day
                    instead. Before an assessment exists, it still carries
                    the explanatory copy telling you what to do next. */}
                <div className="level-block" key={`level-${suiteTestament}`}>
                  {!active.hasData ? (
                    <>
                      <div className="level-badge-empty">Not yet assessed</div>
                      <p className="level-desc-empty">
                        {active.emptyDescription}
                      </p>
                    </>
                  ) : !userEmail && visibleAssessmentData ? (
                    // A brand-new, signed-out result in this browser only — the
                    // verse of the day can wait; the one thing worth this slot
                    // right now is not losing the score just taken.
                    <div className="save-progress-mini">
                      <p className="save-progress-mini-text">Save your progress</p>
                      <button type="button" className="save-progress-mini-btn" onClick={handleSignIn}>
                        Save results
                      </button>
                    </div>
                  ) : (
                    <figure className="verse-of-day">
                      <p className="verse-of-day-kicker">Verse of the Day</p>
                      <blockquote className="verse-of-day-text">{todaysVerse.text}</blockquote>
                      <figcaption className="verse-of-day-ref">{todaysVerse.reference}</figcaption>
                    </figure>
                  )}
                </div>
                <div className="conf-block" key={`conf-${suiteTestament}`}>
                  <span className="conf-empty-label">
                    Score evidence
                    <button
                      className="evidence-info-btn"
                      type="button"
                      aria-label="About score evidence"
                      aria-expanded={showEvidenceTooltip}
                      onMouseEnter={() => setShowEvidenceTooltip(true)}
                      onMouseLeave={() => setShowEvidenceTooltip(false)}
                      onFocus={() => setShowEvidenceTooltip(true)}
                      onBlur={() => setShowEvidenceTooltip(false)}
                      onClick={() => setShowEvidenceTooltip((value) => !value)}
                    >
                      i
                    </button>
                  </span>
                  <span className="conf-note">
                    {active.evidence ? (
                      <>
                        <span className="conf-level">{active.evidence.evidence_level}</span>
                        <span>{active.evidence.n_responses} responses</span>
                      </>
                    ) : "Answer questions to establish evidence"}
                  </span>
                  <span className={`evidence-tooltip ${showEvidenceTooltip ? "is-open" : ""}`} role="tooltip">
                    {active.evidence?.evidence_description || "Score evidence reflects the amount and consistency of psychometric evidence supporting your current estimate."}
                  </span>
                </div>
              </div>
            </>
          );
}

// ---------------------------------------------------------------------------
// The three trigger buttons that expand the knowledge profile, progress
// over time, and knowledge cone panels beneath the score strip.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export function ScorePanelTriggers({
  knowledgeProfileOpen,
  setKnowledgeProfileOpen,
  progressPanelOpen,
  setProgressPanelOpen,
  conePanelOpen,
  setConePanelOpen,
}: {
  knowledgeProfileOpen: boolean;
  setKnowledgeProfileOpen: Dispatch<SetStateAction<boolean>>;
  progressPanelOpen: boolean;
  setProgressPanelOpen: Dispatch<SetStateAction<boolean>>;
  conePanelOpen: boolean;
  setConePanelOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (<>
        <div className="score-panel-triggers">
          <button
            type="button"
            className={`score-panel-trigger ${knowledgeProfileOpen ? "is-active" : ""}`}
            aria-expanded={knowledgeProfileOpen}
            aria-controls="knowledge-profile-panel"
            onClick={() => setKnowledgeProfileOpen(open => !open)}
          >
            <span className="score-panel-trigger-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>
                <path d="M8 7h8"/>
                <path d="M8 11h6"/>
              </svg>
            </span>
            Knowledge profile
          </button>
          <button
            type="button"
            className={`score-panel-trigger ${progressPanelOpen ? "is-active" : ""}`}
            aria-expanded={progressPanelOpen}
            aria-controls="progress-over-time-panel"
            onClick={() => setProgressPanelOpen(open => !open)}
          >
            <span className="score-panel-trigger-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/>
                <path d="M7 14l4-4 3 3 5-6"/>
              </svg>
            </span>
            Knowledge over time
          </button>
          <button
            type="button"
            className={`score-panel-trigger ${conePanelOpen ? "is-active" : ""}`}
            aria-expanded={conePanelOpen}
            aria-controls="knowledge-cone-panel"
            onClick={() => setConePanelOpen(open => !open)}
          >
            <span className="score-panel-trigger-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 18H3z"/>
                <path d="M9.5 9h5"/>
                <path d="M8 15h8"/>
              </svg>
            </span>
            Knowledge cone
          </button>
        </div>
  </>);
}

// ---------------------------------------------------------------------------
// Coverage map section: mode switcher, the recommended-reading /
// knowledge-gap focus card, and the coverage grid itself.
// ---------------------------------------------------------------------------
