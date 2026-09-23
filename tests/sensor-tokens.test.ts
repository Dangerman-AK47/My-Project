import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { generateSensorTokenString } from "../src/lib/services/sensor-tokens";

describe("Sensor Tokens Generation & Hashing", () => {
  it("should generate 32-byte (64 hex characters) CSPRNG token strings", () => {
    const token1 = generateSensorTokenString();
    const token2 = generateSensorTokenString();

    assert.equal(typeof token1, "string");
    assert.equal(token1.length, 64);
    assert.match(token1, /^[0-9a-f]{64}$/);

    assert.notEqual(token1, token2, "Subsequent tokens must be distinct");
  });

  it("should verify correct token against its bcrypt hash", async () => {
    const token = generateSensorTokenString();
    const hash = await bcrypt.hash(token, 10);

    const isMatch = await bcrypt.compare(token, hash);
    assert.equal(isMatch, true);

    const isWrongMatch = await bcrypt.compare("wrong-token-value", hash);
    assert.equal(isWrongMatch, false);
  });
});
