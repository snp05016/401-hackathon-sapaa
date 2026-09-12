import { registerGmailHandlers } from "../gmail";

import { registerResumeHandlers } from "../resume";
import { ipcMain } from "electron";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { applications, applicationEvents, type GhostboardDb } from "@ghostboard/database";
import { buildFollowUpSuggestions, duplicateKey } from "@ghostboard/tracking";
import type { Application, FollowUpSuggestion, ProfileField } from "@ghostboard/shared";
import { STAGE_LABELS, type ApplicationEvent } from "@ghostboard/shared";
import type {
  DiscoveredJob,
  DiscoverSearchRequest,
  DiscoverSearchResponse,
  MoveApplicationRequest,
  MoveApplicationResult,
  SaveDiscoveredJobResult,
} from "../preload";
import { readMasterResume, readProfile, writeMasterResume, writeProfile } from "../db/index";
import { readBridgeFile } from "../bridge/token";
import { IPC_CHANNELS } from "./channels";
import { updateApplicationDeadline } from "../db/deadlines";

export function registerIpcHandlers(db: GhostboardDb): void {
  registerGmailHandlers(db);
  registerResumeHandlers();
  ipcMain.handle(IPC_CHANNELS.updateDeadline, (_event, applicationId: unknown, deadline: unknown) => {
    return updateApplicationDeadline(db, applicationId, deadline);
  });
  ipcMain.handle(IPC_CHANNELS.listApplications, async () => {
    return db.select().from(applications);
  });
  ipcMain.handle(IPC_CHANNELS.searchDiscoveredJobs, (_event, request: DiscoverSearchRequest) => {
    return searchDiscoveredJobs(request);
  });
  ipcMain.handle(IPC_CHANNELS.saveDiscoveredJob, (_event, job: DiscoveredJob) => {
    return saveDiscoveredJob(db, job);
  });
  ipcMain.handle(IPC_CHANNELS.visitDiscoveredJob, async (_event, job: DiscoveredJob, targetUrl?: string) => {
    const result = await saveDiscoveredJob(db, job);
    const jobUrl = requireWebUrl(targetUrl ?? job.jobUrlDirect ?? job.jobUrl, "job link");
    try {
      await shell.openExternal(jobUrl);
    } catch {
      throw new Error("The job was saved to Found, but its link could not be opened.");
    }
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.evaluateFollowUps, async (): Promise<FollowUpSuggestion[]> => {
    const rows = await db.select().from(applications);
    const suggestions = buildFollowUpSuggestions(rows);
    const flaggedIds = new Set(suggestions.map((suggestion) => suggestion.applicationId));
    await Promise.all(
      rows.map((row) => {
        const followUpOn = flaggedIds.has(row.id);
        if (followUpOn === row.followUpOn) return null;
        return db.update(applications).set({ followUpOn, updatedAt: new Date().toISOString() }).where(eq(applications.id, row.id));
      })
    );
    return suggestions;
  });

  ipcMain.handle(
    IPC_CHANNELS.moveApplication,
    async (_event, request: MoveApplicationRequest): Promise<MoveApplicationResult> => {
      const now = new Date().toISOString();

      return db.transaction(async (tx) => {
        const [existing] = await tx.select().from(applications).where(eq(applications.id, request.applicationId));
        if (!existing) throw new Error("application not found");
        if (existing.status === request.toStage) return { application: existing, event: null };

        await tx
          .update(applications)
          .set({
            status: request.toStage,
            updatedAt: now,
            lastActivityAt: now,
            ...(request.toStage === "applied" && !(request.fromStage === "interviewing" || request.fromStage === "offer") ? { dateApplied: now } : {}),
          })
          .where(eq(applications.id, request.applicationId));

        const event: ApplicationEvent = {
          id: crypto.randomUUID(),
          applicationId: request.applicationId,
          type: "stage_changed",
          title: `Moved to ${STAGE_LABELS[request.toStage]}`,
          description: null,
          occurredAt: now,
          metadata: { fromStage: request.fromStage, toStage: request.toStage },
        };

        await tx.insert(applicationEvents).values(event);

        const [updated] = await tx.select().from(applications).where(eq(applications.id, request.applicationId));
        if (!updated) throw new Error("application not found");

        return { application: updated, event };
      });
    }
  );


  ipcMain.handle(IPC_CHANNELS.dismissFollowUp, async (_event, applicationId: unknown): Promise<Application> => {
    if (typeof applicationId !== "string") throw new Error("application id is required");
    const now = new Date().toISOString();
    await db
      .update(applications)
      .set({ followUpOn: false, followUpDismissedAt: now, updatedAt: now })
      .where(eq(applications.id, applicationId));
    const [updated] = await db.select().from(applications).where(eq(applications.id, applicationId));
    if (!updated) throw new Error("application not found");
    return updated;
  });
  ipcMain.handle(IPC_CHANNELS.deleteApplication, async (_event, applicationId: unknown) => {
    if (typeof applicationId !== "string" || !applicationId) throw new Error("invalid application id");
    await db.transaction(async (tx) => {
      await tx.delete(applicationEvents).where(eq(applicationEvents.applicationId, applicationId));
      await tx.delete(applications).where(eq(applications.id, applicationId));
    });
  });

  ipcMain.handle(IPC_CHANNELS.getProfile, () => {
    return readProfile();
  });

  ipcMain.handle(IPC_CHANNELS.saveProfile, (_event, fields: ProfileField[]) => {
    return writeProfile(fields);
  });

  ipcMain.handle(IPC_CHANNELS.getMasterResume, () => {
    return readMasterResume();
  });

  ipcMain.handle(IPC_CHANNELS.saveMasterResume, (_event, latex: unknown) => {
    if (typeof latex !== "string") throw new Error("resume latex is required");
    return writeMasterResume(latex);
  });

  ipcMain.handle(IPC_CHANNELS.bridgeInfo, () => {
    return readBridgeFile();
  });
}

const DISCOVER_SITES = new Set(["linkedin", "indeed", "glassdoor", "google", "zip_recruiter"]);

function requireWebUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is unavailable`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error(`${label} must use HTTP or HTTPS`);
  return parsed.toString();
}

function normalizedDiscoveredJob(value: unknown): DiscoveredJob {
  if (!value || typeof value !== "object") throw new Error("job details are required");
  const job = value as DiscoveredJob;
  if (typeof job.title !== "string" || !job.title.trim()) throw new Error("job title is required");
  if (typeof job.company !== "string" || !job.company.trim()) throw new Error("company is required");
  if (typeof job.site !== "string" || !job.site.trim()) throw new Error("job source is required");
  return { ...job, title: job.title.trim(), company: job.company.trim(), jobUrl: requireWebUrl(job.jobUrlDirect ?? job.jobUrl, "job link") };
}

async function saveDiscoveredJob(db: GhostboardDb, value: unknown): Promise<SaveDiscoveredJobResult> {
  const job = normalizedDiscoveredJob(value);
  const allApplications = await db.select().from(applications);
  const jobUrlKey = duplicateKey(job.jobUrl!);
  const existing = allApplications.find((application) => duplicateKey(application.jobUrl) === jobUrlKey);
  if (existing) return { application: existing, alreadySaved: true };

  const now = new Date().toISOString();
  const application: Application = {
    id: crypto.randomUUID(),
    company: job.company!,
    title: job.title!,
    location: job.location,
    jobUrl: job.jobUrl!,
    jobDescription: job.description ?? "",
    status: "found",
    dateFound: now,
    dateApplied: null,
    deadline: null,
    lastActivityAt: now,
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Review job description",
    nextActionDate: null,
    resumeId: null,
    source: `jobspy:${job.site}`,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(async (transaction) => {
    await transaction.insert(applications).values(application);
    await transaction.insert(applicationEvents).values({
      id: crypto.randomUUID(),
      applicationId: application.id,
      type: "created",
      title: "Discovered job saved",
      description: `Saved from ${job.site} through JobSpy`,
      occurredAt: now,
      metadata: { sourceJobId: job.id },
    });
  });
  return { application, alreadySaved: false };
}

async function searchDiscoveredJobs(value: unknown): Promise<DiscoverSearchResponse> {
  if (!value || typeof value !== "object") throw new Error("search preferences are required");
  const request = value as DiscoverSearchRequest;
  const sites = Array.isArray(request.sites) ? request.sites.filter((site) => DISCOVER_SITES.has(site)) : [];
  const searchTerm = typeof request.searchTerm === "string" ? request.searchTerm.trim() : "";
  if (!searchTerm) throw new Error("Tell us which role you want to find");
  if (sites.length === 0) throw new Error("Choose at least one job source");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const sidecarUrl = (process.env.JOBSPY_URL ?? "http://127.0.0.1:8001").replace(/\/$/, "");
  const hoursOld = request.isRemote ? undefined : request.hoursOld;
  const warnings = request.isRemote && request.hoursOld
    ? ["For reliable Indeed remote results, the age filter was relaxed and results were filtered by workplace instead."]
    : [];

  try {
    const alternateTitles = stringList(request.alternateTitles);
    const searchTerms = [...new Set([searchTerm, ...alternateTitles])].slice(0, 3);
    const resultLimit = Math.min(Math.max(request.resultsWanted ?? 24, 1), 50);
    const resultsPerSearch = Math.min(Math.max(Math.ceil(resultLimit / searchTerms.length) + 5, 10), 25);
    const payloads = await Promise.all(searchTerms.map(async (term) => {
      const response = await fetch(`${sidecarUrl}/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          site_name: sites,
          search_term: term,
          google_search_term: `${term} jobs near ${request.location || request.countryIndeed}`,
          location: request.location || null,
          country_indeed: request.countryIndeed || "canada",
          distance: Math.round(Math.min(Math.max(request.distance || 50, 1), 200) / 1.609),
          results_wanted: resultsPerSearch,
          hours_old: hoursOld,
          is_remote: request.isRemote ?? false,
          job_type: request.jobType ?? null,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail ? `JobSpy search failed: ${detail.slice(0, 240)}` : `JobSpy search failed (${response.status})`);
      }
      const payload = await response.json() as DiscoverSearchResponse;
      if (!Array.isArray(payload.results)) throw new Error("JobSpy returned an unexpected response");
      return payload;
    }));

    const uniqueResults = new Map<string, DiscoveredJob>();
    for (const payload of payloads) {
      for (const job of payload.results) uniqueResults.set(`${job.site}:${job.id || job.jobUrl}`, job);
    }
    const rankedResults = rankDiscoveredJobs([...uniqueResults.values()], request).slice(0, resultLimit);
    if (rankedResults.length < uniqueResults.size) warnings.push(`${uniqueResults.size - rankedResults.length} low-fit or excluded roles were removed.`);
    return {
      cached: payloads.every((payload) => payload.cached),
      count: rankedResults.length,
      results: rankedResults,
      warnings: [...warnings, ...payloads.flatMap((payload) => Array.isArray(payload.warnings) ? payload.warnings : [])],
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Job search took too long. Try fewer sources.");
    if (error instanceof Error && error.message.startsWith("JobSpy")) throw error;
    throw new Error("Job discovery is offline. Start the local JobTrail JobSpy service, then try again.");
  } finally {
    clearTimeout(timeout);
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}

