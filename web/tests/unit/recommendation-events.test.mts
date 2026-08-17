import assert from "node:assert/strict";
import test from "node:test";
import {
  RECOMMENDATION_EVENT_SOURCE,
  buildRecommendationViewMetadata,
  newInteractionId,
  shouldRetryStudyEvent,
} from "../../lib/recommendationEvents.ts";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("newInteractionId returns a v4 UUID", () => {
  assert.match(newInteractionId(), UUID_V4);
});

test("every interaction gets a distinct id, so a later legitimate view is never suppressed", () => {
  const ids = new Set(Array.from({ length: 500 }, () => newInteractionId()));
  assert.equal(ids.size, 500);
});

test("metadata preserves the source and carries the interaction id as idempotency_key", () => {
  const id = newInteractionId();
  const metadata = buildRecommendationViewMetadata(id, "primary_cta");

  assert.equal(metadata.source, RECOMMENDATION_EVENT_SOURCE);
  assert.equal(metadata.source, "dashboard_recommendation");
  assert.equal(metadata.idempotency_key, id);
  assert.equal(metadata.interaction_surface, "primary_cta");
});

test("metadata records which surface the user interacted with", () => {
  const id = newInteractionId();
  assert.equal(buildRecommendationViewMetadata(id, "scope_detail").interaction_surface, "scope_detail");
});

test("a retry of the same interaction reuses the same idempotency key", () => {
  const id = newInteractionId();
  const first = buildRecommendationViewMetadata(id, "primary_cta");
  const retry = buildRecommendationViewMetadata(id, "primary_cta");

  assert.deepEqual(first, retry);
  assert.equal(first.idempotency_key, retry.idempotency_key);
});

test("transport failures with no SQLSTATE are retryable", () => {
  assert.equal(shouldRetryStudyEvent({}), true);
  assert.equal(shouldRetryStudyEvent({ code: null }), true);
  assert.equal(shouldRetryStudyEvent({ code: "" }), true);
});

test("server decisions the retry cannot change are not retried", () => {
  // Not authorized, malformed idempotency key, already recorded.
  assert.equal(shouldRetryStudyEvent({ code: "42501" }), false);
  assert.equal(shouldRetryStudyEvent({ code: "22023" }), false);
  assert.equal(shouldRetryStudyEvent({ code: "23505" }), false);
});

test("serialization and lock failures are retryable with the same key", () => {
  assert.equal(shouldRetryStudyEvent({ code: "40001" }), true);
  assert.equal(shouldRetryStudyEvent({ code: "55P03" }), true);
});

test("a successful call is never retried", () => {
  assert.equal(shouldRetryStudyEvent(null), false);
  assert.equal(shouldRetryStudyEvent(undefined), false);
});
