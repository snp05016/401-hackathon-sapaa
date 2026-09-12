# Site adapters

`genericScraper.ts` is the fallback used for any URL. To add a precise
site-specific adapter (LinkedIn, Greenhouse, Lever, etc.):

1. Create `linkedin.ts` (etc.) exporting a `JobScraper` (see `../types.ts`).
2. `matches(url, document)` should check the hostname / DOM shape for that site.
3. `scrape(url, document)` should return a higher `confidence` than the
   generic scraper (0.4) since it targets known selectors.
4. Register it ahead of `genericScraper` wherever scrapers are tried in order
   (see `apps/extension/src/content/detectJobPage.ts`).

TODO(team)[scraping]: no adapters exist yet — this is a good beginner/intermediate task.
