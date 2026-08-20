import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  PENDING_TRANSFER_KEY,
  PENDING_TRANSFER_TTL_MS,
  beginPendingTransfer,
  claimPendingTransfer,
  classifyClaimError,
  clearPendingTransfer,
  readPendingTransfer,
  type TokenStorage,
  type TransferRpcClient,
} from "../../lib/auth/anonymousTransfer.ts";
import { authCallbackUrl } from "../../lib/auth/redirect.ts";

const GUEST = "11111111-1111-4111-8111-111111111111";
const OTHER_GUEST = "22222222-2222-4222-8222-222222222222";
const ACCOUNT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const T0 = 1_800_000_000_000;

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    has: (k: string) => map.has(k),
  } satisfies TokenStorage & { has: (k: string) => boolean };
}

type Call = { fn: string; args?: Record<string, unknown> };

function fakeClient(
  respond: (call: Call) => { data: unknown; error: { code?: string; message?: string } | null },
) {
  const calls: Call[] = [];
  return {
    calls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      return respond({ fn, args });
    },
  } satisfies TransferRpcClient & { calls: Call[] };
}

const mints = (token: string) => fakeClient(() => ({ data: token, error: null }));
const claimOk = () => fakeClient(() => ({ data: { ok: true }, error: null }));

// ---------------------------------------------------------------------------
// Starting a flow
// ---------------------------------------------------------------------------

test("starting a flow records the token, its guest account, and a pending status", async () => {
  const storage = fakeStorage();
  assert.equal(await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0), true);

  const record = readPendingTransfer(storage, T0);
  assert.deepEqual(record, {
    token: "tok-1", flowId: "flow-tok-1", sourceUserId: GUEST, issuedAt: T0, status: "pending",
  });
});

test("starting a flow replaces an earlier record, so an abandoned flow cannot be completed later", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-old"), storage, GUEST, "flow-tok-old", T0);
  await beginPendingTransfer(mints("tok-new"), storage, OTHER_GUEST, "flow-tok-new", T0 + 1000);

  assert.equal(readPendingTransfer(storage, T0 + 1000)?.token, "tok-new");
});

test("a FAILED mint leaves no stale record behind", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-old"), storage, GUEST, "flow-tok-old", T0);

  const failing = fakeClient(() => ({ data: null, error: { code: "53400", message: "throttled" } }));
  assert.equal(await beginPendingTransfer(failing, storage, OTHER_GUEST, "flow-x", T0 + 1000), false);

  // The old record must be gone: claiming it after a different guest started a
  // flow would move the wrong session's progress.
  assert.equal(readPendingTransfer(storage, T0 + 1000), null);
});

test("starting a flow purges the legacy UUID key from the old design", async () => {
  const storage = fakeStorage({ obs_anon_user_id: GUEST });
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);
  assert.equal(storage.has("obs_anon_user_id"), false);
});

// ---------------------------------------------------------------------------
// Record validity
// ---------------------------------------------------------------------------

test("an ABANDONED flow expires and is discarded rather than lingering", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);

  assert.ok(readPendingTransfer(storage, T0 + PENDING_TRANSFER_TTL_MS - 1));
  assert.equal(readPendingTransfer(storage, T0 + PENDING_TRANSFER_TTL_MS + 1), null);
  // Reading an expired record also removes it.
  assert.equal(storage.has(PENDING_TRANSFER_KEY), false);
});

