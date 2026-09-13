# Hackathon Project Brief and Goals

**Status:** Canonical project context

**Last updated:** September 12, 2026

**Team size:** Seven people

**Product name:** Intentionally undecided

## 1. Purpose of this document

This document is the durable source of truth for the hackathon project's product
direction, goals, architecture, constraints, priorities, vocabulary, and
demonstration strategy.

It exists so that teammates and AI assistants can answer five questions before
making changes:

1. What user problem are we solving?
2. Which part of the product does this work support?
3. What constraints must remain true?
4. What is the smallest valuable outcome for the hackathon?
5. Which adjacent ideas are deliberately out of scope?

This is not a substitute for an issue, implementation plan, or task-specific
acceptance criteria. It provides the baseline from which those artifacts should
be derived.

When a task conflicts with this document, do not silently choose one direction.
Surface the conflict. A later explicit human decision may update the project
direction, but an implementation agent must not redefine the product on its own.

## 2. How to use this document

### For teammates

- Use the document map below to find the relevant product area.
- Link the relevant goals and constraints in issues and pull requests.
- Treat the priority definitions and protected demo path as decision filters.
- Update this document only for durable team decisions, not temporary
  implementation notes.
- Keep detailed code mechanics in package documentation, tests, or design notes.

### For AI assistants

- Read the document map and executive summary before product work.
- Read every section relevant to the requested subsystem.
- For cross-cutting planning, contract changes, or integration review, read the
  entire document.
- Build a small task context index before editing: applicable goals, invariants,
  contracts, priorities, non-goals, and owners.
- Do not use this document as permission to implement unrelated roadmap items.
- Do not infer authorization for commits, pushes, pull requests, deployment,
  external messages, credentials, or destructive operations.

## 3. Document map

| Need | Read |
| --- | --- |
| Product summary | Sections 4-8 |
| Core constraints | Sections 9-10 |
| Feature behavior | Sections 11-27 |
| Technical architecture | Sections 28-34 |
| Contracts and data | Sections 35-38 |
| Privacy and security | Sections 39-40 |
| Team and AI workflow | Sections 41-43 |
| Priorities and milestones | Sections 44-48 |
| Testing and quality | Sections 49-50 |
| Risks and decisions | Sections 51-54 |
| Terminology | Section 55 |

## 4. Executive summary

The project is a local-first job-search command center. It combines an Electron
desktop application with a Chromium browser extension so the product can follow a
job seeker through the application lifecycle rather than forcing them to maintain
another spreadsheet.

The browser extension understands the page the user is currently viewing. It can
detect job postings, extract structured job information, identify application
fields, and offer user-triggered assistance. The desktop application owns the
user's local profile, resumes, applications, activity history, reminders, and
current job-search context.

The distinguishing experience is continuity:

```text
discover a real job
  -> understand it in the browser
  -> compare it with the user's resume
  -> create a truthful tailored resume
  -> assist with application fields
  -> let the user review and submit
  -> save and track the application locally
  -> surface follow-ups and responses
  -> find similar opportunities
```

The product is not intended to be a generic CRUD tracker with a Kanban board
attached. The Kanban is one view of the user's search, not the product thesis.

## 5. Hackathon brief

The Fall 2026 hackathon asks teams to build a job application organizer that can
help users:

- track job applications;
- organize stages such as applied, interview, offer, and rejected;
- manage a master resume and tailored resume versions;
- track recruiter or employer responses;
- log communications;
- support reminders and follow-ups;
- work well on desktop and mobile;
- present a polished and creative experience.

For this project, desktop and Chromium extension support are the deliberate
hackathon focus. A separate mobile application is not part of the initial scope.
The responsive principles of the brief should inform layout quality, but they do
not justify sacrificing the primary desktop/extension flow.

## 6. Problem statement

Job seekers typically split their work across browser tabs, spreadsheets, email,
documents, calendar reminders, resume editors, and application portals. This
creates several failures:

- jobs disappear after tabs close;
- descriptions and requirements are copied inconsistently;
- resume tailoring is repetitive and easy to do dishonestly;
- application status becomes stale because manual trackers require discipline;
- recruiter communication is disconnected from the original job;
- follow-ups are forgotten;
- users repeatedly enter the same profile information;
- job-search context is lost between discovery, application, and tracking.

The product should reduce that fragmentation while keeping sensitive data local
and leaving consequential actions under user control.

## 7. Product thesis

The product should feel like a system accompanying the user through the full job
application lifecycle.

