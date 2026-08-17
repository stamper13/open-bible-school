"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  STATE_LABELS,
  bookPassage,
  focusNodeDomId,
  readableUnitLabel,
  sectionHue,
  starTone,
  type ExploreBook,
  type ExploreSection,
  type ExploreTree,
  type ExploreUnit,
  type FocusState,
} from "@/lib/focusPath";
import { sectionEvidence } from "@/lib/bliEvidence";
import { GALAXY_ERAS, SECTION_CHRONO, bookChrono, formatYear, yearToPos } from "./chronology";
import { MAP_OVERVIEW_STYLES } from "./mapOverviewStyles";

/**
 * The whole Old Testament on one chart: every section, book, and chapter
 * section at once, positioned by two axes that both carry real meaning —
 * chronology running down the Y axis (the rail on the left), and dependency
 * depth running across the X axis as four lanes (Torah first, since nothing
 * else in the Old Testament assumes anything prior to it; Writings last,
 * since it draws on both the Torah and the historical books before it).
 *
 * Writings has no single place in time — Job may be patriarchal, Psalms and
 * Proverbs are mostly monarchy-era, Ezra/Nehemiah/Esther are post-exilic —
 * so rather than force it to one spot, its books simply sit at their own
 * real (approximate) dates within their lane, same rail as everything else.
 * The result reads as its own answer to "when is Writings": everywhere.
 *
 * Colour is the same `starTone` used everywhere else in the app: each section
 * keeps its own hue family, while competency changes opacity and strength.
 * Dependency arrows connect the four section hubs — the only level the data
 * actually models a dependency relationship at; books and chapter sections
 * are tied to their own hub with a plain tether line, not a claimed
 * prerequisite.
 */

const VIEW_W = 1180;
const VIEW_H = 1580;
const PAD_T = 56;
const PAD_B = 50;
const RAIL_LABEL_X = 76;
const RAIL_LINE_X = 100;
const FIELD_L = 118;
const FIELD_R = 1140;

const LANE_ORDER = ["TORAH", "FORMER", "LATTER", "WRITINGS"] as const;
type LaneKey = (typeof LANE_ORDER)[number];
const LANE_COUNT = LANE_ORDER.length;
const LANE_WIDTH = (FIELD_R - FIELD_L) / LANE_COUNT;
const laneCenterX = (i: number) => FIELD_L + LANE_WIDTH * (i + 0.5);
const SUB_COL_OFFSET = 30;
const BOOK_MIN_GAP = 32;

const posToY = (pos: number) => PAD_T + 118 + pos * (VIEW_H - PAD_T - 118 - PAD_B);
const yForYear = (year: number) => posToY(yearToPos(year));

const HUB_R = 34;
const BOOK_R = 11;
const UNIT_R = 3;
// Hubs sit in a fixed row well clear of the field's chronological range —
// not at their own section's chronological anchor. A section's anchor tends
// to fall right in the middle of its own books (Torah's is 1900 BC, and its
// own books cluster 2100-1406 BC), so placing the hub *at* that year put it
// on top of the very books it summarizes. Pinning it to a dedicated header
// row keeps chronology accurate for books — the finer-grained, more useful
// data — while giving the hub room to breathe.
const HUB_Y = PAD_T + 52;

type PlacedBook = {
  book: ExploreBook;
  x: number;
  y: number;
  labelVisible: boolean;
  tone: ReturnType<typeof starTone>;
};
type PlacedHub = {
  section: ExploreSection;
  x: number;
  y: number;
  hue: string;
  tone: ReturnType<typeof starTone>;
};

type AtlasFilter = "all" | "needs_work" | "below_baseline" | "insufficient_evidence" | "sufficient" | "recommended";
const FILTERS: Array<{ key: AtlasFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "needs_work", label: "Needs work" },
  { key: "below_baseline", label: "Below baseline" },
  { key: "insufficient_evidence", label: "Not enough evidence" },
  { key: "sufficient", label: "Sufficient" },
  { key: "recommended", label: "Recommended path" },
];

/** How close two books' labels can sit (in Y) before the later one's text
 *  gets suppressed to hover-only. Bigger than BOOK_MIN_GAP because this is
 *  about the *text* running into a neighbour, not just the circles — and
 *  labels from any sub-column land in roughly the same rightward strip,
 *  so this check is global across the lane, not per-column. */
const LABEL_MIN_GAP = 20;

