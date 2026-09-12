# Project AI Agents

This directory contains reusable Codex agents for the team's engineering
workflow. They are organized by capability, not by teammate or product feature.
The same agent can therefore support scraping, tracking, autofill, resume,
database, extension, and UI work without creating seven competing agent personas.

Codex discovers project-scoped custom agents from `.codex/agents/*.toml`.
Repository-wide coding and agent rules live in the root `AGENTS.md`; the detailed
product baseline and workflow guidance live in this document.

## Shared project baseline

This is an intentionally unnamed Fall 2026 hackathon project built by a team of
seven people. It is a local-first job-search command center made from an Electron
desktop application and a Chromium Manifest V3 extension. Do not add
"Ghostboard" to user-facing text. Existing `@ghostboard/*` package scopes are
legacy technical identifiers and require a coordinated migration if they are ever
renamed.

The protected demonstration path is:

```text
real job page
  -> extension detects the active job
  -> structured job ingestion and keywords
  -> authenticated localhost bridge
  -> SQLite persistence
  -> desktop application
  -> truthful resume tailoring
  -> user-triggered autofill
  -> user manually submits
```

Agents must preserve these product constraints:

- Electron owns the local SQLite/Drizzle database.
- The bridge binds only to `127.0.0.1`, uses narrow CORS, and requires its local
  token.
- Applicant profiles, resumes, and application history stay local whenever
  possible.
- Cloud AI receives only the minimum required context.
- Scraping, matching, autofill classification, tracking, and stale-state logic
  should be deterministic unless the task explicitly authorizes otherwise.
- Resume tailoring may reorganize or reword truthful material but must never
  invent facts or overwrite the master resume.
- Autofill requires a user action and must never activate the final Submit button.
- Silence may produce stale or follow-up guidance but must never produce a
  rejection automatically.
- CAPTCHA, MFA, authentication controls, and anti-bot protections are never
  bypassed.
- Email access is opt-in and incremental; do not process an entire inbox when a
  narrow query works.
- Protect the core demo before building email tracking, universal portal status,
  mobile applications, cloud sync, or other stretch infrastructure.

The main code boundaries are:

| Path | Responsibility |
| --- | --- |
| `apps/desktop` | Electron main/preload/renderer, IPC, localhost bridge, desktop UI |
| `apps/extension` | Manifest V3 content scripts, service worker, popup UI |
| `packages/shared` | Cross-package contracts and constants |
| `packages/database` | SQLite, Drizzle, migrations, persistence |
| `packages/scraping` | Job detection, providers, normalization, ingestion |
| `packages/matching` | Deterministic keywords, coverage, similarity |
| `packages/autofill` | Applicant-field detection and matching |
| `packages/resume` | LaTeX validation, versioning, tailoring workflow |
| `packages/tracking` | Application events, stale logic, status providers |
| `packages/ai` | Narrow cloud-model provider abstraction |

Treat `packages/shared`, database migrations, bridge and IPC protocols, root
dependency files, and global UI primitives as coordination-sensitive.

The team principle is "scaffold, don't solve" when an algorithm remains assigned
as meaningful human engineering. An agent may implement the algorithm only when
the task explicitly assigns that implementation; otherwise it should establish
types, fixtures, tests, integration seams, or TODOs without silently completing
someone else's work.

## Available agents

| Agent | Primary use | Writes code? | Recommended model capacity |
| --- | --- | --- | --- |
| `scoper` | Evidence-based planning and contract discovery | No | Strongest available |
| `builder` | Bounded backend or general implementation | Yes | Any, if scope is precise |
| `ui_builder` | Desktop and extension interface work | Yes | Any competent coding model |
| `verifier` | Adversarial testing and regression review | No | Strong when risk is high |
| `integrator` | Cross-package and merge-readiness review | No | Strongest available |

No agent pins a model name. This is intentional: teammates may have different
model availability, and an unavailable model would make the shared configuration
unusable. Agents inherit the parent task's model and reasoning settings.

## Choosing an agent

Use this decision path:

```text
Is the requested outcome unclear or cross-cutting?
  yes -> scoper
  no  -> continue

Is the main deliverable a React/extension interface?
  yes -> ui_builder
  no  -> builder

Has implementation finished?
  yes -> verifier

Does the diff affect shared contracts, migrations, bridge/IPC, or multiple owners?
  yes -> integrator
  no  -> human review
```

Do not invoke all five agents automatically. A small change may need only a
builder and human review. Additional agents cost time and tokens and can pollute
the working tree if given overlapping write access.

## Model-capability strategy

