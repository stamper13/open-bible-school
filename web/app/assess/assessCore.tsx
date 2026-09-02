"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { BOOK_NAMES } from "@/lib/bibleTaxonomy";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { IDK_CHOICE_ID, SECTION_COLORS } from "./constants";
import { SectionSortDropZone, SectionSortLabelChip, SortableSequenceItem } from "./QuestionInteractionItems";
import type {
  AssessmentMode,
  Choice,
  NtPilotQuestion,
  OtAssessmentRequest,
  OtAssessmentStartRow,
  Phase,
  Question,
  SectionSortInteraction,
  SectionSortKey,
  SectionSortLabel,
} from "./types";

// ---------------------------------------------------------------------------
// Assess page nav bar: brand, phase/progress readout, sign in/out + exit.
// Named AssessNavBar (not NavBar) so it doesn't collide with
// homeDashboard.tsx's unrelated nav bar of the same shape.
// ---------------------------------------------------------------------------

export function AssessNavBar({
  isDashboardTransitioning,
  displayNavPhaseLabel,
  displayNavSubLabel,
  answeredCount,
  displayProgressPct,
  displayProgressEnd,
  assessmentMode,
  isSignedIn,
  handleSignOut,
  setShowResults,
  attemptId,
}: {
  isDashboardTransitioning: boolean;
  displayNavPhaseLabel: string;
  displayNavSubLabel: string;
  answeredCount: number;
  displayProgressPct: number;
  displayProgressEnd: number;
  assessmentMode: AssessmentMode;
  isSignedIn: boolean;
  handleSignOut: () => Promise<void>;
  setShowResults: Dispatch<SetStateAction<boolean>>;
  attemptId: string | null;
}) {
  /* Collapsing the header is a button, not a scroll behaviour. Scrolling it
     away needed scroll to move it through, and this screen has 22px of travel
     at 375x667 — most of which Safari spends collapsing its own chrome, so it
     never actually went. A button does not depend on there being room. */
  const [navHidden, setNavHidden] = useState(false);
  return (<>
      <nav className={`nav ${navHidden ? "is-hidden" : ""} ${isDashboardTransitioning ? "dashboard-transition" : ""}`}>
        <BrandMark />
        <div className="nav-center">
          <span className="nav-phase">{displayNavPhaseLabel}</span>
          <span className="nav-subphase">{displayNavSubLabel}</span>
          <div className="nav-progress-row">
            <span className="nav-count">{answeredCount}</span>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${displayProgressPct}%` }} />
            </div>
            <span className="nav-count-right">{displayProgressEnd}</span>
          </div>
        </div>
        <div className="nav-actions">
          {assessmentMode === "OT" && (isSignedIn ? (
            <button
              onClick={handleSignOut}
              className="nav-exit nav-action-button"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setShowResults(true)}
              className="nav-exit nav-action-button"
            >
              Sign in
            </button>
          ))}
          {attemptId && answeredCount > 0 && (
            <Link className="nav-exit" href={`/results/${attemptId}`}>
              Review<span className="nav-exit-tail"> session</span>
            </Link>
          )}
          <Link className="nav-exit" href="/">Exit</Link>
          {/* Phone only, via CSS. The header is worth ~65px of a screen that
              Safari has already cut to about 560px. */}
          <button
            type="button"
            className="nav-collapse"
            onClick={() => setNavHidden(true)}
            aria-label="Hide the header"
            title="Hide the header"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
        </div>
      </nav>
      {/* Its counterpart. Sits outside the nav so it survives the nav being
          taken out of the layout, and stays a fixed tab at the top of the
          screen — the one way back. */}
      {navHidden && (
        <button
          type="button"
          className="nav-reveal"
          onClick={() => setNavHidden(false)}
          aria-label="Show the header"
          title="Show the header"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}
  </>);
}

// ---------------------------------------------------------------------------
// The question card's head: location pills (section/book/targeted-assessment/
// tier badges) and, on the OT flow, the report-a-problem trigger.
// ---------------------------------------------------------------------------

export function QuestionHead({
  showsLocationLabels,
  question,
  assessmentMode,
  showsBookLabel,
  showsTargetedOtLabel,
  otAssessment,
  otRequest,
  onReportRequest,
}: {
  showsLocationLabels: boolean;
  question: Question;
  assessmentMode: AssessmentMode;
  showsBookLabel: boolean;
  showsTargetedOtLabel: boolean;
  otAssessment: OtAssessmentStartRow | null;
  otRequest: OtAssessmentRequest;
  onReportRequest: () => void;
}) {
  return (<>
            <div className="question-head">
              {showsLocationLabels && (
                <div className="location-bar">
                  <span
                    className="loc-pill"
                    style={{
                      color: SECTION_COLORS[question.section] || "#0aa3a3",
                      background: (SECTION_COLORS[question.section] || "#0aa3a3") + "18",
                      borderColor: (SECTION_COLORS[question.section] || "#0aa3a3") + "30",
                    }}
                  >
                    <span
                      className="loc-dot"
                      style={{ background: SECTION_COLORS[question.section] || "#0aa3a3" }}
                    />
                    {assessmentMode === "NT" ? "New Testament" : question.section}
                  </span>
                  {showsBookLabel && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#566070", background: "rgba(27,36,66,.05)", borderColor: "rgba(27,36,66,.09)" }}>
                        {assessmentMode === "NT" ? ((question as NtPilotQuestion).book_name || question.book_code) : BOOK_NAMES[question.book_code] || question.book_code}
                      </span>
                    </>
                  )}
                  {showsTargetedOtLabel && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#087f7f", background: "rgba(10,163,163,.10)", borderColor: "rgba(10,163,163,.22)" }}>
                        {otAssessment?.label ?? otRequest.label ?? "Targeted assessment"}
                      </span>
                    </>
                  )}
                  {assessmentMode === "NT" && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#92400e", background: "#fef3c7", borderColor: "#fde68a" }}>
                        NT BLI
                      </span>
                    </>
                  )}
                  {question.importance_tier === 1 && (
                    <>
                      <span className="loc-sep">·</span>
                      <span className="loc-pill" style={{ color: "#b45309", background: "#fef3c7", borderColor: "#fde68a" }}>
                        <span className="tier-star">★</span> Tier 1
                      </span>
                    </>
                  )}
                </div>
              )}
              {assessmentMode === "OT" && (
                <button
                  className="report-trigger"
                  type="button"
                  aria-label="Report a problem with this question"
                  title="Report a problem"
                  onClick={onReportRequest}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <path d="M4 22V15" />
                  </svg>
                </button>
              )}
            </div>
  </>);
}

// ---------------------------------------------------------------------------
// The question's answer surface: section-sort drag/drop, sequence drag/drop,
// or plain multiple-choice — whichever the current question calls for.
// ---------------------------------------------------------------------------

export function QuestionInteraction({
  isSectionSortQuestion,
  sectionSortInteraction,
  sequenceSensors,
  handleSectionSortDragEnd,
  sectionSortLabelsByZone,
  phase,
  isSubmittingAnswer,
  isLoadingNextQuestion,
  sectionSortReadyToSubmit,
  submitSectionSort,
  onSpawnPoint,
  isSequenceQuestion,
  handleSequenceDragEnd,
  sequenceOrder,
  moveSequenceItem,
  submitAnswer,
  submitSequenceOrder,
  visibleChoices,
  choiceLabel,
  isQuestionInteractionLocked,
  assessmentMode,
  submitNtAnswer,
}: {
  isSectionSortQuestion: boolean;
  sectionSortInteraction: SectionSortInteraction | null;
  sequenceSensors: Parameters<typeof DndContext>[0]["sensors"];
  handleSectionSortDragEnd: (event: DragEndEvent) => void;
  sectionSortLabelsByZone: Map<SectionSortKey | "UNASSIGNED", SectionSortLabel[]>;
  phase: Phase;
  isSubmittingAnswer: boolean;
  isLoadingNextQuestion: boolean;
  sectionSortReadyToSubmit: boolean;
  submitSectionSort: (submissionMode?: "answer" | "skip") => Promise<void>;
  onSpawnPoint: (x: number, y: number) => void;
  isSequenceQuestion: boolean;
  handleSequenceDragEnd: (event: DragEndEvent) => void;
  sequenceOrder: Choice[];
  moveSequenceItem: (itemId: string, direction: -1 | 1) => void;
  submitAnswer: (choiceId: string) => Promise<void>;
  submitSequenceOrder: () => void;
  visibleChoices: Choice[];
  choiceLabel: (id: string) => string;
  isQuestionInteractionLocked: () => boolean;
  assessmentMode: AssessmentMode;
  submitNtAnswer: (choiceId: string) => Promise<void>;
}) {
  return (<>
            {isSectionSortQuestion && sectionSortInteraction ? (
              <div className="section-sort-question">
                <DndContext
                  sensors={sequenceSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionSortDragEnd}
                >
                  <div className="section-sort-bank" aria-label="Book labels">
                    {(sectionSortLabelsByZone.get("UNASSIGNED") ?? []).map(label => (
                      <SectionSortLabelChip
                        key={label.id}
                        label={label}
                        disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                      />
                    ))}
                  </div>
                  <div className="section-sort-zones">
                    {sectionSortInteraction.dropZones.map(zone => (
                      <SectionSortDropZone
                        key={zone.id}
                        zone={zone}
                        labels={sectionSortLabelsByZone.get(zone.id) ?? []}
                        disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                      />
                    ))}
                  </div>
                </DndContext>
                {phase === "question" && (
                  <div className="sequence-actions">
                    <button
                      className="sequence-skip"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion}
                      onClick={() => {
                        void submitSectionSort("skip");
                      }}
                    >
                      I don&apos;t know
                    </button>
                    <button
                      className="sequence-submit"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion || !sectionSortReadyToSubmit}
                      onClick={(event) => {
                        onSpawnPoint(event.clientX, event.clientY);
                        void submitSectionSort();
                      }}
                    >
                      Submit groups
                    </button>
                  </div>
                )}
              </div>
            ) : isSequenceQuestion ? (
              <div className="sequence-question">
                <p className="sequence-instruction">Drag the events into order, earliest first.</p>
                <DndContext
                  sensors={sequenceSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSequenceDragEnd}
                >
                  <SortableContext
                    items={sequenceOrder.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="sequence-list" aria-label="Events in chronological order">
                      {sequenceOrder.map((item, index) => (
                        <SortableSequenceItem
                          key={item.id}
                          item={item}
                          index={index}
                          disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                          isFirst={index === 0}
                          isLast={index === sequenceOrder.length - 1}
                          onMove={moveSequenceItem}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                {phase === "question" && (
                  <div className="sequence-actions">
                    <button
                      className="sequence-skip"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion}
                      onClick={() => submitAnswer(IDK_CHOICE_ID)}
                    >
                      I don&apos;t know
                    </button>
                    <button
                      className="sequence-submit"
                      type="button"
                      disabled={isSubmittingAnswer || isLoadingNextQuestion || sequenceOrder.length === 0}
                      onClick={(event) => {
                        onSpawnPoint(event.clientX, event.clientY);
                        submitSequenceOrder();
                      }}
                    >
                      Submit order
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="choices">
                {visibleChoices.map((choice, index) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`choice ${phase === "feedback" ? choiceLabel(choice.id) : ""}`}
                    onClick={(e) => {
                      if (phase !== "question" || isSubmittingAnswer || isLoadingNextQuestion || isQuestionInteractionLocked()) return;
                      onSpawnPoint(e.clientX, e.clientY);
                      if (assessmentMode === "NT") submitNtAnswer(choice.id);
                      else submitAnswer(choice.id);
                    }}
                    disabled={phase === "feedback" || isSubmittingAnswer || isLoadingNextQuestion}
                  >
                    <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                    {choice.text}
                  </button>
                ))}
              </div>
            )}
  </>);
}

// ---------------------------------------------------------------------------
// Post-answer feedback: the feedback bar + next button, an optional
// tradition note, the NT running score row, and the OT milestone banner.
// ---------------------------------------------------------------------------

export function FeedbackPanel({
  assessmentMode,
  isSkipped,
  isCorrect,
  sectionSortFeedback,
  nextQuestion,
  isLoadingNextQuestion,
  sectionSortTraditionNote,
  answeredCount,
  correctCount,
  accuracy,
  otTargetCount,
  isTargetedOtAssessment,
  isScopeOtAssessment,
  otAssessment,
  attemptId,
  transitionToDashboard,
}: {
  assessmentMode: AssessmentMode;
  isSkipped: boolean;
  isCorrect: boolean | null;
  sectionSortFeedback: { correct: number; total: number } | null;
  nextQuestion: () => Promise<void>;
  isLoadingNextQuestion: boolean;
  sectionSortTraditionNote: string;
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  otTargetCount: number;
  isTargetedOtAssessment: boolean;
  isScopeOtAssessment: boolean;
  otAssessment: OtAssessmentStartRow | null;
  attemptId: string | null;
  transitionToDashboard: () => void;
}) {
  return (
              <>
                <div className={`feedback-bar ${assessmentMode === "OT" ? "recorded" : isSkipped ? "skipped" : isCorrect ? "correct" : "wrong"}`}>
                  <span className="feedback-text">
                    {sectionSortFeedback
                      ? "Response recorded."
                      : assessmentMode === "OT"
                        ? "Answer recorded."
                        : isSkipped
                        ? "Skipped — the correct answer is highlighted."
                        : isCorrect
                          ? "Correct!"
                          : "Not quite — the correct answer is highlighted."}
                  </span>
                  {/* On the last question this button ends the run rather than
                      fetching another, so it stops saying "Next". */}
                  <button className="next-btn" type="button" onClick={nextQuestion} disabled={isLoadingNextQuestion}>
                    {isLoadingNextQuestion
                      ? "Plotting..."
                      : assessmentMode === "OT" && answeredCount === otTargetCount
                        ? "See results →"
                        : "Next →"}
                  </button>
                </div>

                {sectionSortTraditionNote && (
                  <div className="canon-note" role="note">
                    <strong>Why this placement matters</strong>
                    <span>{sectionSortTraditionNote}</span>
                  </div>
                )}

                {assessmentMode === "NT" && (
                  <div className="score-row">
                    <div className="score-item"><strong>{answeredCount}</strong>answered</div>
                    <div className="score-item"><strong>{correctCount}</strong>correct</div>
                    <div className="score-item"><strong>{accuracy}%</strong>accuracy</div>
                  </div>
                )}

                {/* The completion banner used to live here, below the
                    answers, where a phone shoved it off the bottom of the
                    screen. Ending the run now takes over the whole screen
                    instead — see OtCompleteScreen, which the See results
                    button above routes to. */}
              </>
  );
}
