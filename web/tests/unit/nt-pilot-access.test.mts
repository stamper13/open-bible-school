import assert from "node:assert/strict";
import test from "node:test";
import {
  isNtPilotEmail,
  NT_PILOT_ALLOWED_EMAIL,
} from "../../app/assess/ntPilotPolicy.ts";

test("only the approved account passes the NT pilot display gate", () => {
  assert.equal(isNtPilotEmail(NT_PILOT_ALLOWED_EMAIL), true);
  assert.equal(isNtPilotEmail(`  ${NT_PILOT_ALLOWED_EMAIL.toUpperCase()}  `), true);
  assert.equal(isNtPilotEmail("reader@example.com"), false);
  assert.equal(isNtPilotEmail(null), false);
  assert.equal(isNtPilotEmail(undefined), false);
});
