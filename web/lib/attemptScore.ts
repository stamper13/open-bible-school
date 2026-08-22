// The results page's headline figure.
//
// It leads with the BLI movement rather than session accuracy: on an adaptive
// test a high hit rate can still barely move the score, so "90%" sitting next
// to a +4 BLI reads as a contradiction.
//
// The subtlety worth knowing about lives in deriveAttemptScoreState below —
// obs_get_progress_history reports a first assessment and a genuinely unchanged
// score identically, so a baseline has to be recognised by position in the
// history instead.

/** Snapshots requested per call; also the truncation guard for baseline detection. */
export const ATTEMPT_HISTORY_LIMIT = 50;

export type ProgressHistoryRow = {
  attempt_id: string;
  captured_at: string;
  score_change: number | null;
};

export type AttemptScoreState = {
  /** "baseline": a first assessment, so there is no movement to report.
   *  "change": movement against an earlier snapshot.
   *  "unknown": history unavailable, so claim nothing either way. */
  mode: "change" | "baseline" | "unknown";
  change: number | null;
};

/**
 * Work out whether this attempt is a learner's baseline or a later run.
 *
 * `score_change` cannot answer this on its own: the RPC computes
 * `display_bli - lag(display_bli)`, which is NULL on the first snapshot, and
 * then coalesces that NULL to 0 on the way out. A baseline and a genuinely
 * unchanged score are therefore the same value, and a baseline must show the
 * score itself rather than a meaningless "0".
 */
export function deriveAttemptScoreState(
  rows: readonly ProgressHistoryRow[],
  attemptId: string,
  limit: number = ATTEMPT_HISTORY_LIMIT,
): AttemptScoreState {
  const point = rows.find(row => row.attempt_id === attemptId);
  if (!point) return { mode: "unknown", change: null };

  const pointAt = new Date(point.captured_at).getTime();
  const hasEarlierSnapshot = rows.some(row => new Date(row.captured_at).getTime() < pointAt);

  // The RPC returns the most recent `limit` snapshots, so "nothing earlier in
  // this page" only proves a baseline when the window was not truncated. A full
  // page means older snapshots may exist beyond its end.
  if (!hasEarlierSnapshot && rows.length < limit) {
    return { mode: "baseline", change: null };
  }

  return {
    mode: "change",
    change: point.score_change === null || point.score_change === undefined
      ? null
      : Number(point.score_change),
  };
}

export type AttemptScoreDisplay = {
  /** The headline figure, or null when there is nothing at all to show. */
  value: string | null;
  label: string;
  /** "" | " is-up" | " is-down" — appended to the .score-value class. */
  trendClass: string;
  /** Set only when the figure is a signed delta, whose sign needs wording. */
  aria?: string;
  /** Supporting line under the label, or null. */
  context: string | null;
};

/**
 * Turn the score state into what the headline actually renders. Direction is
 * carried by the +/- sign first and colour only reinforces it, so the result
 * still reads correctly without colour vision.
 */
export function formatAttemptScore({
  state,
  displayBli,
  bliLevel,
  accuracyDisplay,
}: {
  state: AttemptScoreState;
  displayBli: number | null;
  bliLevel: string | null;
  accuracyDisplay: string | null;
}): AttemptScoreDisplay {
  const { mode, change } = state;

  if (mode === "change" && change !== null) {
    const value = change > 0 ? `+${change}` : change < 0 ? `−${Math.abs(change)}` : "0";
    return {
      value,
      label: "BLI change this session",
      trendClass: change === 0 ? "" : change > 0 ? " is-up" : " is-down",
      aria: change > 0
        ? `BLI rose ${change} points this session`
        : change < 0
          ? `BLI fell ${Math.abs(change)} points this session`
          : "BLI did not change this session",
      context: displayBli === null
        ? null
        : `Now ${displayBli}${bliLevel ? ` · ${bliLevel}` : ""}`,
    };
  }

  // No movement to report: the score itself is the headline, so the context
  // line only needs to add the level.
  if (displayBli !== null) {
    return {
      value: String(displayBli),
      label: mode === "baseline" ? "Your baseline BLI" : "Your BLI",
      trendClass: "",
      context: bliLevel,
    };
  }

  return { value: accuracyDisplay, label: "Session accuracy", trendClass: "", context: null };
}
