import { calculateJobSimilarity } from "@ghostboard/matching";
import type { JobPosting } from "@ghostboard/shared";

export function Discover() {
  // TODO(team)[matching]: fetch real jobs and call calculateJobSimilarity per-job.
  const placeholder: JobPosting = {
    id: "placeholder",
    company: "—",
    title: "—",
    location: null,
    jobUrl: "",
    jobDescription: "",
    source: "none",
    postedAt: null,
    salaryRange: null,
    scrapedAt: new Date().toISOString(),
  };
  const results = calculateJobSimilarity(placeholder, []);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Discover</h1>
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Job similarity isn't implemented yet — see <code>packages/matching/src/similarity.ts</code>.
        </div>
      ) : (
        <ul>
          {results.map((r) => (
            <li key={r.similarJobId}>{r.similarJobId}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
