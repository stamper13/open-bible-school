"use client";

import { useState, type CSSProperties, type Dispatch, type RefObject, type SetStateAction } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { type Testament as BibleTestament } from "@/lib/bibleTaxonomy";
import type { BliContractScores } from "@/lib/bliContract";
import { NT_PILOT_ENABLED } from "../assess/constants";
import { DASHBOARD_SUBJECTS } from "../homeConstants";
import type { AssessmentSnapshot, DashboardTab } from "../homeTypes";

// ---------------------------------------------------------------------------
// The one dashboard subject control (Bible Assessment / Church History /
// Biblical Languages).
//
// This used to exist twice: this dropdown in the dashboard header, and a
// separate three-tile .dashboard-tabs grid on the pre-baseline landing. They
// disagreed on the first subject's name ("Bible Assessment" vs "BLI") and both
// rendered at once whenever a learner without a completed assessment selected a
// non-BLI subject. One component, driven by DASHBOARD_SUBJECTS, keeps the two
// entry points identical and the labels in one place.
// ---------------------------------------------------------------------------

export function SubjectSwitcher({
  activeDashboardTab,
  setActiveDashboardTab,
  subjectMenuOpen,
  setSubjectMenuOpen,
  subjectMenuRef,
}: {
  activeDashboardTab: DashboardTab;
  setActiveDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
  subjectMenuOpen: boolean;
  setSubjectMenuOpen: Dispatch<SetStateAction<boolean>>;
  subjectMenuRef: RefObject<HTMLDivElement | null>;
}) {
  const active = DASHBOARD_SUBJECTS.find(s => s.id === activeDashboardTab);
  return (
    <div className="subject-switcher" ref={subjectMenuRef}>
      <button
        type="button"
        className="subject-trigger"
        onClick={() => setSubjectMenuOpen(open => !open)}
        aria-haspopup="menu"
        aria-label={`Subject: ${active?.label}`}
        aria-expanded={subjectMenuOpen}
      >
        <span className="subject-trigger-dot" style={{ background: active?.color }} aria-hidden="true" />
        <span className="subject-trigger-label-full">{active?.label}</span>
        <span className="subject-trigger-label-short">{active?.short}</span>
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
                <span>{subject.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  activeDashboardTab,
  setActiveDashboardTab,
  navSubjectMenuOpen,
  setNavSubjectMenuOpen,
  navSubjectMenuRef,
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
  activeDashboardTab: DashboardTab;
  setActiveDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
  navSubjectMenuOpen: boolean;
  setNavSubjectMenuOpen: Dispatch<SetStateAction<boolean>>;
  navSubjectMenuRef: RefObject<HTMLDivElement | null>;
}) {
  return (
      <nav className="nav">
        <BrandMark />
        {/* The subject picker as its own dropdown, on the left beside the
            brand. Phones only: below 767px the in-page .dashboard-subject-row
            is hidden, so this is the one subject control on screen, and it
            keeps its own menu rather than being folded into Menu. It carries
            its own open flag and ref because the in-page instance is still
            mounted at desktop widths. */}
        <div className="nav-subject">
          <SubjectSwitcher
            activeDashboardTab={activeDashboardTab}
            setActiveDashboardTab={setActiveDashboardTab}
            subjectMenuOpen={navSubjectMenuOpen}
            setSubjectMenuOpen={setNavSubjectMenuOpen}
            subjectMenuRef={navSubjectMenuRef}
          />
        </div>
        <div className="nav-right">
          <Link className="nav-btn nav-primary-link" href="/assess">Assess</Link>
          <Link className="nav-btn nav-primary-link" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-btn nav-primary-link" href="/reading-log">Reading Log</Link>
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
              <span className="learn-more-label-full">Learn More</span>
              <span className="learn-more-label-mobile">Menu</span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {learnMoreOpen && (
              <div className="learn-more-menu" role="menu" aria-label="Site menu">
                <Link
                  className="learn-more-item mobile-menu-only"
                  role="menuitem"
                  href="/assess"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#d4a017" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">Assess</span>
                    <span>Start or continue an assessment</span>
                  </span>
                </Link>
                <Link
                  className="learn-more-item mobile-menu-only"
                  role="menuitem"
                  href="/knowledge-map"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#4fd6d6" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">Knowledge Map</span>
                    <span>View your Scripture coverage</span>
                  </span>
                </Link>
                <Link
                  className="learn-more-item mobile-menu-only"
                  role="menuitem"
                  href="/reading-log"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#7c3aed" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">Reading Log</span>
                    <span>Track what you have read</span>
                  </span>
                </Link>
                <Link
                  className="learn-more-item"
                  role="menuitem"
                  href="/intro"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#4fd6d6" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">OBA Intro Presentation</span>
                    <span>The project as a map of the canon</span>
                  </span>
                </Link>
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
                  href="/philosophy"
                  onClick={() => setLearnMoreOpen(false)}
                  style={{ "--planet-color": "#0aa3a3" } as CSSProperties}
                >
                  <span className="learn-more-planet" aria-hidden="true" />
                  <span className="learn-more-item-copy">
                    <span className="learn-more-item-title">About</span>
                    <span>The full write-up, start to finish</span>
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
  // The New Testament suite is not open yet. The tab used to be `disabled`
  // and labelled "NT soon", which meant a click did nothing at all and the
  // "Coming soon" CTA beside it was unreachable — you could only reach that
  // state by already being on NT, which the disabled tab prevented. The tab
  // now says what it is and answers when pressed.
  const [ntNotice, setNtNotice] = useState(false);
  return (<>
          <header className="page-header">
            <div>
              <div className="page-title-row">
                <h1 className="page-title">Your Learning Dashboard</h1>
                <SubjectSwitcher
                  activeDashboardTab={activeDashboardTab}
                  setActiveDashboardTab={setActiveDashboardTab}
                  subjectMenuOpen={subjectMenuOpen}
                  setSubjectMenuOpen={setSubjectMenuOpen}
                  subjectMenuRef={subjectMenuRef}
                />
              </div>
              <p className="page-meta">
                {activeDashboardTab === "bli" && (!dashboardHydrated
                  ? "Loading your dashboard..."
                  : testamentScores?.combined_questions_answered
                  ? `${testamentScores.combined_questions_answered} questions answered across OT and NT`
                  : visibleAssessmentData ? `${visibleAssessmentData.answered} questions answered` : "No assessment taken yet")}
                {activeDashboardTab === "church-history" && "Future course area"}
                {activeDashboardTab === "biblical-languages" && "Future course area"}
              </p>
            </div>
            {activeDashboardTab === "bli" && dashboardHydrated && (() => {
              const isOT = suiteTestament === "OT";
              const hasData = isOT ? Boolean(visibleAssessmentData) : Boolean(testamentScores?.nt_questions_answered);
              // The toggle already picked the testament, so both routes go
              // straight to that assessment — no "which testament?" interstitial.
              const ctaHref = isOT ? "/assess" : "/assess?testament=NT&scope=NT";
              const ntDisabled = !isOT && !NT_PILOT_ENABLED;
              return (
                <div className="header-assess" style={{ "--suite-hue": isOT ? "#d4a017" : "#7c3aed" } as CSSProperties}>
                  <div className="std-assess-toggle" role="tablist" aria-label="Testament">
                    <span className="std-assess-toggle-thumb" style={{ transform: isOT ? "translateX(0%)" : "translateX(100%)" }} />
                    <button
                      type="button" role="tab" aria-selected={isOT}
                      className={`std-assess-toggle-btn ${isOT ? "is-active" : ""}`}
                      onClick={() => { setNtNotice(false); setSuiteTestament("OT"); }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="7" height="16" rx="2"/>
                        <rect x="14" y="4" width="7" height="16" rx="2"/>
                      </svg>
                      Old Testament
                    </button>
                    <button
                      type="button" role="tab" aria-selected={!isOT}
                      aria-disabled={!NT_PILOT_ENABLED}
                      className={`std-assess-toggle-btn ${!isOT ? "is-active" : ""}${NT_PILOT_ENABLED ? "" : " is-soon"}`}
                      onClick={() => {
                        if (!NT_PILOT_ENABLED) { setNtNotice(true); return; }
                        setSuiteTestament("NT");
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="3" x2="12" y2="21"/>
                        <line x1="7" y1="9" x2="17" y2="9"/>
                      </svg>
                      New Testament
                    </button>
                    {ntNotice && !NT_PILOT_ENABLED && (
                      <span className="std-nt-soon" role="status">Coming soon</span>
                    )}
                  </div>
                  <div className="std-assess-actions">
                    {ntDisabled ? (
                      <span className="std-assess-cta is-disabled" aria-disabled="true">Coming soon</span>
                    ) : (
                      <Link className="std-assess-cta" href={ctaHref}>
                        {hasData ? "Continue assessment" : "Start assessment"}
                        <span aria-hidden="true">→</span>
                      </Link>
                    )}
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

// ---------------------------------------------------------------------------

export function DashboardTabsBar({
  activeDashboardTab,
  setActiveDashboardTab,
  subjectMenuOpen,
  setSubjectMenuOpen,
  subjectMenuRef,
}: {
  activeDashboardTab: DashboardTab;
  setActiveDashboardTab: Dispatch<SetStateAction<DashboardTab>>;
  subjectMenuOpen: boolean;
  setSubjectMenuOpen: Dispatch<SetStateAction<boolean>>;
  subjectMenuRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="dashboard-subject-row">
      <SubjectSwitcher
        activeDashboardTab={activeDashboardTab}
        setActiveDashboardTab={setActiveDashboardTab}
        subjectMenuOpen={subjectMenuOpen}
        setSubjectMenuOpen={setSubjectMenuOpen}
        subjectMenuRef={subjectMenuRef}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Take your first assessment" card plus the feature grid beneath it, shown
// until the learner completes a full baseline assessment.
// ---------------------------------------------------------------------------
