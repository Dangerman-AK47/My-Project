import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DuplicateRegistrationError,
  RegistrationRequestNotFoundError,
  InvalidRequestStateError,
} from "../src/lib/services/registration-requests";
import { parseDeviceId } from "../src/lib/validation/device-id";

describe("Sensor Auto-Registration Domain Validation", () => {
  it("should validate valid sensor IDs for registration", () => {
    const valid = ["SENSOR-001", "DEV_ALPHA.1", "NODE-42", "gateway-99"];
    for (const id of valid) {
      const result = parseDeviceId(id);
      assert.equal(result.success, true, `Expected ${id} to be valid`);
      if (result.success) {
        assert.equal(result.value, id.toUpperCase());
      }
    }
  });

  it("should reject invalid sensor IDs for registration", () => {
    const invalid = ["", "a", "ab", "SENSOR$#@", "id with spaces"];
    for (const id of invalid) {
      const result = parseDeviceId(id);
      assert.equal(result.success, false, `Expected ${id} to be rejected`);
    }
  });

  it("should instantiate DuplicateRegistrationError correctly", () => {
    const err = new DuplicateRegistrationError("SENSOR-EXISTS-01");
    assert.equal(err.name, "DuplicateRegistrationError");
    assert.match(err.message, /SENSOR-EXISTS-01/);
  });

  it("should instantiate InvalidRequestStateError correctly", () => {
    const err = new InvalidRequestStateError("Request already processed");
    assert.equal(err.name, "InvalidRequestStateError");
    assert.equal(err.message, "Request already processed");
  });
});
