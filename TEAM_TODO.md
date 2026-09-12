# Team TODO

Everything below is stubbed with correct types and shape-correct empty/zero
returns, so the app runs end-to-end without crashing. Grab a task, ship it.

## Beginner

- **Staleness thresholds** — `packages/tracking/src/staleness.ts`,
  `evaluateApplicationStaleness()`. Currently always returns `isStale: false`.
  Add stage-aware thresholds (e.g. 14 days after `applied`, 7 days after
  `interviewing`) and populate `suggestedAction`. Connect stale reminders to
  the Today page once these thresholds are implemented.
- **Autofill field matching heuristics** — `packages/autofill/src/matchFormField.ts`,
  `matchFormField()`. Currently always returns no match. Start with simple
  label/name string matching (e.g. "First Name" → `profileFields` with
  `key: "fullName"`) before reaching for fuzzy scoring.

## Intermediate

- **`moveApplication` persistence** — `apps/desktop/src/components/kanban/moveApplication.ts`.
  Currently always throws (`KanbanBoard.tsx` already does a real optimistic
  local move + reverts on this throw, showing a banner). Wire it to an IPC
  call that updates the DB and inserts a `stage_changed` `ApplicationEvent`.
- **Extension `host_permissions` scoping** — `apps/extension/manifest.json`.
  Currently `<all_urls>` content-script + `http://127.0.0.1/*` host
  permission, which is broader than needed. Scope the content script to
  known job-board domains once adapters exist.

## Advanced

- **Resume LaTeX tailoring** — `packages/resume/src/customizeResume.ts` +
  `latex.ts`. Provider plumbing (`getProvider()` from `@ghostboard/ai`) is
  real and wired but unused — the function just echoes the input LaTeX back.
  Build the actual prompt, call the provider, and diff the LaTeX output in
  `diffLatex()`.
- **Gmail integration for status updates** — `packages/tracking/src/statusProviders/emailStatusProvider.ts`,
  `checkForUpdates()`. Currently returns `[]`. Integrate the Gmail API,
  classify rejection/interview emails, and map them to `ApplicationStatusUpdate`s.
- **Real DOM autofill write-back** — `apps/extension/src/content/`. The
  content script only detects and reports job postings today; it doesn't
  write values into form fields. Once `matchFormField` is real, add a
  content-script action that fills matched fields on `application_form`
  pages.

## Completed: Today & Deadline Tracking

- **Real Today page counts** — `apps/desktop/src/pages/Today.tsx`. Shows
  due-today, next-7-days, overdue, and missing-deadline counts for jobs in
  Found, alongside total/applied/interviewing counts. Refreshes on focus
  and every minute.
- Deadlines can be set or cleared in Tracking and persist across restarts.
  Status colors are green for 7+ days, yellow for 2–6 days, and red for
  today, tomorrow, or overdue. Stale reminders remain part of the
  **Staleness thresholds** task above.

## Completed: Job Intelligence & Ingestion

- Canonical URL/HTML/live-page ingestion with JSON-LD-first extraction.
- Greenhouse, Lever, Workday, and Ashby public API paths; LinkedIn/Indeed
  snapshot-aware fallback; cleaned generic HTML extraction.
- Deterministic categorized keyword ranking and resume comparison (no LLM).
- Stable identity/content fingerprints, duplicate helpers, and explainable
  weighted job similarity.
- Extension snapshots sent to `POST /job-intelligence/ingest`.