/** Greedy multi-column layout: each book goes in whichever sub-column has
 *  the most vertical clearance from its last entry, then gets nudged down
 *  if it would still land closer than BOOK_MIN_GAP to that column's
 *  previous book. Order (chronological) is preserved within each column;
 *  only crowding is fixed. Dense lanes (Latter Prophets' seventeen books,
 *  mainly) get a third column — two columns' worth of vertical push-down
 *  was still landing books on top of each other's labels in that stretch.
 *  A second pass then decides which labels can stay on screen by default —
 *  the ones too close to the last visible label fall back to hover/focus
 *  instead of just disappearing. */
function layoutLane(books: ExploreBook[], centerX: number): Array<{ book: ExploreBook; x: number; y: number; labelVisible: boolean }> {
  // Descending by anchor year: these are BC years, so the *larger* number is
  // *earlier* — descending order is chronological (and therefore top-to-
  // bottom on screen), which the greedy push-down below depends on.
  const sorted = [...books].sort((a, b) => bookChrono(b.bookCode).anchor - bookChrono(a.bookCode).anchor);
  const colCount = books.length > 10 ? 3 : 2;
  const cols = Array.from({ length: colCount }, (_, i) => ({
    x: centerX + (i - (colCount - 1) / 2) * SUB_COL_OFFSET,
    lastY: -Infinity,
  }));
  const placed = sorted.map((book) => {
    const naturalY = yForYear(bookChrono(book.bookCode).anchor);
    const col = cols.reduce((best, c) => (c.lastY < best.lastY ? c : best));
    const y = Math.max(naturalY, col.lastY + BOOK_MIN_GAP);
    col.lastY = y;
    return { book, x: col.x, y };
  });

  let lastLabelY = -Infinity;
  return placed.map((p) => {
    const labelVisible = p.y - lastLabelY >= LABEL_MIN_GAP;
    if (labelVisible) lastLabelY = p.y;
    return { ...p, labelVisible };
  });
}

function sectionHueFor(s: ExploreSection) {
  return sectionHue({ node_key: s.sectionKey, label: s.sectionName });
}

function evidenceStatusLabel(state: FocusState, answered: number) {
  const evidence = sectionEvidence(answered);
  return `${STATE_LABELS[state]} · ${answered} answered · ${evidence.label}`;
}

function unitAriaLabel(unit: ExploreUnit, book: ExploreBook) {
  const label = readableUnitLabel(unit.label);
  const reference = bookPassage(book.bookName, unit.startCh, unit.endCh);
  const address = label === reference ? label : `${label}. ${reference}`;
  return `${address}. ${evidenceStatusLabel(unit.state, unit.answered)}.${unit.isFocus ? " Recommended." : ""}`;
}

