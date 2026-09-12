# Portable AI Agent Workflows

This directory is the vendor-neutral source of truth for the project's reusable
AI agent roles. The agents are defined as plain Markdown so they can be read by a
local coding model, a hosted chat model, an IDE assistant, a command-line agent,
or a human teammate without requiring a particular vendor or model family.

The roles are organized around engineering capabilities rather than people or
packages. They support the seven-person team without pretending that seven humans
need seven separate AI personas.

## Canonical role files

| Role | File | Access expectation | Use when |
| --- | --- | --- | --- |
| Scoper | `scoper.md` | Read-only | Work is ambiguous, cross-cutting, or ownership-sensitive |
| Builder | `builder.md` | Scoped write access | A bounded implementation is ready to execute |
| UI Builder | `ui-builder.md` | Scoped write access | The deliverable is a desktop or extension interface |
| Verifier | `verifier.md` | Read-only | Completed work needs adversarial validation |
| Integrator | `integrator.md` | Read-only | A change crosses contracts, packages, or team boundaries |

`TASK_TEMPLATE.md` contains the standard task envelope used when handing work to
an implementation agent.

## Portability model

The Markdown files contain the complete role instructions. Vendor-specific
configuration must remain a thin adapter that points to these canonical files.
Do not copy the full prompts into several vendor directories: duplicated prompts
will diverge and become impossible to maintain.

Current adapter:

- `.codex/agents/*.toml` registers the roles with Codex and instructs each spawned
  agent to read its corresponding `.agents/*.md` file.

Other tools can use the agents in any of these ways:

1. Tell the assistant to read `AGENTS.md` and `.agents/<role>.md` before working.
2. Paste the relevant role file before the task envelope.
3. Configure the tool's native custom-agent file as a small pointer to the
   canonical Markdown file.
4. Include the role file in a scripted system/developer prompt.

If a tool cannot read repository files, paste the complete role file and then the
task. Do not summarize it into a few sentences; important safety and reporting
constraints will be lost.

## Shared project baseline

This is an intentionally unnamed Fall 2026 hackathon project built by a team of
seven people. It is a local-first job-search command center consisting of an
Electron desktop application and a Chromium Manifest V3 extension.

Do not add "Ghostboard" to user-facing text. Existing `@ghostboard/*` package
scopes are legacy technical identifiers and must not be renamed without a
coordinated migration.

The protected demonstration path is:

```text
real job page
  -> extension detects the active job
  -> structured job ingestion and deterministic keywords
  -> authenticated localhost bridge
  -> SQLite persistence
  -> desktop application
  -> truthful resume tailoring
  -> user-triggered autofill
  -> user manually submits
```

All agents must preserve these constraints:

- Electron owns the local SQLite/Drizzle database.
- The local bridge binds only to `127.0.0.1`, uses narrow CORS, and validates its
  local authorization token.
- Applicant profiles, resumes, and application history remain local whenever
  possible.
- Cloud AI receives only the minimum context required for the requested action.
- Scraping, keyword extraction, job similarity, field matching, tracking, and
  stale-state logic should be deterministic unless the task explicitly says
  otherwise.
- Resume tailoring may reorganize or reword truthful material, but it must never
  invent facts or overwrite the master resume.
- Autofill must be user-triggered and must never activate the final application
  submit control.
- Silence may produce stale or follow-up guidance; it must never produce a
  rejection automatically.
- CAPTCHA, MFA, authentication controls, paywalls, and anti-bot protections are
  never bypassed.
- Email access is opt-in and incremental. Never process a whole inbox when a
  narrow query is sufficient.
- Protect the core demonstration path before stretch features such as universal
  portal status, email automation, mobile clients, or cloud synchronization.

## Repository boundaries

| Path | Primary responsibility |
| --- | --- |
| `apps/desktop` | Electron main/preload/renderer, IPC, localhost bridge, desktop UI |
| `apps/extension` | Manifest V3 content scripts, service worker, popup UI |
| `packages/shared` | Cross-package TypeScript contracts and constants |
| `packages/database` | SQLite, Drizzle schema, migrations, persistence |
| `packages/scraping` | Job detection, providers, normalization, ingestion |
| `packages/matching` | Deterministic keywords, coverage, similarity |
| `packages/autofill` | Applicant-field detection and matching |
| `packages/resume` | LaTeX validation, versions, tailoring workflow |
| `packages/tracking` | Application events, stale logic, status providers |
| `packages/ai` | Narrow cloud-model provider abstraction |

The following are coordination-sensitive even when they appear small:

- `packages/shared` exports;
- database schema and migration files;
- bridge request and response protocols;
- IPC channel names and preload exposure;
- root workspace dependencies and lockfiles;
- global styling and reusable UI primitives;
- persisted identifiers, enums, and timestamps.

## Human ownership comes first

AI roles do not replace human subsystem ownership.

