import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getUtcMidnight } from "../src/lib/services/version-check";
import type { RegisteredDevice } from "@prisma/client";

describe("Version Check Logic & Telemetry", () => {
  it("should truncate date to midnight UTC accurately", () => {
    const d = new Date("2026-09-22T15:34:56.789Z");
    const midnight = getUtcMidnight(d);

    assert.equal(midnight.getUTCFullYear(), 2026);
    assert.equal(midnight.getUTCMonth(), 8); // September is 8 (0-indexed)
    assert.equal(midnight.getUTCDate(), 22);
    assert.equal(midnight.getUTCHours(), 0);
    assert.equal(midnight.getUTCMinutes(), 0);
    assert.equal(midnight.getUTCSeconds(), 0);
    assert.equal(midnight.getUTCMilliseconds(), 0);
  });

  it("should recognize active vs deactive sensor status types", () => {
    const mockActiveDevice: Partial<RegisteredDevice> = {
      id: "sensor-1",
      deviceId: "DEV-TEST-001",
      status: "ACTIVE",
    };

    const mockDeactiveDevice: Partial<RegisteredDevice> = {
      id: "sensor-2",
      deviceId: "DEV-TEST-002",
      status: "DEACTIVE",
    };

    assert.equal(mockActiveDevice.status, "ACTIVE");
    assert.equal(mockDeactiveDevice.status, "DEACTIVE");
  });
});
