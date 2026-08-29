/**
 * Crossing a hundred on the BLI.
 *
 * Deliberately pure and structurally typed so it can be reasoned about (and
 * tested) without a dashboard, a user, or Supabase. Callers pass their
 * ProgressPoint[] straight in.
 */

export type MilestonePoint = {
  attempt_id: string;
  display_bli: number;
  bli_level: string;
};

export type ScoreMilestoneResult = {
  /** The hundred just crossed: 587 -> 602 gives 600. */
  threshold: number;
  from: number;
  to: number;
  /** Band name at the new score, e.g. "Literate". */
  level: string;
  /** True when this crossing also moved them into a new band. */
  levelChanged: boolean;
  /** The attempt that did it, for the seen-already gate. */
  attemptId: string;
};

/**
 * History arrives newest-first (obs_get_progress_history orders by
 * captured_at desc), so [0] is the round just finished and [1] is the one
 * before it.
 *
 * Two points are required, which is also what makes this a returning-learner
 * moment: there is nothing to have crossed on a first assessment.
 */
export function detectScoreMilestone(
  history: readonly MilestonePoint[] | null | undefined,
): ScoreMilestoneResult | null {
  if (!history || history.length < 2) return null;

  const [latest, previous] = history;
  const to = latest.display_bli;
  const from = previous.display_bli;
  if (!Number.isFinite(to) || !Number.isFinite(from)) return null;

  // Only upward, and only across a hundred. A rise from 587 to 599 is real
  // progress but it is not a milestone, and celebrating every gain would make
  // the celebration mean nothing.
  if (Math.floor(from / 100) >= Math.floor(to / 100)) return null;

  return {
    threshold: Math.floor(to / 100) * 100,
    from,
    to,
    level: latest.bli_level,
    levelChanged: latest.bli_level !== previous.bli_level,
    attemptId: latest.attempt_id,
  };
}
