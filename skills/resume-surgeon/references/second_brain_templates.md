# Candidate Evidence Store Templates

The host may maintain a local evidence store. This is optional; the skill must also work with only a master resume and explicit user answers.

## Evidence record

```yaml
id: evidence-project-example
type: project
title: "Project title"
identity_anchor: "One sentence describing what the project fundamentally was."
date_range:
  start: YYYY-MM
  end: YYYY-MM
authorized_source_ids: []
claims:
  - id: claim-example
    text: "Verified claim"
    evidence_level: direct
    source_reference: "source-id or resume span"
    verified_at: YYYY-MM-DD
```

## Tailoring run

```yaml
id: tailoring-run-id
master_resume_id: resume-id
job_id: job-id
preference_snapshot_id: preference-id
authorized_evidence_source_ids: []
created_at: ISO-8601 timestamp
output_resume_id: tailored-resume-id
validation:
  compiled: not_checked
  page_count: null
  unsupported_claims: 0
```

## Gap record

```yaml
id: gap-skill-example
requirement: "Required or preferred qualification"
importance: required
evidence_level: unknown
resume_action: leave_as_gap
notes: "Why the requirement was not added"
```

## Storage and privacy

- Store evidence locally by default.
- Use stable opaque identifiers rather than embedding unnecessary personal data.
- Keep source authorization per run.
- Do not send full repositories, unrelated documents, or application history to a cloud model.
- Preserve provenance so users can inspect why each claim was included.
