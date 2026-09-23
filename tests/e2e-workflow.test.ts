import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getStorageDriver, DatabaseStorageDriver } from "../src/lib/storage";
import { getDeviceStatusCounts } from "../src/lib/services/device-queries";
import { getRequestStatusCounts } from "../src/lib/services/request-queries";

describe("Database Storage Driver & Query Consolidation", () => {
  it("should save, read, and delete binary blobs via DatabaseStorageDriver", async () => {
    const dbDriver = new DatabaseStorageDriver();
    const payload = Buffer.from(
      JSON.stringify({ message: "sensor telemetry binary", time: Date.now() }),
      "utf-8"
    );

    const saved = await dbDriver.save({
      originalFileName: "telemetry.json",
      buffer: payload,
    });

    assert.ok(saved.storagePath, "storagePath should be set");
    assert.equal(saved.fileSize, payload.byteLength);

    const readBuf = await dbDriver.read(saved.storagePath);
    assert.equal(readBuf.toString("utf-8"), payload.toString("utf-8"));

    await dbDriver.delete(saved.storagePath);

    // Verify deletion
    await assert.rejects(
      async () => {
        await dbDriver.read(saved.storagePath);
      },
      /Blob not found/i
    );
  });

  it("should return consolidated device status counts in a single query", async () => {
    const stats = await getDeviceStatusCounts();
    assert.equal(typeof stats.total, "number");
    assert.equal(typeof stats.active, "number");
    assert.equal(typeof stats.deactive, "number");
    assert.equal(stats.total, stats.active + stats.deactive);
  });

  it("should return consolidated request status counts in a single query", async () => {
    const stats = await getRequestStatusCounts();
    assert.equal(typeof stats.pending, "number");
    assert.equal(typeof stats.approved, "number");
    assert.equal(typeof stats.rejected, "number");
    assert.equal(typeof stats.cancelled, "number");
  });

  it("should use hybrid driver to retrieve files seamlessly", async () => {
    const driver = getStorageDriver();
    const payload = Buffer.from("config-payload-content", "utf-8");

    const saved = await driver.save({
      originalFileName: "config-test.json",
      buffer: payload,
    });

    const readBack = await driver.read(saved.storagePath);
    assert.equal(readBack.toString("utf-8"), "config-payload-content");

    await driver.delete(saved.storagePath);
  });
});
