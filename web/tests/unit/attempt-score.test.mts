import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTEMPT_HISTORY_LIMIT,
  deriveAttemptScoreState,
  formatAttemptScore,
  type ProgressHistoryRow,
} from "../../lib/attemptScore.ts";

const TARGET = "attempt-under-test";

const row = (id: string, capturedAt: string, scoreChange: number | null): ProgressHistoryRow => ({
  attempt_id: id,
  captured_at: capturedAt,
  score_change: scoreChange,
});

const target = (scoreChange: number | null) => row(TARGET, "2026-08-22T04:00:00Z", scoreChange);
const earlier = row("older", "2026-08-01T00:00:00Z", 3);

// The distinction this whole module exists for: obs_get_progress_history
// coalesces the first snapshot's NULL delta to 0, so score_change alone cannot
// tell a baseline apart from a session that genuinely moved nothing.
test("a first assessment reads as a baseline even though score_change is 0", () => {
  assert.deepEqual(
    deriveAttemptScoreState([target(0)], TARGET),
    { mode: "baseline", change: null },
  );
});

test("a score that genuinely did not move is not a baseline", () => {
  assert.deepEqual(
    deriveAttemptScoreState([target(0), earlier], TARGET),
    { mode: "change", change: 0 },
  );
});

test("a baseline is still recognised when score_change comes back null", () => {
  assert.deepEqual(
    deriveAttemptScoreState([target(null)], TARGET),
    { mode: "baseline", change: null },
  );
});

test("gains and losses carry their signed delta through", () => {
  assert.equal(deriveAttemptScoreState([target(4), earlier], TARGET).change, 4);
  assert.equal(deriveAttemptScoreState([target(-12), earlier], TARGET).change, -12);
});

// A full page of history proves nothing about what sits beyond its end, so the
// oldest row in a truncated window must not be mistaken for the baseline.
test("a truncated history window never claims a baseline", () => {
  const filler = Array.from({ length: ATTEMPT_HISTORY_LIMIT - 1 }, (_, i) =>
    row(`newer-${i}`, `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z`, 1));
  const rows = [target(7), ...filler];
  assert.equal(rows.length, ATTEMPT_HISTORY_LIMIT);
  assert.deepEqual(deriveAttemptScoreState(rows, TARGET), { mode: "change", change: 7 });
});

test("an attempt missing from the history claims nothing", () => {
  assert.deepEqual(deriveAttemptScoreState([earlier], TARGET), { mode: "unknown", change: null });
});

test("an empty history claims nothing", () => {
  assert.deepEqual(deriveAttemptScoreState([], TARGET), { mode: "unknown", change: null });
});

// ---------------------------------------------------------------------------

const display = (state: Parameters<typeof formatAttemptScore>[0]["state"]) =>
  formatAttemptScore({ state, displayBli: 547, bliLevel: "Literate", accuracyDisplay: "90%" });

test("a gain renders a signed, upward headline", () => {
  const out = display({ mode: "change", change: 4 });
  assert.equal(out.value, "+4");
  assert.equal(out.label, "BLI change this session");
  assert.equal(out.trendClass, " is-up");
  assert.equal(out.context, "Now 547 · Literate");
  assert.match(out.aria!, /rose 4 points/);
});

test("a loss renders a signed, downward headline", () => {
  const out = display({ mode: "change", change: -12 });
  assert.equal(out.value, "−12");
  assert.equal(out.trendClass, " is-down");
  assert.match(out.aria!, /fell 12 points/);
});

test("no movement renders 0 with no trend colour", () => {
  const out = display({ mode: "change", change: 0 });
  assert.equal(out.value, "0");
  assert.equal(out.trendClass, "");
});

// The point of the baseline branch: show the score, never a meaningless "0".
test("a baseline shows the score itself and names it as the baseline", () => {
  const out = display({ mode: "baseline", change: null });
  assert.equal(out.value, "547");
  assert.equal(out.label, "Your baseline BLI");
  assert.equal(out.trendClass, "");
  assert.equal(out.context, "Literate");
  assert.equal(out.aria, undefined);
});

test("an unknown state shows the score without claiming it is a baseline", () => {
  const out = display({ mode: "unknown", change: null });
  assert.equal(out.value, "547");
  assert.equal(out.label, "Your BLI");
});

test("accuracy is the last resort when there is no BLI at all", () => {
  const out = formatAttemptScore({
    state: { mode: "unknown", change: null },
    displayBli: null,
    bliLevel: null,
    accuracyDisplay: "90%",
  });
  assert.equal(out.value, "90%");
  assert.equal(out.label, "Session accuracy");
});
