/**
 * The streak the dashboard sky already draws for a shooting star: a
 * tail-to-head linear gradient that fades from transparent through the
 * palette's glow into a hot core, with a soft shadow under it.
 *
 * Shared so the knowledge map can send the same light from a cleared node to
 * a newly opened one instead of swapping colours — same drawing routine, same
 * palettes, different endpoints.
 */

export type StreakPalette = { core: string; glow: string };

export const SHOOTING_PALETTES: StreakPalette[] = [
  { core: "255,255,255", glow: "173,232,255" },
  { core: "240,253,255", glow: "10,163,163" },
  { core: "255,248,214", glow: "212,160,23" },
  { core: "245,240,255", glow: "124,58,237" },
];

// A per-session seed for the starfield's star/shooting-star layout, so a
// visitor's sky looks the same star-for-star across the home dashboard and
// the assess flow instead of re-randomizing on every navigation. Previously
// declared twice (once in app/homeHelpers.ts, once privately inside
// app/assess/useAssessmentStarfield.ts) with identical implementations;
// this is the one copy both sides import.
const SKY_SEED_KEY = "obs_sky_seed";

export function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function getOrCreateSkySeed() {
  if (typeof window === "undefined") return 1;
  const existing = sessionStorage.getItem(SKY_SEED_KEY);
  if (existing) return Number(existing) || 1;
  const seed = Math.floor(Math.random() * 4294967295) || 1;
  sessionStorage.setItem(SKY_SEED_KEY, String(seed));
  return seed;
}

export type StreakSpec = {
  tailX: number;
  tailY: number;
  headX: number;
  headY: number;
  /** 0..1 — peak brightness of the head. */
  opacity: number;
  width: number;
  blur: number;
  palette: StreakPalette;
};

export function drawStreak(ctx: CanvasRenderingContext2D, spec: StreakSpec) {
  const { tailX, tailY, headX, headY, opacity, width, blur, palette } = spec;
  const streak = ctx.createLinearGradient(tailX, tailY, headX, headY);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.52, `rgba(${palette.glow},${opacity * 0.46})`);
  streak.addColorStop(0.86, `rgba(${palette.glow},${opacity * 0.72})`);
  streak.addColorStop(1, `rgba(${palette.core},${opacity})`);

  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = `rgba(${palette.glow},${opacity * 0.45})`;
  ctx.shadowBlur = blur;
  ctx.lineWidth = width;
  ctx.strokeStyle = streak;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();
  ctx.restore();
}

/** A bright arrival flare at the head — used when the streak lands on the
 *  newly opened focus node. */
export function drawArrival(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  opacity: number,
  palette: StreakPalette,
) {
  ctx.save();
  ctx.shadowColor = `rgba(${palette.glow},${opacity * 0.9})`;
  ctx.shadowBlur = radius * 2.4;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(radius, 0.4), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${palette.core},${opacity})`;
  ctx.fill();
  ctx.restore();
}
