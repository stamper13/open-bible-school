// lib/bli.ts
// Bible Literacy Index scale + level helpers.
// compute_bli (Supabase) returns a raw 0-100 value; the UI shows a 200-800 scale.

export type BliLevel =
  | "Unfamiliar" | "Acquainted" | "Familiar" | "Literate"
  | "Studied" | "Learned" | "Scholar";

// Raw compute_bli (0-100) -> displayed 200-800 score.
export function toDisplayScore(raw: number): number {
  const s = Math.round(raw * 6 + 200);
  return Math.max(200, Math.min(800, s));
}

// Seven levels on the 200-800 scale. `max` is the inclusive upper bound.
export const BLI_LEVELS: { name: BliLevel; min: number; max: number; color: string }[] = [
  { name: "Unfamiliar", min: 200, max: 290, color: "#566070" }, // muted
  { name: "Acquainted", min: 291, max: 434, color: "#6b7f8a" },
  { name: "Familiar",   min: 435, max: 584, color: "#0aa3a3" }, // accent teal
  { name: "Literate",   min: 585, max: 674, color: "#0e8c6a" }, // former-prophets green
  { name: "Studied",    min: 675, max: 734, color: "#2563c4" }, // latter-prophets blue
  { name: "Learned",    min: 735, max: 770, color: "#7c3aed" }, // writings purple
  { name: "Scholar",    min: 771, max: 800, color: "#d4a017" }, // torah gold
];

export function levelForScore(displayScore: number): BliLevel {
  const band = BLI_LEVELS.find((b) => displayScore <= b.max);
  return band ? band.name : "Scholar";
}

// 0-1 marker position across the 200-800 band, for the level strip in issue 3.
export function markerFraction(displayScore: number): number {
  return Math.max(0, Math.min(1, (displayScore - 200) / 600));
}
