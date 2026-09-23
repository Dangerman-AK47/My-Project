import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET as getUpload, POST as postUpload } from "../src/app/portal/upload/route";
import { GET as getCheck, POST as postCheck } from "../src/app/portal/check/route";
import { GET as getDownload, POST as postDownload } from "../src/app/portal/download/route";

describe("Portal Dedicated API Endpoints", () => {
  it("should define valid Route Handler functions for /portal/upload", () => {
    assert.equal(typeof getUpload, "function");
    assert.equal(typeof postUpload, "function");
  });

  it("should return informative response from GET /portal/upload", async () => {
    const res = await getUpload();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.match(body.message, /Portal upload endpoint/i);
  });

  it("should define valid Route Handler functions for /portal/check", () => {
    assert.equal(typeof getCheck, "function");
    assert.equal(typeof postCheck, "function");
  });

  it("should reject unauthorized request without credentials on GET /portal/check", async () => {
    const req = new Request("http://localhost:3000/portal/check");
    const res = await getCheck(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, "unauthorized");
  });

  it("should reject unauthorized request without credentials on POST /portal/check", async () => {
    const req = new Request("http://localhost:3000/portal/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentConfigVersion: "1.0.0" }),
    });
    const res = await postCheck(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.result, "SENSOR_NOT_REGISTERED");
  });

  it("should define valid Route Handler functions for /portal/download", () => {
    assert.equal(typeof getDownload, "function");
    assert.equal(typeof postDownload, "function");
  });

  it("should reject unauthorized request without credentials on GET /portal/download", async () => {
    const req = new Request("http://localhost:3000/portal/download");
    const res = await getDownload(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, "unauthorized");
  });
});
