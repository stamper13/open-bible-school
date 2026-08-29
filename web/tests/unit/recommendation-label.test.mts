import assert from "node:assert/strict";
import test from "node:test";
import { recommendationPassageLabel } from "../../lib/recommendationLabels.ts";

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
