"use client";

import { useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { NT_PILOT_ENABLED } from "../assess/constants";
import type { DashboardTab } from "../homeTypes";

// ---------------------------------------------------------------------------

export function FirstAssessmentCard({
  inProgressTestament,
  firstAssessmentChooserOpen,
  setFirstAssessmentChooserOpen,
}: {
  inProgressTestament: "OT" | "NT" | null;
  firstAssessmentChooserOpen: boolean;
  setFirstAssessmentChooserOpen: Dispatch<SetStateAction<boolean>>;
}) {
  // Local to this card: nothing outside it needs to know whether the
  // "Learn more" chooser is open. It is kept mutually exclusive with the
  // testament chooser below so the card never sprouts two panels at once.
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);

  return (<>
              <section className="first-assessment-card" aria-label="Start your first assessment">
                <div className="first-assessment-orbit" aria-hidden="true">
                  <span className="first-assessment-sun" />
                  <span className="first-assessment-planet" />
                  <span className="first-assessment-moon" />
                </div>
                <div className="first-assessment-content">
                  <p className="first-assessment-kicker">Start here</p>
                  <h1>Take your first Bible assessment</h1>
                  <div className="first-assessment-actions">
                    {inProgressTestament ? (
                      inProgressTestament === "NT" && !NT_PILOT_ENABLED ? (
                        <button
                          type="button"
                          className="first-assessment-primary is-disabled"
                          disabled
                        >
                          NT coming soon
                        </button>
                      ) : (
                        <Link
                          className="first-assessment-primary"
                          href={inProgressTestament === "OT" ? "/assess" : "/assess?testament=NT&scope=NT"}
                        >
                          Continue assessment
                          <span aria-hidden="true">→</span>
                        </Link>
                      )
                    ) : (
                      <button
                        type="button"
                        className="first-assessment-primary"
                        aria-expanded={firstAssessmentChooserOpen}
                        aria-controls="first-assessment-choice-panel"
                        onClick={() => {
                          setLearnMoreOpen(false);
                          setFirstAssessmentChooserOpen(open => !open);
                        }}
                      >
                        Take assessment
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="first-assessment-secondary"
                      aria-expanded={learnMoreOpen}
                      aria-controls="first-assessment-learn-panel"
                      onClick={() => {
                        setFirstAssessmentChooserOpen(false);
                        setLearnMoreOpen(open => !open);
                      }}
                    >
                      Learn more
                    </button>
                  </div>
                  {learnMoreOpen && (
                    <div
                      id="first-assessment-learn-panel"
                      className="first-assessment-choice-panel"
                      aria-label="Choose how to learn more"
                    >
                      <Link className="first-assessment-choice" href="/intro">
                        <strong>Intro Presentation</strong>
                        <span>A visual tour of what the assessment measures.</span>
                      </Link>
                      <Link className="first-assessment-choice" href="/philosophy">
                        <strong>About</strong>
                        <span>Why the project exists and how it is being built.</span>
                      </Link>
                    </div>
                  )}
                  {!inProgressTestament && firstAssessmentChooserOpen && (
                    <div
                      id="first-assessment-choice-panel"
                      className="first-assessment-choice-panel"
                      aria-label="Choose assessment testament"
                    >
                      <Link className="first-assessment-choice" href="/assess">
                        <strong>Old Testament</strong>
                        <span>Start with Genesis through Malachi.</span>
                      </Link>
                      {NT_PILOT_ENABLED ? (
                        <Link className="first-assessment-choice" href="/assess?testament=NT&scope=NT">
                          <strong>New Testament</strong>
                          <span>Assess Matthew through Revelation separately.</span>
                        </Link>
                      ) : (
                        <span className="first-assessment-choice is-disabled" aria-disabled="true">
                          <strong>New Testament</strong>
                          <span>Coming soon.</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="oba-feature-grid" aria-label="Open Bible Assessment features">
                <article className="oba-feature-card" style={{ "--feature-hue": "#0aa3a3" } as CSSProperties}>
                  <div className="oba-feature-graphic is-signal" aria-hidden="true">
                    <span className="signal-node" />
                    <span className="signal-node" />
                    <span className="signal-node" />
                    <span className="signal-line" />
                    <span className="signal-line" />
                  </div>
                  <p className="oba-feature-kicker">Adaptive</p>
                  <h3 className="oba-feature-title">Questions adjust as you answer</h3>
                  <p className="oba-feature-copy">
                    The assessment starts broad, then spends more time where your answers are less certain.
                  </p>
                </article>

                <article className="oba-feature-card" style={{ "--feature-hue": "#d4a017" } as CSSProperties}>
                  <div className="oba-feature-graphic is-map" aria-hidden="true">
                    <span className="map-orbit" />
                    <span className="map-star" />
                    <span className="map-planet" />
                  </div>
                  <p className="oba-feature-kicker">Visual</p>
                  <h3 className="oba-feature-title">See your knowledge map</h3>
                  <p className="oba-feature-copy">
                    Your results fill in a map of Scripture, showing what has been tested and what still needs coverage.
                  </p>
                </article>

                <article className="oba-feature-card" style={{ "--feature-hue": "#7c3aed" } as CSSProperties}>
                  <div className="oba-feature-graphic is-path" aria-hidden="true">
                    <span className="path-line" />
                    <span className="path-step" />
                    <span className="path-step" />
                    <span className="path-step" />
                  </div>
                  <p className="oba-feature-kicker">Practical</p>
                  <h3 className="oba-feature-title">Build a clearer study path</h3>
                  <p className="oba-feature-copy">
                    As you keep answering and logging reading, your dashboard becomes better at showing what to review next.
                  </p>
                </article>
              </section>
  </>);
}

// ---------------------------------------------------------------------------
// The save prompt. This is what a signed-out learner meets first after their
// result lands on the dashboard; closing it does not throw the ask away, it
// hands off to the save-progress slot in the score strip beside the BLI. See
// the savePromptDismissed handling in app/page.tsx.
// ---------------------------------------------------------------------------

export function SaveResultsModal({
  handleSignIn,
  dismissSavePrompt,
}: {
  handleSignIn: () => Promise<void>;
  dismissSavePrompt: () => void;
}) {
  return (
    <div className="save-modal-backdrop" role="presentation" onClick={dismissSavePrompt}>
      <div className="save-modal" role="dialog" aria-modal="true" aria-labelledby="save-modal-title" onClick={event => event.stopPropagation()}>
        <button
          className="save-modal-close"
          type="button"
          onClick={dismissSavePrompt}
          aria-label="Close - the save option stays on your dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <span className="save-modal-badge" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h2 className="save-modal-title" id="save-modal-title">Save your result?</h2>
        <p className="save-modal-copy">
          Sign in to keep your score and reach it from any device.
        </p>
        <div className="save-modal-actions">
          <button className="save-modal-secondary" type="button" onClick={dismissSavePrompt}>
            Not now
          </button>
          <button className="save-modal-primary" type="button" onClick={handleSignIn}>
            Save results
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The BLI score strip: combined-BLI note, score number, level badge, verse
// of the day / save-progress slot, and score-evidence readout. Reads from
// whichever testament the header's OT/NT toggle currently has active.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export function PlaceholderDashboard({
  activeDashboardTab,
}: {
  activeDashboardTab: DashboardTab;
}) {
  return (<>
          <section className="placeholder-dashboard" aria-label={`${activeDashboardTab === "church-history" ? "Church History" : "Biblical Languages"} dashboard placeholder`}>
            <div>
              <p className="placeholder-eyebrow">Coming soon</p>
              <h2 className="placeholder-title">
                {activeDashboardTab === "church-history" ? "Church History Dashboard" : "Biblical Languages Dashboard"}
              </h2>
              <p className="placeholder-copy">
                {activeDashboardTab === "church-history"
                  ? "Progress through eras, councils, figures, doctrines, and global church history will live here."
                  : "Hebrew, Greek, vocabulary, grammar, parsing, and reading fluency will live here."}
              </p>
              <div className="placeholder-list">
                <span className="placeholder-pill">Progress metrics</span>
                <span className="placeholder-pill">Recommendations</span>
                <span className="placeholder-pill">Assessments</span>
              </div>
            </div>
            <div className="placeholder-orbit" aria-hidden="true" />
          </section>
  </>);
}
