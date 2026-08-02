import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBliContractRow,
  poolBliSections,
  testamentHeadlineAsSection,
} from "../../lib/bliContract.ts";

const sectionScores = {
  Torah: {
    scoring_version: "bli_weighted_v2",
    answered: 133,
    correct: 112,
    idk: 2,
    accuracy_pct: 84.2,
    raw_bli_pct: 77.8,
    display_bli: 622,
    weighted_possible: "107.54",
    weighted_earned: "83.622999875214",
  },
  Writings: {
    scoring_version: "bli_weighted_v2",
    answered: 47,
    correct: 39,
    idk: 3,
    accuracy_pct: 83,
    raw_bli_pct: 74.1,
    display_bli: 593,
    weighted_possible: "19.554",
    weighted_earned: "14.49408",
  },
  "Former Prophets": {
    scoring_version: "bli_weighted_v2",
    answered: 61,
    correct: 47,
    idk: 2,
    accuracy_pct: 77,
    raw_bli_pct: 64,
    display_bli: 512,
    weighted_possible: "41.14",
    weighted_earned: "26.3128266666667",
  },
  "Latter Prophets": {
    scoring_version: "bli_weighted_v2",
    answered: 76,
    correct: 40,
    idk: 23,
    accuracy_pct: 52.6,
    raw_bli_pct: 41.4,
    display_bli: 331,
    weighted_possible: "35.378",
    weighted_earned: "14.65504",
  },
};

const rpcRow = {
  scoring_version: "bli_weighted_v2",
  ot_raw_bli_pct: "68.31",
  ot_display_bli: 546,
  ot_accuracy_pct: "75.1",
  ot_questions_answered: 317,
  ot_correct_answers: 238,
  ot_idk_answers: 30,
  ot_weighted_possible: "203.612",
  ot_weighted_earned: "139.084946541881",
  ot_section_scores: sectionScores,
  nt_raw_bli_pct: 0,
  nt_display_bli: 0,
  nt_accuracy_pct: 0,
  nt_questions_answered: 0,
  nt_correct_answers: 0,
  nt_idk_answers: 0,
  nt_weighted_possible: 0,
  nt_weighted_earned: 0,
  nt_section_scores: {},
  combined_raw_bli_pct: null,
  combined_display_bli: null,
  combined_accuracy_pct: null,
  combined_questions_answered: 317,
  combined_correct_answers: 238,
  combined_idk_answers: 30,
  combined_weighted_possible: "203.612",
  combined_weighted_earned: "139.084946541881",
  combined_available: false,
};

test("normalizes the explicit v2 contract without mixing scales", () => {
  const scores = normalizeBliContractRow(rpcRow);
  assert.ok(scores);
  assert.equal(scores.ot_raw_bli_pct, 68.31);
  assert.equal(scores.ot_display_bli, 546);
  assert.equal(scores.ot_accuracy_pct, 75.1);
  assert.equal(scores.ot_section_scores.Torah.raw_bli_pct, 77.8);
  assert.equal(scores.ot_section_scores.Torah.display_bli, 622);
  assert.equal(scores.ot_section_scores.Torah.accuracy_pct, 84.2);
});

test("headline is represented by its returned earned and possible totals", () => {
  const scores = normalizeBliContractRow(rpcRow);
  assert.ok(scores);
  const headline = testamentHeadlineAsSection(scores, "OT");
  assert.equal(headline.weighted_possible, 203.612);
  assert.equal(headline.weighted_earned, 139.084946541881);
  assert.equal(headline.raw_bli_pct, 68.31);
  assert.equal(headline.display_bli, 546);

  const possible = Object.values(scores.ot_section_scores)
    .reduce((sum, section) => sum + section.weighted_possible, 0);
  const earned = Object.values(scores.ot_section_scores)
    .reduce((sum, section) => sum + section.weighted_earned, 0);
  assert.ok(Math.abs(possible - headline.weighted_possible) < 1e-9);
  assert.ok(Math.abs(earned - headline.weighted_earned) < 1e-9);
});

test("Prophets parent is possible-weighted, never an average of displays", () => {
  const scores = normalizeBliContractRow(rpcRow);
  assert.ok(scores);
  const prophets = poolBliSections(
    scores.ot_section_scores,
    ["Former Prophets", "Latter Prophets"],
  );
  assert.ok(prophets);
  assert.equal(prophets.raw_bli_pct, 53.54);
  assert.equal(prophets.display_bli, 428);
  assert.notEqual(prophets.display_bli, Math.round((512 + 331) / 2));
});

test("legacy or unversioned rows fail closed", () => {
  assert.equal(normalizeBliContractRow({ ...rpcRow, scoring_version: undefined }), null);
  assert.equal(normalizeBliContractRow({ ...rpcRow, scoring_version: "legacy" }), null);
});
