import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  areDuplicateJobs,
  contentFingerprintSimilarity,
  buildCanonicalJob,
  draftFromHtml,
  enrichDraft,
  extractPreferredQualifications,
  extractRequirements,
  extractResponsibilities,
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

test("generic HTML parser uses ATS data attributes for title, company, and location", async () => {
  const description = "Responsibilities\n- Build reliable services\n- Review production code\nRequirements\n- TypeScript\n- SQL\n" + "Collaborate with a small engineering team. ".repeat(8);
  const result = await ingestJob({
    url: "https://jobs.example.com/openings/platform-engineer",
    html: `<html><head><title>Open role</title></head><body><main><h1 data-testid="job-title">Platform Engineer</h1><div data-testid="company-name">Northstar Labs</div><div data-testid="job-location">Toronto, ON</div><section data-testid="job-description">${description}</section><a data-testid="apply-button" href="#apply">Apply now</a></main></body></html>`,
  }, { cache: new MemoryJobIngestionCache() });
  assert.equal(result.outcome, "job");
  assert.equal(result.posting?.title, "Platform Engineer");
  assert.equal(result.posting?.company, "Northstar Labs");
  assert.equal(result.posting?.location, "Toronto, ON");
  assert.ok(result.posting?.responsibilities.some((item) => item.includes("Build reliable services")));
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

test("section headings split required, preferred, and responsibilities", () => {
  const description = [
    "About the role", "",
    "What you will do", "", "- Ship features", "- Mentor peers", "",
    "You may be a good fit if you have", "", "- 3+ years of Python", "- BS in CS", "",
    "Strong candidates may also have", "", "- Kubernetes", "",
    "Benefits", "", "- Free lunch",
  ].join("\n");
  assert.deepEqual(extractRequirements(description), ["3+ years of Python", "BS in CS"]);
  assert.deepEqual(extractPreferredQualifications(description), ["Kubernetes"]);
  assert.deepEqual(extractResponsibilities(description), ["Ship features", "Mentor peers"]);
  // A stop heading must close the section rather than absorb the benefits list.
  assert.ok(!extractRequirements(description).includes("Free lunch"));
});

test("JSON-LD supplies deadline, start date, education, and arrangement", async () => {
  const posting = {
    "@context": "https://schema.org/", "@type": "JobPosting",
    title: "Software Engineering Intern",
    description: "<p>Build and operate distributed systems alongside the platform team, with mentorship throughout the term.</p><p>Requirements</p><ul><li>Pursuing a BS in CS</li><li>Experience with Python or Go</li></ul>",
    datePosted: "2026-08-01", validThrough: "2026-10-31", jobStartDate: "2026-06-01",
    employmentType: ["INTERN"], hiringOrganization: { name: "Acme Robotics" },
    jobLocationType: "TELECOMMUTE", jobLocation: [{ address: { addressLocality: "Toronto", addressCountry: "CA" } }],
    educationRequirements: { credentialCategory: "bachelor degree" },
  };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(posting)}</script></head><body>${"Build reliable systems and collaborate across teams. ".repeat(10)}</body></html>`;
  const result = await ingestJob({ url: "https://job-boards.greenhouse.io/acme/jobs/321" }, {
    fetch: (async () => new Response(html, { headers: { "content-type": "text/html" } })) as typeof globalThis.fetch,
    cache: new MemoryJobIngestionCache(),
  });
  assert.equal(result.posting?.workArrangement, "remote");
  assert.equal(result.posting?.applicationDeadline, "2026-10-31T00:00:00.000Z");
  assert.equal(result.posting?.startDate, "2026-06-01T00:00:00.000Z");
  assert.equal(result.posting?.education, "bachelor degree");
});

test("a vague date stays verbatim instead of becoming a fabricated calendar day", () => {
  const draft = { url: "https://example.com/jobs/1", company: "Acme", title: "Intern", startDate: "June 2026", description: "x".repeat(200) };
  assert.equal(buildCanonicalJob(draft).posting?.startDate, "June 2026");
});

test("LLM enrichment is asked only for empty fields and never overwrites extraction", async () => {
  const prompts: string[] = [];
  const llm = {
    async complete(request: { messages: Array<{ content: string }> }) {
      prompts.push(request.messages.map((message) => message.content).join("\n"));
      return { text: '```json\n{"termDuration":"Summer 2026, 12 weeks","clearance":"Active TS/SCI","workArrangement":"onsite","responsibilities":["ignored"]}\n```' };
    },
  };
  const draft = {
    url: "https://example.com/jobs/1", company: "Acme", title: "Intern",
    description: `Responsibilities\n\n- Build systems\n\n${"Detailed job content. ".repeat(20)}`,
    workArrangement: "remote" as const,
  };
  const enriched = await enrichDraft(draft, llm);
  assert.equal(enriched.termDuration, "Summer 2026, 12 weeks");
  assert.equal(enriched.clearance, "Active TS/SCI");
  // workArrangement was already known, so it is neither asked for nor overwritten.
  assert.equal(enriched.workArrangement, "remote");
  assert.ok(!prompts[0].includes('"workArrangement"'));
  assert.ok(prompts[0].includes('"clearance"'));
  // The whole prompt stays near the description's size -- no raw HTML is sent.
  assert.ok(prompts[0].length < draft.description.length + 1500);
});

test("enrichment failures degrade to deterministic extraction with a warning", async () => {
  const warnings: string[] = [];
  const failing = { async complete() { throw new Error("groq is down"); } };
  const draft = { url: "https://example.com/jobs/1", title: "Intern", description: "Detailed job content. ".repeat(20) };
  const enriched = await enrichDraft(draft, failing, warnings);
  assert.equal(enriched.title, "Intern");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /groq is down/);

  const truncated = { async complete() { return { text: '{"termDuration":"Summer 2026"' }; } };
  const second: string[] = [];
  assert.equal((await enrichDraft(draft, truncated, second)).termDuration, undefined);
  assert.match(second[0], /no parseable JSON/);
});

test("a posting dropped by the confidence threshold explains itself", async () => {
  const html = `<html><head><title>Notes</title></head><body><main>${"Some long prose about a topic that is not a job posting at all. ".repeat(12)}</main></body></html>`;
  const result = await ingestJob({ url: "https://example.com/reading/notes", html }, { cache: new MemoryJobIngestionCache() });
  assert.notEqual(result.outcome, "job");
  assert.equal(result.posting, undefined);
  assert.ok(result.warnings.length >= 1);
});

test("bulleted sections are not asked for once the splitter has parsed the page", async () => {
  const prompts: string[] = [];
  const llm = {
    async complete(request: { messages: Array<{ content: string }> }) {
      prompts.push(request.messages.map((message) => message.content).join("\n"));
      return { text: '{"preferredQualifications":["3+ years of Python","invented extra"],"clearance":null}' };
    },
  };
  const draft = {
    url: "https://example.com/jobs/1", company: "Acme", title: "Engineer",
    description: `Requirements\n\n- 3+ years of Python\n\n${"Detailed job content. ".repeat(20)}`,
    requirements: ["3+ years of Python"],
  };
  const enriched = await enrichDraft(draft, llm);
  assert.ok(!prompts[0].includes('"preferredQualifications"'));
  assert.ok(!prompts[0].includes('"responsibilities"'));
  // Even if a reply volunteers them, a restated requirement is never kept.
  assert.equal(enriched.preferredQualifications, undefined);
});

test("enrichment opts into low reasoning effort so gpt-oss does not bill for thinking", async () => {
  let sent: unknown = "unset";
  const llm = {
    async complete(request: { reasoningEffort?: string }) {
      sent = request.reasoningEffort;
      return { text: '{"clearance":"Active TS/SCI"}' };
    },
  };
  await enrichDraft({ description: "Detailed job content. ".repeat(20) }, llm);
  assert.equal(sent, "low");
});
