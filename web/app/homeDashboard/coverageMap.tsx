"use client";

import { type Dispatch, type MouseEvent, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BOOK_NAMES, type Testament as BibleTestament } from "@/lib/bibleTaxonomy";
import { focusedRecommendationSectionKey } from "@/lib/coverageLegend";
import { compactReference, passageReference, readableUnitLabel, rereadHref, type ExploreTree, type FocusPath } from "@/lib/focusPath";
import type { RecommendationInteractionSurface } from "@/lib/recommendationEvents";
import CoverageGrid, { CoverageLegend, focusRecommendationState, type CoverageGridView } from "../knowledge-map/CoverageGrid";
import { dimensionDisplayName } from "../homeHelpers";
import type { BackendRecommendation, ProgressPoint, RecommendedStudy, ScopeDetailTarget } from "../homeTypes";

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
  isRecommendationEvidenceBlocked,
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
  isRecommendationEvidenceBlocked: boolean;
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
  const recommendationSectionKey = activeCoverageMapMode === "recommended"
    ? focusedRecommendationSectionKey(coverageTree)
    : null;
  const showCoverageLegend = activeCoverageMapMode === "overview" || Boolean(recommendationSectionKey);
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
                      disabled: !hasReadingRecommendation && !isRecommendationEvidenceBlocked,
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
            {showCoverageLegend && (
              <div className="coverage-legend-rail">
                <CoverageLegend
                  focusState={focusRecommendationState(coverageTree)}
                  testament={suiteTestament}
                  view={activeCoverageMapMode}
                  focusSectionKey={recommendationSectionKey}
                />
              </div>
            )}
            <div className="coverage-map-card">
            {suiteTestament === "OT" && activeCoverageMapMode === "recommended" && isRecommendationEvidenceBlocked && (
              <section className="coverage-focus-card is-skill" aria-label="Recommendations need more evidence">
                <div>
                  <p className="coverage-focus-eyebrow">Before recommendations</p>
                  <h3 className="coverage-focus-title">{recommendedStudy.label}</h3>
                  <p className="coverage-focus-meta">{recommendedStudy.books}</p>
                </div>
                <div className="coverage-focus-actions">
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
            {suiteTestament === "OT" && activeCoverageMapMode === "recommended" && !isRecommendationEvidenceBlocked && frontier.focusLeaf && (
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
                  {recommendedStudy.focus && (
                    <p className="coverage-focus-copy">{recommendedStudy.focus}</p>
                  )}
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
                  {recommendedStudy.priority && (
                    <p className="coverage-focus-priority">{recommendedStudy.priority}</p>
                  )}
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
                          label: recommendedStudy.label,
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
                  && !isRecommendationEvidenceBlocked
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
