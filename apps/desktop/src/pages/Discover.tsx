import { calculateJobSimilarity } from "@ghostboard/matching";
import type { JobPosting } from "@ghostboard/shared";

export function Discover() {
  // TODO(team)[matching]: fetch real jobs and call calculateJobSimilarity per-job.
  const placeholder: JobPosting = {
    id: "placeholder",
    fingerprint: "placeholder",
    contentFingerprint: null,
    sourceJobId: null,
    company: "—",
    title: "—",
    location: null,
    jobUrl: "",
    jobDescription: "",
    source: "none",
    employmentType: null,
    requirements: [],
    keywords: [],
    postedAt: null,
    salaryRange: null,
    scrapedAt: new Date().toISOString(),
  };
  const results = calculateJobSimilarity(placeholder, []);

  return (
    <div className="max-w-[860px]">
      <h1 className="animate-reveal border-b border-hairline pb-3 font-display text-[52px] leading-[0.9] tracking-[-0.015em] text-ink">
        Discover
      </h1>
      {results.length === 0 ? (
        <div className="animate-reveal mt-12 max-w-[620px]" style={{ animationDelay: "120ms" }}>
          <p className="font-display text-[30px] leading-snug text-ink">
            Nothing to match against yet.
          </p>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
            Similarity scoring lives in <code className="border-b border-hairline pb-px text-ink">packages/matching/src/similarity.ts</code>. Once it returns
            results, close matches for your saved jobs appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-9 divide-y divide-hairline border-y border-hairline">
          {results.map((r) => (
            <li key={r.similarJobId} className="py-4 text-[13px] text-ink">
              {r.similarJobId}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
