import assert from "node:assert/strict";
import test from "node:test";
import {
  recommendationPassageLabel,
  sanitizePassageReference,
} from "../../lib/recommendationLabels.ts";

test("hides the backend end-of-chapter verse sentinel in recommendation labels", () => {
  assert.equal(
    recommendationPassageLabel({
      book_code: "JDG",
      start_chapter: 2,
      end_chapter: 16,
      label: "Judges 2:1-16:999",
    }),
    "Judges 2-16",
  );
});

test("keeps ordinary recommendation labels unchanged", () => {
  assert.equal(
    recommendationPassageLabel({
      book_code: "JDG",
      start_chapter: 2,
      end_chapter: 16,
      label: "Judges 2-16",
    }),
    "Judges 2-16",
  );
});

test("sanitizes stored focus-path references before display", () => {
  assert.equal(sanitizePassageReference("Judges 2:1-16:999"), "Judges 2-16");
  assert.equal(sanitizePassageReference("Genesis 20:1-22:24"), "Genesis 20:1-22:24");
});