The strongest differentiator is the live connection between the active browser
page and the desktop command center. When the user opens or changes a job, the
system should understand the new context without requiring manual copying. When
the user later reviews their applications, the system should preserve the job,
resume, stage, activity, and next action as one coherent history.

The product wins by making the next useful action obvious:

- save this job;
- inspect keyword coverage;
- tailor a resume;
- continue an incomplete application;
- autofill known fields;
- review fields needing attention;
- mark the application submitted;
- follow up after inactivity;
- prepare for an interview;
- explore similar roles.

## 8. Differentiation

Other teams may build:

- a basic application table;
- a status dropdown;
- a generic Kanban board;
- a dashboard of counts;
- resume upload and storage;
- simple notes and reminders.

This project should distinguish itself through:

1. Live active-page understanding through the browser extension.
2. A visible extension-to-desktop handoff.
3. Deterministic job intelligence and keyword coverage.
4. Truth-constrained LaTeX resume tailoring.
5. User-triggered autofill without auto-submission.
6. Lifecycle awareness, including stale and follow-up states.
7. Similar-job discovery using explainable deterministic ranking.
8. A polished, action-oriented command-center experience.

## 9. Product principles

### 9.1 Action over administration

The product should surface what the user should do next. It should not turn job
searching into maintaining another system.

### 9.2 Live context over manual copying

The extension should understand the page being viewed. The user should not need to
paste every job description into the desktop application.

### 9.3 Local-first privacy

Profiles, resumes, application history, and tracking data should remain on the
user's computer whenever possible.

### 9.4 Deterministic by default

Use normal code for structured extraction, ranking, duplicate detection, form
matching, stale logic, and stage transitions. Use cloud AI only where generative
language work provides real value.

### 9.5 Human control at consequential moments

The user reviews and submits applications. The user chooses whether to insert a
draft answer. The user controls email access. The user can correct uncertain
classification.

### 9.6 Honest uncertainty

Unknown information must remain unknown. The system should not fabricate job
fields, application states, portal status, or resume facts.

### 9.7 Cohesion over feature count

A smaller end-to-end workflow that feels intentional is more valuable than many
disconnected partial features.

### 9.8 Meaningful team engineering

The team should be able to explain its core logic. AI can accelerate boilerplate,
integration, fixtures, and iteration, but it should not erase all substantive
engineering decisions.

## 10. Non-negotiable invariants

The following rules apply across the project:

1. The product remains unnamed until the team selects a final name.
2. Do not introduce "Ghostboard" as visible branding.
3. Existing `@ghostboard/*` package scopes are legacy identifiers and should not
   be renamed casually.
4. The Electron application owns the local database.
5. The localhost bridge binds only to `127.0.0.1`.
6. Bridge access uses a local authorization token and narrow CORS behavior.
7. The extension never clicks the final application Submit button.
8. Autofill happens only after an explicit user action.
9. Silence never automatically means rejection.
10. Rejection requires explicit evidence or a manual user action.
11. The master resume is never overwritten by a tailored version.
12. AI-generated resume content never invents facts.
13. CAPTCHA, MFA, authentication, paywalls, and anti-bot controls are never
    bypassed.
14. Email access is opt-in.
15. Cloud AI receives only the context needed for the requested operation.
16. Unknown or uncertain extraction is reported honestly.
17. Stretch features must not destabilize the protected demonstration path.

## 11. End-to-end lifecycle

The intended lifecycle is:

```text
User discovers a job
  -> extension classifies the active page
  -> extension captures structured evidence
  -> ingestion normalizes a canonical JobPosting
  -> deterministic keywords are extracted
  -> resume keyword coverage is calculated
  -> user saves the job or begins applying
  -> user optionally creates a tailored LaTeX resume
  -> extension detects application fields
  -> user triggers autofill
  -> uncertain fields remain for manual review
  -> user manually submits
  -> application moves to Applied
  -> activity events and communications accumulate
  -> stale logic recommends follow-up after inactivity
  -> explicit messages may identify interview, rejection, offer, or assessment
  -> similar-job ranking surfaces related opportunities
```

Every feature should connect to this lifecycle or have a clear reason to exist.

## 12. Application organization

The core application stages are:

```text
Saved
Applied
In Progress
Interview
Offer
Rejected
```

The exact internal enum may differ for compatibility, but user-facing stages
should remain understandable.

Expected behavior:

- applications appear as cards or concise records;
- users can move an application between stages;
- stage changes persist across application restarts;
- meaningful stage changes create activity history;
- optimistic interactions visibly recover when persistence fails;
- stage is not inferred from inactivity;
- user corrections remain possible.

A card should prioritize company, title, stage, recent activity, and next action.
It should not become a miniature database row with every field exposed.

