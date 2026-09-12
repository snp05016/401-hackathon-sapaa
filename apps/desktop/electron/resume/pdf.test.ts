import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeFolderName } from "./pdf";

test("sanitizeFolderName strips illegal filename characters", () => {
  assert.equal(sanitizeFolderName('Capture/A Test'), "Capture A Test");
  assert.equal(sanitizeFolderName('A/B\\C:D*E?F"G<H>I|J'), "A B C D E F G H I J");
});

test("sanitizeFolderName strips control characters", () => {
  assert.equal(sanitizeFolderName("line\u0000break\u007fend"), "line break end");
});

test("sanitizeFolderName collapses whitespace and trims", () => {
  assert.equal(sanitizeFolderName("  Senior   Software  Engineer  "), "Senior Software Engineer");
  assert.equal(sanitizeFolderName("\tAcme\tCorp\n"), "Acme Corp");
});

test("sanitizeFolderName falls back to untitled for empty or stripped values", () => {
  assert.equal(sanitizeFolderName(""), "untitled");
  assert.equal(sanitizeFolderName("   "), "untitled");
  assert.equal(sanitizeFolderName("///\\\\"), "untitled");
});

test("sanitizeFolderName maps dot and dot-dot to untitled", () => {
  assert.equal(sanitizeFolderName("."), "untitled");
  assert.equal(sanitizeFolderName(".."), "untitled");
});

test("sanitizeFolderName caps the length at 80 characters", () => {
  const long = "x".repeat(200);
  assert.equal(sanitizeFolderName(long).length, 80);
  assert.ok(sanitizeFolderName(long).endsWith("x".repeat(80)));
});