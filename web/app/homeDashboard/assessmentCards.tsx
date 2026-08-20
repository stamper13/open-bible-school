"use client";

import { type CSSProperties, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
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
  return (<>
              <section className="first-assessment-card" aria-label="Start your first assessment">
                <div className="first-assessment-orbit" aria-hidden="true">
                  <span className="first-assessment-sun" />
                  <span className="first-assessment-planet" />
                  <span className="first-assessment-moon" />
                </div>
                <div className="first-assessment-content">
                  <p className="first-assessment-kicker">Start here</p>
                  <h2>Take your first Bible assessment</h2>
                  <p>
                    Answer a short adaptive set of questions. OBA will estimate your BLI, map likely strengths and gaps, and recommend one next place to study.
                  </p>
                  <div className="first-assessment-actions">
                    {inProgressTestament ? (
                      <Link
                        className="first-assessment-primary"
                        href={inProgressTestament === "OT" ? "/assess" : "/assess?testament=NT&scope=NT"}
                      >
                        Continue assessment
                        <span aria-hidden="true">→</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="first-assessment-primary"
                        aria-expanded={firstAssessmentChooserOpen}
                        aria-controls="first-assessment-choice-panel"
                        onClick={() => setFirstAssessmentChooserOpen(open => !open)}
                      >
                        Take assessment
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                    <Link className="first-assessment-secondary" href="/bli">
                      Learn more
                    </Link>
                  </div>
                  {!inProgressTestament && firstAssessmentChooserOpen && (
                    <div
                      id="first-assessment-choice-panel"
                      className="first-assessment-choice-panel"
                      aria-label="Choose assessment testament"
                    >
                      <Link className="first-assessment-choice" href="/assess">
                        <strong>Old Testament</strong>
                        <span>Genesis through Malachi, scored as its own 0-800 BLI.</span>
                      </Link>
                      <Link className="first-assessment-choice" href="/assess?testament=NT&scope=NT">
                        <strong>New Testament</strong>
                        <span>Matthew through Revelation, scored separately from OT.</span>
                      </Link>
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
                  <h3 className="oba-feature-title">Follows where you&rsquo;re unsure</h3>
                  <p className="oba-feature-copy">
                    OBA weights central passages more heavily and spends extra questions on your least-tested sections, so your score reflects real familiarity — not just how many questions you answered.
                  </p>
                </article>

                <article className="oba-feature-card" style={{ "--feature-hue": "#d4a017" } as CSSProperties}>
                  <div className="oba-feature-graphic is-map" aria-hidden="true">
                    <span className="map-orbit" />
                    <span className="map-star" />
                    <span className="map-planet" />
                  </div>
                  <p className="oba-feature-kicker">Visual</p>
                  <h3 className="oba-feature-title">See the Bible as a map</h3>
                  <p className="oba-feature-copy">
                    See which parts of the Bible you have started to cover, which areas are still untested, and how the sections fit together.
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
                  <h3 className="oba-feature-title">Study what helps next</h3>
                  <p className="oba-feature-copy">
                    After an assessment, OBA gives you a focused place to reread or review instead of a vague study plan.
                  </p>
                </article>
              </section>
  </>);
}

// ---------------------------------------------------------------------------
// Prompt to sign in and save a just-taken, signed-out assessment result.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export function SaveResultsCard({
  handleSignIn,
}: {
  handleSignIn: () => Promise<void>;
}) {
  return (<>
          <section className="save-results-card" aria-label="Save assessment results">
            <div className="save-results-graphic" aria-hidden="true">
              <span className="save-results-check" />
            </div>
            <div className="save-results-content">
              <span className="save-results-kicker">Keep this result</span>
              <h2 className="save-results-title">Save your progress across devices.</h2>
              <p className="save-results-copy">
                You just created a BLI snapshot in this browser. Sign in to keep it, sync it across devices, and return to your recommendation later.
              </p>
            </div>
            <div className="save-results-actions">
              <button className="save-results-btn" type="button" onClick={handleSignIn}>
                Save results
                <span aria-hidden="true">→</span>
              </button>
              <span className="save-results-note">Your existing answers transfer after sign-in.</span>
            </div>
          </section>
  </>);
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
                  ? "This space will eventually track progress through major eras, councils, figures, doctrines, movements, and the story of the global church. For now it is a holding place while the course content is being built."
                  : "This space will eventually track progress in biblical Hebrew, Greek, vocabulary, grammar, parsing, and reading fluency. For now it is a holding place while the language pathway is being built."}
              </p>
              <div className="placeholder-list">
                <span className="placeholder-pill">Progress metrics pending</span>
                <span className="placeholder-pill">Recommendations pending</span>
                <span className="placeholder-pill">Assessment engine pending</span>
              </div>
            </div>
            <div className="placeholder-orbit" aria-hidden="true" />
          </section>
  </>);
}
