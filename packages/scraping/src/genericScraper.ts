import type { JobPosting } from "@ghostboard/shared";
import type { JobScraper, ScrapeResult } from "./types";

function metaContent(document: Document, property: string): string | null {
  const el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
  return el?.getAttribute("content")?.trim() || null;
}

function largestHeading(document: Document): string | null {
  const headings = Array.from(document.querySelectorAll("h1"));
  if (headings.length === 0) return null;
  return headings
    .map((h) => h.textContent?.trim() ?? "")
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

function bodyText(document: Document): string {
  return (document.body?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Generic fallback scraper: works on any page by reading <title>, common
 * OpenGraph meta tags, the largest <h1>, and falling back to full body text
 * for the job description. Site-specific adapters (LinkedIn, Greenhouse,
 * Lever, ...) should be more precise and matched first — see adapters/README.md.
 */
export const genericScraper: JobScraper = {
  name: "generic",

  matches(): boolean {
    // Always matches — this is the last-resort fallback scraper.
    return true;
  },

  scrape(url: string, document: Document): ScrapeResult | null {
    const title = largestHeading(document) || document.title || null;
    if (!title) return null;

    const company = metaContent(document, "og:site_name") || document.title.split(/[-|]/).pop()?.trim() || "Unknown";
    const ogTitle = metaContent(document, "og:title");
    const description = bodyText(document).slice(0, 5000);

    const posting: JobPosting = {
      id: crypto.randomUUID(),
      company,
      title: ogTitle || title,
      location: null,
      jobUrl: url,
      jobDescription: description,
      source: "generic",
      postedAt: null,
      salaryRange: null,
      scrapedAt: new Date().toISOString(),
    };

    // Lower confidence than a site-specific adapter would report.
    return { posting, confidence: 0.4 };
  },
};
