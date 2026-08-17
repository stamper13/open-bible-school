// Extracted from app/knowledge-map/StarMap.tsx during a file-size cleanup.
// Pure constants and helper functions used by the hierarchy/chronology star map.
// No behavior change intended.

import type { StarStateKey, StarNode } from "./StarMap";

export type Level = "galaxy" | "system" | "planet";

export const STATE_VIS: Record<StarStateKey, { glow: number; core: number; grey: boolean }> = {
  untested:    { glow: 0.16, core: 0.58, grey: true },
  early:       { glow: 0.28, core: 0.72, grey: true },
  review:      { glow: 0.48, core: 0.84, grey: false },
  developing:  { glow: 0.66, core: 0.92, grey: false },
  established: { glow: 0.85, core: 0.97, grey: false },
  strong:      { glow: 1.00, core: 1.00, grey: false },
};

export const GREY = "#7b8493";
export const EDGE_NEUTRAL = "#8ea2c0";
export const markerId = (c: string) => `sm-arw-${c.replace("#", "")}`;
export const VIEW_W = 880;
export const VIEW_H = 660;
export const RAIL_TICK_X = 142;   // right edge of the rail's text column
export const FIELD_L = 196;
export const FIELD_R = 856;
export const PAD_T = 44;
export const PAD_B = 40;

export const posToY = (pos: number) => PAD_T + pos * (VIEW_H - PAD_T - PAD_B);
export const fieldX = (f: number) => FIELD_L + f * (FIELD_R - FIELD_L);

/**
 * BLI -> star temperature. Real stars run red (cool) to blue-white (hot),
 * so the score maps onto that sequence: ember red at the bottom of the
 * scale, yellow-white through the middle, blue-white at the top.
 */
export const TEMP_STOPS: Array<[number, [number, number, number]]> = [
  [0,   [217, 106, 79]],   // ember red
  [200, [232, 160, 76]],   // orange
  [400, [243, 211, 138]],  // yellow-white
  [600, [245, 242, 234]],  // white
  [800, [168, 197, 255]],  // blue-white
];

export function bliTempColor(score: number): string {
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
export function starColor(node: StarNode) {
  if (STATE_VIS[node.stateKey].grey || node.displayScore === null) return GREY;
  return bliTempColor(node.displayScore);
}

/** "1526 – 1445 BC" -> "1526–1445", so it fits the narrow rail. */
export function compactSpan(span: string): string {
  return span.replace(/\s*–\s*/, "–").replace(/\s*BC\s*$/, "").replace(/^c\.\s*/, "c.");
}

/**
 * A vertical parent -> child connector down a shared column, trimmed at both
 * rims to leave room for the arrowhead. `bow` arcs the line out to the side
 * (positive = right) so an edge that skips over an intermediate node goes
 * around it instead of through it.
 */
export function vEdge(x: number, y1: number, r1: number, y2: number, r2: number, bow = 0) {
  const sy = y1 + r1 + 8;
  const ey = y2 - r2 - 12;
  if (!bow) return `M ${x} ${sy} L ${x} ${ey}`;
  return `M ${x} ${sy} C ${x + bow} ${sy + (ey - sy) * 0.22}, ${x + bow} ${ey - (ey - sy) * 0.22}, ${x} ${ey}`;
}

/** Deterministic PRNG — the backdrop must match between server and client. */
export function seeded(seed: number) {
  let v = seed >>> 0;
  return () => {
    v = (v * 1664525 + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

export const BACKDROP = (() => {
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
