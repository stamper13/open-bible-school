import { BIBLE_BOOKS, BOOK_CHAPTER_COUNT, BOOK_NAMES, type Testament } from "@/lib/bibleTaxonomy";
import { sanitizePassageReference } from "@/lib/recommendationLabels";
import { supabase } from "@/lib/supabase/client";

/**
 * The current focus path: where the router's attention is right now.
 *
 * `obs_get_current_focus_path` returns one row per node across exactly three
 * levels, already ordered by (depth, rank). The map renders that order as
 * given — nothing here re-sorts. Exactly one row per level carries
 * `is_focus`, and level 3 is terminal: dimensions and individual events
 * inform authoring and scoring only, and are deliberately not map nodes.
 *
 * The function is STABLE SECURITY DEFINER behind `obs_is_authorized_user`,
 * so an unauthorized or unknown user gets zero rows back. That is a real
 * state ("nothing to show yet"), not an error.
 */

export type FocusLevel = "testament_section" | "book" | "book_section";
export type FocusState = "sufficient" | "insufficient_evidence" | "below_baseline";
export type FocusMode = "whole_book" | "section_drilldown";

export type FocusPathRow = {
  level: FocusLevel;
  depth: number;
  node_id: string | null;
  node_key: string;
  label: string;
  book_code: string | null;
  rank: number;
  is_focus: boolean;
  answered: number;
  display_score: number | null;
  state: FocusState;
  reference: string | null;
  start_ch: number | null;
  start_vs: number | null;
  end_ch: number | null;
  end_vs: number | null;
  focus_mode: FocusMode;
  book_probes_answered: number | null;
  book_probes_correct: number | null;
};

export type FocusPath = {
  sections: FocusPathRow[];
  books: FocusPathRow[];
  leaves: FocusPathRow[];
  focusSection: FocusPathRow | null;
  focusBook: FocusPathRow | null;
  focusLeaf: FocusPathRow | null;
  focusMode: FocusMode;
  isEmpty: boolean;
};

export const EMPTY_FOCUS_PATH: FocusPath = {
  sections: [],
  books: [],
  leaves: [],
  focusSection: null,
  focusBook: null,
  focusLeaf: null,
  focusMode: "section_drilldown",
  isEmpty: true,
};

/**
 * Section identity colour. Competency stays inside each section's colour
 * family: pale/translucent means not enough evidence, brighter means some
 * knowledge, and the darker fully-solid hue means sufficient.
 */
// NOTE: WRITINGS (OT) and GENERAL (NT) used to share #7c3aed, which made
// the coverage-grid legend implicitly wrong for one of them — fixed by
// moving WRITINGS to a distinct magenta. Separately, PAULINE's old indigo
// (#4f46e5) sat only ~15° from GENERAL's violet (#7c3aed) on the color
// wheel — close enough that the two were hard to tell apart in the legend
// and the grid within the same (NT) testament. PAULINE moved to orange and
// GENERAL to lime, both scoped to this coverage-grid color system only —
// this map (and SECTION_HUES_BY_LABEL below) is the only place these colors
// live, consumed by sectionHue()/leafTone() everywhere the grid or legend
// render, so a change here alone is enough to update both consistently.
const SECTION_HUES: Record<string, string> = {
  TORAH: "#d4a017",
  FORMER: "#0e8c6a",
  LATTER: "#2563c4",
  WRITINGS: "#a21caf",
  GOSPELS_ACTS: "#0d9488",
  PAULINE: "#ea580c",
  GENERAL: "#65a30d",
  APOCALYPSE: "#be123c",
};

/** Fallback for the rare case a section arrives labelled rather than keyed. */
const SECTION_HUES_BY_LABEL: Record<string, string> = {
  Torah: "#d4a017",
  "Former Prophets": "#0e8c6a",
  "Latter Prophets": "#2563c4",
  Writings: "#a21caf",
  "Gospels & Acts": "#0d9488",
  "Pauline Epistles": "#ea580c",
  "General Epistles": "#65a30d",
  Apocalypse: "#be123c",
};

const NEUTRAL_HUE = "#0aa3a3";

