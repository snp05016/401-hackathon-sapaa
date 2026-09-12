import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAudioForTranscription } from "./transcribe";

function smallAudio(mimeType = "audio/webm"): Uint8Array {
  return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
}

test("validateAudioForTranscription accepts a small audio clip", () => {
  assert.doesNotThrow(() => validateAudioForTranscription({ audio: smallAudio(), mimeType: "audio/webm" }));
});

test("validateAudioForTranscription rejects a missing or empty clip", () => {
  assert.throws(() => validateAudioForTranscription({ audio: new Uint8Array(0), mimeType: "audio/webm" }), /No audio captured/);
  assert.throws(() => validateAudioForTranscription({ audio: null as unknown as Uint8Array, mimeType: "audio/webm" }), /No audio captured/);
});

test("validateAudioForTranscription rejects clips over the 25 MB limit", () => {
  const oversized = new Uint8Array(25_000_001);
  assert.throws(() => validateAudioForTranscription({ audio: oversized, mimeType: "audio/webm" }), /too large/);
});

test("validateAudioForTranscription rejects non-audio mime types", () => {
  assert.throws(() => validateAudioForTranscription({ audio: smallAudio(), mimeType: "video/webm" }), /Unsupported audio format/);
  assert.throws(() => validateAudioForTranscription({ audio: smallAudio(), mimeType: "" }), /Unsupported audio format/);
});