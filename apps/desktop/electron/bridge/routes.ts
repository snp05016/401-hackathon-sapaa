import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { applications, type GhostboardDb } from "@ghostboard/database";
import { ingestJob } from "@ghostboard/scraping";
import { getProvider } from "@ghostboard/ai";
import { applyTailoredExperience, customizeResume, parseResumeReference } from "@ghostboard/resume";
import type {
  CreateJobRequest,
  CreateJobResponse,
  UpsertApplicationRequest,
  UpsertApplicationResponse,
  PageContextRequest,
  PageContextResponse,
  ProfileResponse,
  JobPosting,
  IngestJobRequest,
  IngestJobResponse,
  ExternalKanbanResponse,
  ExternalResumeTemplateResponse,
  ApplicationStage,
  TailoredAutofillRequest,
  TailoredAutofillResponse,
} from "@ghostboard/shared";
import { APPLICATION_STAGES, STAGE_LABELS, calendarDateOrNull, jobDetailsOf } from "@ghostboard/shared";
import {
  readExperienceBank,
  readProfile,
  readMasterResume,
  readTailoredAutofillCache,
  readTailoredResumes,
  writeTailoredAutofillCache,
} from "../db/index";

export function handleGetProfile(): ProfileResponse {
  return { profile: readProfile() };
}

/** Read-only: groups the current applications the same way the desktop Kanban board does. */
export async function handleGetKanban(db: GhostboardDb): Promise<ExternalKanbanResponse> {
  const allApplications = await db.select().from(applications);
  const columns = APPLICATION_STAGES.map((stage: ApplicationStage) => ({
    stage,
    label: STAGE_LABELS[stage],
    applications: allApplications.filter((application) => application.status === stage),
  }));
  return { columns };
}

/** Read-only: no route accepts writes to the master resume; it is only ever set by the desktop app itself. */
export function handleGetResumeTemplate(): ExternalResumeTemplateResponse {
  return { resume: readMasterResume() };
}

function sameJob(
  record: { company: string | null; title: string | null; jobUrl: string | null },
  job: TailoredAutofillRequest["job"],
): boolean {
  const normalize = (value: string | null) => value?.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() ?? "";
  if (record.jobUrl && job.jobUrl) return normalize(record.jobUrl) === normalize(job.jobUrl);
  return !!record.company && !!record.title
    && normalize(record.company) === normalize(job.company)
    && normalize(record.title) === normalize(job.title);
}

/** Reuses a reviewed version or the active-job cache before invoking the tailoring provider. */
export async function handleGetTailoredAutofillResume(
  body: TailoredAutofillRequest,
): Promise<TailoredAutofillResponse> {
  if (!body?.job || typeof body.job.jobDescription !== "string" || !body.job.jobDescription.trim()) {
    throw new Error("A job description could not be detected on this page.");
  }
  if (
    typeof body.job.company !== "string"
    || typeof body.job.title !== "string"
    || typeof body.job.jobUrl !== "string"
    || body.job.company.length > 200
    || body.job.title.length > 200
    || body.job.jobUrl.length > 2_000
  ) {
    throw new Error("The detected job details are invalid.");
  }
  const job = {
    company: body.job.company.trim(),
    title: body.job.title.trim(),
    jobUrl: body.job.jobUrl.trim(),
    jobDescription: body.job.jobDescription.trim(),
  };

  const master = readMasterResume();
  const saved = [...readTailoredResumes()].reverse().find((record) => sameJob(record, job));
  if (saved) {
    const experienceOnlyLatex = applyTailoredExperience(master.latex, saved.latex);
    return {
      source: "saved",
      resume: {
        id: saved.id,
        latex: experienceOnlyLatex,
        reference: parseResumeReference(experienceOnlyLatex),
        updatedAt: saved.createdAt,
      },
    };
  }

  const cached = readTailoredAutofillCache();
  if (cached && cached.masterUpdatedAt === master.updatedAt && sameJob(cached.job, job)) {
    return { source: "cached", resume: cached.resume };
  }

  const result = await customizeResume({
    masterLatex: master.latex,
    jobDescription: job.jobDescription,
    jobContext: {
      company: job.company,
      title: job.title,
      jobUrl: job.jobUrl,
    },
    experienceBank: readExperienceBank(),
  });
  const resume = {
    id: `tailored-${crypto.randomUUID()}`,
    latex: result.latex,
    reference: parseResumeReference(result.latex),
    updatedAt: new Date().toISOString(),
  };
  writeTailoredAutofillCache({
    policyVersion: "experience-only-v1",
    job,
    masterUpdatedAt: master.updatedAt,
    resume,
    cachedAt: new Date().toISOString(),
  });
  return { source: "generated", resume };
}

