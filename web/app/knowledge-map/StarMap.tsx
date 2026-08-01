"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  GALAXY_ERAS,
  SECTION_CHRONO,
  bookChrono,
  formatYear,
  spanStartYear,
  yearToPos,
} from "./chronology";

/**
 * A single hierarchy-and-chronology map of the Old Testament.
 *
 * The vertical axis is time, so the chronology rail on the left lines up with
 * every body on the field. Horizontal position is dependency depth: Torah sits
 * at the head, Former Prophets hangs off it, Latter Prophets off both, and so
 * on. Edges are drawn parent -> child, so what a section rests on is visible
 * rather than implied.
 *
 * Brightness carries the evidence: untested bodies stay grey and dim, and the
 * more evidence behind an area the brighter and more saturated it burns.
 */

export type StarStateKey = "untested" | "early" | "review" | "developing" | "established" | "strong";

export type StarNode = {
  stateKey: StarStateKey;
  stateLabel: string;
  stateCopy: string;
  displayScore: number | null;
  answered: number;
  bankCount: number;
};

export type MoonNode = { key: string; label: string; short: string; node: StarNode };
export type PlanetNode = { code: string; name: string; node: StarNode; focusLabel?: string | null };
export type SectionNode = {
  key: string;
  color: string;
  range: string;
  role: string;
  description: string;
  node: StarNode;
  books: PlanetNode[];
};

type Level = "galaxy" | "system" | "planet";

const STATE_VIS: Record<StarStateKey, { glow: number; core: number; grey: boolean }> = {
  untested:    { glow: 0.16, core: 0.58, grey: true },
  early:       { glow: 0.28, core: 0.72, grey: true },
  review:      { glow: 0.48, core: 0.84, grey: false },
  developing:  { glow: 0.66, core: 0.92, grey: false },
  established: { glow: 0.85, core: 0.97, grey: false },
  strong:      { glow: 1.00, core: 1.00, grey: false },
};

const GREY = "#7b8493";
const EDGE_NEUTRAL = "#8ea2c0";
const markerId = (c: string) => `sm-arw-${c.replace("#", "")}`;
const VIEW_W = 880;
const VIEW_H = 660;
const RAIL_TICK_X = 142;   // right edge of the rail's text column
const FIELD_L = 196;
const FIELD_R = 856;
const PAD_T = 44;
const PAD_B = 40;

const posToY = (pos: number) => PAD_T + pos * (VIEW_H - PAD_T - PAD_B);
const fieldX = (f: number) => FIELD_L + f * (FIELD_R - FIELD_L);

/**
 * BLI -> star temperature. Real stars run red (cool) to blue-white (hot),
 * so the score maps onto that sequence: ember red at the bottom of the
 * scale, yellow-white through the middle, blue-white at the top.
 */
const TEMP_STOPS: Array<[number, [number, number, number]]> = [
  [0,   [217, 106, 79]],   // ember red
  [200, [232, 160, 76]],   // orange
  [400, [243, 211, 138]],  // yellow-white
  [600, [245, 242, 234]],  // white
  [800, [168, 197, 255]],  // blue-white
];

function bliTempColor(score: number): string {
  const v = Math.max(0, Math.min(800, score));
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const [y0, c0] = TEMP_STOPS[i];
    const [y1, c1] = TEMP_STOPS[i + 1];
    if (v >= y0 && v <= y1) {
      const f = (v - y0) / (y1 - y0);
      const hex = (k: number) => Math.round(c0[k] + f * (c1[k] - c0[k])).toString(16).padStart(2, "0");
      return `#${hex(0)}${hex(1)}${hex(2)}`;
    }
  }
  return "#a8c5ff";
}

/** Hue carries the score; grey means there is no score to show yet. */
function starColor(node: StarNode) {
  if (STATE_VIS[node.stateKey].grey || node.displayScore === null) return GREY;
  return bliTempColor(node.displayScore);
}

