// Extracted from app/knowledge-map/MapOverview.tsx during a file-size cleanup.
// Pure constants, types, and helper functions used by the atlas overview.
// No behavior change intended.

import {
  STATE_LABELS,
  bookPassage,
  readableUnitLabel,
  sectionHue,
  starTone,
  type ExploreBook,
  type ExploreSection,
  type ExploreUnit,
  type FocusState,
} from "@/lib/focusPath";
import { sectionEvidence } from "@/lib/bliEvidence";
import { bookChrono, yearToPos } from "./chronology";

export const VIEW_W = 1180;
export const VIEW_H = 1580;
export const PAD_T = 56;
export const PAD_B = 50;
export const RAIL_LABEL_X = 76;
export const RAIL_LINE_X = 100;
export const FIELD_L = 118;
export const FIELD_R = 1140;

export const LANE_ORDER = ["TORAH", "FORMER", "LATTER", "WRITINGS"] as const;
export type LaneKey = (typeof LANE_ORDER)[number];
export const LANE_COUNT = LANE_ORDER.length;
export const LANE_WIDTH = (FIELD_R - FIELD_L) / LANE_COUNT;
export const laneCenterX = (i: number) => FIELD_L + LANE_WIDTH * (i + 0.5);
export const SUB_COL_OFFSET = 30;
export const BOOK_MIN_GAP = 32;

export const posToY = (pos: number) => PAD_T + 118 + pos * (VIEW_H - PAD_T - 118 - PAD_B);
export const yForYear = (year: number) => posToY(yearToPos(year));

export const HUB_R = 34;
export const BOOK_R = 11;
export const UNIT_R = 3;
// Hubs sit in a fixed row well clear of the field's chronological range —
// not at their own section's chronological anchor. A section's anchor tends
// to fall right in the middle of its own books (Torah's is 1900 BC, and its
// own books cluster 2100-1406 BC), so placing the hub *at* that year put it
// on top of the very books it summarizes. Pinning it to a dedicated header
// row keeps chronology accurate for books — the finer-grained, more useful
// data — while giving the hub room to breathe.
export const HUB_Y = PAD_T + 52;

export type PlacedBook = {
  book: ExploreBook;
  x: number;
  y: number;
  labelVisible: boolean;
  tone: ReturnType<typeof starTone>;
};
export type PlacedHub = {
  section: ExploreSection;
  x: number;
  y: number;
  hue: string;
  tone: ReturnType<typeof starTone>;
};

export type AtlasFilter = "all" | "needs_work" | "below_baseline" | "insufficient_evidence" | "sufficient" | "recommended";
export const FILTERS: Array<{ key: AtlasFilter; label: string }> = [
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
export const LABEL_MIN_GAP = 20;

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
export function layoutLane(books: ExploreBook[], centerX: number): Array<{ book: ExploreBook; x: number; y: number; labelVisible: boolean }> {
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

export function sectionHueFor(s: ExploreSection) {
  return sectionHue({ node_key: s.sectionKey, label: s.sectionName });
}

export function evidenceStatusLabel(state: FocusState, answered: number) {
  const evidence = sectionEvidence(answered);
  return `${STATE_LABELS[state]} · ${answered} answered · ${evidence.label}`;
}

export function unitAriaLabel(unit: ExploreUnit, book: ExploreBook) {
  const label = readableUnitLabel(unit.label);
  const reference = bookPassage(book.bookName, unit.startCh, unit.endCh);
  const address = label === reference ? label : `${label}. ${reference}`;
  return `${address}. ${evidenceStatusLabel(unit.state, unit.answered)}.${unit.isFocus ? " Recommended." : ""}`;
}

