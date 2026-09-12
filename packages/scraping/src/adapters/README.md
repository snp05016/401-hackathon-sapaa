# Job intelligence adapters

`ingestJob()` is the canonical entry point for a URL, raw HTML, visible text,
or a Chromium `JobPageSnapshot`. It always tries structured `JobPosting`
JSON-LD before generic HTML heuristics.

Current provider paths:

- Greenhouse: per-job Boards API, then posting HTML fallback.
- Lever: per-job public postings API, then posting HTML fallback.
- Workday: per-job CXS API, which avoids its virtualized rendered DOM.
- Ashby: public organization board API filtered to the requested job ID.
- LinkedIn and Indeed: provider/source-ID detection plus supplied browser DOM or
  snapshot extraction. Direct URL fetching falls back to public HTML and may be
  inconclusive when the site returns a login or anti-bot page.
- Generic: JSON-LD, metadata, job-description regions, `main`/`article`, then a
  cleaned body fallback.

Provider API URLs are derived from recognized posting URLs; redirects are not
followed implicitly. The generic fetch path validates each redirect and rejects
literal local/private targets. Playwright is intentionally not a default
dependency—the extension supplies the already-rendered page for dynamic sites.

To add another provider, implement `JobProvider` in `../providers.ts`, keep its
API host fixed/allowlisted, return a partial `JobExtractionDraft`, and add a
fixture-backed test in `../ingest.test.ts`. The canonical builder owns cleaning,
keywords, fingerprints, and the final shared `JobPosting` shape.