## 13. Activity history

Meaningful actions should become timestamped events rather than destructive
updates with no history.

Candidate event types include:

- `job_saved`;
- `application_started`;
- `application_submitted`;
- `stage_changed`;
- `resume_generated`;
- `email_received`;
- `assessment_detected`;
- `interview_detected`;
- `rejection_detected`;
- `offer_detected`;
- `manual_note`;
- `follow_up_scheduled`;
- `follow_up_completed`.

Events should be meaningful, not a log of every UI click. The history should help
the user understand what happened and why the current stage exists.

## 14. Stale and ghosted application tracking

Inactivity should produce attention states, not a false terminal decision.

Candidate freshness states:

```text
fresh
waiting
stale
very_stale
closed
```

Expected behavior:

- the user can configure a general stale threshold;
- stage-specific thresholds may be supported;
- elapsed time is measured from meaningful activity;
- stale applications show elapsed inactivity and a suggested action;
- a follow-up recommendation is actionable;
- a user can dismiss, snooze, or complete the recommendation when implemented;
- rejection is never inferred from time alone.

Light humor is acceptable in secondary copy, especially for stale and rejection
states, but it must remain subtle. The actual status and recommended action must
always be clear.

## 15. Live browser job detection

The extension inspects the page the user is currently viewing. It is not a broad
internet crawler.

The extension should attempt to detect:

- company;
- job title;
- location or remote status;
- salary when present;
- employment type;
- job description;
- requirements and qualifications;
- relevant technologies;
- canonical application URL;
- source provider and provider job identifier.

The experience should feel live on single-page applications:

```text
DOM or URL meaningfully changes
  -> observer detects change
  -> debounce
  -> capture bounded evidence
  -> normalize and compare with previous result
  -> send only when the detected job meaningfully changes
```

Do not send every mutation. Avoid mutation storms, repeated identical snapshots,
or unbounded HTML payloads.

## 16. Job-ingestion strategy

The ingestion pipeline should prioritize reliable evidence:

1. Provider public API or structured endpoint when available.
2. JSON-LD `JobPosting` and structured metadata.
3. Provider-aware DOM regions or embedded state.
4. Cleaned generic job content.
5. Visible text fallback when necessary.

Supported or recognized sources currently include:

- Greenhouse;
- Lever;
- Workday;
- Ashby;
- LinkedIn page snapshots;
- Indeed page snapshots;
- generic job pages.

Provider support should remain explicit about what is direct API extraction versus
page-snapshot fallback. Do not imply authenticated integrations that do not exist.

## 17. Canonical job model

The canonical `JobPosting` should preserve enough information for saving,
matching, resume work, autofill context, and duplicate detection.

Important concepts include:

- deterministic identity;
- content fingerprint;
- source provider;
- source job identifier;
- company;
- title;
- location;
- canonical URL;
- full description;
- employment type;
- requirements;
- deterministic keywords;
- posting date when confidently available;
- salary when present;
- ingestion timestamp.

Required fields must not be filled with fabricated placeholders. If confidence is
insufficient, ingestion should return an uncertain or non-job outcome with
evidence and warnings.

## 18. Deterministic keyword extraction

Keyword extraction should not require an LLM.

The pipeline may combine:

- normalization;
- phrase and alias matching;
- token boundaries;
- technology dictionaries;
- n-grams;
- occurrence counts;
- section weighting;
- title and requirement weighting;
- category-aware scoring;
- false-positive guards.

Candidate categories include:

- language;
- framework;
- database;
- cloud;
- tool;
- methodology;
- qualification;
- soft skill;
- domain;
- other.

The result should be deterministic, explainable, bounded, and stable across
repeated runs. Common words that overlap technology names, such as "Go," require
careful boundaries.

## 19. Resume keyword coverage

The product should compare extracted job keywords with the user's resume text.

The user-facing label is **Keyword Coverage**, not "ATS Score," unless the product
explicitly defines and explains its own metric.

The interface should show:

- covered keywords;
- missing keywords;
- weighted coverage when applicable;
- aliases recognized;
- enough explanation to avoid presenting the score as an employment prediction.

The metric helps the user understand alignment. It does not claim to reproduce an
employer's applicant tracking system.

## 20. Duplicate detection

Saving or ingesting the same job repeatedly should not create obvious duplicate
records.

Useful identity evidence includes:

- normalized provider and source job identifier;
- canonical job URL;
- normalized company and title;
- location;
- description content fingerprint.

Identity and content similarity solve different problems. A content fingerprint
can recognize near-duplicate descriptions, but it must not collapse distinct
locations or clearly different roles into one record.

