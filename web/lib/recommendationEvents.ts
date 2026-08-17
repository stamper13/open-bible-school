/**
 * Recommendation study-event semantics.
 *
 * Contract (analytics track, 2026-08-02):
 *
 *   `recommendation_viewed` means an EXPLICIT user interaction with the
 *   dashboard recommendation — opening it, expanding it, or navigating through
 *   it. Rendering or reloading the dashboard must never record it.
 *
 *   If page impressions are ever wanted, they get their own event name
 *   (`recommendation_rendered`) with its own identity window. Explicit views and
 *   passive impressions are never merged into one event type.
 *
 * Exactly-once delivery is a property of the interaction, not of a time window:
 * one interaction generates one UUID, that UUID is reused for retries of that
 * same interaction, and a genuinely new interaction always generates a new UUID.
 * The database enforces uniqueness on (user_id, event_type, idempotency_key).
 *
 * These helpers are pure so they can be unit tested without a DOM or a network.
 */

/** Surfaces on the dashboard that count as an explicit recommendation view. */
export type RecommendationInteractionSurface = "primary_cta" | "scope_detail";

export const RECOMMENDATION_EVENT_SOURCE = "dashboard_recommendation";

/** Attempts per logical interaction: the first try plus one retry. */
export const RECOMMENDATION_EVENT_MAX_ATTEMPTS = 2;

export const RECOMMENDATION_EVENT_RETRY_DELAY_MS = 400;

/**
 * One interaction id. `crypto.randomUUID` is available in every secure context
 * this app is served from; the fallback exists only so a non-secure-context
 * preview cannot throw inside a click handler.
 */
export function newInteractionId(): string {
  const cryptoRef = typeof globalThis === "undefined" ? undefined : globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") return cryptoRef.randomUUID();

  const bytes = new Uint8Array(16);
  if (cryptoRef && typeof cryptoRef.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Metadata for one explicit recommendation interaction.
 *
 * `source` is preserved verbatim so historical rows stay comparable.
 * `interaction_surface` is additive and lets analytics split "expanded the
 * recommendation" from "clicked through to the retest" later, without another
 * schema change and without overloading the event type.
 */
export function buildRecommendationViewMetadata(
  interactionId: string,
  surface: RecommendationInteractionSurface,
): Record<string, string> {
  return {
    source: RECOMMENDATION_EVENT_SOURCE,
    interaction_surface: surface,
    idempotency_key: interactionId,
  };
}

/**
 * Whether a failed `obs_record_study_event` call should be retried with the
 * SAME interaction id.
 *
 * Retry transport and server faults. Never retry a rejection the server has
 * already decided on: 42501 (not authorized) and 22023 (malformed key) will
 * fail identically forever, and 23505 means the event is already recorded.
 */
export function shouldRetryStudyEvent(error: { code?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  if (code === "") return true; // network/transport failure with no SQLSTATE
  if (code === "42501" || code === "22023" || code === "23505") return false;
  return true;
}
