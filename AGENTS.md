# General Coding Standards

## Principles

- Prioritize correctness and clarity over performance unless otherwise specified.
- Avoid organizational comments that merely summarize the code. Only explain intent when the reason is non-obvious.
- Add functionality to existing files unless it represents a genuinely new component. Avoid creating many small files.
- Do not add unrequested features or speculative abstractions.

## Canonical Project Context and Indexing

`docs/HACKATHON_PROJECT.md` is the canonical index for the project's vision,
goals, feature behavior, architecture, contracts, privacy constraints, team model,
priorities, milestones, success criteria, risks, decisions, and terminology.

Before planning or implementing product work:

1. Read the document map and executive summary in
   `docs/HACKATHON_PROJECT.md`.
2. Read every indexed section relevant to the task.
3. For broad planning, shared-contract changes, integration reviews, or ambiguous
   requests, read the entire document.
4. Build a task context index containing:
   - applicable product and user goals;
   - non-negotiable invariants;
   - relevant feature behavior;
   - affected architecture and trust boundaries;
   - existing or proposed shared contracts;
   - priority level and protected demo impact;
   - relevant non-goals;
   - human ownership and coordination needs;
   - success and verification criteria.
5. Use that context index to constrain the plan, implementation, and final report.

The project brief is context, not blanket authorization. Do not implement adjacent
roadmap features unless the current task requests them. If the current task, code,
and project brief disagree materially, surface the conflict instead of silently
choosing a new product direction.

Explicit user instructions and applicable `AGENTS.md` rules take precedence over
the brief. Durable human decisions should update the brief so future teammates and
agents do not rely on stale context.

## Error Handling

- Avoid operations that can panic or crash. Prefer mechanisms that propagate errors to the caller.
- Validate boundaries, null safety, and state assumptions before acting.
- Never silently discard errors. Either propagate them, log them, or handle them with explicit logic.
- Ensure errors from asynchronous operations reach the user-facing layer with meaningful feedback.

## Naming and Structure

- Use full words for variables and functions. Avoid abbreviations.
- Prefer flat module structures over deep directory hierarchies.
- Use descriptive names for entry points and public interfaces.
- Minimize the lifetime of shared or borrowed state through explicit scoping or shadowing, especially in asynchronous contexts.

## Concurrency and State

- Treat primary state and rendering as single-threaded. Perform direct state mutations and UI work on the foreground thread.
- Offload independent work to background tasks, but route results back to the foreground to update state.
- Access state through handles that support immutable reads and controlled mutable updates.
- Use weak references or equivalent mechanisms when entities hold mutual references to prevent cycles and leaks.
- Never re-enter a state update while one is already in progress.
- Prevent cancellation of spawned tasks by awaiting them, detaching them, or storing them alongside the parent lifecycle.

## Events and Interaction

- Keep event and action names imperative and descriptive.
- Let input handlers mutate the current component or entity directly rather than requiring external lookup.
- Notify the rendering layer explicitly when state changes affect the view.
- Communicate between components via typed events. Subscribe to events for cross-component reactions and clean up subscriptions when no longer needed.

## Testing

- Prefer framework-native scheduling and timer primitives over generic system timers.
- Use the test runner’s executor-aware APIs so asynchronous work is tracked by the dispatcher.

## Build and Automation

- Use project-specific build and lint scripts when they exist, rather than invoking generic toolchain commands directly.

## Patches and Submissions

- Use clear, imperative titles with proper capitalization.
- Avoid conventional commit prefixes and trailing punctuation.
- Optionally prefix titles with the affected module or component.
- End the description with a release notes section in a consistent format. Include one bullet describing the user-facing change or marking it as not applicable.

## Standards Maintenance

- Suggest additions to these standards only after encountering a non-obvious pattern that would help future sessions.
- A new rule must meet three criteria: it is non-obvious, it has been encountered repeatedly, and it is specific enough to act on directly.
- Keep module-specific conventions local to the relevant module rather than in global standards.
- Do not use standards files to document architecture or data flow. Use them to capture pitfalls and constraints.
- Rules should emerge from validated patterns, not one-time observations. Propose them in review before codifying them.

## Custom AI Agent Workflow

The vendor-neutral role definitions are plain Markdown files in `.agents/`. The
detailed teammate guide, invocation examples, model guidance, and task template
are also in that directory. Platform-specific directories must remain thin
adapters that point to `.agents/`; they are not the source of truth.

Every AI assistant, regardless of vendor or model, must read the corresponding
`.agents/<role>.md` file completely before acting in that role. Codex registration
files are provided in `.codex/agents/`, but using Codex is not required.

These agents are workflow roles, not one-to-one representations of the seven
human teammates:

- `scoper`: read-only evidence gathering, contract discovery, and
  implementation-ready planning.
- `builder`: bounded implementation for backend, package, persistence,
  extension-runtime, and integration tasks.
- `ui_builder`: desktop and extension UI implementation using established
  contracts.
- `verifier`: read-only adversarial behavior, regression, and test validation.
- `integrator`: read-only cross-package and merge-readiness review.

### Routing

- Keep small, isolated tasks in the primary thread when delegation adds no value.
- Use `scoper` before implementation when requirements, ownership, or contracts
  are ambiguous.
- Use `builder` only after its objective, owned files, forbidden areas, contracts,
  acceptance criteria, and verification commands are clear.
- Use `ui_builder` when the deliverable is primarily a React desktop or extension
  interface.
- Use `verifier` after meaningful implementation, especially when the work has
  failure modes not proven by typechecking.
- Use `integrator` when a change affects shared types, bridge or IPC contracts,
  database migrations, workspace dependencies, or multiple human-owned areas.
- Do not invoke all agents by default. Use the smallest workflow that controls the
  task's actual risk.

### Ownership and concurrent work

- Human ownership always takes precedence over agent convenience.
- Every write-capable delegated task must name owned files or directories and
  explicitly forbidden areas.
- Treat existing working-tree changes as another person's work unless the task
  proves otherwise.
- Do not rewrite, reset, revert, stage, or commit unrelated changes.
- Prefer one write-capable agent at a time in a shared checkout.
- Parallelize read-only investigation or verification only when the tasks are
  independent and the user or workflow explicitly requests delegation.
- If multiple write agents are explicitly requested, assign disjoint files and
  tell every agent that other work is happening concurrently.
- The primary agent remains responsible for inspecting and reconciling the final
  combined diff.

### Agent task contract

When delegating implementation, provide:

1. A concrete objective.
2. The human owner or coordinating teammate.
3. Owned files and directories.
4. Shared files that may be changed only if necessary.
5. Explicitly forbidden areas.
6. Existing input contracts.
7. Required output contracts.
8. Expected success, failure, and boundary behavior.
9. Acceptance criteria.
10. Exact verification commands.
11. The expected return format.

If enough of this information is missing to change the meaning or architecture of
the task, use `scoper` or ask the human rather than making `builder` guess.

### Completion and reporting

- A write-capable agent must report its outcome, changed files, contract effects,
  exact checks run, limitations, and teammate handoff notes.
- A read-only agent must separate confirmed findings from unverified assumptions
  and include reproducible evidence.
- Never claim a test, build, visual state, or runtime flow passed unless it was
  actually checked.
- The root `npm run lint` command is currently a placeholder and must not be
  presented as substantive lint coverage.
- Agents must not commit, push, open or modify pull requests, alter branch
  protection, merge, or delete branches unless the user explicitly requests that
  external action.