Duplicate behavior should be deterministic and testable.

## 21. Similar-job matching

Similar-job ranking should be deterministic and explainable.

Candidate signals include:

- title-term overlap;
- keyword or skill overlap;
- description-term similarity;
- location compatibility;
- internship versus full-time compatibility;
- seniority compatibility;
- employment-type compatibility.

The result should include:

- normalized score;
- shared keywords;
- matching title terms where available;
- concise reasons explaining the ranking.

An LLM is not required. Semantic embeddings and vector infrastructure are not
necessary for the hackathon baseline.

## 22. Job discovery

Discovery may use:

- public ATS boards;
- company career pages;
- small, intentional searches;
- direct HTTP parsing;
- browser rendering only where JavaScript makes it necessary.

Discovery must not become aggressive internet crawling. Use reasonable request
rates, small result sets, and explicit provider behavior.

Discovery results should flow through the canonical ingestion and similarity
systems rather than creating a second incompatible job model.

## 23. Master LaTeX resume

The user maintains a generic master resume as LaTeX.

Expected baseline capabilities:

- store the master `.tex` source locally;
- view and edit the source;
- preview or compile when tooling is available;
- duplicate the master into a job-specific version;
- retain version metadata and job association.

A WYSIWYG editor is not required for the initial milestone. Raw LaTeX editing is
acceptable.

Optional structural markers can identify experience, skills, projects, and
education sections so tailoring is safer and easier to validate.

## 24. AI-assisted resume tailoring

Generative AI is appropriate for constrained language transformation:

```text
master LaTeX
  + canonical job description
  + extracted keywords
  + strict truth constraints
  -> candidate tailored LaTeX
  -> structural and content validation
  -> separate version saved locally
```

The model may:

- reorder truthful bullets;
- emphasize relevant experience;
- improve wording;
- incorporate truthful keywords already supported by the resume;
- remove less relevant content when necessary.

Tailoring is limited to the Experience section. Name, contact information,
summary, skills, projects, education, and document structure are copied exactly
from the master resume rather than accepted from model output.

The model must never invent:

- skills or technologies;
- employers or roles;
- projects;
- education;
- dates;
- metrics;
- achievements;
- certifications.

Never overwrite the master resume. Provider errors, invalid LaTeX, or suspicious
content must fail safely and remain reviewable.

## 25. Applicant profile and autofill

The local applicant profile may include:

- first, optional middle, and last name;
- email, phone, and optional phone extension;
- street address, city, region, country, and postal code;
- university, degree, major, graduation date, and GPA;
- LinkedIn, GitHub, portfolio, and other links;
- employment history;
- work authorization;
- sponsorship needs;
- relocation preference;
- common application defaults.

The extension should detect `input`, `textarea`, and `select` elements and build a
structured description from labels, names, placeholders, ARIA labels, element
types, options, and nearby DOM context.

Field matching should combine normalized evidence, aliases, nearby text, element
type, and confidence. Ambiguous fields should remain for user attention.

Autofill occurs only after the user clicks an explicit action. The extension must
dispatch the events needed by controlled web forms without triggering final
submission.

The extension offers separate master-resume and tailored-resume autofill actions.
Tailored autofill uses job context already captured from the active tab, preferring
a saved matching tailored version, then a single active-job cache, and otherwise
generating and caching a version. Moving through a multi-page application reuses
that cache; tailoring for a different job replaces it without deleting reviewed
tailored resumes;
it does not require the user to paste the job description into the desktop app.
Manual radio, checkbox, and select answers may be remembered locally and reused
when the normalized question is encountered again.

## 26. Custom application questions

Questions such as "Why do you want to work here?" require contextual writing and
should not be filled with generic automatic text.

Preferred interaction:

1. Detect the custom text question.
2. Offer a clearly labeled draft action.
3. Use only relevant resume and job context.
4. Show the draft for user review.
5. Insert it only after user choice.

The user remains responsible for accuracy and final submission.

## 27. Email and portal tracking

Email tracking is a stretch or experimental feature.

Potential classifications include:

- confirmation;
- assessment;
- interview;
- rejection;
- offer;
- follow-up;
- unknown.

Use deterministic phrase rules first and a model only for genuinely ambiguous
messages. Do not send complete inboxes to a model.

Polling, if implemented, should be incremental using a timestamp or provider
cursor. A several-minute interval is sufficient for a hackathon. Access must be
opt-in.