export function sectionHue(row: Pick<FocusPathRow, "node_key" | "label"> | null): string {
  if (!row) return NEUTRAL_HUE;
  return (
    SECTION_HUES[row.node_key?.toUpperCase() ?? ""]
    ?? SECTION_HUES_BY_LABEL[row.label]
    ?? NEUTRAL_HUE
  );
}

/**
 * The canonical four sections per testament, in display order — the same
 * keys as SECTION_HUES above (and public.obs_biblical_books.section_key).
 * Exists so the coverage-grid legend can render its section color key
 * without needing a loaded ExploreTree: the color mapping is static per
 * testament regardless of what a given user's data looks like. `letter` is
 * the single-character badge the legend shows (hover reveals `label`, the
 * full name used everywhere else) — chosen to be unique within each
 * testament, not strictly "first letter" (General Epistles is E, not G,
 * since Gospels & Acts already took G).
 */
export const SECTION_ORDER_BY_TESTAMENT: Record<Testament, { key: string; label: string; letter: string }[]> = {
  OT: [
    { key: "TORAH", label: "Torah", letter: "T" },
    { key: "FORMER", label: "Former Prophets", letter: "F" },
    { key: "LATTER", label: "Latter Prophets", letter: "L" },
    { key: "WRITINGS", label: "Writings", letter: "W" },
  ],
  NT: [
    { key: "GOSPELS_ACTS", label: "Gospels & Acts", letter: "G" },
    { key: "PAULINE", label: "Pauline Epistles", letter: "P" },
    { key: "GENERAL", label: "General Epistles", letter: "E" },
    { key: "APOCALYPSE", label: "Apocalypse", letter: "A" },
  ],
};

export type LeafTone = {
  rail: string;
  fill: string;
  dashed: boolean;
};

/**
 * The one place a coverage box's colour is decided. Both the grid boxes and
 * the legend swatches in app/knowledge-map/CoverageGrid.tsx read from here,
 * so the legend can't describe a colour the grid doesn't actually paint —
 * which is the entire point of having a legend. Anything that wants a box
 * to look different (evidence dimming, the gold recommendation ring) layers
 * on top in CSS rather than substituting its own tone.
 *
 * "Not enough evidence" deliberately drops the section hue for a neutral
 * slate outline: an unmeasured chapter hasn't earned a colour yet, and the
 * legend says so by showing that row identical across all four sections.
 *
 * The gap between sufficient (44%) and below baseline (12%) is wide on
 * purpose. It used to be 20% vs 12%, which was too close to call at 27px —
 * and worse, .cov-box dims by evidence confidence down to .58 opacity, so a
 * sufficient chapter with thin evidence landed on ~11.6% hue: the exact
 * shade of a full-evidence below-baseline chapter, meaning two opposite
 * verdicts rendered identically. 44% survives that dimming with room to
 * spare while staying light enough for the dark chapter numerals to read.
 */
export function leafTone(state: FocusState, hue: string): LeafTone {
  if (state === "sufficient") {
    return {
      rail: hue,
      fill: `color-mix(in srgb, ${hue} 44%, #ffffff)`,
      dashed: false,
    };
  }
  if (state === "below_baseline") {
    return {
      rail: `color-mix(in srgb, ${hue} 64%, #ffffff)`,
      fill: `color-mix(in srgb, ${hue} 12%, #ffffff)`,
      dashed: false,
    };
  }
  return {
    rail: "#94a3b8",
    fill: "#ffffff",
    dashed: true,
  };
}

export const STATE_LABELS: Record<FocusState, string> = {
  sufficient: "Sufficient",
  below_baseline: "Below baseline",
  insufficient_evidence: "Not enough evidence",
};

/** Stable DOM id for a node, shared by the map and the focus-transition
 *  overlay so travelling light can find both endpoints. */
export function focusNodeDomId(row: Pick<FocusPathRow, "depth" | "node_key">) {
  return `km-node-${row.depth}-${row.node_key}`;
}

/** Mix two #rrggbb colours; `t` is the weight of `b`. Kept in plain hex
 *  because SVG `fill` handles a hex string far more reliably than a
 *  `color-mix()` string across the star primitives. */
