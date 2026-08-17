import assert from "node:assert/strict";
import test from "node:test";
import {
  SECTION_ESTABLISHED_EVIDENCE,
  SECTION_INTERPRETATION_FLOOR,
  leastEvidenceSection,
  sectionEvidence,
} from "../../lib/bliEvidence.ts";

test("section scores stay provisional below the interpretation floor", () => {
  assert.equal(SECTION_INTERPRETATION_FLOOR, 15);
  assert.equal(sectionEvidence(14).isProvisional, true);
  assert.equal(sectionEvidence(14).canInterpret, false);
  assert.equal(sectionEvidence(14).label, "Provisional · 1 to go");
  assert.equal(sectionEvidence(15).canInterpret, true);
});

test("established evidence requires the validation-gate sample size", () => {
  assert.equal(SECTION_ESTABLISHED_EVIDENCE, 30);
  assert.equal(sectionEvidence(29).status, "developing");
  assert.equal(sectionEvidence(30).status, "established");
  assert.equal(sectionEvidence(30).confidence, "high");
});

test("least-evidence routing precedes the lowest point estimate", () => {
  const target = leastEvidenceSection([
    { key: "torah", label: "Torah", backendScopeKey: "TORAH", answered: 18 },
    { key: "former", label: "Former Prophets", backendScopeKey: "FORMER", answered: 7 },
    { key: "latter", label: "Latter Prophets", backendScopeKey: "LATTER", answered: 2 },
    { key: "writings", label: "Writings", backendScopeKey: "WRITINGS", answered: 4 },
  ]);

  assert.equal(target?.key, "latter");
});

test("no uncertainty follow-up is returned once every section is interpretable", () => {
  assert.equal(leastEvidenceSection([
    { key: "torah", label: "Torah", backendScopeKey: "TORAH", answered: 15 },
    { key: "former", label: "Former Prophets", backendScopeKey: "FORMER", answered: 20 },
    { key: "latter", label: "Latter Prophets", backendScopeKey: "LATTER", answered: 17 },
    { key: "writings", label: "Writings", backendScopeKey: "WRITINGS", answered: 15 },
  ]), null);
});