Universal application-portal polling is not realistic because providers vary in
authentication, MFA, CAPTCHA, DOM structure, sessions, and API availability. A
future provider interface and one proof-of-concept adapter may be reasonable, but
unknown status must remain unknown.

## 28. Command-center experience

The main desktop experience should be action-oriented.

Candidate navigation:

```text
Today
Applications
Discover
Resumes
Profile
Tracking
```

The Today page should prioritize a small number of useful actions:

- interview scheduled soon;
- incomplete application to continue;
- stale application worth following up;
- tailored resume awaiting review;
- newly detected job ready to save.

Avoid filling the home screen with low-value charts. Counts can support decisions,
but they should not replace actionable information.

## 29. Real-time current-job view

One of the strongest demonstration moments is the desktop responding to the job
currently open in the browser.

The desktop may display:

- company and title;
- location and source;
- detection confidence or warnings;
- important keyword count;
- resume keyword coverage;
- Save, Tailor Resume, or Continue Application actions.

The view should update when the normalized detected job changes, including SPA
navigation, without reacting to irrelevant DOM mutations.

## 30. Technology stack

### Desktop

- Electron;
- React;
- TypeScript;
- Vite;
- Tailwind CSS;
- shadcn/ui-style primitives;
- Lucide icons;
- restrained Framer Motion interactions where useful.

### Browser extension

- Chromium/Chrome;
- Manifest V3;
- TypeScript;
- React for popup or other suitable surfaces;
- content scripts;
- service worker;
- MutationObserver for meaningful live-page changes.

Chrome support is sufficient for the hackathon. Safari and Firefox are not initial
requirements.

### Data

- local SQLite;
- Drizzle ORM;
- Electron process owns database access.

### AI

- cheap or free cloud language models through a narrow provider abstraction;
- AI used for resume tailoring, draft answers, and ambiguous classification only
  where justified;
- deterministic code for core extraction and lifecycle behavior.

## 31. Process architecture

The high-level runtime relationship is:

```text
active browser tab
  <-> content script
  <-> extension service worker
  <-> authenticated 127.0.0.1 HTTP bridge
  <-> Electron main process
  <-> package/domain services
  <-> SQLite/Drizzle
  <-> typed IPC/preload boundary
  <-> React renderer
```

The renderer should not have unrestricted Node or database access. Privileged
behavior stays behind narrow, typed preload and IPC interfaces.

## 32. Local bridge

The bridge exists because the browser extension and Electron application run in
different security contexts.

Baseline requirements:

- bind to `127.0.0.1` only;
- use a narrow port and route set;
- validate a locally generated token;
- apply narrow CORS rules;
- parse and validate request methods, paths, payloads, and sizes;
- return meaningful errors without exposing secrets;
- shut down cleanly with Electron;
- avoid public network exposure.

Candidate or existing routes include health, profile, jobs, applications, page
context, and job intelligence ingestion. Routes should remain purpose-specific.

## 33. Extension runtime concerns

Manifest V3 service workers can stop and restart. Durable state should not depend
only on in-memory service-worker variables.

Content scripts run against untrusted pages. They should:

- minimize permissions;
- avoid executing page-provided instructions;
- treat DOM content as data;
- bound captured HTML and text;
- avoid mutation storms;
- suppress repeated identical context;
- safely handle page transitions;
- keep user-triggered actions explicit.

The extension should degrade gracefully when the desktop bridge is unavailable.

## 34. Suggested monorepo structure

The existing structure separates applications and domain packages:

```text
apps/
  desktop/
  extension/

packages/
  shared/
  database/
  scraping/
  matching/
  autofill/
  resume/
  tracking/
  ai/

fixtures/
docs/
.agents/
.codex/
```

Do not create new packages solely for architectural aesthetics. A new package
should represent a stable responsibility with real consumers.

## 35. Shared contracts

Shared TypeScript contracts allow seven people to work with mocks while keeping
integration explicit.

Important contract families include:

- `JobPosting`;
- `Application` and `ApplicationStage`;
- `ApplicationEvent`;
- `Keyword` and keyword-coverage results;
- `JobSimilarityResult`;
- `ApplicantProfile`;
- `DetectedFormField` and `FieldMatch`;
- page snapshots and context messages;
- bridge requests and responses;
- tracking/status updates;
- resume versions.

Shared contract changes are coordination events. Before changing one:

1. Identify every producer.
2. Identify every consumer.
3. Prefer an additive compatible change.
4. Align runtime validation with the static type.
5. Update fixtures, mocks, tests, persistence, and UI consumers.
6. Communicate the change to affected owners.

## 36. Application data

A practical application record may contain:

