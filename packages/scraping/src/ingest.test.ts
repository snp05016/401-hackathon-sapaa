import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  areDuplicateJobs,
  contentFingerprintSimilarity,
  draftFromHtml,
  fingerprintDescription,
  fingerprintJob,
  ingestJob,
  MemoryJobIngestionCache,
  normalizeJobUrl,
  fetchProviderDraft,
  detectProvider,
  extractSourceJobId,
  validateJobUrl,
} from "./index";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url)), "utf8");

test("structured JSON-LD produces a complete canonical posting", async () => {
  const result = await ingestJob({
    url: "https://job-boards.greenhouse.io/acme/jobs/987654?utm_source=test",
    html: fixture("structured-greenhouse-job.html"),
  }, { now: () => new Date("2026-09-11T12:00:00Z"), cache: new MemoryJobIngestionCache() });
  assert.equal(result.outcome, "job");
  assert.equal(result.posting?.company, "Acme Robotics");
  assert.equal(result.posting?.source, "greenhouse");
  assert.equal(result.posting?.sourceJobId, "987654");
  assert.equal(result.posting?.location, "Toronto, ON, CA");
  assert.equal(result.posting?.salaryRange, "CAD 130,000–160,000 / year");
  assert.match(result.posting?.jobDescription ?? "", /Docker and Kubernetes/);
  assert.ok(result.posting?.keywords.some((keyword) => keyword.term === "PostgreSQL"));
  assert.ok(result.posting?.requirements.some((item) => item.includes("Docker")));
  assert.equal(result.posting?.jobUrl, "https://job-boards.greenhouse.io/acme/jobs/987654");
});

test("current Greenhouse pages recover company names from their page title", async () => {
  const description = "About the role. Build customer-facing TypeScript and React applications with Python and SQL. What You'll Do: design, build, test, and improve reliable software with the engineering team. Qualifications: experience solving programming problems and collaborating on production-quality systems.";
  const result = await ingestJob({
    url: "https://job-boards.greenhouse.io/gallup/jobs/4395897009",
    html: `<html><head><title>Job Application for Software Engineer Intern — Summer 2027 at Gallup</title><meta property="og:title" content="Software Engineer Intern — Summer 2027"><meta property="og:description" content="San Francisco"></head><body><main class="job-post"><h1 class="job__title">Software Engineer Intern — Summer 2027</h1><div class="job__location">San Francisco</div><a href="#apply">Apply</a><section class="job__description">${description}</section></main></body></html>`,
  }, { cache: new MemoryJobIngestionCache() });
  assert.equal(result.outcome, "job");
  assert.equal(result.posting?.company, "Gallup");
  assert.equal(result.posting?.title, "Software Engineer Intern — Summer 2027");
  assert.equal(result.posting?.sourceJobId, "4395897009");
});

test("generic noisy HTML excludes page chrome and extracts job content", async () => {
  const result = await ingestJob({
    url: "https://northstar.example/careers/42",
    html: fixture("noisy-generic-job.html"),
  }, { cache: new MemoryJobIngestionCache() });
  assert.equal(result.outcome, "job");
  assert.equal(result.posting?.title, "Software Engineer Intern");
  assert.equal(result.posting?.company, "Northstar Labs");
  assert.doesNotMatch(result.posting?.jobDescription ?? "", /Privacy Terms|Recommended jobs/);
  assert.match(result.posting?.jobDescription ?? "", /React and TypeScript/);
});

test("a non-job page is rejected instead of fabricated", async () => {
  const result = await ingestJob({
    url: "https://example.com/about",
    html: "<html><head><title>About Example</title></head><body><main><h1>About us</h1><p>We make useful things for customers around the world.</p></main></body></html>",
  }, { cache: new MemoryJobIngestionCache() });
  assert.equal(result.outcome, "not_job");
  assert.equal(result.posting, undefined);
});

test("incomplete snapshots return uncertainty and explicit warnings", async () => {
  const result = await ingestJob({
    url: "https://example.com/jobs",
    snapshot: { url: "https://example.com/jobs", pageTitle: "Careers", visibleText: "Requirements\n- TypeScript" },
  }, { cache: new MemoryJobIngestionCache() });
  assert.equal(result.outcome, "uncertain");
  assert.ok(result.warnings.some((warning) => /Company|description/i.test(warning)));
});

test("identical extension snapshots hit the bounded ingestion cache", async () => {
  const cache = new MemoryJobIngestionCache();
  const input = { url: "https://northstar.example/careers/42", html: fixture("noisy-generic-job.html") };
  const first = await ingestJob(input, { cache });
  const second = await ingestJob(input, { cache });
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(first.posting?.fingerprint, second.posting?.fingerprint);
});

test("Greenhouse URL ingestion uses its public API and HTML fallback", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("boards-api.greenhouse.io")) {
      return new Response(JSON.stringify({
        title: "Senior Platform Engineer",
        absolute_url: "https://job-boards.greenhouse.io/acme/jobs/987654",
        location: { name: "Toronto, ON" },
        content: "<p>Build TypeScript and PostgreSQL services for a distributed platform. Requirements include Docker, Kubernetes, AWS, CI/CD, observability, testing, mentoring, and reliable production operations across our global customer base.</p>",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(fixture("structured-greenhouse-job.html"), { status: 200, headers: { "content-type": "text/html" } });
  };
  const result = await ingestJob({ url: "https://job-boards.greenhouse.io/acme/jobs/987654" }, { fetch: fetcher, cache: new MemoryJobIngestionCache() });
  assert.equal(result.outcome, "job");
  assert.equal(result.posting?.company, "Acme Robotics");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /boards-api\.greenhouse\.io/);
});

