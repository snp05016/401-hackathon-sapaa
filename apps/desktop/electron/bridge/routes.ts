import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { applications, type GhostboardDb } from "@ghostboard/database";
import { ingestJob } from "@ghostboard/scraping";
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
} from "@ghostboard/shared";
import { readProfile } from "../db/index";

export function handleGetProfile(): ProfileResponse {
  return { profile: readProfile() };
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
    createdAt: now,
    updatedAt: now,
  });

  return { job, applicationId };
}

/** Read-only intelligence boundary: no application or lifecycle state is written. */
export async function handleIngestJob(body: IngestJobRequest): Promise<IngestJobResponse> {
  return ingestJob({
    url: body.snapshot?.url ?? body.url,
    html: body.html,
    visibleText: body.visibleText,
    snapshot: body.snapshot,
  });
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