function hexMix(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const to = (x: number) => Math.round(x).toString(16).padStart(2, "0");
  return `#${to(ar + (br - ar) * t)}${to(ag + (bg - ag) * t)}${to(ab + (bb - ab) * t)}`;
}

/**
 * A body's appearance on the star field. Competency changes strength inside
 * the section hue: sufficient uses the dark, fully-solid hue; below baseline
 * uses a lighter/brighter version; not enough evidence uses the palest,
 * most transparent version. `is_focus` never changes the colour: the map
 * rings it instead.
 */
export type StarTone = {
  color: string;
  core: number;
  glow: number;
  faint: boolean;
  /** Completed / competent: rendered vivid and glowing so it reads as clearly
   *  distinct from everything still in progress. */
  bright: boolean;
};

export function starTone(state: FocusState, hue: string): StarTone {
  if (state === "sufficient") {
    return {
      color: hexMix(hue, "#05060c", 0.10),
      core: 1,
      glow: 1,
      faint: false,
      bright: true,
    };
  }
  if (state === "below_baseline") {
    return {
      color: hexMix(hue, "#ffffff", 0.28),
      core: 0.78,
      glow: 0.42,
      faint: false,
      bright: false,
    };
  }
  return {
    color: hexMix(hue, "#ffffff", 0.58),
    core: 0.32,
    glow: 0.08,
    faint: true,
    bright: false,
  };
}

/**
 * `whole_book` means the learner missed the book-level orientation probes, so
 * level 3 arrives in chapter order for a read-through. `section_drilldown`
 * means it arrives weakest-first. Same layout either way; only the label on
 * the focus leaf changes.
 */
export function focusLeafKicker(mode: FocusMode): string {
  return mode === "whole_book" ? "Start here" : "Weakest section";
}

export function focusModeCopy(mode: FocusMode): string {
  return mode === "whole_book"
    ? "The book-level orientation probes came back short, so these sections are in reading order for a straight read-through."
    : "Orientation is in place, so these sections are ordered weakest-first.";
}

/** "Genesis 20:1-22:24" — falls back to the chapter/verse fields when the
 *  backend has no stored reference string for a unit-derived leaf. */
export function passageReference(row: FocusPathRow): string {
  if (row.reference) return sanitizePassageReference(row.reference);
  const bookName = row.book_code ? BOOK_NAMES[row.book_code] ?? row.book_code : "";
  if (!bookName) return row.label;
  if (row.start_ch === null) return bookName;
  const start = row.start_vs === null ? `${row.start_ch}` : `${row.start_ch}:${row.start_vs}`;
  if (row.end_ch === null) return `${bookName} ${start}`;
  const end = row.end_vs === null || row.end_vs === 999 ? `${row.end_ch}` : `${row.end_ch}:${row.end_vs}`;
  return sanitizePassageReference(`${bookName} ${start}-${end}`);
}

/** Short form for tight spaces: "Genesis 20-22". */
export function compactReference(row: FocusPathRow): string {
  const bookName = row.book_code ? BOOK_NAMES[row.book_code] ?? row.book_code : "";
  if (!bookName || row.start_ch === null) return row.label;
  if (row.end_ch === null || row.end_ch === row.start_ch) return `${bookName} ${row.start_ch}`;
  return `${bookName} ${row.start_ch}-${row.end_ch}`;
}

/** Outbound passage link for any reference string. The app has no in-app
 *  reader; rereading happens on BibleGateway in a new tab. */
export function rereadUrl(reference: string): string {
  const params = new URLSearchParams({ search: reference, version: "ESV" });
  return `https://www.biblegateway.com/passage/?${params.toString()}`;
}

export function rereadHref(row: FocusPathRow): string {
  return rereadUrl(passageReference(row));
}

/** "20-24", "1", or "" — a chapter range for a compact label. */
export function chapterRangeLabel(startCh: number | null, endCh: number | null): string {
  if (startCh === null) return "";
  if (endCh === null || endCh === startCh) return `${startCh}`;
  return `${startCh}-${endCh}`;
}

/** User-facing unit labels should not expose internal curriculum codes like
 *  "B4" or "A."; those are useful for ordering, not for orientation. */
