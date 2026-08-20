// The question-fetching machinery shared by the OT and NT assessment flows.
//
// Both testaments ask the same shape of question over the same shape of RPC
// (`p_attempt_id` in, one row out) and both warm the next question while the
// learner is still reading the current one. Only the RPC name and the row type
// differ, so that is all these helpers take.
//
// What is deliberately NOT shared: what to do with the result. The two flows
// diverge on error handling (OT recovers from an expired anonymous session; NT
// surfaces its own banner) and on retry policy, so each caller keeps its own
// handler and decides for itself whether a timeout is worth a second attempt.

import { supabase } from "@/lib/supabase/client";
import type { QuestionPrefetch, RpcErrorLike } from "./types";
import { rpcErrorCodeText, rpcErrorMessageText } from "./rpcErrors";

/** A ref holding the in-flight prefetch, if any. Structural so it accepts whatever `useRef` returns. */
type PrefetchRef<TRow> = { current: QuestionPrefetch<TRow> | null };

export type QuestionRpcResult<TRow> = { data: TRow[] | null; error: RpcErrorLike };

/**
 * Postgres killed the query for taking too long. Worth retrying: the next
 * attempt usually lands once the planner has a warm cache.
 */
export function isStatementTimeoutError(err: RpcErrorLike) {
  return rpcErrorCodeText(err) === "57014"
    || /statement timeout/i.test(rpcErrorMessageText(err));
}

/** One call to a `obs_get_next_*_assessment_question` RPC. */
export async function fetchNextQuestion<TRow>(
  rpcName: string,
  attemptId: string,
): Promise<QuestionRpcResult<TRow>> {
  const { data, error } = await supabase.rpc(rpcName, { p_attempt_id: attemptId });
  return { data: (data ?? null) as TRow[] | null, error };
}

/**
 * Warm the next question in the background.
 *
 * Keyed on (attemptId, afterAnsweredCount) so a prefetch is only ever consumed
 * by the exact step that asked for it — re-requesting the same step is a no-op
 * rather than a second round trip.
 */
export function startQuestionPrefetch<TRow>(
  ref: PrefetchRef<TRow>,
  rpcName: string,
  attemptId: string,
  afterAnsweredCount: number,
): void {
  const existing = ref.current;
  if (
    existing
    && existing.attemptId === attemptId
    && existing.afterAnsweredCount === afterAnsweredCount
  ) return;

  const prefetch: QuestionPrefetch<TRow> = {
    attemptId,
    afterAnsweredCount,
    settled: false,
    data: null,
    error: null,
    promise: Promise.resolve(),
  };
  prefetch.promise = (async () => {
    try {
      const { data, error } = await fetchNextQuestion<TRow>(rpcName, attemptId);
      prefetch.data = data;
      prefetch.error = error;
    } catch (error: unknown) {
      prefetch.error = error instanceof Error
        ? { message: error.message }
        : { message: "Question prefetch failed" };
    } finally {
      prefetch.settled = true;
    }
  })();
  ref.current = prefetch;
}

/**
 * Claim the warmed question for this step, or null if there is nothing usable.
 *
 * Null means "fall back to a normal load" and covers three cases: no prefetch,
 * one belonging to a different step, or one superseded while we awaited it.
 * The ref is cleared on a successful claim so a result is never consumed twice.
 */
export async function takePrefetchedQuestion<TRow>(
  ref: PrefetchRef<TRow>,
  attemptId: string,
  afterAnsweredCount: number,
): Promise<QuestionRpcResult<TRow> | null> {
  const prefetch = ref.current;
  if (
    !prefetch
    || prefetch.attemptId !== attemptId
    || prefetch.afterAnsweredCount !== afterAnsweredCount
  ) {
    return null;
  }

  await prefetch.promise;
  // A newer prefetch replaced this one while we waited: that one owns the step.
  if (ref.current !== prefetch) return null;
  ref.current = null;

  return { data: prefetch.data, error: prefetch.error };
}
