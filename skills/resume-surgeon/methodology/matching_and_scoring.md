# Evidence-Aware Matching and Scoring

This methodology compares a parsed resume with a job description. It is an internal prioritization model, not a replica of any proprietary ATS.

## Normalized representations

Represent each job requirement with:

- canonical name and exact source phrase;
- required or preferred status;
- importance weight;
- responsibility or outcome context.

Represent each candidate match with:

- source section and entry;
- exact evidence reference;
- evidence level;
- recency when known;
- confidence and any uncertainty.

Normalize common aliases only when they are genuinely equivalent. Related technologies may receive partial relevance but must never be rewritten as exact matches.

## Evidence multipliers

Suggested defaults:

| Evidence level | Multiplier |
|---|---:|
| Direct role or project evidence with a concrete outcome | 1.00 |
| Direct role or project evidence without a metric | 0.85 |
| Related or transferable evidence | 0.70 |
| Coursework or training | 0.60 |
| Confirmed familiarity or skills-list only | 0.40 |
| Unknown or missing | 0.00 |

The host may tune weights, but must not award positive evidence to an unknown skill.

## Match signals

Use three complementary signals when available:

1. lexical overlap for exact terminology;
2. semantic similarity for equivalent phrasing;
3. taxonomy proximity for related concepts.

Keep the evidence multiplier separate from semantic relevance. A semantically close statement with no candidate evidence is still unsupported.

## Score structure

Report two independent dimensions:

- `document_health`: parseability, structure, clarity, and layout;
- `job_alignment`: weighted, evidence-adjusted requirement coverage.

Use broad bands such as weak, moderate, and strong. If numeric scores are shown, label them estimates and include the inputs and deductions. Do not claim an 80/100 from this method equals an 80% chance of passing an employer's screen.

## Anti-gaming checks

Reject or penalize:

- invisible or micro-font keyword text;
- repetitive keyword stuffing;
- verbatim copying of job-description sentences;
- unsupported exact-skill substitution;
- misleading ownership or seniority inflation.

## Comparison output

Return a matrix with requirement, importance, evidence level, source, confidence, and proposed action. Proposed actions are limited to `retain`, `reorder`, `truthful_reframe`, `clarify`, or `leave_as_gap`.
