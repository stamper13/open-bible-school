#!/usr/bin/env node

// Score-fidelity gate for bli_weighted_v2.
//
// This deliberately does not claim item validity. It asks a narrower question:
// when controlled section abilities generate responses over representative
// weighted items, does the score recover the expected headline, bands, and
// specialist ordering once every section has established evidence?

const REPLICATIONS = 200;
const ANSWERS_PER_SECTION = 30;
const WRONG_PENALTY = 0.25 / 0.75;

const GATES = Object.freeze({
  headlineMaeMax: 40,
  sectionBandRecoveryMin: 0.80,
  specialistTopRankMin: 0.90,
});

const sections = [
  { name: "Torah", chronological: [0.75, 1.00], tiers: [89, 235, 46], meanB: 0.082 },
  { name: "Former Prophets", chronological: [0.63, 0.88], tiers: [37, 174, 14], meanB: -0.030 },
  { name: "Latter Prophets", chronological: [0.58, 0.85], tiers: [48, 276, 6], meanB: 0.055 },
  { name: "Writings", chronological: [0.52, 0.70], tiers: [3, 199, 25], meanB: 0.078 },
];

const profiles = [
  { key: "P01", label: "Torah strong / Former medium / Latter weak", correct: [.90, .65, .30, .55], idk: [.02, .05, .12, .07] },
  { key: "P02", label: "Former strong / Torah weak", correct: [.35, .88, .60, .50], idk: [.10, .02, .06, .08] },
  { key: "P03", label: "Latter strong / Former weak", correct: [.60, .30, .88, .55], idk: [.06, .12, .02, .07] },
  { key: "P04", label: "Writings specialist", correct: [.55, .55, .45, .90], idk: [.07, .07, .09, .02] },
  { key: "P05", label: "Broad expert", correct: [.90, .86, .88, .84], idk: [.02, .02, .02, .03] },
  { key: "P06", label: "Broad intermediate", correct: [.62, .64, .60, .66], idk: [.06, .06, .07, .05] },
  { key: "P07", label: "Broad novice", correct: [.30, .28, .32, .26], idk: [.14, .15, .13, .16] },
  { key: "P08", label: "Torah specialist", correct: [.95, .38, .25, .42], idk: [.01, .10, .15, .09], specialist: 0 },
  { key: "P09", label: "Former Prophets specialist", correct: [.42, .94, .35, .45], idk: [.09, .01, .11, .09], specialist: 1 },
  { key: "P10", label: "Latter Prophets specialist", correct: [.35, .42, .94, .45], idk: [.11, .09, .01, .09], specialist: 2 },
  { key: "P11", label: "Writings specialist (polarized)", correct: [.40, .45, .32, .94], idk: [.10, .09, .12, .01], specialist: 3 },
  { key: "P12", label: "Early-canon strength", correct: [.90, .76, .35, .55], idk: [.02, .04, .11, .07] },
  { key: "P13", label: "Prophetic strength", correct: [.32, .65, .90, .52], idk: [.12, .05, .02, .08] },
  { key: "P14", label: "Both Prophets strong", correct: [.50, .84, .82, .48], idk: [.08, .03, .03, .09] },
  { key: "P15", label: "Torah + Writings strong", correct: [.86, .45, .40, .88], idk: [.03, .09, .10, .02] },
  { key: "P16", label: "Torah + Latter strong", correct: [.85, .38, .86, .42], idk: [.03, .10, .03, .09] },
  { key: "P17", label: "Near high threshold", correct: [.74, .73, .76, .72], idk: [.04, .04, .04, .05] },
  { key: "P18", label: "Uneven intermediate", correct: [.70, .58, .64, .52], idk: [.04, .06, .05, .08] },
  { key: "P19", label: "Confident guesser", correct: [.55, .55, .55, .55], idk: [0, 0, 0, 0] },
  { key: "P20", label: "IDK-heavy intermediate", correct: [.60, .60, .60, .60], idk: [.25, .25, .25, .25] },
];

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function displayBli(earned, possible) {
  if (possible <= 0) return 0;
  return Math.round(clamp(earned / possible, 0, 1) * 800);
}

function bliBand(score) {
  if (score >= 513) return "high";
  if (score >= 313) return "medium";
  return "weak";
}

