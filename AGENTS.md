# General Coding Standards

## Principles

- Prioritize correctness and clarity over performance unless otherwise specified.
- Avoid organizational comments that merely summarize the code. Only explain intent when the reason is non-obvious.
- Add functionality to existing files unless it represents a genuinely new component. Avoid creating many small files.
- Do not add unrequested features or speculative abstractions.

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

