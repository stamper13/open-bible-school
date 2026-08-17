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
import { STAR_MAP_STYLES } from "./starMapStyles";
import {
  STATE_VIS,
  GREY,
  EDGE_NEUTRAL,
  markerId,
  VIEW_W,
  VIEW_H,
  RAIL_TICK_X,
  FIELD_L,
  FIELD_R,
  PAD_T,
  PAD_B,
  posToY,
  fieldX,
  TEMP_STOPS,
  bliTempColor,
  starColor,
  compactSpan,
  vEdge,
  seeded,
  BACKDROP,
  type Level,
} from "./starMapParts";

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
      <style>{STAR_MAP_STYLES}</style>

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
