# Report Templates

## Baseline comparison

```markdown
# Resume-to-Job Baseline

**Role:** [role]
**Company:** [company]
**Source resume:** [master identifier]

## Document health
- Status: [pass / warn / fail / not checked]
- Confirmed checks: [checks actually run]
- Findings: [evidence-backed findings]

## Requirement coverage
| Requirement | Importance | Evidence level | Resume source | Confidence | Action |
|---|---|---|---|---|---|
| [requirement] | [required/preferred] | [direct/related/coursework/familiarity/unknown] | [entry or —] | [high/medium/low] | [retain/reframe/clarify/gap] |

## Constraints
- Unsupported claims detected: [count]
- Must-preserve preferences: [status]
- Unresolved questions: [list]
```

## Tailoring proposal

````markdown
# Tailoring Proposal

## Preferences applied
- [preference]: [decision]

## Literal changes
```diff
- [original LaTeX]
+ [proposed LaTeX]
```

## Claim-evidence ledger
| Changed claim | Evidence source | Evidence level | Status |
|---|---|---|---|
| [claim] | [source id] | [direct/related/coursework/familiarity] | [supported/rejected] |

## Validation
- Master unchanged: [yes/no/not checked]
- LaTeX compiled: [pass/fail/not checked]
- Page count: [number/not checked]
- Text extraction: [pass/warn/fail/not checked]

## Remaining gaps
- [requirement]: [reason it was not added]
````

## Final comparison

```markdown
# Final Resume Review

- Document health: [baseline] -> [final]
- Evidence-adjusted alignment: [baseline band] -> [final band]
- Unsupported claims: [must be 0]
- Preferences honored: [yes/no with exceptions]
- Output artifact: [host-provided identifier]
```