export function readableUnitLabel(label: string): string {
  const cleaned = label
    .replace(/^[A-Z]\d+\s+/, "")
    .replace(/^[A-Z]\.\s+/, "")
    .trim();
  return cleaned || label;
}

/** "Genesis 20-24" from parts, for ladder units that carry only chapters. */
export function bookPassage(bookName: string, startCh: number | null, endCh: number | null): string {
  if (startCh === null) return bookName;
  const range = endCh === null || endCh === startCh ? `${startCh}` : `${startCh}-${endCh}`;
  return `${bookName} ${range}`;
}

function normalizeRow(raw: Record<string, unknown>): FocusPathRow {
  const num = (value: unknown): number | null => (
    value === null || value === undefined ? null : Number(value)
  );
  return {
    level: raw.level as FocusLevel,
    depth: Number(raw.depth),
    node_id: (raw.node_id as string | null) ?? null,
    node_key: String(raw.node_key ?? ""),
    label: String(raw.label ?? ""),
    book_code: (raw.book_code as string | null) ?? null,
    rank: Number(raw.rank),
    is_focus: Boolean(raw.is_focus),
    answered: Number(raw.answered ?? 0),
    display_score: num(raw.display_score),
    state: (raw.state as FocusState) ?? "insufficient_evidence",
    reference: (raw.reference as string | null) ?? null,
    start_ch: num(raw.start_ch),
    start_vs: num(raw.start_vs),
    end_ch: num(raw.end_ch),
    end_vs: num(raw.end_vs),
    focus_mode: (raw.focus_mode as FocusMode) ?? "section_drilldown",
    book_probes_answered: num(raw.book_probes_answered),
    book_probes_correct: num(raw.book_probes_correct),
  };
}

/** Group the flat row set into levels, preserving the returned order. */
export function projectFocusPath(rows: FocusPathRow[]): FocusPath {
  if (rows.length === 0) return EMPTY_FOCUS_PATH;
  if (rows.every((row) => row.answered <= 0)) return EMPTY_FOCUS_PATH;

  const sections = rows.filter((row) => row.depth === 1);
  const books = rows.filter((row) => row.depth === 2);
  const leaves = rows.filter((row) => row.depth === 3);

  return {
    sections,
    books,
    leaves,
    focusSection: sections.find((row) => row.is_focus) ?? null,
    focusBook: books.find((row) => row.is_focus) ?? null,
    focusLeaf: leaves.find((row) => row.is_focus) ?? null,
    focusMode: rows[0]?.focus_mode ?? "section_drilldown",
    isEmpty: false,
  };
}

/**
 * Loads the focus path for a signed-in user. A missing session, or a user the
 * backend does not authorize, yields an empty path rather than an error.
 */
export async function loadFocusPath(userId: string | null): Promise<FocusPath> {
  if (!userId) return EMPTY_FOCUS_PATH;

  const { data, error } = await supabase.rpc("obs_get_current_focus_path", {
    p_user_id: userId,
  });
  if (error) throw error;

  const rows = ((data ?? []) as Record<string, unknown>[]).map(normalizeRow);
  return projectFocusPath(rows);
}

/* ------------------------------------------------------------------ *
 * The wider ladder — every section, book, and unit — used to let the
 * map recentre onto any section, not just the current focus.
 *
 * `obs_get_ladder_state_v1` returns one row per learning unit across the
 * whole Old Testament, with the same `state` the focus path is built from,
 * so states stay consistent between the two views. Container (section/book)
 * states are aggregated here exactly as the focus-path function does: a
 * container is `sufficient` only when every child unit is, otherwise it
 * inherits the state of its earliest non-sufficient child.
 * ------------------------------------------------------------------ */

export type ExploreUnit = {
  unitKey: string;
  order: number;
  bookCode: string;
  bookName: string;
  label: string;
  startCh: number | null;
  endCh: number | null;
  answered: number;
  displayScore: number | null;
  state: FocusState;
  isFocus: boolean;
};

export type ExploreBook = {
  bookCode: string;
  bookName: string;
  sectionKey: string;
  order: number;
  state: FocusState;
  answered: number;
  isFocus: boolean;
  units: ExploreUnit[];
};