The instructions are designed to make lower-capability models safer by reducing
ambiguity rather than pretending every model reasons equally well.

### With a stronger model

Use it for:

- `scoper` on unclear or cross-package work;
- `integrator` on shared-contract or migration changes;
- `verifier` for security-sensitive bridge and extension work;
- debugging failures that cross Electron, the extension, and SQLite;
- deciding between competing architectural approaches.

### With a smaller or less capable model

Give it:

- one objective;
- an explicit list of owned files;
- forbidden files or subsystems;
- exact input and output types;
- examples and edge cases;
- concrete test commands;
- a short acceptance checklist.

Do not ask a smaller model to "build the whole feature," discover ownership,
redesign contracts, and verify integration in one pass. Have `scoper` prepare the
task first, then send that bounded task to `builder` or `ui_builder`.

## Prompt contract

Every implementation request should contain this information:

```md
Objective:

Human owner:

Owned files/directories:

Shared files allowed only if necessary:

Explicitly forbidden areas:

Existing input contracts:

Required output contracts:

Expected behavior:

Edge cases:

Acceptance criteria:

Required verification commands:

Return format:
```

If some fields are unknown, invoke `scoper` first. Do not make `builder` infer a
large missing specification from a vague sentence.

## Standard workflows

### Small isolated implementation

```text
builder -> targeted tests -> human reviews diff
```

Example prompt:

```text
Use builder to implement the staleness thresholds in
packages/tracking/src/staleness.ts only. Preserve existing shared types. Add
stage-aware unit tests, never classify silence as rejected, and return the files
changed plus the exact test results.
```

### Ambiguous backend feature

```text
scoper -> human accepts scope -> builder -> verifier -> human review
```

Example planning prompt:

```text
Use scoper to map the current application-event persistence path. Return an
implementation plan for moveApplication without editing files. Identify every
IPC, database, shared-type, and UI consumer involved.
```

After accepting the plan:

```text
Use builder to implement the accepted moveApplication plan. Own only the files
listed by scoper. Do not redesign the Application contract. Run the targeted
tests and npm run typecheck.
```

### UI feature

```text
scoper when needed -> ui_builder -> verifier -> human visual review
```

Example prompt:

```text
Use ui_builder to build the empty, loading, populated, and bridge-disconnected
states for the Discover page. Consume the existing IngestJobResponse contract.
Do not change scraping or bridge behavior. Verify keyboard navigation and the
desktop production build.
```

### Shared-contract change

```text
scoper -> human coordination -> builder -> verifier -> integrator -> human merge
```

Example prompt:

```text
Use integrator to review this branch against main. Focus on the shared protocol,
extension sender, Electron bridge receiver, persistence consumer, and backward
compatibility. Do not modify files. Return READY, READY WITH NON-BLOCKING NOTES,
or BLOCKED with evidence.
```

### Bug investigation

```text
scoper or verifier reproduces -> builder makes smallest fix -> verifier retests
```

Do not let the implementation agent rewrite the surrounding subsystem before the
failure mode is proven.

## Parallel work

Safe parallel work is primarily read-only:

- one `scoper` traces the runtime path while one `verifier` examines tests;
- independent reviewers inspect security and behavior;
- separate agents inspect desktop and extension consumers without editing.

Avoid parallel builders in the same checkout. If parallel writes are necessary,
assign disjoint directories and explicitly tell each agent that other agents are
editing concurrently. The primary agent must inspect and reconcile the combined
diff afterward.

## Expected handoff format

Every write-capable agent must finish with:

```md
Outcome

Files changed

Behavior implemented

Contracts changed

Tests and builds run

Known limitations

Teammate integration notes
```

Every read-only review agent must finish with:

```md
Verdict

Findings ordered by severity

Evidence and reproduction

Checks performed

Unverified assumptions

Recommended next action
```

## Anti-patterns

Do not:

- create one custom agent per teammate;
- create one agent for every package;
- ask several write agents to modify shared types concurrently;
- use `integrator` as an automatic merge bot;
- allow `verifier` to silently fix the code it is auditing;
- send vague implementation prompts to smaller models;
- treat passing typecheck as proof that runtime behavior works;
- claim the placeholder lint script provides real lint coverage;
- let an agent weaken branch protection or merge without an explicit human
  request;
- outsource every meaningful algorithm when the team intends to implement it.

## Loading the agents

After pulling these files, start a new Codex task from the repository if the
agents are not immediately listed. Refer to agents by their `name` field, for
example:

```text
Use scoper to prepare this issue for implementation.
Use ui_builder to implement the approved UI scope.
Use verifier to audit the completed change.
```
