import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { applications, type GhostboardDb } from "@ghostboard/database";
import { ingestJob } from "@ghostboard/scraping";
import { getProvider } from "@ghostboard/ai";
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
} from "@ghostboard/shared";
import { APPLICATION_STAGES, STAGE_LABELS, calendarDateOrNull, jobDetailsOf } from "@ghostboard/shared";
import { readProfile, readMasterResume } from "../db/index";

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
