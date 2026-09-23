import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatUploadId, formatFileSize, formatUploadTimestamp } from "../src/lib/upload/format";

describe("Formatting Helpers", () => {
  it("should format upload IDs with zero-padded sequence numbers", () => {
    assert.equal(formatUploadId(1), "UP-000001");
    assert.equal(formatUploadId(42), "UP-000042");
    assert.equal(formatUploadId(999999), "UP-999999");
  });

  it("should format file sizes accurately across byte units", () => {
    assert.equal(formatFileSize(512), "512 B");
    assert.equal(formatFileSize(1024), "1.0 KB");
    assert.equal(formatFileSize(2.5 * 1024 * 1024), "2.5 MB");
    assert.equal(formatFileSize(1024 * 1024 * 1024), "1.0 GB");
  });

  it("should format timestamps with date, time, and combined labels", () => {
    const testDate = new Date("2026-09-17T23:49:00Z");
    const formatted = formatUploadTimestamp(testDate);
    assert.ok(formatted.dateLabel.length > 0);
    assert.ok(formatted.timeLabel.length > 0);
    assert.ok(formatted.combined.includes(formatted.dateLabel));
    assert.ok(formatted.date.length > 0);
  });
});
