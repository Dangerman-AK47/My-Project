import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFileName } from "../src/lib/storage";

describe("Storage File Handling & Sanitization", () => {
  it("should preserve clean filenames and extensions", () => {
    assert.equal(sanitizeFileName("report.pdf"), "report.pdf");
    assert.equal(sanitizeFileName("my_archive_2026.tar.gz"), "my_archive_2026.tar.gz");
    assert.equal(sanitizeFileName("data-export-123.json"), "data-export-123.json");
  });

  it("should strip path traversal components", () => {
    assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
    assert.equal(sanitizeFileName("..\\..\\windows\\system32\\cmd.exe"), "cmd.exe");
    assert.equal(sanitizeFileName("subfolder/file.txt"), "file.txt");
  });

  it("should replace dangerous and special characters with underscores", () => {
    assert.equal(sanitizeFileName("my file (1) [final]!.docx"), "my_file__1___final__.docx");
    assert.equal(sanitizeFileName("script<alert>.js"), "script_alert_.js");
    assert.equal(sanitizeFileName("foo$bar#baz?.png"), "foo_bar_baz_.png");
  });

  it("should provide fallback if filename becomes empty", () => {
    assert.equal(sanitizeFileName(""), "file");
    assert.equal(sanitizeFileName("???"), "___");
  });
});
