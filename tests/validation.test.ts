import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deviceIdSchema,
  parseDeviceId,
  DEVICE_ID_MIN_LENGTH,
  DEVICE_ID_MAX_LENGTH,
} from "../src/lib/validation/device-id";

describe("Device ID Validation & Normalization", () => {
  it("should accept valid device IDs and normalize them to uppercase", () => {
    const cases = [
      { input: "dev-1001", expected: "DEV-1001" },
      { input: "device_42", expected: "DEVICE_42" },
      { input: "node.01", expected: "NODE.01" },
      { input: "A-123_b.c", expected: "A-123_B.C" },
      { input: "abc", expected: "ABC" },
    ];
    for (const c of cases) {
      const parsed = deviceIdSchema.safeParse(c.input);
      assert.equal(parsed.success, true, `Expected "${c.input}" to be valid`);
      if (parsed.success) {
        assert.equal(parsed.data, c.expected);
      }
    }
  });

  it("should trim leading and trailing spaces and uppercase", () => {
    const raw = "   dev-9999   ";
    const parsed = deviceIdSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data, "DEV-9999");
    }
  });

  it("should reject device IDs shorter than minimum length", () => {
    const parsed = deviceIdSchema.safeParse("ab");
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.error.issues[0]);
      assert.match(
        parsed.error.issues[0].message,
        new RegExp(`at least ${DEVICE_ID_MIN_LENGTH} characters`, "i")
      );
    }
  });

  it("should reject device IDs that exceed maximum length", () => {
    const longId = "a".repeat(DEVICE_ID_MAX_LENGTH + 1);
    const parsed = deviceIdSchema.safeParse(longId);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.error.issues[0]);
      assert.match(
        parsed.error.issues[0].message,
        new RegExp(`at most ${DEVICE_ID_MAX_LENGTH} characters`, "i")
      );
    }
  });

  it("should reject invalid characters", () => {
    const invalidIds = ["DEV 1001", "device@home", "id#1", "dev/test", "dev$"];
    for (const id of invalidIds) {
      const parsed = deviceIdSchema.safeParse(id);
      assert.equal(parsed.success, false, `Expected "${id}" to be rejected`);
    }
  });

  it("should correctly validate and return errors via parseDeviceId helper", () => {
    const valid = parseDeviceId("  dev-500  ");
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.value, "DEV-500");
    }

    const invalid = parseDeviceId("x");
    assert.equal(invalid.success, false);
    if (!invalid.success) {
      assert.ok(invalid.error.length > 0);
    }
  });
});
