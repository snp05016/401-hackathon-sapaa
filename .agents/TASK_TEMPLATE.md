# AI Agent Task Envelope

Copy this template when assigning implementation to Builder or UI Builder. Delete
instructional comments after filling it in.

## Objective

<!-- One observable outcome. Avoid combining several unrelated features. -->

## Human owner

<!-- Person responsible for accepting decisions and coordinating overlaps. -->

## Owned files and directories

<!-- Exact paths the agent may modify. -->

-

## Conditionally allowed shared files

<!-- Shared contracts or root files that may change only if a named condition is met. -->

- None unless explicitly listed.

## Forbidden areas

<!-- Teammate-owned or unrelated paths the agent must not modify. -->

-

## Current behavior

<!-- Evidence-backed description with file paths and symbols. -->

## Existing input contracts

<!-- Types, events, routes, database shapes, props, or function parameters consumed. -->

## Required output contracts

<!-- Exact return values, events, persistence effects, or rendered states produced. -->

## Expected success behavior

1.

## Failure and boundary behavior

1.

## Non-goals

<!-- Adjacent improvements that must not enter this change. -->

-

## Acceptance criteria

- [ ]

## Required verification

<!-- Use repository commands and concrete manual/runtime scenarios. -->

- [ ] Targeted tests:
- [ ] Typecheck when TypeScript contracts are affected:
- [ ] Production build when application integration is affected:
- [ ] `git diff --check`:
- [ ] Manual/runtime scenarios:

## Return format

```md
Outcome
Files changed
Contracts changed or preserved
Acceptance-criteria evidence
Tests and builds run
Known limitations
Teammate handoff
```