export default function MapOverview({
  tree,
  onFocusView,
  motionPaused = false,
}: {
  tree: ExploreTree;
  /** Optional: lets a selected node hand control back to the focus view,
   *  already centred on what was picked. */
  onFocusView?: (target: { sectionKey: string; bookCode?: string }) => void;
  motionPaused?: boolean;
}) {
  const [filter, setFilter] = useState<AtlasFilter>("all");
  const [selected, setSelected] = useState<
    | { kind: "section"; section: ExploreSection }
    | { kind: "book"; book: ExploreBook; section: ExploreSection }
    | { kind: "unit"; unit: ExploreUnit; book: ExploreBook; section: ExploreSection }
    | null
  >(null);

  const bySectionKey = useMemo(() => {
    const map = new Map<string, ExploreSection>();
    tree.sections.forEach((s) => map.set(s.sectionKey, s));
    return map;
  }, [tree.sections]);
  const hasRecommendation = useMemo(
    () => tree.sections.some((section) => (
      section.isFocus
      || section.books.some((book) => book.isFocus || book.units.some((unit) => unit.isFocus))
    )),
    [tree.sections],
  );
  const visibleFilters = useMemo(
    () => FILTERS.filter((item) => hasRecommendation || item.key !== "recommended"),
    [hasRecommendation],
  );
  const effectiveFilter: AtlasFilter = !hasRecommendation && filter === "recommended" ? "all" : filter;

  const hubs: PlacedHub[] = useMemo(() => LANE_ORDER.map((key, i) => {
    const section = bySectionKey.get(key);
    if (!section) return null;
    const hue = sectionHueFor(section);
    return {
      section, hue,
      x: laneCenterX(i),
      y: HUB_Y,
      tone: starTone(section.state, hue),
    };
  }).filter((h): h is PlacedHub => h !== null), [bySectionKey]);

  const hubByKey = useMemo(() => new Map(hubs.map((h) => [h.section.sectionKey, h])), [hubs]);

  const placedBooks: PlacedBook[] = useMemo(() => {
    const out: PlacedBook[] = [];
    LANE_ORDER.forEach((key, i) => {
      const section = bySectionKey.get(key);
      if (!section) return;
      const hue = sectionHueFor(section);
      layoutLane(section.books, laneCenterX(i)).forEach(({ book, x, y, labelVisible }) => {
        out.push({ book, x, y, labelVisible, tone: starTone(book.state, hue) });
      });
    });
    return out;
  }, [bySectionKey]);

  // Dependency arrows connect the four hubs — Torah is the shared root, so
  // its two "skip" arrows (to Latter Prophets and to Writings) bow outward
  // to stay legible next to the direct Torah->Former and Former->{Latter,
  // Writings} lines they'd otherwise cross. Any edge whose lanes aren't
  // adjacent bows its control point perpendicular to the direct line, in
  // whichever of the two perpendicular directions ends up farther from the
  // intermediate hub(s) it would otherwise pass through — computed rather
  // than hardcoded, so it stays correct if lane order or hub positions ever
  // change.
  const depEdges = useMemo(() => {
    const edges: Array<{ from: PlacedHub; to: PlacedHub; controlX: number; controlY: number }> = [];
    SECTION_CHRONO.forEach((c) => {
      const to = hubs.find((h) => h.section.sectionName === c.key);
      if (!to) return;
      c.dependsOn.forEach((depName) => {
        const from = hubs.find((h) => h.section.sectionName === depName);
        if (!from) return;

        const fromIdx = LANE_ORDER.indexOf(from.section.sectionKey as LaneKey);
        const toIdx = LANE_ORDER.indexOf(to.section.sectionKey as LaneKey);
        const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        const between = hubs.filter((h) => {
          const idx = LANE_ORDER.indexOf(h.section.sectionKey as LaneKey);
          return idx > lo && idx < hi;
        });

        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        if (between.length === 0) {
          edges.push({ from, to, controlX: mx, controlY: my });
          return;
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;
        const bow = 70 + 55 * (between.length - 1);
        const candidateA = { x: mx + perpX * bow, y: my + perpY * bow };
        const candidateB = { x: mx - perpX * bow, y: my - perpY * bow };
        // Pick whichever side clears every intermediate hub by more.
        const minDist = (p: { x: number; y: number }) =>
          Math.min(...between.map((h) => Math.hypot(h.x - p.x, h.y - p.y)));
        const control = minDist(candidateA) >= minDist(candidateB) ? candidateA : candidateB;
        edges.push({ from, to, controlX: control.x, controlY: control.y });
      });
    });
    return edges;
  }, [hubs]);

  const railTicks = GALAXY_ERAS.map((e) => ({ y: yForYear(e.year), label: e.label, sub: formatYear(e.year) }));
  const selectedState = selected?.kind === "section"
    ? selected.section.state
    : selected?.kind === "book"
      ? selected.book.state
      : selected?.unit.state ?? null;
  const selectedSection = selected?.section ?? null;
  const selectedTone = selectedState && selectedSection
    ? starTone(selectedState, sectionHueFor(selectedSection))
    : null;
  const selectedAnswered = selected?.kind === "section"
    ? selected.section.answered
    : selected?.kind === "book"
      ? selected.book.answered
      : selected?.unit.answered ?? null;
  const selectedTitle = selected?.kind === "section"
    ? selected.section.sectionName
    : selected?.kind === "book"
      ? selected.book.bookName
      : selected?.unit ? readableUnitLabel(selected.unit.label) : "Select a node";
  const selectedReference = selected?.kind === "unit"
    ? bookPassage(selected.book.bookName, selected.unit.startCh, selected.unit.endCh)
    : null;
  const selectedSub = selected?.kind === "section"
    ? `${selected.section.books.length} books`
    : selected?.kind === "book"
      ? `Old Testament › ${selected.section.sectionName}`
      : selected
        ? `Old Testament › ${selected.section.sectionName} › ${selected.book.bookName}`
        : "Select a section, book, or chapter section to inspect it.";
  const selectedTarget = selected?.kind === "section"
    ? { sectionKey: selected.section.sectionKey }
    : selected
      ? { sectionKey: selected.section.sectionKey, bookCode: selected.book.bookCode }
      : null;
  const matchesFilter = (state: FocusState, isRecommended: boolean) => {
    if (effectiveFilter === "all") return true;
    if (effectiveFilter === "needs_work") return state !== "sufficient";
    if (effectiveFilter === "recommended") return isRecommended;
    return state === effectiveFilter;
  };
  const matchOpacity = (state: FocusState, isRecommended: boolean) =>
    matchesFilter(state, isRecommended) ? 1 : 0.16;

  return (
    <div className={`mov ${motionPaused ? "is-motion-paused" : ""}`}>
      <style>{MAP_OVERVIEW_STYLES}</style>

      <div className="mov-tools" aria-label="Atlas filters">
        <span className="mov-filter-label">Show</span>
        {visibleFilters.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`mov-filter-btn ${effectiveFilter === item.key ? "is-active" : ""}`}
            aria-pressed={effectiveFilter === item.key}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Legend: one row per competency tier, a mini-dot per section hue,
          with a mini-dot per section tint. A horizontal
          bar above the chart rather than an overlay on it — this view has
          no orbiting motion to dodge, but it does have a lane header and
          the chronology rail sitting right in the top-left corner, which
          an overlay legend would sit on top of. */}
      <div className="mov-legend" aria-label="Colour legend">
        {(["sufficient", "below_baseline", "insufficient_evidence"] as FocusState[]).map((state) => (
          <div key={state} className="mov-legend-item">
            <div className="mov-legend-dots">
              {hubs.map((h) => {
                const tone = starTone(state, h.hue);
                const op = state === "sufficient" ? 1 : state === "below_baseline" ? 0.82 : 0.55;
                return <div key={h.section.sectionKey} style={{ width: 11, height: 11, borderRadius: "50%", background: tone.color, opacity: op }} />;
              })}
            </div>
            <span className="mov-legend-label">{STATE_LABELS[state]}</span>
          </div>
        ))}
        {hasRecommendation && (
          <div className="mov-legend-item">
            <svg width={24} height={24} viewBox="-12 -12 24 24" style={{ flexShrink: 0, overflow: "visible" }} aria-hidden="true">
              <circle cx={0} cy={0} r={6} fill="rgba(255,255,255,0.5)" />
              <circle cx={0} cy={0} r={9} fill="none" stroke="#ffcf5c" strokeWidth={1.8} />
            </svg>
            <span className="mov-legend-label">Ring = recommended</span>
          </div>
        )}
      </div>

      <div className="mov-mobile-note">
        Atlas is a compressed overview on small screens. Use Study view for selecting passages and taking action.
      </div>

      <div className="mov-shell">
      <div className="mov-stage">
        <svg className="mov-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="group" aria-label="Full Old Testament map: every section, book, and chapter section by chronology and dependency">
          <defs>
            <filter id="mov-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="mov-sphere" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="38%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#05060c" stopOpacity="0.44" />
            </radialGradient>
            <radialGradient id="mov-hot">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            {hubs.map((h) => (
              <marker key={h.section.sectionKey} id={`mov-arw-${h.section.sectionKey}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0.5,0.8 L9.2,5 L0.5,9.2 L2.4,5 Z" fill={h.hue} />
              </marker>
            ))}
          </defs>

          {/* chronology rail */}
          <g>
            <text className="mov-axis-label" x={RAIL_LINE_X - 20} y={PAD_T - 28} textAnchor="end">Time</text>
            <text className="mov-axis-note" x={RAIL_LINE_X + 12} y={PAD_T - 29}>Earlier ↓ later</text>
            <line className="mov-rail-line" x1={RAIL_LINE_X} y1={PAD_T - 14} x2={RAIL_LINE_X} y2={VIEW_H - PAD_B + 14} />
            {railTicks.map((t, i) => (
              <g key={`${t.label}-${i}`}>
                <line className="mov-rail-tick" x1={RAIL_LINE_X - 6} y1={t.y} x2={RAIL_LINE_X + 6} y2={t.y} />
                <text className="mov-rail-label" x={RAIL_LABEL_X} y={t.y - 6}>{t.label}</text>
                <text className="mov-rail-sub" x={RAIL_LABEL_X} y={t.y + 7}>{t.sub}</text>
              </g>
            ))}
          </g>

          {/* lane headers */}
          <text className="mov-axis-label" x={(FIELD_L + FIELD_R) / 2} y={PAD_T - 48} textAnchor="middle">
            Dependency / section family
          </text>
          {hubs.map((h, i) => (
            <text key={h.section.sectionKey} className="mov-lane-label" x={laneCenterX(i)} y={PAD_T - 24} fill={h.hue} opacity={0.75}>
              {h.section.sectionName}
            </text>
          ))}

          {/* dependency arrows between section hubs */}
          <g>
            {depEdges.map((e, i) => {
              // Trim each end back to the hub's rim along the straight
              // from->to direction, then curve through the (possibly bowed)
              // control point computed above.
              const dx = e.to.x - e.from.x;
              const dy = e.to.y - e.from.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const sx = e.from.x + ux * (HUB_R + 8);
              const sy = e.from.y + uy * (HUB_R + 8);
              const ex = e.to.x - ux * (HUB_R + 12);
              const ey = e.to.y - uy * (HUB_R + 12);
              const d = `M ${sx} ${sy} Q ${e.controlX} ${e.controlY} ${ex} ${ey}`;
              return (
                <g key={i}>
                  <path className="mov-edge-halo" d={d} stroke={e.from.hue} />
                  <path className="mov-edge" d={d} stroke={e.from.hue} strokeWidth={2} opacity={0.9} markerEnd={`url(#mov-arw-${e.from.section.sectionKey})`} />
                </g>
              );
            })}
          </g>

          {/* tethers: book -> own section hub */}
          <g>
            {placedBooks.map((p) => {
              const hub = hubByKey.get(p.book.sectionKey);
              if (!hub) return null;
              return <line key={`t-${p.book.bookCode}`} className="mov-tether" x1={hub.x} y1={hub.y} x2={p.x} y2={p.y} />;
            })}
          </g>

          {/* section hubs */}
          <g>
            {hubs.map((h) => {
              const isSel = selected?.kind === "section" && selected.section.sectionKey === h.section.sectionKey;
              const opacity = matchOpacity(h.section.state, h.section.isFocus);
              return (
                <g
                  key={h.section.sectionKey}
                  id={focusNodeDomId({ depth: 1, node_key: h.section.sectionKey })}
                  className={`mov-body ${opacity < 1 ? "is-dimmed" : ""}`}
                  style={{ opacity } as CSSProperties}
                  role="button"
                  tabIndex={0}
                  aria-label={`${h.section.sectionName}. ${STATE_LABELS[h.section.state]}.${h.section.isFocus ? " Recommended focus." : ""}`}
                  onClick={() => setSelected({ kind: "section", section: h.section })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected({ kind: "section", section: h.section }); } }}
                >
                  <circle className="mov-hit" cx={h.x} cy={h.y} r={HUB_R + 14} />
                  <circle cx={h.x} cy={h.y} r={HUB_R * 1.7} fill={h.hue} opacity={h.tone.glow * 0.22} />
                  <circle className="mov-core mov-twinkle" cx={h.x} cy={h.y} r={HUB_R} fill={h.tone.color} opacity={h.tone.core} />
                  <circle cx={h.x} cy={h.y} r={HUB_R} fill="none" stroke={h.tone.color} strokeWidth={1.6} opacity={h.tone.core * 0.9} filter="url(#mov-glow)" />
                  <circle cx={h.x} cy={h.y} r={HUB_R * 0.5} fill="url(#mov-hot)" opacity={h.tone.core * 0.7} />
                  {h.section.isFocus && <circle className="mov-ring" cx={h.x} cy={h.y} r={HUB_R + 8} fill="none" stroke="#ffcf5c" strokeWidth={2} />}
                  {isSel && <circle cx={h.x} cy={h.y} r={HUB_R + 5} fill="none" stroke="#fff" strokeWidth={1.6} strokeDasharray="3 3" />}
                </g>
              );
            })}
          </g>

          {/* books */}
          <g>
            {placedBooks.map((p) => {
              const isSel = selected?.kind === "book" && selected.book.bookCode === p.book.bookCode;
              const section = bySectionKey.get(p.book.sectionKey);
              const opacity = matchOpacity(p.book.state, p.book.isFocus);
              return (
                <g key={p.book.bookCode}>
                  <g
                    id={focusNodeDomId({ depth: 2, node_key: p.book.bookCode })}
                    className={`mov-body ${opacity < 1 ? "is-dimmed" : ""}`}
                    style={{ opacity } as CSSProperties}
                    role="button"
                    tabIndex={0}
                    aria-label={`${p.book.bookName}. ${STATE_LABELS[p.book.state]}.${p.book.isFocus ? " Recommended book." : ""}`}
                    onClick={() => section && setSelected({ kind: "book", book: p.book, section })}
                    onKeyDown={(e) => { if (section && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelected({ kind: "book", book: p.book, section }); } }}
                  >
                    <rect className="mov-hit" x={p.x - BOOK_R - 8} y={p.y - 13} width={112} height={26} rx={8} />
                    <circle className="mov-core" cx={p.x} cy={p.y} r={BOOK_R} fill={p.tone.color} opacity={p.tone.core} />
                    <circle cx={p.x} cy={p.y} r={BOOK_R} fill="url(#mov-sphere)" opacity={0.85} />
                    <circle cx={p.x} cy={p.y} r={BOOK_R} fill="none" stroke={p.tone.bright ? "#fff" : p.tone.color} strokeWidth={p.tone.bright ? 1.2 : 0.8} opacity={p.tone.bright ? 0.85 : 0.5} />
                    {p.book.isFocus && <circle className="mov-ring" cx={p.x} cy={p.y} r={BOOK_R + 5} fill="none" stroke="#ffcf5c" strokeWidth={1.6} />}
                    {isSel && <circle cx={p.x} cy={p.y} r={BOOK_R + 4} fill="none" stroke="#fff" strokeWidth={1.3} strokeDasharray="2 3" />}
                    <text
                      className={`mov-label ${p.labelVisible || p.book.isFocus || isSel ? "" : "mov-label-onhover"}`}
                      x={p.x + BOOK_R + 6} y={p.y}
                    >
                      {p.book.bookName}
                    </text>
                  </g>
                  {/* chapter-section pips: a tiny row beneath the book */}
                  {p.book.units.length > 0 && (() => {
                    const n = p.book.units.length;
                    const rowW = (n - 1) * 8;
                    return (
                      <g>
                        {p.book.units.map((u, ui) => {
                          const utone = starTone(u.state, section ? sectionHueFor(section) : "#8ea2c0");
                          const ux = p.x - rowW / 2 + ui * 8;
                          const uy = p.y + BOOK_R + 10;
                          const uSel = selected?.kind === "unit" && selected.unit.unitKey === u.unitKey;
                          const unitOpacity = matchOpacity(u.state, u.isFocus);
                          return (
                            <g
                              key={u.unitKey}
                              className={`mov-body ${unitOpacity < 1 ? "is-dimmed" : ""}`}
                              style={{ opacity: unitOpacity } as CSSProperties}
                              role="button"
                              tabIndex={0}
                              aria-label={unitAriaLabel(u, p.book)}
                              onClick={() => section && setSelected({ kind: "unit", unit: u, book: p.book, section })}
                              onKeyDown={(e) => { if (section && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelected({ kind: "unit", unit: u, book: p.book, section }); } }}
                            >
                              <circle className="mov-hit" cx={ux} cy={uy} r={UNIT_R + 9} />
                              <circle cx={ux} cy={uy} r={UNIT_R} fill={utone.color} opacity={utone.core} />
                              {u.isFocus && <circle className="mov-ring" cx={ux} cy={uy} r={UNIT_R + 3} fill="none" stroke="#ffcf5c" strokeWidth={1} />}
                              {uSel && <circle cx={ux} cy={uy} r={UNIT_R + 2.5} fill="none" stroke="#fff" strokeWidth={1} />}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

        <aside className="mov-panel" aria-label="Atlas inspector">
          <div>
            <p className="mov-panel-kicker">Atlas inspector</p>
            {selectedReference && <span className="mov-panel-ref">{selectedReference}</span>}
            <p className="mov-panel-title">{selectedTitle}</p>
            <p className="mov-panel-sub">{selectedSub}</p>
          </div>

          {selected && selectedTone && selectedState && selectedAnswered !== null ? (
            <>
              <div className="mov-panel-meta">
                <span
                  className="mov-chip"
                  style={{
                    background: selectedTone.faint ? "rgba(255,255,255,.07)" : `${selectedTone.color}22`,
                    border: `1px solid ${selectedTone.faint ? "rgba(255,255,255,.16)" : `${selectedTone.color}66`}`,
                    color: selectedTone.faint ? "rgba(255,255,255,.82)" : "#fff",
                  }}
                >
                  <span className="mov-dot" style={{ background: selectedTone.color }} />
                  {evidenceStatusLabel(selectedState, selectedAnswered)}
                </span>
              </div>
              {onFocusView && selectedTarget && (
                <div className="mov-panel-actions">
                  <button
                    type="button"
                    className="mov-open-btn"
                    onClick={() => onFocusView(selectedTarget)}
                  >
                    Open in study view ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="mov-panel-empty">
              Click a section, book, or chapter-section dot to inspect it here. Use the filters to find unfinished areas fast.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
