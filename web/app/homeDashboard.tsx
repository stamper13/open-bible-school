"use client";

import { type CSSProperties, type Dispatch, type MouseEvent, type RefObject, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { BLI_LEVELS, levelForScore, type BliLevel, type BliLevelBand } from "@/lib/bli";
import {
  compactReference,
  passageReference,
  readableUnitLabel,
  rereadHref,
  type ExploreTree,
  type FocusPath,
} from "@/lib/focusPath";
import { verseOfTheDay } from "@/lib/verseOfTheDay";
import CoverageGrid, { CoverageLegend, hasFocusRecommendation, type CoverageGridView } from "./knowledge-map/CoverageGrid";
import { BOOK_NAMES, type Testament as BibleTestament } from "@/lib/bibleTaxonomy";
import type { RecommendationInteractionSurface } from "@/lib/recommendationEvents";
import type { BliContractScores } from "@/lib/bliContract";
import {
  DASHBOARD_SUBJECTS,
  dimensionDisplayName,
  type AssessmentSnapshot,
  type BackendRecommendation,
  type BliEvidence,
  type DashboardTab,
  type ProgressPoint,
  type RecommendedStudy,
  type ScopeDetailTarget,
} from "./homeHelpers";

// ---------------------------------------------------------------------------
// Site nav bar: brand, top links, "Learn More" menu, and the account menu
// (sign in / sign out / delete account). Named HomeNavBar (not NavBar) so it
// doesn't collide with assessCore.tsx's unrelated nav bar of the same shape.
// ---------------------------------------------------------------------------

export function HomeNavBar({
  userEmail,
  accountMenuOpen,
  accountMenuRef,
  setAccountMenuOpen,
  learnMoreOpen,
  learnMoreRef,
  setLearnMoreOpen,
  handleSignIn,
  onSignOut,
  onDeleteAccountRequest,
}: {
  userEmail: string | null;
  accountMenuOpen: boolean;
  accountMenuRef: RefObject<HTMLDivElement | null>;
  setAccountMenuOpen: Dispatch<SetStateAction<boolean>>;
  learnMoreOpen: boolean;
  learnMoreRef: RefObject<HTMLDivElement | null>;
  setLearnMoreOpen: Dispatch<SetStateAction<boolean>>;
  handleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAccountRequest: () => void;
}) {
  return (
      <nav className="nav">
        <BrandMark />
        <div className="nav-right">
          <Link className="nav-btn" href="/assess">Assess</Link>
          <Link className="nav-btn" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-btn" href="/reading-log">Reading Log</Link>
          <div className="learn-more" ref={learnMoreRef}>
            <button
              type="button"
              className="nav-btn learn-more-trigger"
              onClick={() => {
                setLearnMoreOpen(open => !open);
                setAccountMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={learnMoreOpen}
            >
              Learn More
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {learnMoreOpen && (
              <div className="learn-more-menu" role="menu" aria-label="Learn more pages">
                <Link
                  className="learn-more-item"
                  role="menuitem"
                  href="/credential"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#d4a017" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">Future Ideas</span>
                    <span>Where the project can grow next</span>
                  </span>
                </Link>
                <Link
                  className="learn-more-item"
                  role="menuitem"
                  href="/about"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#0aa3a3" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">About</span>
                    <span>Purpose, limits, and philosophy</span>
                  </span>
                </Link>
                <Link
                  className="learn-more-item"
                  role="menuitem"
                  href="/bli"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#7c3aed" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">How BLI Works</span>
                    <span>Scoring model and score bands</span>
                  </span>
                </Link>
              </div>
            )}
          </div>
          {userEmail ? (
            <div ref={accountMenuRef} style={{position:"relative"}}>
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen(open => !open);
                  setLearnMoreOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                title="Account"
                style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12,color:"var(--muted)",padding:"6px 12px",borderRadius:999,border:"1px solid var(--border)",background:accountMenuOpen?"rgba(255,255,255,.72)":"rgba(255,255,255,.5)",cursor:"pointer",fontFamily:"inherit",transition:"background .14s"}}
              >
                {userEmail}
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{transform:accountMenuOpen?"rotate(180deg)":"none",transition:"transform .14s"}} aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {accountMenuOpen && (
                <div
                  role="menu"
                  style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:40,minWidth:190,padding:6,borderRadius:12,background:"rgba(255,255,255,.98)",border:"1px solid var(--border)",boxShadow:"0 16px 40px rgba(0,0,0,.28)"}}
                >
                  <div style={{padding:"7px 10px 8px",fontSize:11,color:"var(--muted)",borderBottom:"1px solid var(--border)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    Signed in as<br/><span style={{color:"var(--navy)",fontWeight:700}}>{userEmail}</span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onSignOut}
                    style={{display:"flex",width:"100%",alignItems:"center",gap:9,marginTop:4,padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",color:"var(--navy)",fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(27,36,66,.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onDeleteAccountRequest}
                    title="Permanently delete your account and assessment history"
                    style={{display:"flex",width:"100%",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",color:"#b4402f",fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(180,64,47,.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    Delete account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="nav-btn" onClick={handleSignIn}>Sign in</button>
          )}
        </div>
      </nav>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page header: title, subject switcher, and (on the BLI tab) the
// OT/NT toggle with its assessment CTA.
// ---------------------------------------------------------------------------

export function DashboardHeader({
  activeDashboardTab,
  setActiveDashboardTab,
  subjectMenuOpen,
  setSubjectMenuOpen,
  subjectMenuRef,
  dashboardHydrated,
  testamentScores,
  visibleAssessmentData,
  suiteTestament,
  setSuiteTestament,
}: {
  activeDashboardTab: DashboardTab;
  setActiveDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
  subjectMenuOpen: boolean;
  setSubjectMenuOpen: Dispatch<SetStateAction<boolean>>;
  subjectMenuRef: RefObject<HTMLDivElement | null>;
  dashboardHydrated: boolean;
  testamentScores: BliContractScores | null;
  visibleAssessmentData: AssessmentSnapshot | null;
  suiteTestament: BibleTestament;
  setSuiteTestament: Dispatch<SetStateAction<BibleTestament>>;
}) {
  return (<>
          <header className="page-header">
            <div>
              <div className="page-title-row">
                <h1 className="page-title">Your Learning Dashboard</h1>
                <div className="subject-switcher" ref={subjectMenuRef}>
                  <button
                    type="button"
                    className="subject-trigger"
                    onClick={() => setSubjectMenuOpen(open => !open)}
                    aria-haspopup="menu"
                    aria-expanded={subjectMenuOpen}
                  >
                    <span
                      className="subject-trigger-dot"
                      style={{ background: DASHBOARD_SUBJECTS.find(s => s.id === activeDashboardTab)?.color }}
                      aria-hidden="true"
                    />
                    {DASHBOARD_SUBJECTS.find(s => s.id === activeDashboardTab)?.label}
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {subjectMenuOpen && (
                    <div className="learn-more-menu subject-menu" role="menu" aria-label="Dashboard subject">
                      {DASHBOARD_SUBJECTS.map(subject => (
                        <button
                          type="button"
                          key={subject.id}
                          role="menuitemradio"
                          aria-checked={activeDashboardTab === subject.id}
                          className={`learn-more-item subject-menu-item ${activeDashboardTab === subject.id ? "is-active" : ""}`}
                          onClick={() => { setActiveDashboardTab(subject.id); setSubjectMenuOpen(false); }}
                          style={{ "--planet-color": subject.color } as CSSProperties}
                        >
                          <span className="learn-more-planet" aria-hidden="true" />
                          <span className="learn-more-item-copy">
                            <span className="learn-more-item-title">{subject.label}</span>
                            <span>{subject.id === "bli" ? subject.subtitle : "Coming soon"}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="page-meta">
                {activeDashboardTab === "bli" && (!dashboardHydrated
                  ? "Loading your dashboard..."
                  : testamentScores?.combined_questions_answered
                  ? `${testamentScores.combined_questions_answered} questions answered across OT and NT`
                  : visibleAssessmentData ? `${visibleAssessmentData.answered} questions answered` : "No assessment taken yet")}
                {activeDashboardTab === "church-history" && "Church History dashboard coming soon"}
                {activeDashboardTab === "biblical-languages" && "Biblical Languages dashboard coming soon"}
              </p>
            </div>
            {activeDashboardTab === "bli" && dashboardHydrated && (() => {
              const isOT = suiteTestament === "OT";
              const hasData = isOT ? Boolean(visibleAssessmentData) : Boolean(testamentScores?.nt_questions_answered);
              // The toggle already picked the testament, so both routes go
              // straight to that assessment — no "which testament?" interstitial.
              const ctaHref = isOT ? "/assess" : "/assess?testament=NT&scope=NT";
              return (
                <div className="header-assess" style={{ "--suite-hue": isOT ? "#d4a017" : "#7c3aed" } as CSSProperties}>
                  <div className="std-assess-toggle" role="tablist" aria-label="Testament">
                    <span className="std-assess-toggle-thumb" style={{ transform: isOT ? "translateX(0%)" : "translateX(100%)" }} />
                    <button
                      type="button" role="tab" aria-selected={isOT}
                      className={`std-assess-toggle-btn ${isOT ? "is-active" : ""}`}
                      onClick={() => setSuiteTestament("OT")}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="7" height="16" rx="2"/>
                        <rect x="14" y="4" width="7" height="16" rx="2"/>
                      </svg>
                      Old Testament
                    </button>
                    <button
                      type="button" role="tab" aria-selected={!isOT}
                      className={`std-assess-toggle-btn ${!isOT ? "is-active" : ""}`}
                      onClick={() => setSuiteTestament("NT")}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="3" x2="12" y2="21"/>
                        <line x1="7" y1="9" x2="17" y2="9"/>
                      </svg>
                      New Testament
                    </button>
                  </div>
                  <div className="std-assess-actions">
                    <Link className="std-assess-cta" href={ctaHref}>
                      {hasData ? "Continue assessment" : "Start assessment"}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              );
            })()}
          </header>
  </>);
}

// ---------------------------------------------------------------------------
// Dashboard subject tab row (BLI / Church History / Biblical Languages).
// Only shown before a learner has completed a full baseline assessment.
// ---------------------------------------------------------------------------

export function DashboardTabsBar({
  activeDashboardTab,
  setActiveDashboardTab,
}: {
  activeDashboardTab: DashboardTab;
  setActiveDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
}) {
  return (<>
          <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
            <button
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "bli"}
              className={`dashboard-tab ${activeDashboardTab === "bli" ? "is-active" : ""}`}
              onClick={() => setActiveDashboardTab("bli")}
            >
              <strong>BLI</strong>
              <span>OT, NT, and combined literacy</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "church-history"}
              className={`dashboard-tab ${activeDashboardTab === "church-history" ? "is-active" : ""}`}
              onClick={() => setActiveDashboardTab("church-history")}
            >
              <strong>Church History</strong>
              <span>Coming soon</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "biblical-languages"}
              className={`dashboard-tab ${activeDashboardTab === "biblical-languages" ? "is-active" : ""}`}
              onClick={() => setActiveDashboardTab("biblical-languages")}
            >
              <strong>Biblical Languages</strong>
              <span>Coming soon</span>
            </button>
          </div>
  </>);
}

// ---------------------------------------------------------------------------
// "Take your first assessment" card plus the feature grid beneath it, shown
// until the learner completes a full baseline assessment.
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

export function CoverageMapSection({
  coverageTree,
  activeCoverageMapMode,
  setCoverageMapMode,
  suiteTestament,
  coverageModeCopy,
  hasReadingRecommendation,
  frontier,
  backendRecommendation,
  knowledgeGapEyebrow,
  isBackendRecommendationShown,
  recommendedStudy,
  recommendedGuidanceLabel,
  recommendedGuidanceSteps,
  recommendedResources,
  progressHistory,
  openScopeDetail,
  recordRecommendationView,
  handleRecommendedAction,
  router,
}: {
  coverageTree: ExploreTree;
  activeCoverageMapMode: CoverageGridView;
  setCoverageMapMode: Dispatch<SetStateAction<CoverageGridView>>;
  suiteTestament: BibleTestament;
  coverageModeCopy: string;
  hasReadingRecommendation: boolean;
  frontier: FocusPath;
  backendRecommendation: BackendRecommendation | null;
  knowledgeGapEyebrow: string;
  isBackendRecommendationShown: boolean;
  recommendedStudy: RecommendedStudy;
  recommendedGuidanceLabel: string;
  recommendedGuidanceSteps: string[];
  recommendedResources: { label: string; href: string }[];
  progressHistory: ProgressPoint[];
  openScopeDetail: (target: ScopeDetailTarget) => void | Promise<void>;
  recordRecommendationView: (surface: RecommendationInteractionSurface) => void | Promise<void>;
  handleRecommendedAction: (event: MouseEvent<HTMLAnchorElement>) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (<>
          <section className={`coverage-map-section is-${activeCoverageMapMode}`} aria-labelledby="coverage-map-title">
            <div className="coverage-map-head">
              <div>
                <p className="section-eyebrow">Coverage map</p>
                <h2 id="coverage-map-title" className="coverage-map-title">
                  {suiteTestament === "NT" ? "New Testament" : "Old Testament"}
                </h2>
                <p className="coverage-map-copy">{coverageModeCopy}</p>
              </div>
              {suiteTestament === "OT" && (
                <div className="coverage-mode-controls" role="tablist" aria-label="Coverage map view">
                  {[
                    {
                      key: "recommended" as const,
                      label: "Recommended",
                      disabled: !hasReadingRecommendation,
                      icon: (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3z" />
                        </svg>
                      ),
                    },
                    {
                      key: "overview" as const,
                      label: "Overview",
                      disabled: false,
                      icon: (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="4" y="4" width="6" height="6" rx="1.2" />
                          <rect x="14" y="4" width="6" height="6" rx="1.2" />
                          <rect x="4" y="14" width="6" height="6" rx="1.2" />
                          <rect x="14" y="14" width="6" height="6" rx="1.2" />
                        </svg>
                      ),
                    },
                    {
                      key: "skill" as const,
                      label: "Knowledge Gap",
                      disabled: false,
                      icon: (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 4v16" />
                          <path d="M5 8h14" />
                          <path d="M7 14h10" />
                          <path d="M9 20h6" />
                        </svg>
                      ),
                    },
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      role="tab"
                      title={mode.label}
                      aria-label={mode.label}
                      aria-selected={activeCoverageMapMode === mode.key}
                      disabled={mode.disabled}
                      className={`coverage-mode-btn ${activeCoverageMapMode === mode.key ? "is-active" : ""}`}
                      onClick={() => setCoverageMapMode(mode.key)}
                    >
                      {mode.icon}
                      <span>{mode.label}</span>
                    </button>
                  ))}
                  <Link className="coverage-map-link" href="/knowledge-map" title="Open Knowledge Map" aria-label="Open Knowledge Map">
                    <span className="cml-icon" aria-hidden="true">
                      <span className="cml-star" />
                      <span className="cml-orbit">
                        <span className="cml-planet" />
                      </span>
                    </span>
                  </Link>
                </div>
              )}
            </div>
            <div className="coverage-legend-rail">
              <CoverageLegend hasRecommendation={hasFocusRecommendation(coverageTree)} testament={suiteTestament} />
            </div>
            <div className="coverage-map-card">
            {suiteTestament === "OT" && activeCoverageMapMode === "recommended" && frontier.focusLeaf && (
              <section className="coverage-focus-card" aria-label="Recommended reading">
                <div>
                  <p className="coverage-focus-eyebrow">Recommended reading</p>
                  <h3 className="coverage-focus-title">{readableUnitLabel(frontier.focusLeaf.label)}</h3>
                  <p className="coverage-focus-meta">{passageReference(frontier.focusLeaf)}</p>
                </div>
                <div className="coverage-focus-actions">
                  <a
                    className="coverage-focus-primary"
                    href={rereadHref(frontier.focusLeaf)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Reread {compactReference(frontier.focusLeaf)}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7"/><path d="M9 7h8v8"/>
                    </svg>
                  </a>
                </div>
              </section>
            )}
            {suiteTestament === "OT" && activeCoverageMapMode === "skill" && (
              <section className="coverage-focus-card is-skill" aria-label="Recommended knowledge gap review">
                <div>
                  <div className="coverage-diagnostic-head">
                    <p className="coverage-focus-eyebrow">{knowledgeGapEyebrow}</p>
                  </div>
                  {backendRecommendation?.dimension_key ? (
                    <h3 className="coverage-focus-title">
                      <button
                        type="button"
                        className="coverage-focus-title-link"
                        onClick={() => {
                          const dimensionKey = backendRecommendation.dimension_key!;
                          const dimensionName = backendRecommendation.dimension_short_label
                            ?? backendRecommendation.dimension_label
                            ?? dimensionDisplayName(dimensionKey);
                          void openScopeDetail({
                            scopeType: "DIMENSION",
                            scopeKey: `${suiteTestament}:${dimensionKey}`,
                            label: dimensionName,
                            // This card only ever renders for suiteTestament === "OT" (see the
                            // guard above), so the subtitle doesn't need to branch on testament.
                            subtitle: "Old Testament knowledge dimension",
                          });
                        }}
                      >
                        {recommendedStudy.label}
                      </button>
                    </h3>
                  ) : (
                    <h3 className="coverage-focus-title">{recommendedStudy.label}</h3>
                  )}
                  <p className="coverage-focus-meta">{recommendedStudy.books}</p>
                  <p className="coverage-focus-copy">{recommendedStudy.focus}</p>
                  {recommendedGuidanceSteps.length > 0 && (
                    <div className="recommended-guidance">
                      <p className="recommended-guidance-title">{recommendedGuidanceLabel}</p>
                      <ul className="recommended-guidance-list">
                        {recommendedGuidanceSteps.map(step => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                      {recommendedResources.length > 0 && (
                        <div className="recommended-resources" aria-label="Study resources">
                          {recommendedResources.map(resource => (
                            <a
                              key={resource.href}
                              className="recommended-resource"
                              href={resource.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {resource.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="coverage-focus-actions">
                  <p className="coverage-focus-priority">{recommendedStudy.priority}</p>
                  {backendRecommendation && isBackendRecommendationShown && (
                    <button
                      type="button"
                      className="scope-text-btn"
                      onClick={() => {
                        // Expanding the recommendation is an explicit view.
                        void recordRecommendationView("scope_detail");
                        void openScopeDetail({
                          scopeType: "UNIT",
                          scopeKey: backendRecommendation.unit_key,
                          unitKey: backendRecommendation.unit_key,
                          label: backendRecommendation.label,
                          subtitle: `${backendRecommendation.section} · ${BOOK_NAMES[backendRecommendation.book_code] ?? backendRecommendation.book_code}`,
                        });
                      }}
                    >
                      Details
                    </button>
                  )}
                  <Link className="coverage-focus-primary" href={recommendedStudy.actionHref} onClick={handleRecommendedAction}>
                    {recommendedStudy.actionLabel}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
                    </svg>
                  </Link>
                  {progressHistory[0]?.attempt_id && (
                    <Link className="recommended-review" href={`/results/${progressHistory[0].attempt_id}`}>
                      Recent results <span aria-hidden="true">›</span>
                    </Link>
                  )}
                </div>
              </section>
            )}
            <CoverageGrid
              tree={coverageTree}
              testament={suiteTestament}
              view={activeCoverageMapMode}
              showSummary={false}
              onFocusView={suiteTestament === "OT" ? () => router.push("/knowledge-map") : undefined}
              // The gold-ringed unit group (e.g. Genesis 12-50) is a whole
              // learning range; the actual "Recommended reading" card above
              // points at a narrower slice inside it (e.g. 20-22). Only wire
              // this up while that card is the one actually showing, so the
              // highlight never points at chapters unrelated to what's on
              // screen.
              focusChapterRange={
                suiteTestament === "OT" && activeCoverageMapMode === "recommended"
                  && frontier.focusLeaf?.book_code && frontier.focusLeaf.start_ch !== null
                  ? {
                      bookCode: frontier.focusLeaf.book_code,
                      startCh: frontier.focusLeaf.start_ch,
                      endCh: frontier.focusLeaf.end_ch ?? frontier.focusLeaf.start_ch,
                    }
                  : null
              }
            />
            </div>
          </section>
  </>);
}

// ---------------------------------------------------------------------------
// Placeholder shown for the not-yet-built Church History / Biblical
// Languages dashboard tabs.
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
