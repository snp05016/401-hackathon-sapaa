import assert from "node:assert/strict";
import { test } from "node:test";
import { matchFormField } from "./matchFormField";
import type { DetectedFormField, ProfileField } from "@ghostboard/shared";

const profileFields: ProfileField[] = [
  { key: "fullName", label: "Full name", value: "Ada Lovelace", category: "personal" },
  { key: "email", label: "Email", value: "ada@example.com", category: "contact" },
  { key: "phone", label: "Phone", value: "+15555555555", category: "contact" },
  { key: "linkedin", label: "LinkedIn URL", value: "https://linkedin.com/in/ada", category: "links" },
  { key: "github", label: "GitHub URL", value: "https://github.com/ada", category: "links" },
];

function field(overrides: Partial<DetectedFormField> = {}): DetectedFormField {
  return {
    selector: "#example",
    label: null,
    fieldType: "text",
    name: null,
    placeholder: null,
    options: null,
    ...overrides,
  };
}

test("matchFormField recognizes common identity fields from labels and names", () => {
  const firstName = matchFormField(field({ label: "First Name", name: "first_name" }), profileFields);
  assert.equal(firstName.matchedProfileKey, "fullName");
  assert.ok(firstName.confidence >= 0.75);

  const email = matchFormField(field({ label: "Email Address", name: "email" }), profileFields);
  assert.equal(email.matchedProfileKey, "email");
  assert.ok(email.confidence >= 0.8);

  const linkedIn = matchFormField(field({ label: "LinkedIn Profile", placeholder: "linkedin.com/in/you" }), profileFields);
  assert.equal(linkedIn.matchedProfileKey, "linkedin");
  assert.ok(linkedIn.confidence >= 0.8);
});

test("matchFormField returns no match when the field is unrelated", () => {
  const result = matchFormField(field({ label: "Start Date", name: "start_date" }), profileFields);
  assert.equal(result.matchedProfileKey, null);
  assert.equal(result.confidence, 0);
});
