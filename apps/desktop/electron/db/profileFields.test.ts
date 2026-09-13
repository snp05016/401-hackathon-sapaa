import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PROFILE_FIELDS, normalizeProfileFields } from "./index";

test("profile schema keeps the veteran status field and adds LGBTQ status with safe defaults", () => {
  const keys = DEFAULT_PROFILE_FIELDS.map((field) => field.key);

  assert.ok(keys.includes("veteranStatus"));
  assert.ok(keys.includes("lgbtqStatus"));

  const normalized = normalizeProfileFields([
    { key: "veteranStatus", label: "Veteran status", value: "Yes", category: "eeo" },
    { key: "lgbtqStatus", label: "LGBTQ+ status", value: "No", category: "eeo" },
  ]);

  assert.ok(normalized.some((field) => field.key === "veteranStatus" && field.value === "Yes"));
  assert.ok(normalized.some((field) => field.key === "lgbtqStatus" && field.value === "No"));
});