/** "1526 – 1445 BC" -> "1526–1445", so it fits the narrow rail. */
function compactSpan(span: string): string {
  return span.replace(/\s*–\s*/, "–").replace(/\s*BC\s*$/, "").replace(/^c\.\s*/, "c.");
}

/**
 * A vertical parent -> child connector down a shared column, trimmed at both
 * rims to leave room for the arrowhead. `bow` arcs the line out to the side
 * (positive = right) so an edge that skips over an intermediate node goes
 * around it instead of through it.
 */
function vEdge(x: number, y1: number, r1: number, y2: number, r2: number, bow = 0) {
  const sy = y1 + r1 + 8;
  const ey = y2 - r2 - 12;
  if (!bow) return `M ${x} ${sy} L ${x} ${ey}`;
  return `M ${x} ${sy} C ${x + bow} ${sy + (ey - sy) * 0.22}, ${x + bow} ${ey - (ey - sy) * 0.22}, ${x} ${ey}`;
}

/** Deterministic PRNG — the backdrop must match between server and client. */
function seeded(seed: number) {
  let v = seed >>> 0;
  return () => {
    v = (v * 1664525 + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

const BACKDROP = (() => {
  const rand = seeded(20260731);
  return Array.from({ length: 110 }, () => ({
    x: rand() * VIEW_W,
    y: rand() * VIEW_H,
    r: 0.4 + rand() * 1.5,
    o: 0.18 + rand() * 0.5,
    delay: rand() * 6,
    dur: 3 + rand() * 4.5,
  }));
})();

export default function StarMap({
  sections,
  getDimensions,
  onExplore,
}: {
  sections: SectionNode[];
  getDimensions: (bookCode: string) => MoonNode[];
  onExplore?: (bookCode: string) => void;
}) {
  const [sectionKey, setSectionKey] = useState<string | null>(null);
  const [bookCode, setBookCode] = useState<string | null>(null);
  const [focusMoon, setFocusMoon] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const level: Level = bookCode ? "planet" : sectionKey ? "system" : "galaxy";
  const section = sections.find(s => s.key === sectionKey) ?? null;
  const planet = section?.books.find(b => b.code === bookCode) ?? null;
  const moons = bookCode ? getDimensions(bookCode) : [];

  const goUp = useCallback(() => {
    setFocusMoon(null);
    if (bookCode) setBookCode(null);
    else if (sectionKey) setSectionKey(null);
  }, [bookCode, sectionKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (bookCode || sectionKey)) { e.preventDefault(); goUp(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookCode, goUp, sectionKey]);

  useEffect(() => { statusRef.current?.focus(); }, [level, sectionKey, bookCode]);

  const activeMoon = moons.find(m => m.key === focusMoon) ?? null;
  const chrono = planet ? bookChrono(planet.code) : null;
  const sectionChrono = section ? SECTION_CHRONO.find(c => c.key === section.key) ?? null : null;

  const detail = activeMoon
    ? { title: activeMoon.label, sub: activeMoon.short, node: activeMoon.node, when: chrono?.span ?? null }
    : planet
      ? { title: planet.name, sub: chrono?.note ?? "", node: planet.node, when: chrono?.span ?? null }
      : section
        ? { title: section.key, sub: sectionChrono?.role ?? section.range, node: section.node, when: sectionChrono?.span ?? null }
        : null;

  // ---- Layout per level -------------------------------------------------

  type Placed = {
    id: string; label: string; sub?: string; y: number; x: number;
    node: StarNode; r: number; onOpen?: () => void; ariaExtra: string;
    pressed?: boolean;
  };

  let placed: Placed[] = [];
  let edges: Array<{ from: string; to: string; color: string; bow?: number }> = [];
  let ticks: Array<{ y: number; label: string; sub?: string }> = [];
  let railTitle = "";

  if (level === "galaxy") {
    railTitle = "Creation – 430 BC";
    ticks = GALAXY_ERAS.map(e => ({ y: posToY(yearToPos(e.year)), label: e.label, sub: formatYear(e.year) }));
    placed = sections.map((s) => {
      const c = SECTION_CHRONO.find(x => x.key === s.key);
      return {
        id: s.key,
        label: s.key,
        sub: c?.span ?? s.range,
        y: posToY(yearToPos(c?.anchor ?? 1000)),
        x: fieldX(0.30),
        node: s.node,
        r: 26,
        onOpen: () => setSectionKey(s.key),
        ariaExtra: `${c?.span ?? s.range}. ${c?.dependsOn.length ? `Depends on ${c.dependsOn.join(" and ")}.` : "Foundation — depends on nothing prior."} Zoom in to see its books.`,
      };
    });
    // One arrow per dependency, tinted with its source's colour — so Latter
    // Prophets visibly receives a separate arrow from Torah and from Former.
    // Adjacent links run straight down the column; links that skip over a
    // section bow around it — Torah's on the right, Former's on the left.
    const BOWS: Record<string, number> = {
      "Torah->Former Prophets": 0,
      "Former Prophets->Latter Prophets": 0,
      "Torah->Latter Prophets": 130,
      "Torah->Writings": 205,
      "Former Prophets->Writings": -130,
    };
    edges = SECTION_CHRONO.flatMap(c => c.dependsOn.map(dep => ({
      from: dep, to: c.key,
      color: sections.find(x => x.key === dep)?.color ?? EDGE_NEUTRAL,
      bow: BOWS[`${dep}->${c.key}`] ?? 0,
    })));
  }

  if (level === "system" && section) {
    railTitle = sectionChrono?.span ?? section.range;
    const ordered = [...section.books].sort((a, b) => {
      const ca = bookChrono(a.code), cb = bookChrono(b.code);
      return (spanStartYear(cb) - spanStartYear(ca)) || (cb.anchor - ca.anchor);
    });

    // Book anchors bunch up badly (Genesis spans millennia, Leviticus one year),
    // so books are spaced evenly by chronological rank and each carries its own
    // real date on the rail. Order stays true; spacing stays readable.
    const yFor = (i: number) => posToY(ordered.length === 1 ? 0.5 : i / (ordered.length - 1));

    ticks = ordered.map((b, i) => ({ y: yFor(i), label: compactSpan(bookChrono(b.code).span) }));

    placed = ordered.map((b, i) => ({
      id: b.code,
      label: b.name,
      y: yFor(i),
      x: fieldX(0.18),
      node: b.node,
      r: 14,
      onOpen: () => setBookCode(b.code),
      ariaExtra: `${bookChrono(b.code).span}. ${b.node.stateLabel}. Zoom in to see its dimensions.`,
    }));
    edges = ordered.slice(1).map((b, i) => ({ from: ordered[i].code, to: b.code, color: EDGE_NEUTRAL }));
  }

  if (level === "planet" && planet) {
    railTitle = chrono?.span ?? "";
    ticks = [{ y: posToY(0.16), label: chrono?.span ?? "", sub: "period covered" }];
    // Dimensions are not dated, so they fan out beneath the book itself.
    placed = [{
      id: `__book__${planet.code}`,
      label: planet.name,
      sub: chrono?.span,
      y: posToY(0.10),
      x: fieldX(0.30),
      node: planet.node,
      r: 30,
      ariaExtra: `${chrono?.span ?? ""}. ${planet.node.stateLabel}.`,
    }];
    moons.forEach((m, i) => {
      placed.push({
        id: m.key,
        label: m.short,
        sub: m.label,
        y: posToY(0.30 + i * 0.108),
        x: fieldX(0.30),
        node: m.node,
        r: 11,
        pressed: focusMoon === m.key,
        onOpen: () => setFocusMoon(focusMoon === m.key ? null : m.key),
        ariaExtra: `${m.label}. ${m.node.stateLabel}. ${m.node.answered} answered.`,
      });
    });
    // Fan the edges out on alternating sides so seven arrows from one book
    // stay readable down a single column.
    edges = moons.map((m, i) => ({
      from: `__book__${planet.code}`, to: m.key, color: EDGE_NEUTRAL,
      bow: i === 0 ? 0 : (i % 2 === 0 ? 1 : -1) * (34 + Math.floor(i / 2) * 26),
    }));
  }

  const byId = new Map(placed.map(p => [p.id, p]));
  const arrowColors = Array.from(new Set([...sections.map(s => s.color), EDGE_NEUTRAL]));

  return (
    <div className="starmap">
      <style>{`
        .starmap { position: relative; }
        .sm-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .sm-crumb { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: rgba(255,255,255,.5); }
        .sm-crumb button { background: none; border: 0; padding: 2px 4px; cursor: pointer; font: inherit; color: #4fd6d6; border-radius: 5px; }
        .sm-crumb button:hover { text-decoration: underline; }
        .sm-crumb span[aria-current] { color: #fff; }
        .sm-back {
          margin-left: auto; display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 999px; cursor: pointer; font: inherit;
          font-size: 12.5px; font-weight: 650;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16); color: #fff;
        }
        .sm-back:hover { background: rgba(255,255,255,.14); }
        .sm-back:disabled { opacity: .3; cursor: not-allowed; }
        .sm-stage {
          position: relative; border-radius: 18px; overflow: hidden; max-width: 900px; margin: 0 auto;
          border: 1px solid rgba(255,255,255,.12);
          background: radial-gradient(ellipse at 62% 30%, rgba(20,28,54,.92), rgba(9,12,26,.97));
          box-shadow: inset 0 0 80px rgba(0,0,0,.5);
        }
        .sm-svg { display: block; width: 100%; height: auto; touch-action: manipulation; }
        .sm-hint { position: absolute; left: 14px; bottom: 10px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,.32); pointer-events: none; }

        .sm-body { cursor: pointer; }
        .sm-body:focus { outline: none; }
        .sm-body:focus-visible .sm-hit { stroke: #fff; stroke-width: 2; }
        .sm-body:hover .sm-core { filter: brightness(1.4); }
        .sm-static { cursor: default; }
        .sm-hit { fill: transparent; stroke: transparent; }
        .sm-core { stroke: rgba(255,255,255,.28); stroke-width: 1; }
        .sm-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13px; font-weight: 700; fill: rgba(255,255,255,.88);
          pointer-events: none; dominant-baseline: middle;
        }
        .sm-sub {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 10px; font-weight: 600; fill: rgba(255,255,255,.42);
          pointer-events: none; dominant-baseline: middle;
        }
        .sm-edge { fill: none; stroke-linecap: round; }
        .sm-edge.dep { stroke-dasharray: 5 6; animation: smFlow 1.6s linear infinite; }
        @keyframes smFlow { to { stroke-dashoffset: -22; } }
        .sm-edge-halo { fill: none; stroke-width: 5; opacity: .13; filter: blur(2px); }
        .sm-dust { animation: smDust ease-in-out infinite alternate; }
        @keyframes smDust { from { opacity: .12; } to { opacity: .7; } }
        .sm-corona { animation: smBreathe 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes smBreathe {
          0%, 100% { transform: scale(.92); opacity: .8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        .sm-spikes { animation: smSpike 4.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes smSpike {
          0%, 100% { transform: scale(.8); opacity: .55; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        .sm-rail-line { stroke: rgba(255,255,255,.13); stroke-width: 1; }
        .sm-rail-tick { stroke: rgba(255,255,255,.2); stroke-width: 1; }
        .sm-rail-label {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 10.5px; font-weight: 750; fill: rgba(255,255,255,.62);
          text-anchor: end; dominant-baseline: middle;
        }
        .sm-rail-sub {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 9px; font-weight: 600; fill: rgba(255,255,255,.34);
          text-anchor: end; dominant-baseline: middle;
        }
        .sm-rail-title {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 9.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          fill: rgba(255,255,255,.4); text-anchor: end;
        }
        .sm-twinkle { animation: smTwinkle 3.6s ease-in-out infinite; }
        @keyframes smTwinkle { 0%,100% { filter: brightness(.92); } 50% { filter: brightness(1.18); } }

        .sm-panel {
          margin-top: 14px; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 16px; align-items: center;
          padding: 16px 18px; border-radius: 14px;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
        }
        .sm-panel-title { font-family: var(--font-crimson), Georgia, serif; font-size: 20px; font-weight: 600; color: #fff; }
        .sm-panel-when { font-family: var(--font-inter), system-ui, sans-serif; font-size: 11.5px; font-weight: 750; color: #f0c674; margin-top: 3px; letter-spacing: .03em; }
        .sm-panel-sub { font-size: 12.5px; color: rgba(255,255,255,.5); margin-top: 4px; line-height: 1.5; }
        .sm-panel-copy { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,.62); margin-top: 8px; }
        .sm-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
        .sm-dot { width: 8px; height: 8px; border-radius: 50%; }
        .sm-stats { display: flex; gap: 18px; margin-top: 10px; }
        .sm-stat { font-size: 11px; color: rgba(255,255,255,.42); font-weight: 650; }
        .sm-stat b { display: block; font-size: 17px; color: #fff; font-weight: 750; font-family: var(--font-crimson), Georgia, serif; }
        .sm-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
        .sm-legend span { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 650; color: rgba(255,255,255,.45); }
        .sm-temp-bar {
          width: 120px; height: 8px; border-radius: 999px;
          background: linear-gradient(90deg, #d96a4f, #e8a04c, #f3d38a, #f5f2ea, #a8c5ff);
        }
        .sm-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        @media (prefers-reduced-motion: reduce) {
          .sm-twinkle, .sm-edge.dep, .sm-dust, .sm-corona, .sm-spikes { animation: none !important; }
        }
        @media (max-width: 640px) {
          .sm-panel { grid-template-columns: 1fr; }
          .sm-label { font-size: 20px; }
          .sm-sub { font-size: 15px; }
          .sm-rail-label { font-size: 16px; }
          .sm-rail-sub { font-size: 13px; }
          .sm-rail-title { font-size: 14px; }
        }
      `}</style>

      <div className="sm-bar">
        <nav className="sm-crumb" aria-label="Map location">
          {level === "galaxy"
            ? <span aria-current="true">Old Testament</span>
            : <button type="button" onClick={() => { setSectionKey(null); setBookCode(null); setFocusMoon(null); }}>Old Testament</button>}
          {section && <>
            <span aria-hidden="true">›</span>
            {level === "system"
              ? <span aria-current="true">{section.key}</span>
              : <button type="button" onClick={() => { setBookCode(null); setFocusMoon(null); }}>{section.key}</button>}
          </>}
          {planet && <><span aria-hidden="true">›</span><span aria-current="true">{planet.name}</span></>}
        </nav>
        <button type="button" className="sm-back" onClick={goUp} disabled={level === "galaxy"}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Zoom out
        </button>
      </div>

      <p className="sm-sr" ref={statusRef} tabIndex={-1} role="status" aria-live="polite">
        {level === "galaxy" && "Old Testament hierarchy, Creation to 430 BC. Four sections ordered by what they depend on."}
        {level === "system" && section && `${section.key}, ${sectionChrono?.span ?? ""}. ${section.books.length} books in chronological order.`}
        {level === "planet" && planet && `${planet.name}, ${chrono?.span ?? ""}. ${moons.length} knowledge dimensions.`}
      </p>

      <div className="sm-stage">
        <svg className="sm-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="group" aria-label="Old Testament hierarchy and chronology map">
          <defs>
            <filter id="sm-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="8" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="sm-glow-lg" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="16" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {arrowColors.map(c => (
              <marker
                key={c} id={markerId(c)} viewBox="0 0 10 10"
                refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"
              >
                <path d="M0.5,0.8 L9.2,5 L0.5,9.2 L2.4,5 Z" fill={c} />
              </marker>
            ))}
            {/* plasma granulation: noise-driven lighting modulates the disc,
                giving the mottled surface of a real star */}
            <filter id="sm-granule" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="4" seed="7" result="n" />
              <feDiffuseLighting in="n" lightingColor="#ffffff" surfaceScale="2.4" result="lt">
                <feDistantLight azimuth="235" elevation="55" />
              </feDiffuseLighting>
              <feComposite in="lt" in2="SourceGraphic" operator="arithmetic" k1="1.15" k2="0" k3="0.25" k4="0" />
            </filter>
            <radialGradient id="sm-hot">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sm-corona">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="18%" stopColor="currentColor" stopOpacity="0.62" />
              <stop offset="55%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* deep-field backdrop */}
          <g aria-hidden="true">
            {BACKDROP.map((s, i) => (
              <circle
                key={i} className="sm-dust" cx={s.x} cy={s.y} r={s.r} fill="#dbe7ff"
                style={{ opacity: s.o, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` } as CSSProperties}
              />
            ))}
          </g>

          {/* chronology rail */}
          <g>
            <text className="sm-rail-title" x={RAIL_TICK_X + 6} y={22}>{railTitle}</text>
            <line className="sm-rail-line" x1={RAIL_TICK_X + 14} y1={PAD_T - 12} x2={RAIL_TICK_X + 14} y2={VIEW_H - PAD_B + 12} />
            {ticks.map((t, i) => (
              <g key={`${t.label}-${i}`}>
                <line className="sm-rail-tick" x1={RAIL_TICK_X + 8} y1={t.y} x2={RAIL_TICK_X + 20} y2={t.y} />
                <text className="sm-rail-label" x={RAIL_TICK_X} y={t.sub ? t.y - 6 : t.y}>{t.label}</text>
                {t.sub && <text className="sm-rail-sub" x={RAIL_TICK_X} y={t.y + 7}>{t.sub}</text>}
              </g>
            ))}
          </g>

          {/* dependency / flow arrows */}
          <g>
            {edges.map((e, i) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const d = vEdge(a.x, a.y, a.r, b.y, b.r, e.bow ?? 0);
              const dep = level === "galaxy";
              return (
                <g key={`${e.from}->${e.to}-${i}`}>
                  {/* a soft under-stroke so the arrow reads against the starfield */}
                  <path className="sm-edge-halo" d={d} stroke={e.color} />
                  <path
                    className={`sm-edge${dep ? " dep" : ""}`}
                    d={d}
                    stroke={e.color}
                    strokeWidth={dep ? 1.9 : 1.2}
                    opacity={dep ? 0.95 : 0.5}
                    markerEnd={`url(#${markerId(e.color)})`}
                  />
                </g>
              );
            })}
          </g>

          {/* bodies */}
          <g>
            {placed.map((p, i) => {
              const vis = STATE_VIS[p.node.stateKey];
              const color = starColor(p.node);
              const interactive = Boolean(p.onOpen);
              const labelX = p.x + p.r * 2.2 + 12;
              return (
                <g
                  key={p.id}
                  className={interactive ? "sm-body" : "sm-static"}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  aria-pressed={p.pressed}
                  aria-label={interactive ? `${p.label}. ${p.ariaExtra}` : undefined}
                  onClick={p.onOpen}
                  onKeyDown={interactive ? (e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onOpen?.(); } }) : undefined}
                >
                  {interactive && <circle className="sm-hit" cx={p.x} cy={p.y} r={p.r + 16} />}

                  {/* a star as the photos show one: wide soft halo, then a
                      granulated plasma disc with a bright rim */}
                  <g style={{ color }}>
                    <circle
                      className="sm-corona" cx={p.x} cy={p.y} r={p.r * 2.6}
                      fill="url(#sm-corona)" opacity={vis.glow * 0.65}
                      style={{ animationDelay: `${i * 0.9}s` } as CSSProperties}
                    />
                  </g>
                  {/* faint diffraction cross behind the disc */}
                  <g
                    className="sm-spikes" opacity={vis.glow * 0.5}
                    style={{ animationDelay: `${i * 0.75}s` } as CSSProperties}
                  >
                    <path d={`M ${p.x - p.r * 2.2} ${p.y} L ${p.x} ${p.y - 0.8} L ${p.x + p.r * 2.2} ${p.y} L ${p.x} ${p.y + 0.8} Z`} fill={color} />
                    <path d={`M ${p.x} ${p.y - p.r * 2.2} L ${p.x + 0.8} ${p.y} L ${p.x} ${p.y + p.r * 2.2} L ${p.x - 0.8} ${p.y} Z`} fill={color} />
                  </g>
                  {/* granulated disc */}
                  <circle
                    className="sm-core sm-twinkle"
                    cx={p.x} cy={p.y} r={p.r}
                    fill={color} opacity={vis.core} filter="url(#sm-granule)"
                    style={{ animationDelay: `${i * 0.6}s` } as CSSProperties}
                  />
                  {/* bright limb */}
                  <circle cx={p.x} cy={p.y} r={p.r} fill="none" stroke={color} strokeWidth={1.3} opacity={vis.core * 0.85} filter="url(#sm-glow)" />
                  {/* hot centre */}
                  <circle cx={p.x} cy={p.y} r={p.r * 0.52} fill="url(#sm-hot)" opacity={vis.core * 0.8} />
                  {p.pressed && <circle cx={p.x} cy={p.y} r={p.r + 6} fill="none" stroke="#fff" strokeWidth={1.8} opacity={0.9} />}
                  <text className="sm-label" x={labelX} y={p.sub ? p.y - 6 : p.y}>{p.label}</text>
                  {p.sub && <text className="sm-sub" x={labelX} y={p.y + 8}>{p.sub}</text>}
                </g>
              );
            })}
          </g>
        </svg>
        <span className="sm-hint">
          {level === "galaxy" ? "Each arrow points from a section to what depends on it · select to zoom in"
            : level === "system" ? "Ordered earliest to latest · select a book · Esc to zoom out"
            : "Select a dimension · Esc to zoom out"}
        </span>
      </div>

      {detail && (
        <div className="sm-panel">
          <div>
            <p className="sm-panel-title">{detail.title}</p>
            {detail.when && <p className="sm-panel-when">{detail.when}</p>}
            {detail.sub && <p className="sm-panel-sub">{detail.sub}</p>}
            <p className="sm-panel-copy">{detail.node.stateCopy}</p>
            <div className="sm-stats">
              <span className="sm-stat">BLI<b>{detail.node.displayScore ?? "—"}</b></span>
              <span className="sm-stat">Answered<b>{detail.node.answered}</b></span>
              <span className="sm-stat">In bank<b>{detail.node.bankCount}</b></span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
            <span
              className="sm-chip"
              style={{
                background: STATE_VIS[detail.node.stateKey].grey ? "rgba(255,255,255,.07)" : `${starColor(detail.node)}22`,
                border: `1px solid ${STATE_VIS[detail.node.stateKey].grey ? "rgba(255,255,255,.16)" : `${starColor(detail.node)}66`}`,
                color: STATE_VIS[detail.node.stateKey].grey ? "rgba(255,255,255,.7)" : "#fff",
              }}
            >
              <span className="sm-dot" style={{ background: starColor(detail.node) }} />
              {detail.node.stateLabel}{detail.node.displayScore !== null ? ` · ${detail.node.displayScore}` : ""}
            </span>
            {planet && onExplore && (
              <button type="button" className="sm-back" style={{ marginLeft: 0 }} onClick={() => onExplore(planet.code)}>
                Open in detail view
              </button>
            )}
          </div>
        </div>
      )}

      <div className="sm-legend" aria-hidden="true">
        <span><span className="sm-dot" style={{ background: GREY, opacity: .55 }} />Untested / low evidence</span>
        <span className="sm-temp">
          BLI 0
          <span className="sm-temp-bar" />
          800
        </span>
        <span>dim → bright = more answers behind the estimate</span>
      </div>
    </div>
  );
}
