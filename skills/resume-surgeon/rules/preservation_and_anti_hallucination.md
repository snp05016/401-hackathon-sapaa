# Preservation and Anti-Hallucination Rules

These rules apply to every candidate and every tailoring run.

## Claim classes

Classify each resume statement before editing:

- `immutable_identity`: candidate name, employer, official title, school, degree, dates, credentials;
- `verified_outcome`: metrics, scale, rankings, awards, business outcomes;
- `verified_scope`: systems, responsibilities, tools, methods, and audiences;
- `presentation`: ordering, emphasis, action verbs, sentence structure, and concise wording;
- `unknown`: anything not supported by an authorized source.

Only `presentation` is freely editable. Identity, outcomes, and scope require supporting evidence or an explicit verified correction from the user. Unknowns are never promoted into resume claims.

## Core identity anchors

For every role or project, derive a one-sentence identity anchor from the source resume and evidence. The anchor states what the work fundamentally was. Rewriting may emphasize different verified facets, but must not turn the work into a different product, responsibility, industry, or level of ownership.

Example:

```text
Anchor: Internal inventory dashboard used by warehouse staff.
Allowed facet: Emphasize its React component system for a frontend role.
Rejected rewrite: Describe it as a customer-facing commerce platform.
```

## Evidence policy

A changed claim must cite at least one authorized source:

1. exact or equivalent text in the master resume;
2. structured candidate profile data;
3. a user-provided portfolio, work sample, or evidence record;
4. a repository or document the user explicitly authorized for inspection;
5. an explicit factual statement by the user in the current session.

Evidence from one role or project cannot be reassigned to another. A technology appearing in a job description is not evidence that the candidate knows it.

## Negative constraints

- `NC-01`: Never overwrite or silently mutate the master resume.
- `NC-02`: Never invent or strengthen employers, roles, dates, education, credentials, ownership, metrics, tools, or outcomes.
- `NC-03`: Never add an unsupported job-description keyword to a skills list or bullet.
- `NC-04`: Never remove a must-preserve item or exceed the user's allowed removal policy.
- `NC-05`: Never inspect a private source that the user did not authorize.
- `NC-06`: Never conceal keywords with invisible text, micro-fonts, metadata, or other anti-human tricks.
- `NC-07`: Never claim that simulated ATS scoring predicts an employer's actual decision.
- `NC-08`: Never send more personal data to a cloud model than the operation requires.

Any violation rejects the proposed change set.

## In-progress work

In-progress work may be included only when the user explicitly confirms both the work and its associated role or project. Use wording that clearly signals its status, such as “building,” “piloting,” or “currently implementing.” Do not attach an unverified outcome or metric.

## Skills policy

Skills may be reordered or normalized only when already supported. Missing job skills belong in a gap report, not on the resume. If the user later confirms genuine familiarity, record the evidence level accurately and avoid implying production depth when the experience was coursework or exploration.

## Final audit

Before returning a tailored resume, verify:

- every changed claim has an evidence reference;
- all numbers and dates match their source;
- core identity anchors remain intact;
- must-preserve preferences are honored;
- unsupported job keywords remain absent;
- the master source is unchanged;
- cloud context was minimized;
- all validation results are reported honestly.