- Determine ownership from the issue, branch, task prompt, and team agreement.
- Do not edit a teammate's subsystem merely because it is adjacent.
- Do not silently break a shared contract.
- Treat existing working-tree changes as someone else's work unless proven
  otherwise.
- Stop for coordination when a required change crosses an unauthorized boundary.
- A human remains responsible for accepting scope, reviewing behavior, and
  authorizing external actions.

The team's principle is "scaffold, don't solve" when meaningful algorithmic work
is intentionally reserved for a person. An agent may implement such logic only
when the task explicitly assigns it. Otherwise, it may create types, fixtures,
test harnesses, integration seams, mocks, or TODOs without completing the
human-owned algorithm.

## Selecting the role

Use the smallest workflow that controls the real risk:

```text
Is the requirement, ownership, or contract unclear?
  yes -> Scoper
  no  -> continue

Is the deliverable primarily a React desktop or extension interface?
  yes -> UI Builder
  no  -> Builder

Has meaningful implementation completed?
  yes -> Verifier

Does the diff affect shared contracts, migrations, bridge/IPC, dependencies,
or more than one human-owned subsystem?
  yes -> Integrator
  no  -> human review
```

Do not invoke every role automatically. A small isolated change may need only a
Builder and human review.

## Matching task difficulty to model capability

The roles do not name or require a particular model. Model access differs across
the team, and a pinned unavailable model would make the shared workflow fail.

Use the strongest available reasoning model for:

- unclear cross-package scoping;
- architecture or data-contract tradeoffs;
- migration and backward-compatibility review;
- security-sensitive bridge or extension review;
- complex failures spanning browser, Electron, and persistence;
- final integration decisions.

A smaller or less capable model can work effectively when given:

- one concrete objective;
- exact owned files and forbidden areas;
- existing input and required output types;
- representative examples;
- explicit edge cases;
- objective acceptance criteria;
- exact verification commands;
- a mandatory return format.

Do not ask a smaller model to discover architecture, redesign contracts,
implement a feature, and validate the integration in one prompt. Use Scoper first,
then provide its bounded output to Builder or UI Builder.

## Standard task envelope

Use `TASK_TEMPLATE.md` for write-capable roles. At minimum, provide:

```md
Objective:
Human owner:
Owned files/directories:
Conditionally allowed shared files:
Forbidden areas:
Existing input contracts:
Required output contracts:
Expected behavior:
Failure and boundary behavior:
Acceptance criteria:
Verification commands:
Return format:
```

If missing information would change the architecture, data contract, UX meaning,
privacy behavior, external service, or team ownership, do not make Builder guess.
Use Scoper or ask the human.

## Standard workflows

### Small isolated change

```text
Builder -> targeted verification -> human reviews the diff
```

### Ambiguous backend change

```text
Scoper -> human accepts scope -> Builder -> Verifier -> human review
```

### UI work

```text
Scoper when needed -> UI Builder -> Verifier -> human visual review
```

### Shared-contract or migration change

```text
Scoper -> human coordination -> Builder -> Verifier -> Integrator -> human merge
```

### Bug investigation

```text
Verifier reproduces -> Builder applies smallest fix -> Verifier retests
```

Keep investigation separate from repair when independence matters. A verifier
that silently fixes what it finds is no longer an independent verifier.

## Parallel-agent guidance

Safe parallel work is primarily read-only:

- one Scoper traces the implementation while a Verifier inspects tests;
- separate reviewers inspect security and behavioral risks;
- separate read-only agents inspect desktop and extension consumers.

Avoid parallel write-capable agents in one checkout. If parallel writes are
explicitly requested:

1. Assign disjoint files or directories.
2. Tell every agent that others are editing concurrently.
3. Prohibit reverting or overwriting another agent's changes.
4. Require the coordinating agent to inspect and reconcile the combined diff.

## External actions

No role receives implicit permission to:

- commit or push;
- open, edit, approve, or merge a pull request;
- alter branch protection;
- delete branches or cloud data;
- send messages or submit forms;
- install services or create credentials;
- publish or deploy the application.

Those actions require an explicit human request even when implementation is
complete.

## Shared completion standard

A task is complete only when:

- the requested behavior exists at the appropriate layer;
- acceptance criteria are mapped to evidence;
- success, failure, empty, and boundary states are handled where applicable;
- relevant checks actually pass;
- the final diff contains no unrelated files;
- shared-contract and migration impacts are documented;
- privacy and product constraints remain intact;
- another teammate can consume the result without reverse-engineering it.

The root `npm run lint` command is currently a placeholder. It must never be
reported as substantive lint coverage.

## Maintenance rules

- Keep canonical role behavior in `.agents/*.md`.
- Keep vendor adapters short and declarative.
- Change a role only when the improvement applies across team workflows.
- Do not add one role per teammate or one role per package.
- Prefer improving the task envelope over adding another vaguely overlapping
  agent.
- Review role changes like code: check scope, contradictions, unsafe authority,
  model portability, and output requirements.
