"use client";

import { useMemo, type CSSProperties } from "react";
import { BOOK_CHAPTER_COUNT, type Testament } from "@/lib/bibleTaxonomy";
import {
  SECTION_ORDER_BY_TESTAMENT,
  STATE_LABELS,
  bookPassage,
  leafTone,
  readableUnitLabel,
  sectionHue,
  type ExploreBook,
  type ExploreSection,
  type ExploreTree,
  type ExploreUnit,
  type FocusState,
} from "@/lib/focusPath";
import { sectionEvidence } from "@/lib/bliEvidence";
import { COVERAGE_GRID_STYLES_1, COVERAGE_GRID_STYLES_2 } from "./coverageGridStyles";

const SECTION_ORDER = ["TORAH", "FORMER", "LATTER", "WRITINGS", "GOSPELS_ACTS", "PAULINE", "GENERAL", "APOCALYPSE"];

function sectionRank(section: ExploreSection) {
  const key = section.sectionKey.toUpperCase();
  const name = section.sectionName.toLowerCase();
  if (key.includes("TORAH") || name.includes("torah")) return 0;
  if (key.includes("FORMER") || name.includes("former")) return 1;
  if (key.includes("LATTER") || name.includes("latter")) return 2;
  if (key.includes("WRIT") || name.includes("writ")) return 3;
  if (key.includes("GOSPELS") || name.includes("gospels")) return 4;
  if (key.includes("PAULINE") || name.includes("pauline")) return 5;
  if (key.includes("GENERAL") || name.includes("general")) return 6;
  if (key.includes("APOCALYPSE") || name.includes("apocalypse") || name.includes("revelation")) return 7;
  return SECTION_ORDER.length;
}

function sectionHueFor(section: ExploreSection) {
  return sectionHue({ node_key: section.sectionKey, label: section.sectionName });
}

function unitRef(book: ExploreBook, unit: ExploreUnit) {
  return bookPassage(book.bookName, unit.startCh, unit.endCh);
}

function unitShortRef(unit: ExploreUnit) {
  if (unit.startCh === null) return "";
  if (unit.endCh === null || unit.endCh === unit.startCh) return String(unit.startCh);
  return `${unit.startCh}-${unit.endCh}`;
}

type ChapterGroup = {
  unit: ExploreUnit;
  chapters: number[];
};

export type CoverageGridView = "overview" | "recommended" | "skill";

function chapterGroupsForBook(book: ExploreBook): ChapterGroup[] {
  const chapterCount = BOOK_CHAPTER_COUNT[book.bookCode];
  return book.units.map((unit) => {
    if (!chapterCount || unit.startCh === null) {
      return { unit, chapters: [] };
    }
    const start = Math.max(1, unit.startCh);
    const end = Math.min(chapterCount, unit.endCh ?? unit.startCh);
    return {
      unit,
      chapters: Array.from({ length: Math.max(1, end - start + 1) }, (_, index) => start + index),
    };
  });
}

function chapterCountForTree(sections: ExploreSection[]) {
  return sections.reduce((sum, section) => (
    sum + section.books.reduce((bookSum, book) => bookSum + (BOOK_CHAPTER_COUNT[book.bookCode] ?? book.units.length), 0)
  ), 0);
}

function chapterStateCounts(sections: ExploreSection[]) {
  const totals: Record<FocusState, number> = {
    sufficient: 0,
    below_baseline: 0,
    insufficient_evidence: 0,
  };
  sections.forEach((section) => {
    section.books.forEach((book) => {
      chapterGroupsForBook(book).forEach(({ unit, chapters }) => {
        totals[unit.state] += chapters.length || 1;
      });
    });
  });
  return totals;
}

function evidenceLabel(answered: number) {
  const evidence = sectionEvidence(answered);
  if (evidence.status === "untested") return "Needs answers";
  if (evidence.status === "provisional") return "Early read";
  if (evidence.status === "developing") return "Getting clearer";
  return "Reliable sample";
}

function boxClass(unit: ExploreUnit, isFocusChapter: boolean) {
  const evidence = sectionEvidence(unit.answered);
  return [
    "cov-box",
    `is-${unit.state.replace("_", "-")}`,
    `evidence-${evidence.confidence}`,
    unit.isFocus ? "is-focus" : "",
    isFocusChapter ? "is-focus-chapter" : "",
  ].filter(Boolean).join(" ");
}

export type FocusChapterRange = { bookCode: string; startCh: number; endCh: number };