function itemFor(section, rng) {
  const chronological = section.chronological[0]
    + rng() * (section.chronological[1] - section.chronological[0]);
  const tierTotal = section.tiers.reduce((sum, count) => sum + count, 0);
  const tierRoll = rng() * tierTotal;
  const tier = tierRoll < section.tiers[0]
    ? 1
    : tierRoll < section.tiers[0] + section.tiers[1] ? 2 : 3;
  const importance = tier === 1 ? 1 : tier === 2 ? 0.6 : 0.35;
  const irtB = section.meanB + (rng() - 0.5) * 1.0;
  return {
    weight: chronological * importance,
    reward: clamp(1 + 0.20 * irtB, 0.70, 1.25),
  };
}

let headlineAbsoluteError = 0;
let assessmentCount = 0;
let sectionBandMatches = 0;
let sectionCount = 0;
let specialistTopMatches = 0;
let specialistCount = 0;

for (let replication = 0; replication < REPLICATIONS; replication += 1) {
  for (let profileIndex = 0; profileIndex < profiles.length; profileIndex += 1) {
    const profile = profiles[profileIndex];
    const rng = random(0xB11 + replication * 101 + profileIndex * 10_007);
    const observedSections = [];
    let observedEarned = 0;
    let expectedEarned = 0;
    let totalPossible = 0;

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
      let observedSectionEarned = 0;
      let expectedSectionEarned = 0;
      let sectionPossible = 0;
      const pCorrect = profile.correct[sectionIndex];
      const pIdk = profile.idk[sectionIndex];
      const pWrong = Math.max(0, 1 - pCorrect - pIdk);

      for (let itemIndex = 0; itemIndex < ANSWERS_PER_SECTION; itemIndex += 1) {
        const item = itemFor(sections[sectionIndex], rng);
        const response = rng();
        sectionPossible += item.weight;
        expectedSectionEarned += item.weight * (
          pCorrect * item.reward - pWrong * WRONG_PENALTY
        );

        if (response < pCorrect) {
          observedSectionEarned += item.weight * item.reward;
        } else if (response >= pCorrect + pIdk) {
          observedSectionEarned -= item.weight * WRONG_PENALTY;
        }
      }

      const observedBli = displayBli(observedSectionEarned, sectionPossible);
      const expectedBli = displayBli(expectedSectionEarned, sectionPossible);
      observedSections.push(observedBli);
      sectionBandMatches += Number(bliBand(observedBli) === bliBand(expectedBli));
      sectionCount += 1;
      observedEarned += observedSectionEarned;
      expectedEarned += expectedSectionEarned;
      totalPossible += sectionPossible;
    }

    const observedHeadline = displayBli(observedEarned, totalPossible);
    const expectedHeadline = displayBli(expectedEarned, totalPossible);
    headlineAbsoluteError += Math.abs(observedHeadline - expectedHeadline);
    assessmentCount += 1;

    if (profile.specialist !== undefined) {
      const measuredTop = observedSections.indexOf(Math.max(...observedSections));
      specialistTopMatches += Number(measuredTop === profile.specialist);
      specialistCount += 1;
    }
  }
}

const metrics = {
  replications: REPLICATIONS,
  profiles: profiles.length,
  assessments: assessmentCount,
  answersPerSection: ANSWERS_PER_SECTION,
  answersPerAssessment: ANSWERS_PER_SECTION * sections.length,
  headlineMae: headlineAbsoluteError / assessmentCount,
  sectionBandRecovery: sectionBandMatches / sectionCount,
  specialistTopRankRecovery: specialistTopMatches / specialistCount,
};

const checks = [
  {
    name: "headline MAE",
    pass: metrics.headlineMae <= GATES.headlineMaeMax,
    measured: metrics.headlineMae,
    required: `<= ${GATES.headlineMaeMax}`,
  },
  {
    name: "section-band recovery",
    pass: metrics.sectionBandRecovery >= GATES.sectionBandRecoveryMin,
    measured: metrics.sectionBandRecovery,
    required: `>= ${GATES.sectionBandRecoveryMin}`,
  },
  {
    name: "specialist top-rank recovery",
    pass: metrics.specialistTopRankRecovery >= GATES.specialistTopRankMin,
    measured: metrics.specialistTopRankRecovery,
    required: `>= ${GATES.specialistTopRankMin}`,
  },
];

console.log(JSON.stringify({
  validationKind: "score_fidelity",
  itemValidityEvaluated: false,
  itemValidityNote: "Requires reviewed content judgments and human-response calibration; this gate must not be cited as item validity.",
  metrics,
  gates: checks,
  pass: checks.every(check => check.pass),
}, null, 2));

if (checks.some(check => !check.pass)) process.exitCode = 1;
