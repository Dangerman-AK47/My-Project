import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

describe("Admin Authentication & Password Security", () => {
  before(() => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/filevault";
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "ChangeThisPassword123!";
    process.env.SESSION_SECRET = "test-secret-must-be-at-least-32-characters-long-key";
  });

  it("should hash and verify passwords correctly with bcrypt", async () => {
    const { hashPassword, verifyPassword } = await import("../src/lib/auth/passwords");
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    assert.notEqual(hash, password);
    assert.ok(hash.startsWith("$2a$") || hash.startsWith("$2b$"));

    const isValid = await verifyPassword(password, hash);
    assert.equal(isValid, true);

    const isInvalid = await verifyPassword("WrongPassword!", hash);
    assert.equal(isInvalid, false);
  });

  it("should create and verify signed JWT session tokens", async () => {
    const { createSessionToken, verifySessionToken } = await import("../src/lib/auth/session");

    const payload = {
      sub: "admin-id-12345",
      username: "admin_user",
      role: "ADMIN",
    };

    const token = await createSessionToken(payload);
    assert.ok(typeof token === "string" && token.length > 20);

    const verified = await verifySessionToken(token);
    assert.ok(verified !== null);
    if (verified) {
      assert.equal(verified.sub, payload.sub);
      assert.equal(verified.username, payload.username);
      assert.equal(verified.role, payload.role);
    }
  });

  it("should reject invalid or tampered session tokens", async () => {
    const { verifySessionToken } = await import("../src/lib/auth/session");

    assert.equal(await verifySessionToken(undefined), null);
    assert.equal(await verifySessionToken("not-a-real-token"), null);
    assert.equal(await verifySessionToken("eyJhbGciOiJIUzI1NiJ9.invalid.signature"), null);
  });
});