test("a malformed or hand-written record is rejected and cleared", () => {
  for (const raw of [
    "not json",
    JSON.stringify({ token: "t" }),
    // A record from the pre-flow-binding design: no flowId, so not claimable.
    JSON.stringify({ token: "t", sourceUserId: GUEST, issuedAt: T0, status: "pending" }),
    JSON.stringify({ token: "t", flowId: "f", sourceUserId: GUEST, issuedAt: T0, status: "claimed" }),
    JSON.stringify({ token: "", flowId: "f", sourceUserId: GUEST, issuedAt: T0, status: "pending" }),
    JSON.stringify({ token: "t", flowId: "", sourceUserId: GUEST, issuedAt: T0, status: "pending" }),
    JSON.stringify({ token: "t", flowId: "f", sourceUserId: GUEST, issuedAt: "soon", status: "pending" }),
  ]) {
    const storage = fakeStorage({ [PENDING_TRANSFER_KEY]: raw });
    assert.equal(readPendingTransfer(storage, T0), null, `accepted bad record: ${raw}`);
    assert.equal(storage.has(PENDING_TRANSFER_KEY), false);
  }
});

test("a record from the future is not honoured", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);
  assert.equal(readPendingTransfer(storage, T0 - 60_000), null);
});

// ---------------------------------------------------------------------------
// Claiming
// ---------------------------------------------------------------------------

test("with no record the claim is a no-op and no RPC is made", async () => {
  const storage = fakeStorage();
  const client = claimOk();
  assert.deepEqual(await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-tok-1", T0), { kind: "nothing-to-claim" });
  assert.equal(client.calls.length, 0);
});

test("a successful claim sends only the token and clears the record", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);

  const client = claimOk();
  assert.deepEqual(await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-tok-1", T0), { kind: "transferred" });
  assert.equal(client.calls[0].fn, "obs_claim_anonymous_transfer");
  assert.deepEqual(client.calls[0].args, { p_transfer_token: "tok-1" });
  assert.equal(readPendingTransfer(storage, T0), null);
});

test("SECURITY: the claim never transmits an account id under any argument name", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);
  const client = claimOk();
  await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-tok-1", T0);

  const args = client.calls[0].args ?? {};
  assert.deepEqual(Object.keys(args), ["p_transfer_token"]);
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const value of Object.values(args)) {
    assert.equal(uuid.test(String(value)), false, `argument leaked a UUID: ${String(value)}`);
  }
});

test("SHARED BROWSER: an unrelated sign-in WITHIN the TTL does not claim the abandoned flow", async () => {
  const storage = fakeStorage();
  // Guest A starts authentication and walks away.
  await beginPendingTransfer(mints("tok-guest-a"), storage, GUEST, "flow-a", T0);

  // Five minutes later — well inside the TTL — Account B arrives at the
  // callback through a completely unrelated sign-in or magic link, carrying no
  // flow id of Guest A's. Expiry cannot save us here; only flow binding can.
  const client = claimOk();
  const outcome = await claimPendingTransfer(client, storage, ACCOUNT_B, null, T0 + 5 * 60 * 1000);

  assert.equal(client.calls.length, 0,
    "Guest A's progress was handed to an unrelated account that never started that flow");
  assert.deepEqual(outcome, { kind: "nothing-to-claim" });
});

test("SHARED BROWSER: a callback carrying the WRONG flow id does not claim", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-guest-a"), storage, GUEST, "flow-a", T0);

  const client = claimOk();
  await claimPendingTransfer(client, storage, ACCOUNT_B, "flow-somebody-else", T0 + 60_000);
  assert.equal(client.calls.length, 0, "a mismatched flow id was accepted");
});

test("the matching flow id claims normally", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-guest-a"), storage, GUEST, "flow-a", T0);

  const client = claimOk();
  const outcome = await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-a", T0 + 60_000);
  assert.deepEqual(outcome, { kind: "transferred" });
  assert.deepEqual(client.calls[0].args, { p_transfer_token: "tok-guest-a" });
});

test("SHARED BROWSER: an expired abandoned flow is not claimed by the next person to sign in", async () => {
  const storage = fakeStorage();
  // Visitor one starts a sign-in and walks away.
  await beginPendingTransfer(mints("tok-visitor-one"), storage, GUEST, "flow-tok-visitor-one", T0);

  // Visitor two signs in on the same browser, later.
  const client = claimOk();
  // Correct flow id on purpose, so expiry alone is what stops this claim.
  const outcome = await claimPendingTransfer(
    client, storage, ACCOUNT_B, "flow-tok-visitor-one", T0 + PENDING_TRANSFER_TTL_MS + 1,
  );

  assert.deepEqual(outcome, { kind: "nothing-to-claim" });
  assert.equal(client.calls.length, 0, "visitor one's progress was claimed by visitor two");
});

