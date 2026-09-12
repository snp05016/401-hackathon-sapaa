# Candidate Tailoring Preferences

The host product should collect these preferences before a cloud-model tailoring call. Missing fields use the conservative defaults below.

```json
{
  "target_roles": [],
  "priority_themes": [],
  "must_preserve_entry_ids": [],
  "must_preserve_section_ids": ["education", "experience", "skills"],
  "allowed_section_order": [],
  "allow_bullet_reordering": true,
  "allow_content_removal": false,
  "allow_layout_changes": false,
  "allow_new_supported_claims": false,
  "tone": "direct",
  "maximum_pages": 1,
  "minimum_font_size_pt": 10,
  "review_before_save": true,
  "authorized_evidence_source_ids": [],
  "cloud_data_scope": "minimum_required"
}
```

## Semantics

- `target_roles`: roles the candidate wants the resume to emphasize.
- `priority_themes`: preferred strengths, domains, or outcomes to foreground.
- `must_preserve_*`: stable identifiers that cannot be removed.
- `allowed_section_order`: empty means preserve the master order.
- `allow_content_removal`: permits omission from the tailored copy, never deletion from the master.
- `allow_layout_changes`: permits limited style or spacing changes after content recovery is exhausted.
- `allow_new_supported_claims`: permits adding facts absent from the master only when an authorized evidence source supports them.
- `tone`: e.g. `direct`, `technical`, `concise`, or `leadership-focused`.
- `maximum_pages`: positive integer chosen by the candidate.
- `review_before_save`: default `true` when missing.
- `authorized_evidence_source_ids`: explicit allowlist for this run.
- `cloud_data_scope`: must remain `minimum_required` for cloud execution.

Truthfulness, privacy, and valid document structure override conflicting preferences. Report any preference that cannot be honored and why.
