/**
 * Anonymous progress transfer, capability-based.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The previous flow passed the guest account's UUID to the server and asked it
 * to move that account's data. The server had no way to tell whether the caller
 * had ever controlled that guest account, so knowing a UUID was enough to claim
 * someone else's progress — and the UUID travelled in the callback URL, which
 * the callback trusted ahead of browser storage. A crafted callback link was
 * therefore sufficient, and the id also leaked through Referer headers, browser
 * history and request logs.
 *
 * The replacement never names an account. While still signed in as the guest,
 * the client asks the server to mint a single-use capability bound to that
 * session; holding the session is the proof. After sign-in the client presents
 * only the token, and the server derives the source from it.
 *
 * WHY A STRUCTURED RECORD RATHER THAN A BARE TOKEN
 * ---------------------------------------------------------------------------
 * The capability is deliberately NOT bound to a destination account — that is
 * what lets a guest upgrade into whichever account they create. The consequence
 * is that a token left lying in storage will be spent by whoever signs in next
 * on that browser. On a shared or public machine that silently moves one
 * visitor's progress into a stranger's account.
 *
 * A bare token cannot defend against that, because there is nothing to check.
 * So the record carries its own context — which guest session it was minted
 * for, when, and whether a sign-in flow is actually in progress — and is
 * discarded whenever that context stops being true:
 *
 *   * replaced whenever a fresh sign-in flow starts,
 *   * expired after PENDING_TRANSFER_TTL_MS,
 *   * cleared on sign-out and on any account switch,
 *   * cleared once claimed, or once the server says it can never be claimed,
 *   * ignored (and cleared) if malformed.
 *
 * It still has to survive a magic link opened in a DIFFERENT TAB, which is why
 * this uses localStorage rather than sessionStorage.
 */

export const PENDING_TRANSFER_KEY = "obs_pending_transfer";

/** Legacy key from the UUID-based flow. Always purged when we touch storage. */
const LEGACY_ANON_ID_KEY = "obs_anon_user_id";

/**
 * How long a started sign-in flow may remain claimable.
 *
 * This is a deliberate trade-off, not a security boundary — the server-side
 * capability is valid far longer. A short window limits how long an abandoned
 * flow can be hijacked by the next person on a shared browser; a long one
 * accommodates a magic link opened well after it was requested. Sixty minutes
 * covers OAuth (seconds) and the ordinary "check your email" delay while
 * keeping the stale window bounded to a single sitting.
 */
export const PENDING_TRANSFER_TTL_MS = 60 * 60 * 1000;

export type PendingTransfer = {
  /** The single-use capability. NEVER put this in a URL. */
  token: string;
  /**
   * Correlates this record with one specific sign-in round trip.
   *
   * This is the actual binding, and it is what `sourceUserId` and `issuedAt`
   * alone could not provide. Those only tell you the destination differs from
   * the source (true of every legitimate transfer) and that the record is
   * recent — so within the TTL, an unrelated sign-in arriving at the callback
   * would still spend an abandoned capability.
   *
   * The flow id travels in the redirect URL and the record stays in storage.
   * The claim proceeds only when the two match, so a callback that did not
   * originate from this flow can never complete it.
   *
   * Unlike the guest UUID this replaced, the flow id is NOT an authorization
   * token: it is a random, non-secret correlator. Knowing it grants nothing —
   * the capability itself never leaves same-origin storage, so an attacker
   * would already need access to the browser, at which point the URL is moot.
   */
  flowId: string;
  /** The anonymous account it was minted for. Used to detect account switches. */
  sourceUserId: string;
  /** Epoch ms, for expiry. */
  issuedAt: number;
  /** Explicit flow state; anything else is treated as not claimable. */
  status: "pending";
};

/** Random, non-secret correlator for one sign-in round trip. */
export function newFlowId(): string {
  return globalThis.crypto.randomUUID();
}

/** The subset of Storage this module uses, so tests can supply a fake. */
export type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The subset of the Supabase client this module uses.
 *
 * `rpc()` is typed as PromiseLike rather than Promise: supabase-js returns a
 * PostgrestFilterBuilder, which is a thenable but not an actual Promise. This
 * module only awaits the result, so PromiseLike is both sufficient and what
 * makes the real client assignable here.
 */
export type TransferRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type ClaimOutcome =
  /** Guest progress was moved onto the signed-in account. */
  | { kind: "transferred" }
  /** No claimable record; nothing to do, not an error. */
  | { kind: "nothing-to-claim" }
  /** The transfer failed but the capability is still good — keep it. */
  | { kind: "retryable"; message: string }
  /** The capability is invalid, expired or already used — discard it. */
  | { kind: "spent"; message: string };

/**
 * SQLSTATE raised by obs_claim_anonymous_transfer when the source session has
 * immutable scoring evidence. The server explicitly does NOT consume the
 * capability then, so the record is kept for a later retry.
 */
const EVIDENCE_CONFLICT = "55000";

/** SQLSTATE for an unknown, expired or already-consumed capability. */
const CAPABILITY_REJECTED = "42501";

export function clearPendingTransfer(storage: TokenStorage): void {
  storage.removeItem(PENDING_TRANSFER_KEY);
  // The old flow's key is worthless now and must never be read again.
  storage.removeItem(LEGACY_ANON_ID_KEY);
}