export default function CoverageGrid({
  tree,
  testament = "OT",
  view = "overview",
  showSummary = true,
  onFocusView,
  focusChapterRange = null,
}: {
  tree: ExploreTree;
  testament?: Testament;
  view?: CoverageGridView;
  showSummary?: boolean;
  onFocusView?: (target: { sectionKey: string; bookCode?: string }) => void;
  /** The exact chapters the current "Recommended reading" card points at —
   *  narrower than the gold-ringed learning unit it lives inside (e.g. the
   *  unit might be Genesis 12-50, but the card is pointing at 20-22 within
   *  it). When set, those specific chapter boxes get an extra highlight on
   *  top of the unit's own is-focus ring, so the eye lands on exactly the
   *  chapters being recommended rather than the whole surrounding range. */
  focusChapterRange?: FocusChapterRange | null;
}) {
  const sections = useMemo(
    () => [...tree.sections].sort((a, b) => {
      const rankDelta = sectionRank(a) - sectionRank(b);
      if (rankDelta !== 0) return rankDelta;
      return a.order - b.order;
    }),
    [tree.sections],
  );

  const units = sections.flatMap((section) => section.books.flatMap((book) => book.units));
  const chapterTotals = chapterStateCounts(sections);
  const chapterCount = chapterCountForTree(sections);
  const sufficient = chapterTotals.sufficient;
  const below = chapterTotals.below_baseline;
  const thin = chapterTotals.insufficient_evidence;
  const hasRecommendation = units.some((unit) => unit.isFocus);
  const focusedView = view !== "overview" && hasRecommendation;
  const visibleSections = useMemo(() => {
    if (!focusedView) return sections;
    return sections
      .map((section) => ({
        ...section,
        books: section.books.filter((book) => book.units.some((unit) => unit.isFocus)),
      }))
      .filter((section) => section.books.length > 0);
  }, [focusedView, sections]);
  const testamentName = testament === "NT" ? "New Testament" : "Old Testament";
  const shortName = testament === "NT" ? "NT" : "OT";

  return (
    <div className={`cov ${focusedView ? "is-focused" : ""}`}>
      <style>{COVERAGE_GRID_STYLES_1}</style>

      {showSummary && (
        <section className="cov-summary" aria-labelledby="coverage-title">
          <div>
            <p className="cov-kicker">{focusedView ? "Focus" : "Coverage overview"}</p>
            <h2 id="coverage-title" className="cov-title">{focusedView ? "Current range" : `Every ${shortName} chapter`}</h2>
            <p className="cov-copy">
              {focusedView
                ? `Pulled forward from the full ${testamentName} map.`
                : `A course-style grid of the whole ${testamentName} ladder. Each box is a chapter; thin outlines show the larger learning ranges underneath it.`}
            </p>
          </div>
          <div className="cov-stats" aria-label="Coverage totals">
            <div className="cov-stat"><strong>{chapterCount}</strong><span>Chapters</span></div>
            <div className="cov-stat"><strong>{sufficient}</strong><span>Sufficient</span></div>
            <div className="cov-stat"><strong>{below}</strong><span>Below</span></div>
            <div className="cov-stat"><strong>{thin}</strong><span>Thin evidence</span></div>
          </div>
        </section>
      )}

      {sections.length === 0 ? (
        <div className="cov-empty">Take an assessment to begin filling in the coverage grid.</div>
      ) : <div className="cov-board">
      {visibleSections.map((section) => {
        const hue = sectionHueFor(section);
        const sectionUnits = section.books.flatMap((book) => book.units);
        const sectionGroups = section.books.flatMap((book) => chapterGroupsForBook(book));
        const sectionChapterCount = sectionGroups.reduce((sum, group) => sum + (group.chapters.length || 1), 0);
        const sectionSufficient = sectionGroups.reduce((sum, group) => (
          sum + (group.unit.state === "sufficient" ? group.chapters.length || 1 : 0)
        ), 0);
        const sectionAnswered = sectionUnits.reduce((sum, unit) => sum + unit.answered, 0);
        return (
          <section key={section.sectionKey} className="cov-section" style={{ "--hue": hue } as CSSProperties}>
            <header className="cov-section-head">
              <div>
                <h3 className="cov-section-name">{section.sectionName}</h3>
                <p className="cov-section-meta">{section.books.length} books · {sectionChapterCount} chapters · {sectionUnits.length} learning ranges · {sectionAnswered} answers here</p>
              </div>
              <div className="cov-section-score">{sectionSufficient}/{sectionChapterCount} sufficient</div>
            </header>
            {section.books.map((book) => {
              const tone = leafTone(book.state, hue);
              const bookEvidence = sectionEvidence(book.answered);
              const isUpNext = book.units.some((unit) => unit.isFocus);
              const chapterGroups = chapterGroupsForBook(book);
              const bookChapterCount = chapterGroups.reduce((sum, group) => sum + (group.chapters.length || 1), 0);
              return (
                <div key={book.bookCode} className={`cov-book-row ${isUpNext ? "is-up-next" : ""}`}>
                  <div
                    className="cov-book-main"
                    style={{
                      "--book-dot": tone.rail,
                      "--book-opacity": bookEvidence.confidence === "none" ? ".5" : bookEvidence.confidence === "low" ? ".72" : bookEvidence.confidence === "moderate" ? ".88" : "1",
                    } as CSSProperties}
                  >
                    <span className="cov-book-dot" aria-hidden="true" />
                    <div>
                      <h4 className="cov-book-name">{book.bookName}</h4>
                      <div className="cov-book-meta">{STATE_LABELS[book.state]} · {book.answered} answered · {bookChapterCount} chapters</div>
                    </div>
                  </div>
                  <div className="cov-boxes">
                    {chapterGroups.map(({ unit, chapters }) => {
                      const unitTone = leafTone(unit.state, hue);
                      const reference = unitRef(book, unit);
                      const chapterList = chapters.length > 0 ? chapters : [null];
                      const isSingle = chapterList.length === 1;
                      return (
                        <span
                          key={unit.unitKey}
                          className={`cov-unit-group ${isSingle ? "is-single" : ""} ${unit.isFocus ? "is-focus" : ""}`}
                          style={{ "--fill": unitTone.fill, "--rail": unitTone.rail } as CSSProperties}
                          title={`${reference}: ${readableUnitLabel(unit.label)}. ${STATE_LABELS[unit.state]}, ${unit.answered} answered, ${evidenceLabel(unit.answered)}.`}
                        >
                          {chapterList.map((chapter) => {
                            const chapterRef = chapter === null ? reference : bookPassage(book.bookName, chapter, chapter);
                            const isFocusChapter = Boolean(
                              focusChapterRange
                              && chapter !== null
                              && book.bookCode === focusChapterRange.bookCode
                              && chapter >= focusChapterRange.startCh
                              && chapter <= focusChapterRange.endCh,
                            );
                            return (
                              <button
                                key={`${unit.unitKey}-${chapter ?? "unit"}`}
                                type="button"
                                className={boxClass(unit, isFocusChapter)}
                                title={`${chapterRef}: ${readableUnitLabel(unit.label)}. ${STATE_LABELS[unit.state]}, ${unit.answered} answered, ${evidenceLabel(unit.answered)}.${isFocusChapter ? " This is the recommended reading right now." : ""}`}
                                aria-label={`${chapterRef}. ${readableUnitLabel(unit.label)}. ${STATE_LABELS[unit.state]}. ${unit.answered} answered. ${evidenceLabel(unit.answered)}.${isFocusChapter ? " Recommended reading right now." : unit.isFocus ? " Recommended." : ""}`}
                                style={{ "--fill": unitTone.fill, "--rail": unitTone.rail } as CSSProperties}
                                disabled={!onFocusView}
                                onClick={onFocusView ? () => onFocusView({ sectionKey: section.sectionKey, bookCode: book.bookCode }) : undefined}
                              >
                                <span className="cov-box-ref">{chapter ?? (unitShortRef(unit) || book.bookName)}</span>
                                <span className="cov-box-title">{readableUnitLabel(unit.label)}</span>
                                <span className="cov-box-score">{unit.displayScore ?? "--"} BLI</span>
                              </button>
                            );
                          })}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
        {!focusedView && (
          <div className="cov-challenge">
            <p className="cov-challenge-title">{hasRecommendation ? "Coverage challenge" : "Start filling the map"}</p>
            <p className="cov-challenge-copy">
              {hasRecommendation
                ? "Use the blank or faint boxes to choose focused retests. The highlighted box is the section OBA recommends next."
                : "Take an assessment to turn these blank chapter-section boxes into measured coverage."}
            </p>
          </div>
        )}
      </div>}
    </div>
  );
}

/** Whether any unit anywhere in the tree is the router's current pick — the
 *  same check CoverageGrid does internally, exposed standalone so
 *  CoverageLegend can be rendered apart from the grid (see app/page.tsx,
 *  where it floats outside the coverage-map-card into the page margin). */
export function hasFocusRecommendation(tree: ExploreTree): boolean {
  return tree.sections.some((section) => (
    section.books.some((book) => book.units.some((unit) => unit.isFocus))
  ));
}

const LEGEND_STATES: FocusState[] = ["sufficient", "below_baseline", "insufficient_evidence"];

/**
 * Legend-only tone, deliberately NOT leafTone. leafTone's fill goes from a
 * 20%-hue mix (sufficient) to a 12%-hue mix (below baseline) — an 8-point
 * difference that's meant to read alongside a much bigger, thicker-bordered
 * 27px grid box. Shrunk down to a 20px legend swatch, "20% vs 12% white"
 * is close enough to invisible — the whole point of the legend (distinct
 * shading per row) was getting lost. This spreads the same three states
 * across a much wider, unmistakable range instead: solid hue, a 50/50
 * blend, then empty.
 */
function legendTone(state: FocusState, hue: string): { fill: string; rail: string } {
  if (state === "sufficient") return { fill: hue, rail: hue };
  if (state === "below_baseline") return { fill: `color-mix(in srgb, ${hue} 50%, #ffffff)`, rail: hue };
  return { fill: "#ffffff", rail: `color-mix(in srgb, ${hue} 55%, #ffffff)` };
}

/**
 * The coverage legend, split out from CoverageGrid so it can render outside
 * the white coverage-map-card entirely (see .coverage-legend-rail in
 * app/page.tsx). No box of its own by design — it's meant to sit directly on
 * whatever backdrop the caller provides, so colors here are tuned for the
 * dashboard's dark starfield rather than a white card interior. If this
 * component ever needs to render inside a light background, it'll need a
 * variant rather than a shared default.
 *
 * A real section × evidence-level matrix: one letter column per section
 * (x-axis) and one row per completion level (y-axis), each box colored via
 * sectionHue/leafTone — the exact same functions the grid itself uses, so
 * this can't drift out of sync with what the boxes actually look like.
 * Column headers still pop a tooltip with the full section name on hover.
 */
export function CoverageLegend({
  hasRecommendation,
  testament,
  view = "overview",
  focusSectionKey = null,
}: {
  hasRecommendation: boolean;
  testament: Testament;
  view?: CoverageGridView;
  focusSectionKey?: string | null;
}) {
  const sections = SECTION_ORDER_BY_TESTAMENT[testament];
  const visibleSections = view === "overview"
    ? sections
    : view === "recommended" && focusSectionKey
      ? sections.filter((section) => section.key === focusSectionKey.toUpperCase())
      : [];

  if (visibleSections.length === 0) return null;

  const cells = LEGEND_STATES.flatMap((state) => [
    <div key={`${state}-label`} className="cov-legend-row-head">{STATE_LABELS[state]}</div>,
    ...visibleSections.map((section) => {
      const hue = sectionHue({ node_key: section.key, label: section.label });
      const tone = legendTone(state, hue);
      return (
        <div key={`${state}-${section.key}`} className="cov-legend-cell">
          <span
            className={`cov-legend-swatch ${state === "insufficient_evidence" ? "is-empty" : ""}`}
            style={{ "--fill": tone.fill, "--rail": tone.rail } as CSSProperties}
            title={`${section.label}: ${STATE_LABELS[state]}`}
          />
        </div>
      );
    }),
  ]);

  return (
    <div className="cov-legend" aria-label="Coverage legend">
      <style>{COVERAGE_GRID_STYLES_2}</style>
      <div
        className="cov-legend-grid"
        role="img"
        aria-label="Coverage color by section and completion level"
        style={{ gridTemplateColumns: `74px repeat(${visibleSections.length}, 28px)` }}
      >
        <div className="cov-legend-corner" aria-hidden="true" />
        {visibleSections.map((section) => (
          <button
            key={section.key}
            type="button"
            className="cov-legend-col-head"
            style={{ "--hue": sectionHue({ node_key: section.key, label: section.label }) } as CSSProperties}
            aria-label={section.label}
          >
            {section.letter}
            <span className="cov-legend-col-head-tip" aria-hidden="true">{section.label}</span>
          </button>
        ))}
        {cells}
      </div>
      {hasRecommendation && <span className="cov-legend-item is-gold">Gold ring = recommended</span>}
    </div>
  );
}
