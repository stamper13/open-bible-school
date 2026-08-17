"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  STATE_LABELS,
  bookPassage,
  chapterRangeLabel,
  focusLeafKicker,
  focusModeCopy,
  focusNodeDomId,
  passageReference,
  readableUnitLabel,
  rereadHref,
  rereadUrl,
  sectionHue,
  starTone,
  type ExploreBook,
  type ExploreSection,
  type ExploreTree,
  type FocusPath,
  type FocusPathRow,
  type FocusState,
  type StarTone,
} from "@/lib/focusPath";
import { sectionEvidence } from "@/lib/bliEvidence";
import { FOCUS_STAR_MAP_STYLES } from "./focusStarMapStyles";

/**
 * The focus path as an explorable solar system.
 *
 * The four sections run across a compact top rail in reading order. The open
 * section is repeated as the large central star below; its books orbit that
 * central star as planets, and the selected book's sections ride as
 * chapter-labelled moons.
 *
 * By default the centre is the router's recommendation (the backend focus), and
 * a ring marks it. But every section and book is clickable: click another
 * section and it slides to the centre while the rest keep their reading-order
 * heights; click another book to swing its moons into view. The recommendation
 * keeps its ring wherever it lands, so you can always see where you actually
 * stand while you look around. Structure and states come from the full ladder,
 * so the same colours mean the same thing everywhere.
 */

const VIEW_W = 1000;
const VIEW_H = 1040;
const CX = 540;
const CY = 585;
const SECTION_RAIL_Y = 72;
const SECTION_RAIL_STEP_X = 225;
const CENTRAL_SECTION_R = 68;
const RAIL_SECTION_R = 25;
const OPEN_RAIL_GHOST_R = 31;
const NEUTRAL_EDGE = "#8ea2c0";
// The one colour on this map that never means "state" or "section identity" —
// it means exactly one thing everywhere it appears: this is what the router
// recommends right now. Kept far from every section hue (gold, blue, green,
// purple) and every state colour so it can never be mistaken for either.
const RECOMMEND_GOLD = "#ffcf5c";

/** A compact 4-point sparkle, centred on the origin at radius 1 — the
 *  "recommended" badge glyph. Scaled and positioned by its caller. */
const SPARKLE_PATH = "M0,-1 C0.16,-0.16 0.16,-0.16 1,0 C0.16,0.16 0.16,0.16 0,1 C-0.16,0.16 -0.16,0.16 -1,0 C-0.16,-0.16 -0.16,-0.16 0,-1 Z";

const BOOK_PERIOD_MS = 108_000;
const MOON_PERIOD_MS = 40_000;
const STATE_ORDER: FocusState[] = ["sufficient", "below_baseline", "insufficient_evidence"];
const SECTION_RAIL_ORDER = ["TORAH", "FORMER", "LATTER", "WRITINGS"];

type MoonDatum = {
  key: string;
  label: string;
  chapter: string;
  state: FocusState;
  answered: number;
  displayScore: number | null;
  isFocus: boolean;
  passageRef: string;
  reread: string;
};

type LinkedNodeKind = "section" | "book" | "moon";
type LinkedNode = { kind: LinkedNodeKind; key: string };

const deg = (d: number) => (d * Math.PI) / 180;

const NO_BOOKS: ExploreBook[] = [];

const sectionHueFor = (s: { sectionKey: string; sectionName: string }) =>
  sectionHue({ node_key: s.sectionKey, label: s.sectionName });

function sectionRailRank(section: ExploreSection) {
  const key = section.sectionKey.toUpperCase();
  const name = section.sectionName.toLowerCase();
  if (key.includes("TORAH") || name.includes("torah")) return 0;
  if (key.includes("FORMER") || name.includes("former")) return 1;
  if (key.includes("LATTER") || name.includes("latter")) return 2;
  if (key.includes("WRIT") || name.includes("writ")) return 3;
  return SECTION_RAIL_ORDER.length;
}

/** The book a section opens to when it becomes central: the recommendation if
 *  it lives here, else the earliest one still needing work, else the first. */
function defaultBook(section: ExploreSection): ExploreBook | null {
  return (
    section.books.find((b) => b.isFocus)
    ?? section.books.find((b) => b.state !== "sufficient")
    ?? section.books[0]
    ?? null
  );
}

function moonFromLeaf(row: FocusPathRow): MoonDatum {
  return {
    key: row.node_key,
    label: readableUnitLabel(row.label),
    chapter: chapterRangeLabel(row.start_ch, row.end_ch),
    state: row.state,
    answered: row.answered,
    displayScore: row.display_score,
    isFocus: row.is_focus,
    passageRef: passageReference(row),
    reread: rereadHref(row),
  };
}

function moonFromUnit(u: ExploreBook["units"][number]): MoonDatum {
  const passageRef = bookPassage(u.bookName, u.startCh, u.endCh);
  return {
    key: u.unitKey,
    label: readableUnitLabel(u.label),
    chapter: chapterRangeLabel(u.startCh, u.endCh),
    state: u.state,
    answered: u.answered,
    displayScore: u.displayScore,
    isFocus: u.isFocus,
    passageRef,
    reread: rereadUrl(passageRef),
  };
}