test("SHARED BROWSER: signing out clears the record so the next account cannot claim it", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);

  clearPendingTransfer(storage); // what sign-out / stale-session cleanup performs

  const client = claimOk();
  assert.deepEqual(await claimPendingTransfer(client, storage, ACCOUNT_B, "flow-tok-1", T0), { kind: "nothing-to-claim" });
  assert.equal(client.calls.length, 0);
});

test("ACCOUNT SWITCH: a second guest's flow supersedes the first, so only the current one is claimed", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-guest-one"), storage, GUEST, "flow-tok-guest-one", T0);
  await beginPendingTransfer(mints("tok-guest-two"), storage, OTHER_GUEST, "flow-tok-guest-two", T0 + 5_000);

  const client = claimOk();
  // The callback completes the SECOND guest's flow; the first is long gone.
  await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-tok-guest-two", T0 + 6_000);
  assert.deepEqual(client.calls[0].args, { p_transfer_token: "tok-guest-two" });
});

test("a sign-in that returns the SAME account claims nothing and drops the record", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);

  const client = claimOk();
  // The session did not change identity, so there is nothing to move.
  assert.deepEqual(await claimPendingTransfer(client, storage, GUEST, "flow-tok-1", T0), { kind: "nothing-to-claim" });
  assert.equal(client.calls.length, 0);
  assert.equal(storage.has(PENDING_TRANSFER_KEY), false);
});

test("an evidence conflict is retryable and the record is KEPT for a later attempt", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);

  const client = fakeClient(() => ({
    data: null,
    error: { code: "55000", message: "evidence-backed answers; NOT transferred" },
  }));
  assert.equal((await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-tok-1", T0)).kind, "retryable");
  // Losing it here would strand the learner's progress permanently.
  assert.equal(readPendingTransfer(storage, T0)?.token, "tok-1");
});

test("a rejected capability is discarded so it is not retried forever", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);

  const client = fakeClient(() => ({
    data: null,
    error: { code: "42501", message: "Invalid, expired, or already-used transfer token" },
  }));
  assert.equal((await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-tok-1", T0)).kind, "spent");
  assert.equal(readPendingTransfer(storage, T0), null);
});

test("a network failure keeps the record rather than discarding progress", async () => {
  const storage = fakeStorage();
  await beginPendingTransfer(mints("tok-1"), storage, GUEST, "flow-tok-1", T0);

  const client: TransferRpcClient = {
    rpc: async () => {
      throw new Error("network down");
    },
  };
  assert.equal((await claimPendingTransfer(client, storage, ACCOUNT_A, "flow-tok-1", T0)).kind, "retryable");
  assert.equal(readPendingTransfer(storage, T0)?.token, "tok-1");
});

test("an unrecognised server error is treated as retryable, never as spent", () => {
  assert.equal(classifyClaimError("XX999", "who knows").kind, "retryable");
  assert.equal(classifyClaimError(undefined, "").kind, "retryable");
});

// ---------------------------------------------------------------------------
// Source guards. These fail the build if the URL-borne account id returns.
// ---------------------------------------------------------------------------

const ASSESS_AUTH_SOURCE = "app/assess/useAssessmentAuthActions.ts";
const HOME_AUTH_SOURCE = "app/useHomeAccountActions.ts";
const SOURCES = ["app/auth/callback/page.tsx", "app/assess/page.tsx", ASSESS_AUTH_SOURCE, "app/page.tsx", HOME_AUTH_SOURCE] as const;
const SIGN_IN_SOURCES = [ASSESS_AUTH_SOURCE, HOME_AUTH_SOURCE] as const;
const source = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("SECURITY: no sign-in redirect carries an account id in the URL", () => {
  for (const rel of SOURCES) {
    assert.equal(/[?&]anon=/.test(source(rel)), false,
      `${rel} builds a redirect containing "anon=" — a UUID in the URL is not proof of ownership`);
  }
});