export type ExploreSection = {
  sectionKey: string;
  sectionName: string;
  order: number;
  state: FocusState;
  answered: number;
  isFocus: boolean;
  books: ExploreBook[];
};

export type ExploreTree = { sections: ExploreSection[] };

export const EMPTY_EXPLORE_TREE: ExploreTree = { sections: [] };

/** Container state: sufficient iff all children are, else the earliest gap. */
function aggregateState(children: Array<{ state: FocusState; order: number }>): FocusState {
  if (children.length === 0) return "insufficient_evidence";
  if (children.every((c) => c.state === "sufficient")) return "sufficient";
  const gaps = children
    .filter((c) => c.state !== "sufficient")
    .sort((a, b) => a.order - b.order);
  return gaps[0].state;
}

type LadderRaw = Record<string, unknown>;
type ExploreUnitWithSection = ExploreUnit & { sectionKey: string; sectionName: string };

function blankTestamentLadder(testament: Testament): LadderRaw[] {
  return BIBLE_BOOKS
    .filter((book) => book.testament === testament)
    .flatMap((book) => {
      const chapterCount = BOOK_CHAPTER_COUNT[book.code] ?? null;
      if (testament === "NT" && chapterCount) {
        return Array.from({ length: chapterCount }, (_, index) => {
          const chapter = index + 1;
          return {
            unit_key: `blank-${book.code.toLowerCase()}-${chapter}`,
            sequence_order: book.order * 1000 + chapter,
            section_key: book.sectionKey,
            section_name: book.section,
            book_code: book.code,
            book_name: book.name,
            label: `${book.name} ${chapter}`,
            start_chapter: chapter,
            end_chapter: chapter,
            answered: 0,
            display_score: null,
            state: "insufficient_evidence",
            is_focus: false,
          };
        });
      }
      return [{
      unit_key: `blank-${book.code.toLowerCase()}`,
      sequence_order: book.order * 10,
      section_key: book.sectionKey,
      section_name: book.section,
      book_code: book.code,
      book_name: book.name,
      label: book.name,
      start_chapter: 1,
      end_chapter: chapterCount,
      answered: 0,
      display_score: null,
      state: "insufficient_evidence",
      is_focus: false,
      }];
    });
}

function missingChapterUnit(
  book: Pick<ExploreBook, "bookCode" | "bookName" | "order"> & { sectionKey: string; sectionName: string },
  startCh: number,
  endCh: number,
): ExploreUnitWithSection {
  return {
    unitKey: `gap-${book.bookCode.toLowerCase()}-${startCh}-${endCh}`,
    order: book.order + startCh / 1000,
    sectionKey: book.sectionKey,
    sectionName: book.sectionName,
    bookCode: book.bookCode,
    bookName: book.bookName,
    label: startCh === endCh ? `${book.bookName} ${startCh}` : `${book.bookName} ${startCh}-${endCh}`,
    startCh,
    endCh,
    answered: 0,
    displayScore: null,
    state: "insufficient_evidence",
    isFocus: false,
  };
}

function fillMissingBookChapters(
  book: ExploreBook & { sectionKey: string; sectionName: string },
): ExploreUnit[] {
  const totalChapters = BOOK_CHAPTER_COUNT[book.bookCode];
  if (!totalChapters) return book.units;

  const ordered = [...book.units].sort((a, b) => {
    const startDelta = (a.startCh ?? Number.POSITIVE_INFINITY) - (b.startCh ?? Number.POSITIVE_INFINITY);
    return startDelta !== 0 ? startDelta : a.order - b.order;
  });
  if (ordered.some((unit) => unit.startCh === null)) return ordered;

  const filled: ExploreUnit[] = [];
  let cursor = 1;

  for (const unit of ordered) {
    const start = Math.max(1, unit.startCh ?? cursor);
    const end = Math.min(totalChapters, unit.endCh ?? start);
    if (start > cursor) filled.push(missingChapterUnit(book, cursor, start - 1));
    filled.push(unit);
    cursor = Math.max(cursor, end + 1);
  }

  if (cursor <= totalChapters) {
    filled.push(missingChapterUnit(book, cursor, totalChapters));
  }

  return filled.sort((a, b) => {
    const startDelta = (a.startCh ?? Number.POSITIVE_INFINITY) - (b.startCh ?? Number.POSITIVE_INFINITY);
    return startDelta !== 0 ? startDelta : a.order - b.order;
  });
}

