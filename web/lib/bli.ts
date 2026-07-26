// lib/bli.ts
// Bible Literacy Index scale + level helpers.
// compute_bli (Supabase) returns a raw 0-100 value; the UI shows a 0-800 scale.

export type BliLevel =
  | "Unfamiliar" | "Acquainted" | "Familiar" | "Literate"
  | "Studied" | "Learned" | "Scholar";

export type BliLevelBand = {
  name: BliLevel;
  min: number;
  max: number;
  color: string;
  description: string;
};

// Raw compute_bli (0-100) -> displayed 0-800 score.
export function toDisplayScore(raw: number): number {
  const s = Math.round(raw * 8);
  return Math.max(0, Math.min(800, s));
}

// Seven levels on the 0-800 scale. `max` is the inclusive upper bound.
export const BLI_LEVELS: BliLevelBand[] = [
  {
    name: "Unfamiliar",
    min: 0,
    max: 120,
    color: "#566070",
    description: "You do not yet have a steady grasp of the Old Testament's major plot, events, characters, and book locations.",
  },
  {
    name: "Acquainted",
    min: 121,
    max: 312,
    color: "#6b7f8a",
    description: "You recognize some major people and stories, but many core events, sequences, and book-level connections are still forming.",
  },
  {
    name: "Familiar",
    min: 313,
    max: 512,
    color: "#0aa3a3",
    description: "You know many major stories and characters, with growing awareness of where events belong and how they connect.",
  },
  {
    name: "Literate",
    min: 513,
    max: 632,
    color: "#0e8c6a",
    description: "You can navigate the Old Testament with confidence, connecting books, events, characters, and theological themes.",
  },
  {
    name: "Studied",
    min: 633,
    max: 712,
    color: "#2563c4",
    description: "You show detailed knowledge of the text, including less obvious events, patterns, references, and historical flow.",
  },
  {
    name: "Learned",
    min: 713,
    max: 760,
    color: "#7c3aed",
    description: "You understand the Old Testament at a deep level, with strong command of structure, sequence, characters, and theology.",
  },
  {
    name: "Scholar",
    min: 761,
    max: 800,
    color: "#d4a017",
    description: "You demonstrate exceptional mastery, including fine textual detail, interconnections, and theological architecture.",
  },
];

export function levelForScore(displayScore: number): BliLevel {
  const band = BLI_LEVELS.find((b) => displayScore <= b.max);
  return band ? band.name : "Scholar";
}

// 0-1 marker position across the 0-800 scale.
export function markerFraction(displayScore: number): number {
  return Math.max(0, Math.min(1, displayScore / 800));
}
