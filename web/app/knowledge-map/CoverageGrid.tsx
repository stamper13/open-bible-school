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
      <style>{`
        .cov {
          color: #242936;
        }
        .cov-summary {
          display: grid; grid-template-columns: minmax(0,1fr) auto;
          gap: 20px; align-items: start;
          margin-bottom: 14px; padding: 22px 24px;
          border: 1px solid rgba(226,232,240,.95); border-radius: 10px;
          background: rgba(255,255,255,.97);
          box-shadow: 0 18px 42px rgba(0,0,0,.18);
        }
        .cov-kicker {
          margin: 0 0 6px; color: #0a6e6e;
          font-size: 10px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase;
        }
        .cov-title {
          margin: 0; color: #252936;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(28px, 4vw, 40px); line-height: 1;
        }
        .cov-copy {
          max-width: 720px; margin: 9px 0 0;
          color: #4f5d72; font-size: 13px; line-height: 1.55;
        }
        .cov-stats {
          display: grid; grid-template-columns: repeat(4, minmax(68px, 1fr)); gap: 8px;
          min-width: min(420px, 100%);
        }
        .cov-stat {
          min-height: 64px; padding: 10px 12px; border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .cov-stat strong {
          display: block; color: #252936;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; line-height: 1;
        }
        .cov-stat span {
          display: block; margin-top: 6px;
          color: #64748b;
          font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
        }
        /* .cov-board renders as part of the caller's own card (currently
           the dashboard's coverage-map-card) rather than carrying its own
           background/border/shadow — see CoverageLegend below, which has
           moved out of this card entirely. */
        .cov-board {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px 20px;
          padding: 18px;
        }
        .cov.is-focused .cov-board {
          grid-template-columns: 1fr;
        }
        .cov-section {
          overflow: hidden;
          border: 0;
          border-radius: 0;
          background: transparent;
        }
        .cov-section-head {
          display: flex; justify-content: space-between; gap: 14px; align-items: end;
          padding: 0 0 10px;
          border-bottom: 1px solid #d7dee8;
          background: transparent;
        }
        .cov-section-name {
          margin: 0; color: #202534;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 23px; line-height: 1;
        }
        .cov-section-meta {
          margin: 5px 0 0; color: #64748b;
          font-size: 11px; font-weight: 800;
        }
        .cov-section-score {
          color: #4b5563; font-size: 12px; font-weight: 850;
          white-space: nowrap;
        }
        .cov-book-row {
          display: grid; grid-template-columns: minmax(118px, 148px) minmax(0,1fr);
          gap: 12px; align-items: center;
          min-height: 42px; padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .cov-book-row:last-child { border-bottom: 0; }
        .cov-book-row.is-up-next {
          margin: 0 -10px; padding-inline: 10px;
          background: #fff;
          border-radius: 8px;
          box-shadow: inset 3px 0 0 #ffcf5c;
        }
        .cov-book-main {
          min-width: 0; display: flex; align-items: flex-start; gap: 8px;
        }
        .cov-book-dot {
          width: 10px; height: 10px; margin-top: 4px; border-radius: 999px;
          background: var(--book-dot); opacity: var(--book-opacity);
          flex: 0 0 auto;
        }
        .cov-book-name {
          margin: 0; color: #202534; font-size: 13px; font-weight: 900; line-height: 1.2;
        }
        .cov-book-meta {
          margin-top: 3px; color: #64748b;
          font-size: 10px; font-weight: 750; line-height: 1.25;
        }
        .cov-boxes {
          display: flex; align-items: center; flex-wrap: wrap;
          gap: 7px 9px;
        }
        .cov-unit-group {
          display: inline-flex; align-items: center; flex-wrap: wrap;
          gap: 5px; padding: 8px; border-radius: 9px;
          border: 1.5px solid color-mix(in srgb, var(--rail) 55%, #64748b);
          background: color-mix(in srgb, var(--fill) 36%, transparent);
        }
        .cov-unit-group.is-single {
          padding: 0; border-color: transparent; background: transparent;
        }
        .cov-unit-group.is-focus {
          border-color: #ffcf5c;
          box-shadow: 0 0 0 2px rgba(255,207,92,.14);
        }
        .cov-box {
          appearance: none; position: relative; flex: 0 0 auto;
          width: 27px; height: 27px; min-height: 0; padding: 0;
          display: grid; place-items: center;
          border-radius: 5px; border: 1.5px solid var(--rail);
          background: var(--fill); color: #17213d;
          cursor: pointer; font: inherit; text-align: center;
          transition: transform .14s ease, border-color .14s ease, background .14s ease, box-shadow .14s ease;
        }
        .cov-box:hover,
        .cov-box:focus-visible {
          transform: translateY(-2px);
          border-color: #fff;
          box-shadow: 0 10px 22px rgba(0,0,0,.28), 0 0 18px color-mix(in srgb, var(--rail) 32%, transparent);
          outline: none;
        }
        .cov-box:disabled {
          cursor: default;
        }
        .cov-box:disabled:hover,
        .cov-box:disabled:focus-visible {
          transform: none;
          border-color: var(--rail);
          box-shadow: none;
        }
        .cov-box.is-insufficient-evidence {
          border-style: solid; border-color: #94a3b8; background: #fff; color: #64748b;
        }
        .cov-box.evidence-none { opacity: .58; }
        .cov-box.evidence-low { opacity: .72; }
        .cov-box.evidence-moderate { opacity: .88; }
        .cov-box.evidence-high { opacity: 1; }
        .cov-box.is-focus::after {
          content: ""; position: absolute; inset: -4px; border-radius: 8px;
          border: 2px solid #ffcf5c; pointer-events: none;
          box-shadow: 0 0 0 2px rgba(255,207,92,.16);
        }
        /* Every chapter in a gold-ringed unit gets that same ::after ring
           (is-focus is set per-unit, not per-chapter) — so within a wide
           unit like Genesis 12-50, nothing marks which chapters the current
           "Recommended reading" card is actually pointing at. A pure
           motion-only cue (no fill) turned out too easy to miss, so this
           now DOES override background/border with a color, but one no
           section owns: orange sits in the one real gap in the section
           palette (gold/green/blue/magenta/teal/indigo/purple/rose — see
           SECTION_HUES in lib/focusPath.ts), so it can't be mistaken for
           any section's own "sufficient" look the way the original gold
           fill could for Torah. The rotating sparkle ring from before sits
           on its own slightly wider orbit (-7px vs is-focus's -4px) so the
           two rings read as concentric halos instead of overlapping. */
        .cov-box.is-focus-chapter {
          background: #fed7aa; border-color: #f97316; color: #7c2d12;
          box-shadow: 0 0 10px 1px rgba(249,115,22,.5);
          z-index: 3;
        }
        .cov-box.is-focus-chapter::before {
          content: ""; position: absolute; inset: -7px; border-radius: 9px;
          padding: 2px; pointer-events: none; z-index: 4;
          background: conic-gradient(from 0deg,
            transparent 0deg, rgba(255,255,255,.95) 10deg, transparent 24deg,
            transparent 96deg, rgba(255,255,255,.95) 106deg, transparent 120deg,
            transparent 192deg, rgba(255,255,255,.95) 202deg, transparent 216deg,
            transparent 288deg, rgba(255,255,255,.95) 298deg, transparent 312deg,
            transparent 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          animation: covFocusChapterSpin 2.4s linear infinite, covFocusChapterTwinkle 1s ease-in-out infinite alternate;
        }
        @keyframes covFocusChapterSpin { to { transform: rotate(360deg); } }
        @keyframes covFocusChapterTwinkle { from { opacity: .5; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .cov-box.is-focus-chapter::before { animation: none; opacity: .85; }
        }
        .cov-box-ref {
          display: block; max-width: 23px; overflow: hidden; text-overflow: ellipsis;
          color: currentColor;
          font-size: 8px; font-weight: 950; line-height: 1;
          white-space: nowrap;
        }
        .cov-box-title {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        .cov-box-score {
          position: absolute; width: 1px; height: 1px; overflow: hidden;
          clip: rect(0 0 0 0); white-space: nowrap;
        }
        .cov-empty {
          padding: 28px; text-align: center;
          border: 1px solid #e2e8f0; border-radius: 10px;
          background: rgba(255,255,255,.97); color: #64748b;
        }
        .cov-challenge {
          grid-column: 2;
          min-height: 74px; padding: 14px 16px; border-radius: 8px;
          border: 1px solid #d7dee8;
          background: #fff;
        }
        .cov.is-focused .cov-challenge { display: none; }
        .cov-challenge-title {
          margin: 0 0 5px; color: #202534; font-size: 12px; font-weight: 900; letter-spacing: .02em;
        }
        .cov-challenge-copy { margin: 0; color: #64748b; font-size: 12px; line-height: 1.45; }
        @media (max-width: 900px) {
          .cov-summary { grid-template-columns: 1fr; }
          .cov-stats { min-width: 0; }
          .cov-board { grid-template-columns: 1fr; }
          .cov-book-row { grid-template-columns: minmax(112px, 150px) minmax(0,1fr); }
          .cov-challenge { grid-column: auto; }
        }
        @media (max-width: 560px) {
          .cov-stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .cov-section-head { align-items: start; flex-direction: column; }
          .cov-board { padding: 13px; }
          .cov-book-row { grid-template-columns: 1fr; gap: 7px; }
        }
      `}</style>

      {showSummary && (
        <section className="cov-summary" aria-labelledby="coverage-title">
          <div>
            <p className="cov-kicker">{focusedView ? "Focused coverage" : "Coverage overview"}</p>
            <h2 id="coverage-title" className="cov-title">{focusedView ? "Recommended range" : `Every ${shortName} chapter`}</h2>
            <p className="cov-copy">
              {focusedView
                ? `The recommended ${testamentName} range is pulled forward here; Overview restores it to the full map.`
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
export function CoverageLegend({ hasRecommendation, testament }: { hasRecommendation: boolean; testament: Testament }) {
  const sections = SECTION_ORDER_BY_TESTAMENT[testament];
  const cells = LEGEND_STATES.flatMap((state) => [
    <div key={`${state}-label`} className="cov-legend-row-head">{STATE_LABELS[state]}</div>,
    ...sections.map((section) => {
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
      <style>{`
        .cov-legend { display: flex; flex-direction: column; gap: 10px; }
        .cov-legend-grid {
          display: grid; grid-template-columns: 74px repeat(4, 1fr);
          gap: 6px 7px; align-items: center;
        }
        .cov-legend-corner { width: 100%; height: 100%; }
        .cov-legend-col-head {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          height: 22px; border-radius: 6px;
          font-size: 11px; font-weight: 900;
          color: var(--hue); background: color-mix(in srgb, var(--hue) 16%, transparent);
          border: 1.5px solid var(--hue);
        }
        .cov-legend-col-head-tip {
          position: absolute; bottom: calc(100% + 9px); left: 50%;
          transform: translate(-50%, 4px);
          padding: 5px 10px; border-radius: 7px; white-space: nowrap;
          background: rgba(14,18,38,.98); border: 1px solid rgba(255,255,255,.16);
          color: #fff; font-size: 11px; font-weight: 750;
          opacity: 0; visibility: hidden; pointer-events: none; z-index: 20;
          transition: opacity .12s ease, transform .12s ease, visibility .12s ease;
        }
        .cov-legend-col-head-tip::after {
          content: ""; position: absolute; top: 100%; left: 50%;
          width: 8px; height: 8px; transform: translate(-50%, -50%) rotate(45deg);
          background: rgba(14,18,38,.98);
          border-right: 1px solid rgba(255,255,255,.16); border-bottom: 1px solid rgba(255,255,255,.16);
        }
        .cov-legend-col-head:hover .cov-legend-col-head-tip,
        .cov-legend-col-head:focus-visible .cov-legend-col-head-tip {
          opacity: 1; visibility: visible; transform: translate(-50%, 0);
        }
        .cov-legend-row-head {
          font-size: 10.5px; font-weight: 800; color: rgba(255,255,255,.68);
          line-height: 1.2;
        }
        .cov-legend-cell { display: flex; justify-content: center; }
        .cov-legend-swatch {
          width: 20px; height: 20px; border-radius: 5px;
          background: var(--fill); border: 2px solid var(--rail);
        }
        .cov-legend-swatch.is-empty { background: var(--fill, #fff); }
        .cov-legend-item {
          display: inline-flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,.74); font-size: 12px; font-weight: 800;
        }
        .cov-legend-item.is-gold { color: #f0c674; }
      `}</style>
      <div className="cov-legend-grid" role="img" aria-label="Coverage color by section and completion level">
        <div className="cov-legend-corner" aria-hidden="true" />
        {sections.map((section) => (
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
