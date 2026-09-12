# Team TODO

Everything below is stubbed with correct types and shape-correct empty/zero
returns, so the app runs end-to-end without crashing. Grab a task, ship it.

## Beginner

- **Staleness thresholds** — `packages/tracking/src/staleness.ts`,
  `evaluateApplicationStaleness()`. Currently always returns `isStale: false`.
  Add stage-aware thresholds (e.g. 14 days after `applied`, 7 days after
  `interviewing`) and populate `suggestedAction`.
- **Autofill field matching heuristics** — `packages/autofill/src/matchFormField.ts`,
  `matchFormField()`. Currently always returns no match. Start with simple
  label/name string matching (e.g. "First Name" → `profileFields` with
  `key: "fullName"`) before reaching for fuzzy scoring.
- **Real Today page counts** — `apps/desktop/src/pages/Today.tsx`. Currently
  shows total/applied/interviewing counts only. Add "due today" / stale
  reminders once `evaluateApplicationStaleness` is real.

## Intermediate

- **Keyword extraction + resume comparison** — `packages/matching/src/keywords.ts`,
  `extractKeywords()` and `compareResumeToJob()`. Both return empty results.
  Implement TF-IDF, RAKE, or an LLM-based extractor (there's already a
  working `@ghostboard/ai` provider to call).
- **`moveApplication` persistence** — `apps/desktop/src/components/kanban/moveApplication.ts`.
  Currently always throws (`KanbanBoard.tsx` already does a real optimistic
  local move + reverts on this throw, showing a banner). Wire it to an IPC
  call that updates the DB and inserts a `stage_changed` `ApplicationEvent`.
- **Site-specific scraping adapters** — `packages/scraping/src/adapters/README.md`.
  Only `genericScraper.ts` exists. Add LinkedIn / Greenhouse / Lever adapters
  implementing the `JobScraper` interface (`packages/scraping/src/types.ts`)
  with higher confidence than the 0.4 generic fallback.
- **Extension `host_permissions` scoping** — `apps/extension/manifest.json`.
  Currently `<all_urls>` content-script + `http://127.0.0.1/*` host
  permission, which is broader than needed. Scope the content script to
  known job-board domains once adapters exist.

## Advanced

- **Job similarity embeddings** — `packages/matching/src/similarity.ts`,
  `calculateJobSimilarity()`. Currently returns `[]`. Implement embedding
  cosine similarity (or keyword-overlap fallback) across `JobPosting`s.
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