test("URL validation blocks local targets and canonicalization preserves functional params", () => {
  assert.equal(validateJobUrl("http://127.0.0.1/jobs/1").ok, false);
  assert.equal(validateJobUrl("file:///tmp/job.html").ok, false);
  assert.equal(
    normalizeJobUrl("http://EXAMPLE.com/jobs/1/?utm_source=x&gh_jid=42#apply"),
    "https://example.com/jobs/1?gh_jid=42",
  );
});

test("provider detection and source IDs cover major ATS and hosted boards", () => {
  const cases = [
    ["https://boards.greenhouse.io/embed/job_app?for=acme&token=5624529004", "greenhouse", "5624529004"],
    ["https://jobs.lever.co/acme/lever-123", "lever", "lever-123"],
    ["https://acme.wd5.myworkdayjobs.com/en-US/site/job/Toronto/Engineer_R123456", "workday", "R123456"],
    ["https://jobs.ashbyhq.com/acme/ashby-123", "ashby", "ashby-123"],
    ["https://www.linkedin.com/jobs/view/backend-engineer-4123456789", "linkedin", "4123456789"],
    ["https://ca.indeed.com/viewjob?jk=indeed123", "indeed", "indeed123"],
  ] as const;
  for (const [url, provider, id] of cases) {
    assert.equal(detectProvider(url), provider);
    assert.equal(extractSourceJobId(url), id);
  }
});

test("Lever, Workday, and Ashby provider adapters normalize public API payloads", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.lever.co")) return new Response(JSON.stringify({
      text: "Backend Engineer", hostedUrl: "https://jobs.lever.co/acme/l1",
      categories: { location: "Calgary", commitment: "Full-time" },
      descriptionPlain: "Build Go and PostgreSQL services.", createdAt: 1789000000000,
    }), { status: 200 });
    if (url.includes("myworkdayjobs.com/wday/cxs")) return new Response(JSON.stringify({ jobPostingInfo: {
      title: "Cloud Developer", company: "Acme", jobReqId: "R123456", location: "Edmonton",
      timeType: "Full time", jobDescription: "Build AWS services using TypeScript and Terraform.",
    } }), { status: 200 });
    return new Response(JSON.stringify({ jobs: [{
      id: "a1", title: "ML Engineer", organizationName: "Acme", jobUrl: "https://jobs.ashbyhq.com/acme/a1",
      location: "Canada", workplaceType: "Remote", descriptionPlain: "Build Python machine learning systems.",
      compensation: { minValue: 100000, maxValue: 120000, currency: "cad" },
    }] }), { status: 200 });
  };
  const lever = await fetchProviderDraft(new URL("https://jobs.lever.co/acme/l1"), { fetch: fetcher });
  const workday = await fetchProviderDraft(new URL("https://acme.wd5.myworkdayjobs.com/en-US/site/job/Edmonton/Cloud-Developer_R123456"), { fetch: fetcher });
  const ashby = await fetchProviderDraft(new URL("https://jobs.ashbyhq.com/acme/a1"), { fetch: fetcher });
  assert.deepEqual([lever?.title, lever?.location, lever?.employmentType], ["Backend Engineer", "Calgary", "Full-time"]);
  assert.deepEqual([workday?.company, workday?.sourceJobId, workday?.location], ["Acme", "R123456", "Edmonton"]);
  assert.deepEqual([ashby?.company, ashby?.location, ashby?.salaryRange], ["Acme", "Canada · Remote", "CAD 100,000–120,000"]);
});

test("content fingerprints recognize near duplicates without collapsing distinct locations", async () => {
  const base = fixture("noisy-generic-job.html");
  const changed = base.replace("production software", "reliable production software");
  const leftFp = fingerprintDescription(draftFromHtml(base, "https://northstar.example/jobs/42").description ?? "");
  const rightFp = fingerprintDescription(draftFromHtml(changed, "https://agency.example/jobs/900").description ?? "");
  assert.ok(contentFingerprintSimilarity(leftFp, rightFp) >= 0.92);
  const first = (await ingestJob({ url: "https://northstar.example/jobs/42", html: base }, { cache: new MemoryJobIngestionCache() })).posting!;
  const duplicate = (await ingestJob({ url: "https://northstar.example/jobs/42?utm_campaign=x", html: changed }, { cache: new MemoryJobIngestionCache() })).posting!;
  const otherLocation = { ...duplicate, fingerprint: "different", location: "Vancouver" };
  assert.equal(areDuplicateJobs(first, duplicate), true);
  assert.equal(areDuplicateJobs(first, otherLocation), false);
});

test("a fixed SPA route distinguishes real jobs while repeated snapshots stay stable", () => {
  const base = { source: "generic", url: "https://example.com/jobs/details", company: "Acme", title: "Software Engineer", location: "Toronto" };
  assert.equal(fingerprintJob(base), fingerprintJob({ ...base }));
  assert.notEqual(fingerprintJob(base), fingerprintJob({ ...base, location: "Vancouver" }));
  assert.notEqual(fingerprintJob(base), fingerprintJob({ ...base, title: "Data Engineer" }));
});
