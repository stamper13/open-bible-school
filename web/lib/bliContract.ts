import { levelForScore, toDisplayScore, type BliLevel } from "./bli.ts";

export const BLI_SCORING_VERSION = "bli_weighted_v2" as const;

export type BliSectionScore = {
  scoring_version: typeof BLI_SCORING_VERSION;
  answered: number;
  correct: number;
  idk: number;
  accuracy_pct: number;
  raw_bli_pct: number;
  display_bli: number;
  weighted_possible: number;
  weighted_earned: number;
  bli_level: BliLevel;
};

export type BliContractScores = {
  scoring_version: typeof BLI_SCORING_VERSION;
  ot_raw_bli_pct: number;
  ot_display_bli: number;
  ot_bli_level: BliLevel;
  ot_accuracy_pct: number;
  ot_questions_answered: number;
  ot_correct_answers: number;
  ot_idk_answers: number;
  ot_weighted_possible: number;
  ot_weighted_earned: number;
  ot_section_scores: Record<string, BliSectionScore>;
  nt_raw_bli_pct: number;
  nt_display_bli: number;
  nt_bli_level: BliLevel;
  nt_accuracy_pct: number;
  nt_questions_answered: number;
  nt_correct_answers: number;
  nt_idk_answers: number;
  nt_weighted_possible: number;
  nt_weighted_earned: number;
  nt_section_scores: Record<string, BliSectionScore>;
  combined_raw_bli_pct: number | null;
  combined_display_bli: number | null;
  combined_accuracy_pct: number | null;
  combined_questions_answered: number;
  combined_correct_answers: number;
  combined_idk_answers: number;
  combined_weighted_possible: number;
  combined_weighted_earned: number;
  combined_available: boolean;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeSectionScores(value: unknown): Record<string, BliSectionScore> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([name, candidate]) => {
      if (
        !isRecord(candidate)
        || candidate.scoring_version !== BLI_SCORING_VERSION
      ) return [];
      const displayBli = numberValue(candidate.display_bli);
      return [[name, {
        scoring_version: BLI_SCORING_VERSION,
        answered: numberValue(candidate.answered),
        correct: numberValue(candidate.correct),
        idk: numberValue(candidate.idk),
        accuracy_pct: numberValue(candidate.accuracy_pct),
        raw_bli_pct: numberValue(candidate.raw_bli_pct),
        display_bli: displayBli,
        weighted_possible: numberValue(candidate.weighted_possible),
        weighted_earned: numberValue(candidate.weighted_earned),
        bli_level: levelForScore(displayBli),
      } satisfies BliSectionScore]];
    }),
  );
}

export function normalizeBliContractRow(value: unknown): BliContractScores | null {
  if (!isRecord(value) || value.scoring_version !== BLI_SCORING_VERSION) return null;

  const otDisplayBli = numberValue(value.ot_display_bli);
  const ntDisplayBli = numberValue(value.nt_display_bli);

  return {
    scoring_version: BLI_SCORING_VERSION,
    ot_raw_bli_pct: numberValue(value.ot_raw_bli_pct),
    ot_display_bli: otDisplayBli,
    ot_bli_level: levelForScore(otDisplayBli),
    ot_accuracy_pct: numberValue(value.ot_accuracy_pct),
    ot_questions_answered: numberValue(value.ot_questions_answered),
    ot_correct_answers: numberValue(value.ot_correct_answers),
    ot_idk_answers: numberValue(value.ot_idk_answers),
    ot_weighted_possible: numberValue(value.ot_weighted_possible),
    ot_weighted_earned: numberValue(value.ot_weighted_earned),
    ot_section_scores: normalizeSectionScores(value.ot_section_scores),
    nt_raw_bli_pct: numberValue(value.nt_raw_bli_pct),
    nt_display_bli: ntDisplayBli,
    nt_bli_level: levelForScore(ntDisplayBli),
    nt_accuracy_pct: numberValue(value.nt_accuracy_pct),
    nt_questions_answered: numberValue(value.nt_questions_answered),
    nt_correct_answers: numberValue(value.nt_correct_answers),
    nt_idk_answers: numberValue(value.nt_idk_answers),
    nt_weighted_possible: numberValue(value.nt_weighted_possible),
    nt_weighted_earned: numberValue(value.nt_weighted_earned),
    nt_section_scores: normalizeSectionScores(value.nt_section_scores),
    combined_raw_bli_pct: nullableNumber(value.combined_raw_bli_pct),
    combined_display_bli: nullableNumber(value.combined_display_bli),
    combined_accuracy_pct: nullableNumber(value.combined_accuracy_pct),
    combined_questions_answered: numberValue(value.combined_questions_answered),
    combined_correct_answers: numberValue(value.combined_correct_answers),
    combined_idk_answers: numberValue(value.combined_idk_answers),
    combined_weighted_possible: numberValue(value.combined_weighted_possible),
    combined_weighted_earned: numberValue(value.combined_weighted_earned),
    combined_available: value.combined_available === true,
  };
}

export function testamentHeadlineAsSection(
  scores: BliContractScores,
  testament: "OT" | "NT",
): BliSectionScore {
  if (testament === "OT") {
    return {
      scoring_version: BLI_SCORING_VERSION,
      answered: scores.ot_questions_answered,
      correct: scores.ot_correct_answers,
      idk: scores.ot_idk_answers,
      accuracy_pct: scores.ot_accuracy_pct,
      raw_bli_pct: scores.ot_raw_bli_pct,
      display_bli: scores.ot_display_bli,
      weighted_possible: scores.ot_weighted_possible,
      weighted_earned: scores.ot_weighted_earned,
      bli_level: scores.ot_bli_level,
    };
  }

  return {
    scoring_version: BLI_SCORING_VERSION,
    answered: scores.nt_questions_answered,
    correct: scores.nt_correct_answers,
    idk: scores.nt_idk_answers,
    accuracy_pct: scores.nt_accuracy_pct,
    raw_bli_pct: scores.nt_raw_bli_pct,
    display_bli: scores.nt_display_bli,
    weighted_possible: scores.nt_weighted_possible,
    weighted_earned: scores.nt_weighted_earned,
    bli_level: scores.nt_bli_level,
  };
}

export function poolBliSections(
  sections: Record<string, BliSectionScore>,
  names: string[],
): BliSectionScore | null {
  const rows = names.map(name => sections[name]).filter(Boolean);
  if (rows.length === 0) return null;

  const weightedPossible = rows.reduce((sum, row) => sum + row.weighted_possible, 0);
  if (weightedPossible <= 0) return null;

  const weightedEarned = rows.reduce((sum, row) => sum + row.weighted_earned, 0);
  const rawBliPct = Math.max(
    0,
    Math.min(100, Math.round((weightedEarned / weightedPossible) * 10_000) / 100),
  );
  const displayBli = toDisplayScore(rawBliPct);
  const answered = rows.reduce((sum, row) => sum + row.answered, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct, 0);

  return {
    scoring_version: BLI_SCORING_VERSION,
    answered,
    correct,
    idk: rows.reduce((sum, row) => sum + row.idk, 0),
    accuracy_pct: answered > 0 ? Math.round((correct / answered) * 1_000) / 10 : 0,
    raw_bli_pct: rawBliPct,
    display_bli: displayBli,
    weighted_possible: weightedPossible,
    weighted_earned: weightedEarned,
    bli_level: levelForScore(displayBli),
  };
}
