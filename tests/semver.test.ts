import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidSemver, semverSchema, semverGt, compareSemver } from "../src/lib/validation/semver";

describe("Semver Validation Helper & Schema", () => {
  it("should accept valid standard semver strings", () => {
    const valid = ["1.0.0", "0.1.0", "2.14.3", "0.0.1", "10.200.300"];
    for (const v of valid) {
      assert.equal(isValidSemver(v), true, `Expected "${v}" to be valid`);
      const parsed = semverSchema.safeParse(v);
      assert.equal(parsed.success, true);
    }
  });

  it("should reject versions with leading 'v'", () => {
    assert.equal(isValidSemver("v1.0.0"), false);
    const parsed = semverSchema.safeParse("v1.0.0");
    assert.equal(parsed.success, false);
  });

  it("should reject incomplete version strings", () => {
    assert.equal(isValidSemver("1.0"), false);
    assert.equal(isValidSemver("1"), false);
    assert.equal(isValidSemver(""), false);
  });

  it("should reject prerelease tags in strict semver format", () => {
    assert.equal(isValidSemver("1.0.0-beta.1"), false);
    assert.equal(isValidSemver("1.0.0-alpha"), false);
    assert.equal(isValidSemver("1.0.0+20130313144700"), false);
  });

  it("should reject non-numeric characters", () => {
    assert.equal(isValidSemver("latest"), false);
    assert.equal(isValidSemver("1.x.3"), false);
    assert.equal(isValidSemver("1.0.0a"), false);
  });

  it("should trim leading and trailing whitespace on parse", () => {
    const parsed = semverSchema.safeParse("  1.2.3  ");
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data, "1.2.3");
    }
  });

  it("should accurately compare semantic versions", () => {
    assert.equal(semverGt("2.0.0", "1.9.9"), true);
    assert.equal(semverGt("1.10.0", "1.9.9"), true);
    assert.equal(semverGt("1.0.1", "1.0.0"), true);
    assert.equal(semverGt("1.0.0", "1.0.0"), false);
    assert.equal(semverGt("1.0.0", "2.0.0"), false);
    assert.equal(semverGt("1.2.3", "1.3.0"), false);

    assert.equal(compareSemver("2.0.0", "1.9.9"), 1);
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
    assert.equal(compareSemver("0.9.9", "1.0.0"), -1);
  });
});