export async function handleCreateJob(db: GhostboardDb, body: CreateJobRequest): Promise<CreateJobResponse> {
  const now = new Date().toISOString();
  const intelligenceId = body.id ?? body.fingerprint ?? crypto.randomUUID();
  const job: JobPosting = {
    id: intelligenceId,
    fingerprint: body.fingerprint ?? intelligenceId,
    contentFingerprint: body.contentFingerprint ?? null,
    sourceJobId: body.sourceJobId ?? null,
    company: body.company,
    title: body.title,
    location: body.location,
    jobUrl: body.jobUrl,
    jobDescription: body.jobDescription,
    source: body.source,
    employmentType: body.employmentType ?? null,
    requirements: body.requirements ?? [],
    keywords: body.keywords ?? [],
    postedAt: body.postedAt,
    salaryRange: body.salaryRange,
    scrapedAt: body.scrapedAt ?? now,
    workArrangement: body.workArrangement ?? null,
    applicationDeadline: body.applicationDeadline ?? null,
    startDate: body.startDate ?? null,
    termDuration: body.termDuration ?? null,
    responsibilities: body.responsibilities ?? [],
    preferredQualifications: body.preferredQualifications ?? [],
    education: body.education ?? null,
    workAuthorization: body.workAuthorization ?? null,
    clearance: body.clearance ?? null,
  };

  const applicationId = crypto.randomUUID();
  await db.insert(applications).values({
    id: applicationId,
    company: job.company,
    title: job.title,
    location: job.location,
    jobUrl: job.jobUrl,
    jobDescription: job.jobDescription,
    status: "found",
    dateFound: now,
    dateApplied: null,
    lastActivityAt: now,
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: job.source,
    deadline: calendarDateOrNull(job.applicationDeadline),
    jobDetails: jobDetailsOf(job),
    createdAt: now,
    updatedAt: now,
  });

  return { job, applicationId };
}

/**
 * Enrichment is opt-in on having a key configured. Without one, ingestion stays
 * fully deterministic; the LLM only ever sees the cleaned description, and only
 * for fields JSON-LD, provider APIs, and the DOM left empty.
 */
function enrichmentProvider() {
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) return undefined;
  try {
    return getProvider();
  } catch {
    return undefined;
  }
}

/** Read-only intelligence boundary: no application or lifecycle state is written. */
export async function handleIngestJob(body: IngestJobRequest): Promise<IngestJobResponse> {
  return ingestJob({
    url: body.snapshot?.url ?? body.url,
    html: body.html,
    visibleText: body.visibleText,
    snapshot: body.snapshot,
  }, { llm: enrichmentProvider() });
}

export async function handleUpsertApplication(
  db: GhostboardDb,
  body: UpsertApplicationRequest
): Promise<UpsertApplicationResponse> {
  const now = new Date().toISOString();

  if (body.id) {
    const [existing] = await db.select().from(applications).where(eq(applications.id, body.id));
    if (existing) {
      await db
        .update(applications)
        .set({
          company: body.company,
          title: body.title,
          location: body.location ?? existing.location,
          jobUrl: body.jobUrl,
          jobDescription: body.jobDescription ?? existing.jobDescription,
          status: body.status ?? existing.status,
          resumeId: body.resumeId ?? existing.resumeId,
          source: body.source ?? existing.source,
          updatedAt: now,
        })
        .where(eq(applications.id, body.id));
      const [updated] = await db.select().from(applications).where(eq(applications.id, body.id));
      return { application: updated! };
    }
  }

  const id = body.id ?? crypto.randomUUID();
  const created = {
    id,
    company: body.company,
    title: body.title,
    location: body.location ?? null,
    jobUrl: body.jobUrl,
    jobDescription: body.jobDescription ?? "",
    status: body.status ?? "found",
    dateFound: now,
    dateApplied: null,
    lastActivityAt: now,
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: null,
    nextActionDate: null,
    resumeId: body.resumeId ?? null,
    source: body.source ?? "manual",
    createdAt: now,
    updatedAt: now,
  } as const;
  await db.insert(applications).values(created);
  return { application: created };
}

// TODO(team)[tracking]: actually persist page-context payloads (e.g. into application_events)
// instead of just logging — useful for building autofill training data later.
export function handlePageContext(body: PageContextRequest): PageContextResponse {
  console.log("[bridge] page-context received:", body.url, body.pageType);
  return { received: true };
}