- identifier;
- company;
- title;
- location;
- canonical job URL;
- job description;
- source;
- current stage;
- date found;
- date applied;
- last meaningful activity;
- next action and due date;
- associated resume version;
- created and updated timestamps.

Keep the database small and understandable. Do not over-normalize for hypothetical
future scale.

## 37. Event data

An application event should contain enough information to reconstruct meaningful
history:

- event identifier;
- application identifier;
- event type;
- concise title;
- optional description;
- occurrence timestamp;
- optional structured metadata.

Metadata should remain bounded and versionable. Do not use it as an untyped dump
for core fields that deserve explicit schema.

## 38. Time, status, and identity semantics

- Persist times in an unambiguous representation.
- Convert to local presentation at the UI boundary.
- Define whether thresholds are inclusive at exact boundaries.
- Distinguish date found, date applied, last activity, and next-action date.
- Keep application stage distinct from freshness/stale state.
- Keep database row identity distinct from deterministic job identity.
- Preserve provider job IDs and canonical URLs when available.
- Treat missing dates as unknown rather than the current time unless the field is
  specifically an ingestion or creation timestamp.

## 39. Privacy philosophy

The product handles sensitive professional and personal data.

Default posture:

- profile stored locally;
- resumes stored locally;
- application history stored locally;
- model calls explicit and narrowly scoped;
- no hidden background AI processing;
- no automatic application submission;
- no hidden email access;
- minimal extension permissions;
- localhost-only bridge;
- understandable permission and error states.

Logs and test fixtures should avoid real personal information. Use synthetic data
unless a person explicitly authorizes a specific use.

## 40. Security boundaries

Important trust boundaries include:

- untrusted job-page DOM to content script;
- content script to service worker;
- extension to localhost bridge;
- HTTP payload to Electron main process;
- main process to SQLite;
- main process to preload/renderer;
- local resume/profile data to cloud AI;
- email provider to tracking classification.

At each boundary, validate shape, size, authorization, and expected behavior.
Never treat webpage content as executable instructions. Never expose bridge tokens
in logs or renderer-visible errors.

## 41. Seven-person team model

The team has seven people. Work should be split by stable subsystem ownership, not
by having everyone touch every layer.

Known direction:

- Job Intelligence and Ingestion owns live job detection, URL/HTML/snapshot
  ingestion, provider adapters, canonical job normalization, deterministic
  keyword extraction, fingerprints, duplicate behavior, similarity, and its
  extension/backend interface.
- Two people are expected to focus substantially on user interface work.
- Other ownership assignments should be recorded in issues or a dedicated team
  ownership document once finalized.

Useful remaining workstreams include:

- platform integration, bridge, IPC, and database;
- application lifecycle, activity history, stale logic, and reminders;
- applicant profile and autofill;
- master resume, LaTeX validation, and AI tailoring;
- job discovery and matching integration;
- cohesive desktop and extension UI.

Do not infer a specific person's ownership from this list. The current issue or
team agreement is authoritative.

## 42. AI development philosophy

AI assistants should accelerate the team without replacing its understanding.

Good AI-assisted work includes:

- monorepo and application scaffolding;
- Electron, React, Vite, and Manifest V3 boilerplate;
- SQLite and Drizzle setup;
- shared types and typed integration seams;
- localhost bridge plumbing;
- fixtures and test harnesses;
- repetitive glue code;
- focused debugging and verification;
- UI shells and state wiring.

Meaningful algorithms should remain human-owned unless explicitly assigned:

- keyword ranking;
- similarity weighting;
- autofill inference;
- stale scoring;
- Kanban transition behavior;
- email classification;
- resume-tailoring policy.

The portable workflow roles live in `.agents/`. They are capability-based:

- Scoper;
- Builder;
- UI Builder;
- Verifier;
- Integrator.

They are not one agent per human and do not require a particular model vendor.

## 43. GitHub workflow

Normal team workflow is:

```text
issue
  -> feature branch
  -> focused commits
  -> pull request
  -> review
  -> merge
```

Avoid direct commits to `main` except when a human explicitly authorizes a
specific exception. Agents do not receive implicit permission to commit, push,
open pull requests, alter branch protection, approve, or merge.

Pull requests should explain:

- user or teammate-visible outcome;
- scope and non-goals;
- changed contracts;
- tests and runtime verification;
- limitations;
- release note or an explicit not-applicable entry.

## 44. Priority framework

### P0: protected demo path

Work required to demonstrate the end-to-end product thesis. P0 failures take
priority over polish and stretch work.

### P1: strong supporting experience

Features that make the product cohesive and substantially improve judging, but
should not destabilize the P0 path.

