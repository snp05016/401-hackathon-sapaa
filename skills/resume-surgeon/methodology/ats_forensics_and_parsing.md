# ATS-Oriented Parsing and Document Forensics

This module checks whether a resume is structurally readable and suitable for evidence-aware comparison. It does not claim exact knowledge of any employer's proprietary parser.

## Document representation

Parse the source into:

```text
Document
├── contact metadata
├── sections
│   ├── headings
│   ├── entries: title, organization, location, dates
│   └── bullets: action, scope, tools, outcomes
└── skills: categories and items
```

Every node should retain a source span for safe diff generation.

## Document-health checks

- standard, recognizable section headings;
- chronological and internally consistent dates;
- contact information in the main reading flow;
- clean text extraction order;
- no overlapping columns, floating text boxes, or graphics carrying essential information;
- embedded fonts and usable Unicode mappings;
- consistent punctuation and tense;
- no invisible text, micro-font keywords, or off-canvas content.

Do not reject every use of LaTeX tables: many templates use simple tables for paired headings and dates. Instead, verify the compiled text order and ensure body bullets are not split across complex multi-column layouts.

## Validation methods

When tools are available, compare:

1. source-level section and macro parsing;
2. `pdftotext -layout` output;
3. a PDF library's page and text extraction;
4. visible rendering for overflow, collisions, and missing glyphs.

Record which checks actually ran. A missing tool yields `not_checked`, not `passed`.

## Severity

- `fatal`: invisible text, unreadable output, missing essential identity, or corrupted source;
- `high`: broken reading order, missing major section content, or inconsistent role/date association;
- `medium`: ambiguous headings, weak hierarchy, or extraction differences;
- `low`: typography, punctuation, or minor density issues.

Tailoring may continue only when source spans are reliable and no fatal integrity issue exists. Layout repair beyond small content-neutral fixes requires explicit user permission.
