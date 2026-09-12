# ATS-Oriented System Reference

This reference describes a transparent approximation for resume quality and job alignment. Commercial applicant-tracking and employer-review systems vary and are not observable from this skill.

## Two independent dimensions

### Document health

Evaluate parseable structure, reading order, recognizable sections, consistent dates, text extraction, font encoding, and visible integrity.

### Evidence-adjusted job alignment

Evaluate required and preferred qualifications against candidate evidence. Exact terminology, semantic equivalence, and related skills can inform relevance, but only verified evidence can support a resume claim.

## Recommended architecture

Use deterministic code for:

- LaTeX/source parsing;
- section and date extraction;
- diffing;
- file isolation and provenance;
- compilation and page counting;
- keyword density and suspicious-format checks.

Use a cloud LLM for:

- job-description decomposition when deterministic extraction is insufficient;
- preference-aware wording and emphasis;
- focused clarification questions;
- adversarial claim review.

The cloud model should receive only the necessary resume sections, job requirements, preferences, and authorized evidence excerpts.

## Review perspectives

A single model may evaluate the draft from these distinct perspectives:

1. parser and document integrity;
2. recruiter skim and clarity;
3. role relevance;
4. technical or domain authenticity;
5. interview defensibility;
6. forensic truth and preference compliance.

These are review lenses, not proof that six independent agents or real employers evaluated the document.

## Safe execution

- preserve the master source;
- write a separate tailored version;
- show literal diffs;
- retain a claim-evidence ledger;
- validate output deterministically;
- surface unknowns and failures;
- require explicit authorization for private evidence sources;
- never insert unsupported skills for keyword coverage.
