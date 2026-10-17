import test from "node:test";
import assert from "node:assert/strict";
import { isStagingEnvironment, POINTVET_IS_STAGING } from "../src/lib/stagingEnvironment.js";

test("staging banner is exclusive to an explicit exact environment flag", () => {
  assert.equal(isStagingEnvironment("staging"), true);
  for (const value of [undefined, null, "production", "STAGING", " staging", "preview", "true", "1"]) {
    assert.equal(isStagingEnvironment(value), false, String(value));
  }
  assert.equal(POINTVET_IS_STAGING, false, "Node/CI does not get an implicit staging flag");
});
