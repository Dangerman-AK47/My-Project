import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GlobalConfigNotFoundError,
  GlobalConfigVersionConflictError,
  GlobalConfigVersionNotForwardError,
  GlobalConfigFileTooLargeError,
} from "../src/lib/services/sensor-configs";
import { semverGt } from "../src/lib/validation/semver";

describe("Global Configuration Domain Rules", () => {
  it("should enforce forward-only semver progression", () => {
    const currentActiveVersion = "1.2.0";

    // Valid forward versions
    assert.equal(semverGt("1.2.1", currentActiveVersion), true);
    assert.equal(semverGt("1.3.0", currentActiveVersion), true);
    assert.equal(semverGt("2.0.0", currentActiveVersion), true);

    // Invalid non-forward versions
    assert.equal(semverGt("1.2.0", currentActiveVersion), false, "Same version is not forward");
    assert.equal(semverGt("1.1.9", currentActiveVersion), false, "Lower version is not forward");
    assert.equal(semverGt("0.9.0", currentActiveVersion), false, "Older major is not forward");
  });

  it("should instantiate specific error types with descriptive messages", () => {
    const notFound = new GlobalConfigNotFoundError("cfg-123");
    assert.equal(notFound.name, "GlobalConfigNotFoundError");
    assert.match(notFound.message, /cfg-123/);

    const conflict = new GlobalConfigVersionConflictError("2.0.0");
    assert.equal(conflict.name, "GlobalConfigVersionConflictError");
    assert.match(conflict.message, /2.0.0/);

    const notForward = new GlobalConfigVersionNotForwardError("1.0.0", "1.5.0");
    assert.equal(notForward.name, "GlobalConfigVersionNotForwardError");
    assert.match(notForward.message, /1.0.0/);
    assert.match(notForward.message, /1.5.0/);

    const tooLarge = new GlobalConfigFileTooLargeError(10000000, 5000000);
    assert.equal(tooLarge.name, "GlobalConfigFileTooLargeError");
  });
});
