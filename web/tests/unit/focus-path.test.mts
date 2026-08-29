import assert from "node:assert/strict";
import test from "node:test";
import { focusedRecommendationSectionKey } from "../../lib/coverageLegend.ts";

function unit(isFocus: boolean) {
  return {
    unitKey: isFocus ? "JDG:2-16" : "GEN:1-11",
    order: 1,
    bookCode: isFocus ? "JDG" : "GEN",
    bookName: isFocus ? "Judges" : "Genesis",
    label: isFocus ? "Judges 2-16" : "Genesis 1-11",
    startCh: isFocus ? 2 : 1,
    endCh: isFocus ? 16 : 11,
    answered: 0,
    displayScore: null,
    state: "insufficient_evidence",
    isFocus,
  };
}

function treeWithFocus(isFocus: boolean) {
  return {
    sections: [
      {
        sectionKey: "TORAH",
        sectionName: "Torah",
        order: 1,
        answered: 0,
        state: "insufficient_evidence",
        isFocus: false,
        books: [
          {
            bookCode: "GEN",
            bookName: "Genesis",
            sectionKey: "TORAH",
            order: 1,
            answered: 0,
            state: "insufficient_evidence",
            isFocus: false,
            units: [unit(false)],
          },
        ],
      },
      {
        sectionKey: "FORMER",
        sectionName: "Former Prophets",
        order: 2,
        answered: 0,
        state: "insufficient_evidence",
        isFocus: isFocus,
        books: [
          {
            bookCode: "JDG",
            bookName: "Judges",
            sectionKey: "FORMER",
            order: 7,
            answered: 0,
            state: "insufficient_evidence",
            isFocus,
            units: [unit(isFocus)],
          },
        ],
      },
    ],
  };
}

test("focusedRecommendationSectionKey returns the section containing the focused unit", () => {
  assert.equal(focusedRecommendationSectionKey(treeWithFocus(true)), "FORMER");
});

test("focusedRecommendationSectionKey returns null when there is no focused unit", () => {
  assert.equal(focusedRecommendationSectionKey(treeWithFocus(false)), null);
});