export function buildExploreTree(rows: LadderRaw[]): ExploreTree {
  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

  const rawUnits: ExploreUnitWithSection[] = rows.map((r) => ({
    unitKey: String(r.unit_key ?? ""),
    order: Number(r.sequence_order ?? 0),
    sectionKey: String(r.section_key ?? ""),
    sectionName: String(r.section_name ?? ""),
    bookCode: String(r.book_code ?? ""),
    bookName: String(r.book_name ?? ""),
    label: String(r.label ?? ""),
    startCh: num(r.start_chapter),
    endCh: num(r.end_chapter),
    answered: Number(r.answered ?? 0),
    displayScore: num(r.display_score),
    state: (r.state as FocusState) ?? "insufficient_evidence",
    isFocus: Boolean(r.is_focus),
  }));
  if (rawUnits.length === 0) return EMPTY_EXPLORE_TREE;

  const hasAnyAnswers = rawUnits.some((unit) => unit.answered > 0);
  const units = rawUnits.map((unit) => {
    if (unit.answered > 0) return unit;
    return {
      ...unit,
      displayScore: null,
      state: "insufficient_evidence" as FocusState,
      isFocus: hasAnyAnswers && unit.isFocus,
    };
  });

  // Group into books, then sections, preserving the ladder's sequence order.
  const bookMap = new Map<string, ExploreBook & { sectionKey: string; sectionName: string }>();
  for (const u of units) {
    let book = bookMap.get(u.bookCode);
    if (!book) {
      book = {
        bookCode: u.bookCode,
        bookName: u.bookName,
        sectionKey: u.sectionKey,
        sectionName: u.sectionName,
        order: u.order,
        state: "insufficient_evidence",
        answered: 0,
        isFocus: false,
        units: [],
      };
      bookMap.set(u.bookCode, book);
    }
    book.units.push(u);
    book.order = Math.min(book.order, u.order);
    book.answered += u.answered;
    book.isFocus = book.isFocus || u.isFocus;
  }

  const sectionMap = new Map<string, ExploreSection>();
  for (const book of bookMap.values()) {
    book.units = fillMissingBookChapters(book);
    book.state = aggregateState(book.units);

    let section = sectionMap.get(book.sectionKey);
    if (!section) {
      section = {
        sectionKey: book.sectionKey,
        sectionName: book.sectionName,
        order: book.order,
        state: "insufficient_evidence",
        answered: 0,
        isFocus: false,
        books: [],
      };
      sectionMap.set(book.sectionKey, section);
    }
    section.books.push(book);
    section.order = Math.min(section.order, book.order);
    section.answered += book.answered;
    section.isFocus = section.isFocus || book.isFocus;
  }

  const sections = [...sectionMap.values()].sort((a, b) => a.order - b.order);
  for (const section of sections) {
    section.books.sort((a, b) => a.order - b.order);
    // Section state aggregates over every unit in the section, not the books.
    section.state = aggregateState(section.books.flatMap((b) => b.units));
  }

  return { sections };
}

/**
 * Loads the whole ladder for a signed-in user. Same authorization gate as the
 * focus path — an unknown or unauthorized user yields an empty tree.
 */
export async function loadExploreTree(
  userId: string | null,
  testament: Testament = "OT",
  includeBlankFallback = false,
): Promise<ExploreTree> {
  if (testament === "NT") return buildExploreTree(blankTestamentLadder("NT"));
  if (!userId) {
    return includeBlankFallback
      ? buildExploreTree(blankTestamentLadder(testament))
      : EMPTY_EXPLORE_TREE;
  }

  const { data, error } = await supabase.rpc("obs_get_ladder_state_v1", {
    p_user_id: userId,
  });
  if (error) throw error;

  const rows = (data ?? []) as LadderRaw[];
  return buildExploreTree(rows.length > 0 ? rows : blankTestamentLadder("OT"));
}
