import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_DELETION_FALLBACK_TABLES,
  ACCOUNT_DELETION_REQUIRED_RPC,
  isMissingRelationError,
} from "../../lib/accountDeletion.ts";

test("account deletion fallback only names existing writable public tables", () => {
  assert.deepEqual(ACCOUNT_DELETION_FALLBACK_TABLES, [
    "obs_router_shadow_log",
    "obs_reading_log_entries",
    "assessment_answers",
    "assessment_attempts",
  ]);
});

// Regression guard: obs_reading_log_entries carries user_id but has no foreign
// key to auth.users, so deleting the auth user does not cascade it away. It was
// once documented as cascading, which left reading logs behind after a
// deletion request. It has to stay in the explicit list.
test("account deletion clears the reading log, which nothing cascades", () => {
  assert.ok(
    new Set(ACCOUNT_DELETION_FALLBACK_TABLES).has("obs_reading_log_entries"),
    "obs_reading_log_entries has no FK to auth.users and must be deleted explicitly",
  );
});

// Answers reference their attempt, so clearing attempts first would fail.
test("account deletion clears answers before the attempts they reference", () => {
  const order = ACCOUNT_DELETION_FALLBACK_TABLES as readonly string[];
  assert.ok(
    order.indexOf("assessment_answers") < order.indexOf("assessment_attempts"),
    "assessment_answers must be cleared before assessment_attempts",
  );
});

test("account deletion fallback does not try to delete through historical or view objects", () => {
  const tables = new Set(ACCOUNT_DELETION_FALLBACK_TABLES);

  assert.equal(tables.has("obs_answer_evidence"), false, "obs_answer_evidence is a non-updatable view");
  assert.equal(tables.has("user_foundation_status"), false);
  assert.equal(tables.has("user_skill_ratings"), false);
  assert.equal(tables.has("obs_20260726_ability_before_answer_eligibility"), false);
  assert.equal(tables.has("obs_biblical_taxonomy_ability_backup"), false);
  assert.equal(tables.has("obs_biblical_taxonomy_bli_baseline"), false);
  assert.equal(tables.has("obs_idk_recompute_before"), false);
  assert.equal(tables.has("obs_idk_recompute_old_model"), false);
  assert.equal(tables.has("obs_idk_scope_census"), false);
});

test("account deletion names the required private-cleanup RPC for the migration path", () => {
  assert.equal(ACCOUNT_DELETION_REQUIRED_RPC, "obs_delete_account_owned_data");
});

test("missing public fallback tables are survivable during schema drift", () => {
  assert.equal(isMissingRelationError({ code: "42P01" }), true);
  assert.equal(isMissingRelationError({ code: "42501" }), false);
  assert.equal(isMissingRelationError(null), false);
});