test("SECURITY: the callback never reads an account id from the query string", () => {
  assert.equal(/params\.get\(\s*["'`]anon["'`]\s*\)/.test(source("app/auth/callback/page.tsx")), false,
    "the callback reads an account id from the URL again");
});

test("SECURITY: no client calls migrate_anonymous_data, which accepts a caller-supplied source", () => {
  for (const rel of SOURCES) {
    assert.equal(source(rel).includes("migrate_anonymous_data"), false,
      `${rel} calls migrate_anonymous_data directly; use obs_claim_anonymous_transfer`);
  }
});

test("the callback claims through the capability helper", () => {
  assert.match(source("app/auth/callback/page.tsx"), /claimPendingTransfer\s*\(/);
});

test("both sign-in entry points start a pending transfer before redirecting", () => {
  for (const rel of SIGN_IN_SOURCES) {
    assert.match(source(rel), /beginPendingTransfer\s*\(/, `${rel} does not start a pending transfer`);
  }
});

test("every sign-out / cleanup path clears the pending capability", () => {
  for (const rel of SIGN_IN_SOURCES) {
    assert.match(source(rel), /clearPendingTransfer\s*\(/, `${rel} never clears the pending capability`);
  }
});

test("magic links land on the callback, where the claim happens", () => {
  // The redirect target is built by authCallbackUrl() rather than concatenated
  // inline, so this asserts the call site. That the helper actually produces a
  // /auth/callback URL is covered by the authCallbackUrl tests below.
  assert.match(source(ASSESS_AUTH_SOURCE), /emailRedirectTo:\s*authCallbackUrl\(/,
    "magic links must land on /auth/callback, otherwise guest progress is never claimed");
});

test("SECURITY: redirects carry only the flow correlator, never the capability", () => {
  // This asserts the actual URL the helper builds, not the shape of the call
  // site. An earlier version of this test grepped for an inline
  // `"?flow=" + flowId` concatenation; when that was refactored into
  // authCallbackUrl({ flow }) the assertion broke while the code stayed
  // correct. Testing the output means a future refactor of *how* the URL is
  // assembled cannot make this pass or fail spuriously — only a real change
  // to what ends up in the URL can.
  const FLOW = "flow-correlator-abc";
  const TOKEN = "capability-token-that-must-never-be-in-a-url";

  const url = new URL(authCallbackUrl({ flow: FLOW }));
  assert.equal(url.pathname, "/auth/callback",
    "the redirect must land on the callback route");
  assert.equal(url.searchParams.get("flow"), FLOW,
    "the flow correlator must reach the callback, or guest progress is never claimed");
  assert.equal(url.toString().includes(TOKEN), false,
    "a capability token must never appear in a redirect URL");

  // A null/absent correlator must not degrade into a literal "null" param.
  const bare = new URL(authCallbackUrl({ flow: undefined }));
  assert.equal(bare.searchParams.has("flow"), false,
    "an absent correlator must be omitted, never serialised as a string");

  // The call sites must hand the helper only the correlator. This stays a
  // source check because it is about what the app *chooses* to pass, which
  // no unit-level call of the helper can observe.
  for (const rel of SIGN_IN_SOURCES) {
    const text = source(rel);
    assert.match(text, /authCallbackUrl\(\s*\{\s*flow:/,
      `${rel} does not pass a flow correlator to the callback`);
    assert.equal(/(redirectTo|emailRedirectTo)[^;]*\b(token|record\.token)\b/.test(text), false,
      `${rel} appears to put the capability token in a redirect URL`);
  }
});