function stateOpacity(state: FocusState) {
  return state === "sufficient" ? 1 : state === "below_baseline" ? 0.82 : 0.55;
}

function evidenceStatusLabel(state: FocusState, answered: number) {
  const evidence = sectionEvidence(answered);
  return `${STATE_LABELS[state]} · ${answered} answered · ${evidence.label}`;
}

function linkedNodeId(kind: LinkedNodeKind, key: string) {
  return `${kind}:${key}`;
}

/** Chapter counts for the Old Testament, used to fill in the parts of a book
 *  that no assessed unit yet covers so every book shows its whole span. */
const OT_CHAPTERS: Record<string, number> = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
  "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36, EZR: 10,
  NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8, ISA: 66,
  JER: 52, LAM: 5, EZE: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9, OBA: 1, JON: 4,
  MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
};

/** An uncovered chapter range: a real section of the book with no evidence yet,
 *  shown as a faint moon so the book reads as complete in extent. */
function gapMoon(book: ExploreBook, startCh: number, endCh: number): MoonDatum {
  const passageRef = bookPassage(book.bookName, startCh, endCh);
  return {
    key: `gap-${book.bookCode}-${startCh}-${endCh}`,
    label: startCh === endCh ? `Chapter ${startCh}` : `Chapters ${startCh}-${endCh}`,
    chapter: chapterRangeLabel(startCh, endCh),
    state: "insufficient_evidence",
    answered: 0,
    displayScore: null,
    isFocus: false,
    passageRef,
    reread: rereadUrl(passageRef),
  };
}

/** A book's sections in reading order, with any chapters no unit covers filled
 *  in as faint "not yet assessed" moons. */
function moonsForBook(book: ExploreBook): MoonDatum[] {
  const units = [...book.units].sort((a, b) => (a.startCh ?? 0) - (b.startCh ?? 0));
  const total = OT_CHAPTERS[book.bookCode]
    ?? units.reduce((max, u) => Math.max(max, u.endCh ?? 0), 0);

  const out: MoonDatum[] = [];
  let cursor = 1;
  for (const u of units) {
    const start = u.startCh ?? cursor;
    if (start > cursor) out.push(gapMoon(book, cursor, start - 1));
    out.push(moonFromUnit(u));
    cursor = Math.max(cursor, (u.endCh ?? start) + 1);
  }
  if (total >= cursor) out.push(gapMoon(book, cursor, total));
  return out;
}

