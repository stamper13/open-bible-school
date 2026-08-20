// Extracted from app/knowledge-map/FocusStarMap.tsx during a file-size cleanup.
// Pure constants, helpers, types, and small presentational subcomponents
// (Orb, OrbitArrows) used by the star-map visualization. No behavior change.

import { type CSSProperties } from "react";
import {
  STATE_LABELS,
  bookPassage,
  chapterRangeLabel,
  passageReference,
  readableUnitLabel,
  rereadHref,
  rereadUrl,
  sectionHue,
  type ExploreBook,
  type ExploreSection,
  type FocusPathRow,
  type FocusState,
  type StarTone,
} from "@/lib/focusPath";
import { sectionEvidence } from "@/lib/bliEvidence";

export const VIEW_W = 1000;
export const VIEW_H = 1040;
export const CX = 540;
export const CY = 585;
export const SECTION_RAIL_Y = 72;
export const SECTION_RAIL_STEP_X = 225;
export const CENTRAL_SECTION_R = 68;
export const RAIL_SECTION_R = 25;
export const OPEN_RAIL_GHOST_R = 31;
export const NEUTRAL_EDGE = "#8ea2c0";
// The one colour on this map that never means "state" or "section identity" —
// it means exactly one thing everywhere it appears: this is what the router
// recommends right now. Kept far from every section hue (gold, blue, green,
// purple) and every state colour so it can never be mistaken for either.
export const RECOMMEND_GOLD = "#ffcf5c";

/** A compact 4-point sparkle, centred on the origin at radius 1 — the
 *  "recommended" badge glyph. Scaled and positioned by its caller. */
export const SPARKLE_PATH = "M0,-1 C0.16,-0.16 0.16,-0.16 1,0 C0.16,0.16 0.16,0.16 0,1 C-0.16,0.16 -0.16,0.16 -1,0 C-0.16,-0.16 -0.16,-0.16 0,-1 Z";

export const BOOK_PERIOD_MS = 108_000;
export const MOON_PERIOD_MS = 40_000;
export const STATE_ORDER: FocusState[] = ["sufficient", "below_baseline", "insufficient_evidence"];
export const SECTION_RAIL_ORDER = ["TORAH", "FORMER", "LATTER", "WRITINGS"];

export type MoonDatum = {
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

export type LinkedNodeKind = "section" | "book" | "moon";
export type LinkedNode = { kind: LinkedNodeKind; key: string };

export const deg = (d: number) => (d * Math.PI) / 180;

export const NO_BOOKS: ExploreBook[] = [];

export const sectionHueFor = (s: { sectionKey: string; sectionName: string }) =>
  sectionHue({ node_key: s.sectionKey, label: s.sectionName });

export function sectionRailRank(section: ExploreSection) {
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
export function defaultBook(section: ExploreSection): ExploreBook | null {
  return (
    section.books.find((b) => b.isFocus)
    ?? section.books.find((b) => b.state !== "sufficient")
    ?? section.books[0]
    ?? null
  );
}

export function moonFromLeaf(row: FocusPathRow): MoonDatum {
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

export function moonFromUnit(u: ExploreBook["units"][number]): MoonDatum {
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

export function stateOpacity(state: FocusState) {
  return state === "sufficient" ? 1 : state === "below_baseline" ? 0.82 : 0.55;
}

export function evidenceStatusLabel(state: FocusState, answered: number) {
  const evidence = sectionEvidence(answered);
  return `${STATE_LABELS[state]} · ${answered} answered · ${evidence.label}`;
}

export function linkedNodeId(kind: LinkedNodeKind, key: string) {
  return `${kind}:${key}`;
}

/** Chapter counts for the Old Testament, used to fill in the parts of a book
 *  that no assessed unit yet covers so every book shows its whole span. */
export const OT_CHAPTERS: Record<string, number> = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
  "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36, EZR: 10,
  NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8, ISA: 66,
  JER: 52, LAM: 5, EZE: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9, OBA: 1, JON: 4,
  MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
};

/** An uncovered chapter range: a real section of the book with no evidence yet,
 *  shown as a faint moon so the book reads as complete in extent. */
export function gapMoon(book: ExploreBook, startCh: number, endCh: number): MoonDatum {
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
export function moonsForBook(book: ExploreBook): MoonDatum[] {
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


/** Deterministic per-node seed, so a given book/section always looks the same. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619)) >>> 0;
  return h;
}

/** Mix two #rrggbb colours (t = weight of b). */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  const to = (x: number) => Math.round(x).toString(16).padStart(2, "0");
  return `#${to(ar + (br - ar) * t)}${to(ag + (bg - ag) * t)}${to(ab + (bb - ab) * t)}`;
}

/** A subtle, seeded lightness nudge so no two bodies look identical. */
export function jitter(color: string, seed: number): string {
  const t = (((seed >> 3) % 7) - 3) * 0.02; // -0.06 .. +0.06
  return t >= 0 ? mix(color, "#ffffff", t) : mix(color, "#04050b", -t);
}

export type OrbKind = "star" | "planet" | "moon";

/**
 * A single celestial body. Stars burn (plasma disc, corona, diffraction
 * spikes); planets are lit spheres (shaded, some ringed); moons are small
 * spheres. Each is nudged subtly by its seed so siblings differ, while state
 * still governs colour and brightness.
 */
export function Orb({
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
export function OrbitArrows({ cx, cy, r }: { cx: number; cy: number; r: number }) {
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