function includesTerm(haystack: string, term: string): boolean {
  if (term.length > 3 && !/[+#.]/.test(term)) return haystack.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(haystack);
}

function rankDiscoveredJobs(jobs: DiscoveredJob[], request: DiscoverSearchRequest): DiscoveredJob[] {
  const titleTargets = [request.searchTerm, ...stringList(request.alternateTitles)].map((term) => term.toLowerCase());
  const requiredSkills = stringList(request.requiredSkills);
  const preferredSkills = stringList(request.preferredSkills);
  const industries = stringList(request.preferredIndustries);
  const exclusions = stringList(request.excludedKeywords);
  const timing = stringList(request.timingKeywords);
  const experience = request.experienceLevel?.trim().toLowerCase();

  return jobs.flatMap((job) => {
    const title = (job.title ?? "").toLowerCase();
    const haystack = `${job.title ?? ""} ${job.company ?? ""} ${job.location ?? ""} ${job.description ?? ""} ${job.jobType ?? ""}`.toLowerCase();
    if (exclusions.some((term) => includesTerm(haystack, term))) return [];
    if (request.jobType && job.jobType && !job.jobType.toLowerCase().includes(request.jobType)) return [];

    const matchedRequired = requiredSkills.filter((skill) => includesTerm(haystack, skill));
    if (requiredSkills.length > 0 && matchedRequired.length === 0) return [];
    const matchedPreferred = preferredSkills.filter((skill) => includesTerm(haystack, skill));
    const matchedIndustries = industries.filter((industry) => includesTerm(haystack, industry));
    const matchedTiming = timing.filter((term) => includesTerm(haystack, term));
    const reasons: string[] = [];
    let score = 10;

    const exactTitle = titleTargets.find((target) => title.includes(target));
    if (exactTitle) { score += 35; reasons.push(`Title matches “${exactTitle}”`); }
    else {
      const targetWords = titleTargets.flatMap((target) => target.split(/\s+/)).filter((word) => word.length > 2);
      const wordMatches = [...new Set(targetWords.filter((word) => title.includes(word)))];
      score += Math.min(wordMatches.length * 7, 24);
      if (wordMatches.length) reasons.push(`Related title: ${wordMatches.slice(0, 3).join(", ")}`);
    }
    if (requiredSkills.length) {
      score += Math.round(28 * matchedRequired.length / requiredSkills.length);
      reasons.push(`${matchedRequired.length}/${requiredSkills.length} must-have skills`);
    }
    if (matchedPreferred.length) { score += Math.min(matchedPreferred.length * 4, 12); reasons.push(`Also matches ${matchedPreferred.slice(0, 3).join(", ")}`); }
    if (matchedIndustries.length) { score += 7; reasons.push(`${matchedIndustries[0]} industry`); }
    if (experience && haystack.includes(experience)) { score += 6; reasons.push(`${request.experienceLevel} level`); }
    if (matchedTiming.length) { score += 5; reasons.push(`Timing: ${matchedTiming.slice(0, 2).join(", ")}`); }
    if (request.jobType && job.jobType?.toLowerCase().includes(request.jobType)) score += 5;

    return [{ ...job, matchScore: Math.min(score, 100), matchReasons: reasons.slice(0, 3), matchedSkills: [...matchedRequired, ...matchedPreferred] }];
  }).sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0));
}