export default function FocusStarMap({
  path,
  tree,
  focusTarget = null,
  revealAnimation = false,
  motionPaused = false,
  fullView = false,
  hasRecommendation = !path.isEmpty,
}: {
  path: FocusPath;
  tree: ExploreTree;
  focusTarget?: { sectionKey: string; bookCode?: string } | null;
  motionPaused?: boolean;
  fullView?: boolean;
  hasRecommendation?: boolean;
  /** When true, the map mounts with every non-central body invisible and
   *  scaled down, then flies the rest of the universe into frame a beat
   *  later. Self-contained: the component owns its own mount timing, so it
   *  works correctly regardless of when the caller's data became ready —
   *  no external CSS reaching in, no race with an async parent. */
  revealAnimation?: boolean;
}) {
  const sectionsList = tree.sections;

  // Two-frame delay before dropping the "entering" state: paints once with
  // everything but the centre hidden, then transitions to the full map. A
  // single rAF is sometimes still inside the frame that applied the initial
  // styles; nesting one more rAF guarantees the browser has actually
  // painted the hidden state before we transition away from it.
  const [revealing, setRevealing] = useState(
    revealAnimation && !(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  useEffect(() => {
    if (!revealing) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealing(false));
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trueFocusSectionKey = hasRecommendation ? path.focusSection?.node_key ?? null : null;
  const trueFocusBookCode = hasRecommendation ? path.focusBook?.book_code ?? null : null;

  const initialSectionKey =
    trueFocusSectionKey
    ?? sectionsList.find((s) => s.isFocus)?.sectionKey
    ?? sectionsList[0]?.sectionKey
    ?? "";
  const initialSection = sectionsList.find((s) => s.sectionKey === initialSectionKey) ?? null;
  const initialBookCode =
    (initialSection
      ? (trueFocusBookCode && initialSection.books.some((b) => b.bookCode === trueFocusBookCode)
          ? trueFocusBookCode
          : defaultBook(initialSection)?.bookCode)
      : undefined)
    ?? "";

  const [selectedSectionKey, setSelectedSectionKey] = useState(initialSectionKey);
  const [selectedBookCode, setSelectedBookCode] = useState(initialBookCode);
  const [selectedMoonKey, setSelectedMoonKey] = useState<string | null>(hasRecommendation ? path.focusLeaf?.node_key ?? null : null);
  const [activeNode, setActiveNode] = useState<LinkedNode | null>(null);
  const [readout, setReadout] = useState<{
    label: string; passageRef?: string; state: FocusState; answered: number; displayScore: number | null; color: string;
  } | null>(null);

  const selectedSection =
    sectionsList.find((s) => s.sectionKey === selectedSectionKey)
    ?? sectionsList.find((s) => s.isFocus)
    ?? sectionsList[0]
    ?? null;
  const hue = selectedSection ? sectionHueFor(selectedSection) : "#0aa3a3";

  useEffect(() => {
    if (!focusTarget) return;
    const section = sectionsList.find((s) => s.sectionKey === focusTarget.sectionKey);
    if (!section) return;
    setSelectedSectionKey(section.sectionKey);
    const bookCode = focusTarget.bookCode && section.books.some((b) => b.bookCode === focusTarget.bookCode)
      ? focusTarget.bookCode
      : defaultBook(section)?.bookCode ?? "";
    setSelectedBookCode(bookCode);
    setSelectedMoonKey(null);
    setReadout(null);
  }, [focusTarget, sectionsList]);

  const railSections = useMemo(
    () => [...sectionsList].sort((a, b) => {
      const rankDelta = sectionRailRank(a) - sectionRailRank(b);
      if (rankDelta !== 0) return rankDelta;
      return sectionsList.indexOf(a) - sectionsList.indexOf(b);
    }),
    [sectionsList],
  );
  const sectionMid = (railSections.length - 1) / 2;
  const railX = useCallback(
    (i: number) => CX + (i - sectionMid) * SECTION_RAIL_STEP_X,
    [sectionMid],
  );
  const selectedRailIndex = selectedSection
    ? railSections.findIndex((section) => section.sectionKey === selectedSection.sectionKey)
    : -1;
  const orbitCenterY = fullView ? 535 : CY;

  const books = selectedSection?.books ?? NO_BOOKS;
  const selectedBook =
    books.find((b) => b.bookCode === selectedBookCode)
    ?? (selectedSection ? defaultBook(selectedSection) : null);

  // Moons: the true focus book keeps its authored, verse-precise sections from
  // the focus path; any other book falls back to its ladder units.
  const moonRows: MoonDatum[] = useMemo(() => {
    if (!selectedBook) return [];
    if (selectedBook.bookCode === trueFocusBookCode && path.leaves.length > 0) {
      return path.leaves.map(moonFromLeaf);
    }
    return moonsForBook(selectedBook);
  }, [path.leaves, selectedBook, trueFocusBookCode]);

  const selectedBookIsFocus = selectedBook?.bookCode === trueFocusBookCode;

  // ---- layout -----------------------------------------------------------
  const layout = useMemo(() => {
    const bookOrbit = Math.min(330, 210 + books.length * 12);
    const moonOrbit = Math.min(125, 82 + moonRows.length * 7);

    const placedSections = railSections.map((s, i) => {
      const isCentral = s.sectionKey === selectedSection?.sectionKey;
      return {
        section: s,
        isCentral,
        isRecommendation: s.sectionKey === trueFocusSectionKey,
        tone: starTone(s.state, sectionHueFor(s)),
        r: isCentral ? CENTRAL_SECTION_R : RAIL_SECTION_R,
        x: isCentral ? CX : railX(i),
        y: isCentral ? orbitCenterY : SECTION_RAIL_Y,
        railX: railX(i),
      };
    });

    const placedBooks = books.map((b, i) => ({
      book: b,
      baseAngle: deg(-90) + (i / Math.max(books.length, 1)) * Math.PI * 2,
      isSelected: b.bookCode === selectedBookCode,
      isRecommendation: b.bookCode === trueFocusBookCode,
      tone: starTone(b.state, hue),
      r: b.bookCode === selectedBookCode ? 42 : 20,
    }));

    const placedMoons = moonRows.map((m, i) => ({
      moon: m,
      baseAngle: deg(-90) + (i / Math.max(moonRows.length, 1)) * Math.PI * 2,
      tone: starTone(m.state, hue),
      r: m.isFocus ? 14 : 9,
    }));

    return { bookOrbit, moonOrbit, placedSections, placedBooks, placedMoons };
  }, [books, hue, moonRows, orbitCenterY, railSections, railX, selectedBookCode, selectedSection?.sectionKey, trueFocusBookCode, trueFocusSectionKey]);

  const { bookOrbit, moonOrbit, placedSections, placedBooks, placedMoons } = layout;

  const bookXY = (angle: number) => ({
    x: CX + bookOrbit * Math.cos(angle),
    y: orbitCenterY + bookOrbit * Math.sin(angle),
  });
  const moonAbsXY = (planet: { x: number; y: number }, angle: number) => ({
    x: planet.x + moonOrbit * Math.cos(angle),
    y: planet.y + moonOrbit * Math.sin(angle),
  });

  const selectSection = (section: ExploreSection) => {
    setSelectedSectionKey(section.sectionKey);
    setSelectedBookCode(defaultBook(section)?.bookCode ?? "");
    setSelectedMoonKey(null);
    setReadout({
      label: section.sectionName, state: section.state, answered: section.answered,
      displayScore: null, color: starTone(section.state, sectionHueFor(section)).color,
    });
  };
  const selectBook = (book: ExploreBook) => {
    setSelectedBookCode(book.bookCode);
    setSelectedMoonKey(null);
    setReadout({
      label: book.bookName, state: book.state, answered: book.answered,
      displayScore: null, color: starTone(book.state, hue).color,
    });
  };
  const selectMoon = (m: MoonDatum) => {
    setSelectedMoonKey(m.key);
    setReadout({
      label: m.label, passageRef: m.passageRef, state: m.state, answered: m.answered,
      displayScore: m.displayScore, color: starTone(m.state, hue).color,
    });
  };

  const focusLeaf = hasRecommendation ? path.focusLeaf : null;
  const focusBook = hasRecommendation ? path.focusBook : null;
  const focusSection = hasRecommendation ? path.focusSection : null;
  const focusHue = focusSection ? sectionHue(focusSection) : hue;
  const focusTone = focusLeaf ? starTone(focusLeaf.state, focusHue) : starTone("insufficient_evidence", focusHue);
  const focusReference = focusLeaf ? passageReference(focusLeaf) : null;
  const focusReread = focusLeaf ? rereadHref(focusLeaf) : null;
  const selectedNodeId = selectedMoonKey
    ? linkedNodeId("moon", selectedMoonKey)
    : selectedBook
      ? linkedNodeId("book", selectedBook.bookCode)
      : selectedSection
        ? linkedNodeId("section", selectedSection.sectionKey)
        : null;
  const activeNodeId = activeNode ? linkedNodeId(activeNode.kind, activeNode.key) : selectedNodeId;
  const isLinked = (kind: LinkedNodeKind, key: string) => activeNodeId === linkedNodeId(kind, key);
  const activateNode = (kind: LinkedNodeKind, key: string) => setActiveNode({ kind, key });
  const clearActiveNode = () => setActiveNode(null);

  return (
    <div className={`fsm ${motionPaused ? "is-motion-paused" : ""} ${fullView ? "is-full-view" : ""}`}>
      <style>{FOCUS_STAR_MAP_STYLES}</style>

      <div className="fsm-layout">
      <div className="fsm-stage">
        <svg
          className="fsm-svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="group"
          aria-label="Explorable focus path solar system"
        >
          <defs>
            <filter id="fsm-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="fsm-granule" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="4" seed="7" result="n" />
              <feDiffuseLighting in="n" lightingColor="#ffffff" surfaceScale="2.2" result="lt">
                <feDistantLight azimuth="235" elevation="55" />
              </feDiffuseLighting>
              <feComposite in="lt" in2="SourceGraphic" operator="arithmetic" k1="1.15" k2="0" k3="0.25" k4="0" />
            </filter>
            <radialGradient id="fsm-hot">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="fsm-corona-grad">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="18%" stopColor="currentColor" stopOpacity="0.6" />
              <stop offset="55%" stopColor="currentColor" stopOpacity="0.15" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            {/* planet sphere shading: highlight lit from the upper-left fading
                to a dark lower-right limb, giving planets a solid, lit-sphere
                look distinct from the plasma of the stars */}
            <radialGradient id="fsm-sphere" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="38%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#05060c" stopOpacity="0.44" />
            </radialGradient>
            <marker id="fsm-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0.5,0.8 L9.2,5 L0.5,9.2 L2.4,5 Z" fill={NEUTRAL_EDGE} />
            </marker>
            {/* context-stroke lets one marker take the colour of its line, so
                tinted dependency / home arrows get matching arrowheads */}
            <marker id="fsm-arrow-tint" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
              <path d="M0.5,0.8 L9.2,5 L0.5,9.2 L2.4,5 Z" fill="context-stroke" />
            </marker>
            <marker id="fsm-arrow-faint" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0.5,0.8 L9.2,5 L0.5,9.2 L2.4,5 Z" fill="context-stroke" />
            </marker>
          </defs>

          {/* top rail: the four major OT sections are navigation, not the
              chapter outline. Keep them above the solar system so the left
              panel can stay dedicated to books and chapter sections. */}
          {placedSections.length > 0 && (
            <g className="fsm-section-rail">
              <line
                className="fsm-rail-track"
                x1={railX(0)}
                y1={SECTION_RAIL_Y}
                x2={railX(placedSections.length - 1)}
                y2={SECTION_RAIL_Y}
              />
              {selectedSection && selectedRailIndex >= 0 && (
                <g
                  className="fsm-rail-ghost"
                  transform={`translate(${railX(selectedRailIndex)} ${SECTION_RAIL_Y})`}
                  style={{ "--hue": hue } as CSSProperties}
                  aria-hidden="true"
                >
                  <circle className="fsm-rail-ghost-orb" r={OPEN_RAIL_GHOST_R} />
                  <text className="fsm-rail-ghost-label" y={OPEN_RAIL_GHOST_R + 22}>{selectedSection.sectionName}</text>
                </g>
              )}
              {placedSections.map((s, i) => (
                <g
                  key={s.section.sectionKey}
                  id={focusNodeDomId({ depth: 1, node_key: s.section.sectionKey })}
                  className={`fsm-body fsm-section ${s.isCentral ? "is-open" : ""} ${isLinked("section", s.section.sectionKey) ? "is-linked" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={s.isCentral}
                  aria-label={`${s.section.sectionName}. ${s.isCentral ? "Open section. " : ""}${STATE_LABELS[s.section.state]}.${s.isRecommendation ? " Recommended focus." : ""}${s.isCentral ? "" : " Select to open."}`}
                  style={{
                    transform: `translate(${s.x}px, ${s.y}px) scale(${revealing && !s.isCentral ? 0.3 : 1})`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    opacity: revealing && !s.isCentral ? 0 : 1,
                  } as CSSProperties}
                  onMouseEnter={() => activateNode("section", s.section.sectionKey)}
                  onMouseLeave={clearActiveNode}
                  onFocus={() => activateNode("section", s.section.sectionKey)}
                  onBlur={clearActiveNode}
                  onClick={() => selectSection(s.section)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSection(s.section); } }}
                >
                  <Orb r={s.r} tone={s.tone} index={i} kind="star" seed={hashSeed(s.section.sectionKey)} focusRing={s.isRecommendation} selected={(s.isCentral || isLinked("section", s.section.sectionKey)) && !s.isRecommendation} />
                  <text className="fsm-label" style={{ fontSize: s.isCentral ? 22 : undefined }} x={0} y={s.r + (s.isCentral ? 25 : 22)} textAnchor="middle">{s.section.sectionName}</text>
                </g>
              ))}
            </g>
          )}

          {/* book orbit ring, centred on the selected star's slot */}
          {placedBooks.length > 0 && (
            <>
              <circle className="fsm-orbit-ring" cx={CX} cy={orbitCenterY} r={bookOrbit} />
              <OrbitArrows cx={CX} cy={orbitCenterY} r={bookOrbit} />
            </>
          )}

          {/* books orbiting the central star; the selected book carries its moons.
              Keyed on the section so the orbit remounts and restarts in sync with
              its (also fresh) counter groups — otherwise labels would tilt. */}
          <g
            key={`orbit-${selectedSection?.sectionKey ?? ""}`}
            className="fsm-orbit"
            style={{
              transformBox: "view-box", transformOrigin: `${CX}px ${orbitCenterY}px`,
              animationDuration: `${BOOK_PERIOD_MS}ms`,
              opacity: revealing ? 0 : 1,
            } as CSSProperties}
          >
            {placedBooks.map((b, i) => {
              const p = bookXY(b.baseAngle);
              const labelSize = b.isSelected ? 17 : books.length > 10 ? 11 : books.length > 6 ? 13 : 14;
              return (
                <g
                  key={b.book.bookCode}
                  className="fsm-counter"
                  style={{ transformBox: "view-box", transformOrigin: `${p.x}px ${p.y}px`, animationDuration: `${BOOK_PERIOD_MS}ms` } as CSSProperties}
                >
                  {b.isSelected && placedMoons.length > 0 && (
                    <circle className="fsm-orbit-ring" cx={p.x} cy={p.y} r={moonOrbit} />
                  )}

                  <g
                    id={focusNodeDomId({ depth: 2, node_key: b.book.bookCode })}
                    className={`fsm-body ${isLinked("book", b.book.bookCode) ? "is-linked" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${b.book.bookName}. ${STATE_LABELS[b.book.state]}.${b.isRecommendation ? " Recommended book." : ""} Select to open its sections.`}
                    transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
                    onMouseEnter={() => activateNode("book", b.book.bookCode)}
                    onMouseLeave={clearActiveNode}
                    onFocus={() => activateNode("book", b.book.bookCode)}
                    onBlur={clearActiveNode}
                    onClick={() => selectBook(b.book)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectBook(b.book); } }}
                  >
                    <Orb r={b.r} tone={b.tone} index={i} kind="planet" seed={hashSeed(b.book.bookCode)} focusRing={b.isRecommendation} selected={(b.isSelected || isLinked("book", b.book.bookCode)) && !b.isRecommendation} />
                    <text className="fsm-label" style={{ fontSize: labelSize }} x={b.r + 10} y={0}>
                      <tspan fillOpacity={0.5} fontWeight={600}>{i + 1} </tspan>{b.book.bookName}
                    </text>
                  </g>

                  {b.isSelected && placedMoons.length > 0 && (
                    <g
                      className="fsm-moon-orbit"
                      style={{
                        transformBox: "view-box", transformOrigin: `${p.x}px ${p.y}px`,
                        animationDuration: `${MOON_PERIOD_MS}ms`,
                        opacity: revealing ? 0 : 1,
                      } as CSSProperties}
                    >
                      {placedMoons.map((m, j) => {
                        const mp = moonAbsXY(p, m.baseAngle);
                        return (
                          <g
                            key={m.moon.key}
                            className="fsm-counter"
                            style={{ transformBox: "view-box", transformOrigin: `${mp.x}px ${mp.y}px`, animationDuration: `${MOON_PERIOD_MS}ms` } as CSSProperties}
                          >
                            <g
                              id={focusNodeDomId({ depth: 3, node_key: m.moon.key })}
                              className={`fsm-body ${isLinked("moon", m.moon.key) ? "is-linked" : ""}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`${m.moon.label}. ${STATE_LABELS[m.moon.state]}.`}
                              transform={`translate(${mp.x.toFixed(2)} ${mp.y.toFixed(2)})`}
                              onMouseEnter={() => activateNode("moon", m.moon.key)}
                              onMouseLeave={clearActiveNode}
                              onFocus={() => activateNode("moon", m.moon.key)}
                              onBlur={clearActiveNode}
                              onClick={() => selectMoon(m.moon)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectMoon(m.moon); } }}
                            >
                              <Orb r={m.r} tone={m.tone} index={j} kind="moon" seed={hashSeed(m.moon.key)} focusRing={m.moon.isFocus} selected={(selectedMoonKey === m.moon.key || isLinked("moon", m.moon.key)) && !m.moon.isFocus} />
                              {m.moon.chapter && <text className="fsm-moon-label" x={m.r + 5} y={0}>{m.moon.chapter}</text>}
                            </g>
                          </g>
                        );
                      })}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <p className="fsm-hint">
          {hasRecommendation
            ? "Select any star or planet to explore it · the gold ring and spark mark your recommended focus"
            : "Select any star or planet to explore the blank map · assessment results will fill these areas in"}
        </p>
      </div>

      <div className="fsm-side">
        {focusLeaf && focusBook && focusSection && focusReference && focusReread && (
          <div
            className="fsm-panel fsm-next"
            style={{
              "--hue": focusHue,
              "--dot": focusTone.color,
              "--dot-opacity": stateOpacity(focusLeaf.state),
            } as CSSProperties}
          >
            <p className="fsm-next-kicker">Recommended now</p>
            <span className="fsm-next-ref">{focusReference}</span>
            <h2 className="fsm-next-title">{readableUnitLabel(focusLeaf.label)}</h2>
            <p className="fsm-breadcrumb">
              Old Testament › {focusSection.label} › {focusBook.label}
            </p>
            <span className="fsm-next-state">
              {evidenceStatusLabel(focusLeaf.state, focusLeaf.answered)}
            </span>
            <div className="fsm-next-actions">
              <a className="fsm-action primary" href={focusReread} target="_blank" rel="noopener noreferrer">
                Reread passage ↗
              </a>
              <Link className="fsm-action secondary" href="/assess">
                Assess
              </Link>
            </div>
          </div>
        )}

        {selectedSection && (
          <div className="fsm-panel fsm-course" style={{ "--hue": hue } as CSSProperties}>
            <div className="fsm-course-head">
              <div>
                <p className="fsm-panel-kicker">Course outline</p>
                <h3 className="fsm-course-title">{selectedSection.sectionName}</h3>
                <p className="fsm-course-sub">{selectedSection.books.length} books · select a book to inspect its sections</p>
              </div>
              <span
                className="fsm-course-status"
                style={{
                  "--dot": starTone(selectedSection.state, hue).color,
                  "--dot-opacity": stateOpacity(selectedSection.state),
                } as CSSProperties}
              >
                <span className="fsm-status-dot" aria-hidden="true" />
                {STATE_LABELS[selectedSection.state]}
              </span>
            </div>
            {selectedSection.books.map((book) => {
              const bookTone = starTone(book.state, hue);
              const isBookSelected = selectedBook?.bookCode === book.bookCode;
              return (
                <div key={book.bookCode} className="fsm-book-group">
                  <button
                    type="button"
                    className={`fsm-book-row ${isBookSelected ? "is-selected" : ""} ${isLinked("book", book.bookCode) ? "is-linked" : ""}`}
                    style={{ "--row-hue": hue } as CSSProperties}
                    onMouseEnter={() => activateNode("book", book.bookCode)}
                    onMouseLeave={clearActiveNode}
                    onFocus={() => activateNode("book", book.bookCode)}
                    onBlur={clearActiveNode}
                    onClick={() => selectBook(book)}
                  >
                    <span>
                      <span
                        className="fsm-book-name"
                        style={{
                          "--dot": bookTone.color,
                          "--dot-opacity": stateOpacity(book.state),
                        } as CSSProperties}
                      >
                        <span className="fsm-status-dot" aria-hidden="true" />
                        {book.bookName}
                      </span>
                      <span className="fsm-book-meta">
                        {STATE_LABELS[book.state]} · {book.answered} answered
                      </span>
                    </span>
                    <span className="fsm-pips" aria-label={`${book.units.length} chapter sections`}>
                      {book.units.map((unit) => {
                        const unitTone = starTone(unit.state, hue);
                        return (
                          <span
                            key={unit.unitKey}
                            className="fsm-pip"
                            title={`${readableUnitLabel(unit.label)}: ${evidenceStatusLabel(unit.state, unit.answered)}`}
                            style={{
                              "--dot": unitTone.color,
                              "--dot-opacity": stateOpacity(unit.state),
                            } as CSSProperties}
                          />
                        );
                      })}
                    </span>
                  </button>

                  {isBookSelected && (
                    <div className="fsm-inline-units" aria-label={`${book.bookName} chapter sections`}>
                      <div className="fsm-inline-head">
                        <span>{book.bookName} sections</span>
                        <span>{selectedBookIsFocus ? focusModeCopy(path.focusMode) : "Reading order"}</span>
                      </div>
                      {moonRows.map((m) => {
                        const tone = starTone(m.state, hue);
                        const linked = isLinked("moon", m.key);
                        const selected = selectedMoonKey === m.key;
                        return (
                          <div
                            key={m.key}
                            className={`fsm-inline-unit ${m.isFocus ? "is-focus" : ""} ${selected ? "is-selected" : ""} ${linked ? "is-linked" : ""} ${tone.faint && !m.isFocus ? "is-thin" : ""}`}
                            style={{ "--dot": tone.color, "--dot-opacity": stateOpacity(m.state), "--hue": hue } as CSSProperties}
                            onMouseEnter={() => activateNode("moon", m.key)}
                            onMouseLeave={clearActiveNode}
                          >
                            <button
                              type="button"
                              className="fsm-inline-unit-main"
                              onFocus={() => activateNode("moon", m.key)}
                              onBlur={clearActiveNode}
                              onClick={() => selectMoon(m)}
                            >
                              <span className="fsm-inline-dot" aria-hidden="true" />
                              <span>
                                {hasRecommendation && m.isFocus && selectedBookIsFocus && (
                                  <span className="fsm-inline-kicker">{focusLeafKicker(path.focusMode)}</span>
                                )}
                                <span className="fsm-inline-ref">{m.passageRef}</span>
                                <span className="fsm-inline-name">{m.label}</span>
                                <span className="fsm-inline-state">{evidenceStatusLabel(m.state, m.answered)}</span>
                              </span>
                            </button>
                            <span className="fsm-inline-score">{m.displayScore ?? "--"}</span>
                            <a className="fsm-inline-reread" href={m.reread} target="_blank" rel="noopener noreferrer">
                              Reread <span aria-hidden="true">↗</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="fsm-panel fsm-legend" aria-label="Competency legend" style={{ "--hue": hue } as CSSProperties}>
          <p className="fsm-legend-title">{selectedSection?.sectionName ?? "Section"} competency key</p>
          {STATE_ORDER.map((state) => {
            const tone = starTone(state, hue);
            return (
              <div
                key={state}
                className="fsm-legend-row"
                style={{
                  "--dot": tone.color,
                  "--dot-opacity": stateOpacity(state),
                } as CSSProperties}
              >
                <span className="fsm-legend-dot" aria-hidden="true" />
                <span>{STATE_LABELS[state]}</span>
              </div>
            );
          })}
          {hasRecommendation && (
            <div className="fsm-legend-row" style={{ marginTop: 12 }}>
              <svg width={22} height={22} viewBox="-11 -11 22 22" style={{ flexShrink: 0, overflow: "visible" }} aria-hidden="true">
                <circle cx={0} cy={0} r={5} fill="rgba(255,255,255,0.5)" />
                <circle cx={0} cy={0} r={8} fill="none" stroke={RECOMMEND_GOLD} strokeWidth={1.7} />
                <path d={SPARKLE_PATH} transform="translate(5.8 -5.8) scale(2.4)" fill={RECOMMEND_GOLD} />
              </svg>
              <span>Ring + spark = recommended</span>
            </div>
          )}
        </div>

        {readout && (
          <div className="fsm-readout">
            <div className="fsm-readout-chip">
              <span className="fsm-readout-score">{readout.displayScore ?? "--"}</span>
              <span className="fsm-readout-scorelbl">BLI</span>
            </div>
            <div>
              {readout.passageRef && <span className="fsm-readout-ref">{readout.passageRef}</span>}
              <p className="fsm-readout-name">{readout.label}</p>
              <span className="fsm-readout-state" style={{ "--dot": readout.color } as CSSProperties}>
                {evidenceStatusLabel(readout.state, readout.answered)}
              </span>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/** Deterministic per-node seed, so a given book/section always looks the same. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619)) >>> 0;
  return h;
}

/** Mix two #rrggbb colours (t = weight of b). */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  const to = (x: number) => Math.round(x).toString(16).padStart(2, "0");
  return `#${to(ar + (br - ar) * t)}${to(ag + (bg - ag) * t)}${to(ab + (bb - ab) * t)}`;
}

/** A subtle, seeded lightness nudge so no two bodies look identical. */
function jitter(color: string, seed: number): string {
  const t = (((seed >> 3) % 7) - 3) * 0.02; // -0.06 .. +0.06
  return t >= 0 ? mix(color, "#ffffff", t) : mix(color, "#04050b", -t);
}

type OrbKind = "star" | "planet" | "moon";

/**
 * A single celestial body. Stars burn (plasma disc, corona, diffraction
 * spikes); planets are lit spheres (shaded, some ringed); moons are small
 * spheres. Each is nudged subtly by its seed so siblings differ, while state
 * still governs colour and brightness.
 */
function Orb({
  r,
  tone,
  index,
  kind,
  seed,
  focusRing = false,
  selected = false,
}: {
  r: number;
  tone: StarTone;
  index: number;
  kind: OrbKind;
  seed: number;
  focusRing?: boolean;
  selected?: boolean;
}) {
  const { core, glow, bright } = tone;
  const small = kind === "moon";
  const color = jitter(tone.color, seed);
  const ringed = kind === "planet" && seed % 3 === 0;      // ~a third of planets
  const ringTilt = ((seed >> 5) % 44) - 22;

  return (
    <>
      <circle className="fsm-hit" cx={0} cy={0} r={r + 14} />

      {/* glow: a wide corona for stars, a tighter atmosphere for planets/moons */}
      <g style={{ color } as CSSProperties}>
        <circle
          className="fsm-corona" cx={0} cy={0}
          r={r * (kind === "star" ? (bright ? 2.9 : 2.5) : bright ? 1.9 : 1.6)}
          fill="url(#fsm-corona-grad)" opacity={glow * (bright ? 0.95 : 0.68)}
          style={{ animationDelay: `${index * 0.7}s` } as CSSProperties}
        />
      </g>

      {/* stars sparkle when complete; planets/moons do not (they aren't suns) */}
      {bright && kind === "star" && (
        <g className="fsm-spikes" style={{ animationDelay: `${index * 0.5}s` } as CSSProperties}>
          <path d={`M ${-r * 2.5} 0 L 0 -1 L ${r * 2.5} 0 L 0 1 Z`} fill={color} />
          <path d={`M 0 ${-r * 2.5} L 1 0 L 0 ${r * 2.5} L -1 0 Z`} fill={color} />
        </g>
      )}

      {/* Saturn-like ring behind the disc for some planets */}
      {ringed && (
        <g transform={`rotate(${ringTilt})`}>
          <ellipse cx={0} cy={0} rx={r * 1.9} ry={r * 0.52} fill="none" stroke={mix(color, "#ffffff", 0.35)} strokeWidth={r * 0.14} opacity={0.5} />
        </g>
      )}

      {kind === "star" ? (
        <>
          {/* plasma disc, granulated and rotated by seed so surfaces differ */}
          <g transform={`rotate(${seed % 360})`}>
            <circle
              className="fsm-core fsm-twinkle" cx={0} cy={0} r={r}
              fill={color} opacity={core} filter="url(#fsm-granule)"
              style={{ animationDelay: `${index * 0.5}s` } as CSSProperties}
            />
          </g>
          <circle cx={0} cy={0} r={r} fill="none" stroke={bright ? "#fff" : color} strokeWidth={bright ? 1.6 : 1.1} opacity={bright ? 0.9 : core * 0.8} filter="url(#fsm-glow)" />
          <circle cx={0} cy={0} r={r * (bright ? 0.58 : 0.4)} fill="url(#fsm-hot)" opacity={bright ? core : core * 0.45} />
        </>
      ) : (
        <>
          {/* lit sphere: flat disc, then the shading overlay for volume */}
          <circle className="fsm-core" cx={0} cy={0} r={r} fill={color} opacity={core} />
          <circle cx={0} cy={0} r={r} fill="url(#fsm-sphere)" opacity={0.9} />
          <circle cx={0} cy={0} r={r} fill="none" stroke={bright ? "#fff" : mix(color, "#ffffff", 0.25)} strokeWidth={bright ? 1.4 : 1} opacity={bright ? 0.85 : 0.5} />
          {bright && <circle cx={0} cy={0} r={r * 0.5} fill="url(#fsm-hot)" opacity={0.85} />}
        </>
      )}

      {focusRing && (() => {
        const ringR = r + (small ? 4 : 8);
        // Badge sits on the ring's upper-right rim, like a pin — clear of
        // every label in this file, which all sit left, right, or below.
        const badgeAngle = -Math.PI / 4;
        const badgeR = Math.max(3.5, r * (small ? 0.34 : 0.3));
        const badgeX = ringR * Math.cos(badgeAngle);
        const badgeY = ringR * Math.sin(badgeAngle);
        return (
          <g>
            <circle className="fsm-ring" cx={0} cy={0} r={ringR} fill="none" stroke={RECOMMEND_GOLD} strokeWidth={2} opacity={0.95} />
            <circle cx={badgeX} cy={badgeY} r={badgeR + 2.2} fill="#0a0e1c" opacity={0.92} />
            <path
              d={SPARKLE_PATH}
              transform={`translate(${badgeX} ${badgeY}) scale(${badgeR})`}
              fill={RECOMMEND_GOLD} stroke="rgba(0,0,12,0.55)" strokeWidth={0.35 / badgeR} strokeLinejoin="round"
            />
            {/* Spelled-out tag on bodies with room for it — the central star
                and the open book, where "above" is clear of every other
                label. Skipped on moons and on small (non-central / unopened)
                stars and planets, where a neighbour in the same column could
                sit close enough to collide with it — the ring + badge alone
                still carries the meaning there. */}
            {kind !== "moon" && r >= 30 && (
              <g transform={`translate(0 ${-(ringR + 13)})`}>
                <rect x={-38} y={-9} width={76} height={16} rx={8} fill="#0a0e1c" opacity={0.92} stroke={RECOMMEND_GOLD} strokeWidth={1} strokeOpacity={0.5} />
                <text
                  x={0} y={0.5} textAnchor="middle" dominantBaseline="middle"
                  fontFamily="var(--font-inter), system-ui, sans-serif" fontSize={9} fontWeight={800}
                  letterSpacing="0.06em" fill={RECOMMEND_GOLD}
                >
                  RECOMMENDED
                </text>
              </g>
            )}
          </g>
        );
      })()}
      {selected && !focusRing && (
        <circle cx={0} cy={0} r={r + 5} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1.4} strokeDasharray="3 3" />
      )}
    </>
  );
}

/** Two tangential arrowheads on the orbit ring, marking the reading direction. */
function OrbitArrows({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const head = (angleDeg: number) => {
    const a = deg(angleDeg);
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    const back = 9;
    const wing = 5;
    const bx = px - tx * back;
    const by = py - ty * back;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    return `M ${px} ${py} L ${bx + nx * wing} ${by + ny * wing} L ${bx - nx * wing} ${by - ny * wing} Z`;
  };
  return (
    <g fill={NEUTRAL_EDGE} opacity={0.5}>
      <path d={head(-20)} />
      <path d={head(160)} />
    </g>
  );
}