### P2: stretch or experimental

Features attempted only after the core path is reliable and rehearsed.

## 45. P0 goals

P0 should prove:

1. Electron launches and renders the desktop application.
2. The extension loads and connects to Electron.
3. Opening a real supported job produces structured detection.
4. SPA navigation can update the detected job.
5. The canonical job and deterministic keywords reach the desktop.
6. The user can save the job.
7. The saved job persists in SQLite across restart.
8. The application appears in the organization view.
9. A master LaTeX resume can be stored and copied into a tailored version.
10. Autofill can assist common fields after an explicit user action.
11. The user remains responsible for final review and submission.

## 46. P1 goals

P1 candidates include:

- application activity timeline;
- stage persistence and robust Kanban behavior;
- configurable stale detection;
- actionable Today page;
- deterministic keyword coverage;
- deterministic similar-job ranking;
- public-source discovery of a small result set;
- polished profile and resume workflows;
- cohesive error and empty states;
- accessibility and interaction polish.

## 47. P2 and stretch goals

P2 candidates include:

- opt-in email response tracking proof of concept;
- one application-status provider proof of concept;
- ambiguous message classification;
- deeper reminders and calendar integration;
- richer discovery providers;
- additional browser support after the hackathon;
- final naming and broader brand work.

Do not sacrifice P0 reliability for these items.

## 48. First technical milestone

The first architecture milestone is successful when:

```text
start Electron
  -> desktop opens

load extension
  -> extension connects to Electron

open a sample or real job page
  -> extension detects it

send canonical JobPosting
  -> desktop displays current job

click Save
  -> job persists in SQLite

open Applications
  -> saved job is present
```

The importance of this milestone is proving the complete browser-to-database
chain, not maximizing scraper sophistication.

## 49. Judge demonstration plan

The ideal demonstration is a single continuous story:

### Step 1: Open a real posting

Show a recognizable job page. The extension identifies company and role.

### Step 2: Show live intelligence

Display the structured posting, relevant keyword count, and resume keyword
coverage. Navigate to another job in the same SPA if the site allows it and show
the desktop context update.

### Step 3: Tailor the resume

Generate a separate truthful LaTeX version. Show that the master remains intact
and that relevant existing experience is emphasized.

### Step 4: Begin applying

Open an application form. Show detected field count, autofillable fields, and
fields needing attention.

### Step 5: User-triggered assistance

Click Autofill. Review values. Demonstrate that the system does not submit.

### Step 6: Track the application

Manually mark the application submitted. Show the persisted stage and activity
event in the desktop application.

### Step 7: Show lifecycle intelligence

Use prepared local data to show a stale follow-up recommendation or an interview
event without claiming silence is rejection.

### Step 8: Discover related roles

Show a small list of similar jobs with deterministic scores and reasons.

The demonstration should feel like one product, not eight disconnected tabs.

## 50. Quality and verification goals

Quality should be proportional to hackathon risk:

- type-safe contracts;
- deterministic unit tests for algorithms;
- realistic HTML and provider fixtures;
- migration and restart checks for persistence;
- integration tests for bridge requests where practical;
- extension checks on at least one real supported page and one SPA transition;
- UI checks for loading, empty, success, error, disabled, and disconnected states;
- keyboard and focus checks for important interactions;
- production builds for desktop and extension;
- clean diffs without generated outputs or secrets.

Current root commands include:

- `npm test`;
- `npm run typecheck`;
- `npm run build`;
- `git diff --check`.

The current root `npm run lint` command is a placeholder and must not be treated as
real lint coverage.

## 51. Success metrics

### Product success

- A judge can understand the product thesis within the first minute.
- The live browser-to-desktop transition works reliably.
- The primary demo completes without manual data repair.
- The next useful action is visible at each step.
- The experience looks intentional rather than scaffolded.

### Technical success

- Shared contracts align with runtime payloads.
- Job ingestion returns deterministic, non-fabricated output.
- Saved data survives restart.
- Extension events do not storm or duplicate.
- Bridge access remains local and authenticated.
- Core packages typecheck and production applications build.

### Trust success

- The product never auto-submits.
- The product never silently uploads broad personal data.
- The product never marks silence as rejection.
- Resume tailoring remains truthful and reviewable.
- Uncertain detection is represented as uncertain.

### Team success

- Subsystems have clear human owners.
- Shared-contract changes are coordinated.
- Pull requests remain focused.
- Every teammate can explain the part they built.
- AI assistance accelerates work without making the architecture mysterious.

