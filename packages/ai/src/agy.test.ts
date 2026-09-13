import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAgyPrompt, isAgyAvailable, resolveAgyBinary } from "./agy";
import { getProvider } from "./provider";

test("formatAgyPrompt combines system and user messages", () => {
  const prompt = formatAgyPrompt({
    messages: [
      { role: "system", content: "You are a resume surgeon." },
      { role: "user", content: "Tailor this experience." },
    ],
  });

  assert.match(prompt, /### SYSTEM INSTRUCTIONS ###/);
  assert.match(prompt, /You are a resume surgeon\./);
  assert.match(prompt, /### USER REQUEST ###/);
  assert.match(prompt, /Tailor this experience\./);
});

test("formatAgyPrompt handles user-only messages", () => {
  const prompt = formatAgyPrompt({
    messages: [
      { role: "user", content: "List all TODOs." },
    ],
  });

  assert.equal(prompt, "List all TODOs.");
});

test("resolveAgyBinary resolves a valid string", () => {
  const binary = resolveAgyBinary();
  assert.equal(typeof binary, "string");
  assert.ok(binary.length > 0);
});

test("getProvider respects GHOSTBOARD_LLM_PROVIDER=agy", () => {
  const originalEnv = process.env.GHOSTBOARD_LLM_PROVIDER;
  try {
    process.env.GHOSTBOARD_LLM_PROVIDER = "agy";
    const provider = getProvider();
    assert.equal(provider.name, "agy");
    assert.equal(typeof provider.complete, "function");
  } finally {
    process.env.GHOSTBOARD_LLM_PROVIDER = originalEnv;
  }
});