/**
 * Read the pending record, returning null unless it is well-formed, marked
 * pending, and still inside its window. A malformed or expired record is
 * cleared on the spot rather than left to be reconsidered later.
 */
export function readPendingTransfer(
  storage: TokenStorage,
  now: number = Date.now(),
): PendingTransfer | null {
  const raw = storage.getItem(PENDING_TRANSFER_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingTransfer(storage);
    return null;
  }

  if (
    typeof parsed !== "object" || parsed === null ||
    typeof (parsed as PendingTransfer).token !== "string" ||
    typeof (parsed as PendingTransfer).flowId !== "string" ||
    typeof (parsed as PendingTransfer).sourceUserId !== "string" ||
    typeof (parsed as PendingTransfer).issuedAt !== "number" ||
    (parsed as PendingTransfer).status !== "pending" ||
    (parsed as PendingTransfer).token.length === 0 ||
    (parsed as PendingTransfer).flowId.length === 0
  ) {
    clearPendingTransfer(storage);
    return null;
  }

  const record = parsed as PendingTransfer;
  if (now - record.issuedAt > PENDING_TRANSFER_TTL_MS || now < record.issuedAt) {
    // Expired, or a clock moved backwards far enough to make the window
    // meaningless. Either way this is not a flow we should complete.
    clearPendingTransfer(storage);
    return null;
  }

  return record;
}

/**
 * Mint the transfer capability for the CURRENT guest session and record that a
 * sign-in flow has started.
 *
 * Must be called while still signed in anonymously — immediately before
 * starting OAuth or requesting a magic link. Any previous record is replaced,
 * so an abandoned earlier flow can never be completed afterwards.
 *
 * Returns false when no capability could be minted (not an anonymous session,
 * throttled, or already transferred). Callers proceed with sign-in regardless:
 * failing to carry guest progress must never block authentication.
 */
export async function beginPendingTransfer(
  client: TransferRpcClient,
  storage: TokenStorage,
  sourceUserId: string,
  flowId: string,
  now: number = Date.now(),
): Promise<boolean> {
  // Replace first. If minting fails we must not leave a previous flow's record
  // behind to be claimed by this sign-in.
  clearPendingTransfer(storage);

  try {
    const { data, error } = await client.rpc("obs_issue_anonymous_transfer_token");
    if (error || typeof data !== "string" || data.length === 0) {
      if (error) console.error("Could not prepare guest progress transfer:", error);
      return false;
    }
    const record: PendingTransfer = {
      token: data,
      flowId,
      sourceUserId,
      issuedAt: now,
      status: "pending",
    };
    storage.setItem(PENDING_TRANSFER_KEY, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("Could not prepare guest progress transfer:", err);
    return false;
  }
}

/**
 * Decide what to do with the record after a failed claim. Only an explicit
 * server rejection discards it; anything else (evidence conflict, network
 * failure, unknown error) is retryable, so guest progress is never silently
 * abandoned.
 */
export function classifyClaimError(code: string | undefined, message: string): ClaimOutcome {
  if (code === CAPABILITY_REJECTED) return { kind: "spent", message };
  if (code === EVIDENCE_CONFLICT) return { kind: "retryable", message };
  return { kind: "retryable", message };
}

/**
 * Present the pending capability to claim guest progress onto the signed-in
 * account. The source is derived server-side from the token; this client never
 * sends, and never needs to know, a guest UUID.
 *
 * `signedInUserId` is the account that just authenticated. If it matches the
 * record's source the flow did not actually upgrade anything (the same
 * anonymous session is still current), so nothing is claimed.
 *
 * On success the record is cleared immediately so it cannot be replayed.
 */
export async function claimPendingTransfer(
  client: TransferRpcClient,
  storage: TokenStorage,
  signedInUserId: string,
  callbackFlowId: string | null,
  now: number = Date.now(),
): Promise<ClaimOutcome> {
  const record = readPendingTransfer(storage, now);
  if (!record) return { kind: "nothing-to-claim" };

  // THE BINDING. This callback must be the completion of the flow that minted
  // the capability. Without it, any sign-in reaching this page inside the TTL
  // would spend an abandoned record — on a shared browser that silently moves
  // one visitor's progress into the next person's account.
  //
  // A missing or mismatched id means this callback belongs to some other
  // sign-in, so the record is discarded rather than left for a third arrival to
  // find. Nothing is lost: the progress stays on the guest account, untouched.
  if (!callbackFlowId || callbackFlowId !== record.flowId) {
    clearPendingTransfer(storage);
    return { kind: "nothing-to-claim" };
  }

  // Still the same account: the sign-in did not produce a new identity, so
  // there is nothing to move. Drop the record rather than leaving it pending.
  if (record.sourceUserId === signedInUserId) {
    clearPendingTransfer(storage);
    return { kind: "nothing-to-claim" };
  }

  let result: Awaited<ReturnType<TransferRpcClient["rpc"]>>;
  try {
    result = await client.rpc("obs_claim_anonymous_transfer", {
      p_transfer_token: record.token,
    });
  } catch (err) {
    return { kind: "retryable", message: err instanceof Error ? err.message : String(err) };
  }

  if (result.error) {
    const outcome = classifyClaimError(result.error.code, result.error.message ?? "");
    if (outcome.kind === "spent") clearPendingTransfer(storage);
    return outcome;
  }

  clearPendingTransfer(storage);
  return { kind: "transferred" };
}