## 52. Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Overbuilding stretch features | Core demo remains incomplete | Protect P0 and rehearse it early |
| Extension DOM instability | Live detection fails on demo site | Use structured data, provider adapters, fixtures, and a tested fallback site |
| SPA mutation storms | Performance and duplicate events | Debounce and compare normalized job identity |
| Bridge unavailable | Extension appears broken | Clear disconnected state and retry path |
| Broad extension permissions | Trust and review concerns | Minimize host permissions as adapters stabilize |
| Shared-type drift | Teammate integration failures | Treat contract changes as coordinated events |
| Database migration mismatch | Persistence failure | Test clean and existing database paths |
| AI resume hallucination | Serious trust failure | Truth constraints, diffing, validation, and user review |
| Autofill misclassification | Incorrect application data | Confidence thresholds and manual attention states |
| Automatic rejection inference | Misleading lifecycle state | Separate stale/freshness from application stage |
| Too many dashboards | Weak product story | Prioritize actions and live context |
| Naming distraction | Time lost before product works | Keep product unnamed until the core experience is stable |
| Parallel agent edits | Conflicts and overwritten work | Disjoint ownership and read-heavy parallelism |
| Unequal model access | Inconsistent agent output | Portable roles and explicit task envelopes |

## 53. Explicit non-goals

The initial project does not need:

- Django;
- a general cloud backend;
- microservices;
- Kubernetes;
- complex authentication;
- multi-user collaboration;
- cloud synchronization;
- a dedicated mobile application;
- a giant analytics dashboard;
- a vector database;
- an autonomous multi-agent product feature;
- automatic application submission;
- CAPTCHA or MFA bypass;
- universal ATS or portal scraping;
- dozens of provider adapters;
- aggressive internet crawling;
- production-scale email infrastructure;
- premature deployment infrastructure;
- final branding before the product works.

These may be revisited after the hackathon only through explicit decisions.

## 54. Durable decisions and open questions

### Durable decisions

- Product is intentionally unnamed.
- Desktop stack is Electron, React, TypeScript, and Vite.
- Initial browser target is Chromium Manifest V3.
- Data is local SQLite through Drizzle.
- Electron owns persistence.
- Extension-to-desktop communication uses an authenticated localhost bridge.
- Deterministic methods own core extraction and ranking.
- Cloud AI is narrow and truth-constrained.
- User manually submits applications.
- Applicant name, address, and phone defaults use separate optional middle-name,
  street, city, province/state, and optional phone-extension fields.
- Autofill offers explicit master and active-job-tailored resume modes.
- Silence never equals rejection.
- Team size is seven.
- AI workflow roles are vendor-neutral and live in `.agents/`.

### Open questions

- What final product name and visual identity will the team select?
- What are the finalized human ownership assignments for all seven people?
- Which exact job site will be the primary live demo target?
- Which cloud model provider will be the default for tailoring?
- How will LaTeX compile across teammate machines?
- What stale thresholds should be defaults for each stage?
- Which public source should power the first similar-job discovery demo?
- Is email tracking worth implementing after P0 and P1 are stable?
- Which extension host permissions can be narrowed before submission?

Open questions are not permission for an agent to choose a durable answer. Record
the human decision here when made.

## 55. Glossary

**Active page:** The browser tab and page the user is currently viewing.

**Application stage:** The user's lifecycle state such as Saved, Applied,
Interview, Offer, or Rejected.

**Bridge:** The authenticated HTTP service on `127.0.0.1` connecting the extension
to Electron.

**Canonical job:** A normalized `JobPosting` used consistently across ingestion,
persistence, matching, resume, and UI systems.

**Content fingerprint:** A deterministic representation used to identify similar
or near-duplicate job descriptions.

**Freshness state:** A non-terminal attention state such as fresh, waiting, or
stale. It is separate from application stage.

**Job intelligence:** Extraction, normalization, keywords, fingerprints,
duplicates, and similarity derived from job evidence.

**Keyword Coverage:** The project's deterministic comparison of job keywords with
resume content. It is not a claim to reproduce an employer's ATS.

**Master resume:** The user's canonical local LaTeX resume that is never
overwritten by tailoring.

**Provider adapter:** Source-aware logic for a job platform such as Greenhouse,
Lever, Workday, or Ashby.

**Snapshot:** A bounded, serialization-safe capture of page evidence supplied by
the extension.

**Stale:** An application with no meaningful activity past a configured threshold.
It does not mean rejected.

**Tailored resume:** A separate job-specific LaTeX version derived truthfully from
the master resume.

**User-triggered autofill:** Form assistance that begins only after the user takes
an explicit action and never submits the application.
