import type { JobExtractionDraft, JobProvider, JobProviderName, ProviderFetchContext } from "./types";

function pathParts(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

export function detectProvider(rawUrl: string): JobProviderName {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return "generic"; }
  const host = url.hostname.toLowerCase();
  if (host.endsWith("greenhouse.io") || url.searchParams.has("gh_jid")) return "greenhouse";
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") return "lever";
  if (host.endsWith("myworkdayjobs.com")) return "workday";
  if (host === "jobs.ashbyhq.com") return "ashby";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "indeed.com" || host.endsWith(".indeed.com")) return "indeed";
  return "generic";
}

export function extractSourceJobId(rawUrl: string, provider = detectProvider(rawUrl)): string | null {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  const parts = pathParts(url);
  if (provider === "greenhouse") return url.searchParams.get("gh_jid") || parts.at(-1)?.match(/^\d+$/)?.[0] || null;
  if (provider === "lever" || provider === "ashby") return parts[1] ?? null;
  if (provider === "workday") return parts.at(-1)?.match(/(?:_|-)([A-Za-z]?\d{5,})$/)?.[1] || parts.at(-1) || null;
  if (provider === "linkedin") return url.searchParams.get("currentJobId") || parts.at(-1)?.match(/(\d{6,})$/)?.[1] || null;
  if (provider === "indeed") return url.searchParams.get("jk") || url.searchParams.get("vjk") || null;
  return null;
}

async function jsonResponse(fetcher: typeof globalThis.fetch, url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetcher(url, { ...init, redirect: "manual" });
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

function formatSalary(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const salary = value as Record<string, unknown>;
  const min = Number(salary.minValue);
  const max = Number(salary.maxValue);
  const currency = typeof salary.currency === "string" ? salary.currency.toUpperCase() : "";
  if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
  const low = Number.isFinite(min) ? min : max;
  const high = Number.isFinite(max) ? max : min;
  const interval = typeof salary.interval === "string" ? salary.interval.trim().toLowerCase().replace(/^1\s+/, "") : "";
  return `${currency ? `${currency} ` : ""}${low.toLocaleString("en-US")}–${high.toLocaleString("en-US")}${interval ? ` / ${interval}` : ""}`;
}

const greenhouse: JobProvider = {
  name: "greenhouse",
  matches: (url) => detectProvider(url.href) === "greenhouse",
  sourceJobId: (url) => extractSourceJobId(url.href, "greenhouse"),
  async fetch(url, context) {
    const parts = pathParts(url);
    const boardIndex = parts.findIndex((part) => part === "jobs");
    const board = boardIndex > 0 ? parts[boardIndex - 1] : parts[0];
    const id = this.sourceJobId(url);
    if (!board || !id || !/^\d+$/.test(id)) return null;
    const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(id)}`;
    const payload = await jsonResponse(context.fetch, endpoint) as Record<string, unknown> | null;
    if (!payload) return null;
    const location = payload.location && typeof payload.location === "object"
      ? (payload.location as Record<string, unknown>).name
      : null;
    return {
      source: "greenhouse",
      sourceJobId: id,
      url: typeof payload.absolute_url === "string" ? payload.absolute_url : url.href,
      title: typeof payload.title === "string" ? payload.title : null,
      location: typeof location === "string" ? location : null,
      description: typeof payload.content === "string" ? payload.content : null,
      postedAt: typeof payload.first_published === "string"
        ? payload.first_published
        : typeof payload.updated_at === "string" ? payload.updated_at : null,
    };
  },
};

const lever: JobProvider = {
  name: "lever",
  matches: (url) => detectProvider(url.href) === "lever",
  sourceJobId: (url) => extractSourceJobId(url.href, "lever"),
  async fetch(url, context) {
    const [organization, id] = pathParts(url);
    if (!organization || !id) return null;
    const apiHost = url.hostname === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co";
    const payload = await jsonResponse(context.fetch, `https://${apiHost}/v0/postings/${encodeURIComponent(organization)}/${encodeURIComponent(id)}`) as Record<string, unknown> | null;
    if (!payload) return null;
    const categories = payload.categories && typeof payload.categories === "object" ? payload.categories as Record<string, unknown> : {};
    const lists = Array.isArray(payload.lists) ? payload.lists : [];
    const listText = lists.map((list) => {
      if (!list || typeof list !== "object") return "";
      const record = list as Record<string, unknown>;
      return `${String(record.text ?? "")}\n${String(record.content ?? "")}`;
    }).join("\n");
    return {
      source: "lever",
      sourceJobId: id,
      url: typeof payload.hostedUrl === "string" ? payload.hostedUrl : url.href,
      title: typeof payload.text === "string" ? payload.text : null,
      location: typeof categories.location === "string" ? categories.location : null,
      employmentType: typeof categories.commitment === "string" ? categories.commitment : null,
      description: typeof payload.descriptionPlain === "string"
        ? `${payload.descriptionPlain}\n${listText}`
        : `${String(payload.description ?? "")}\n${listText}`,
      postedAt: typeof payload.createdAt === "number" ? new Date(payload.createdAt).toISOString() : null,
    };
  },
};

function workdayEndpoint(url: URL): string | null {
  const match = `${url.hostname}${url.pathname}`.match(/^([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)\/job\/(.+?)\/?$/);
  if (!match) return null;
  const [, tenant, shard, site, jobPath] = match;
  if (jobPath.split("/").some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part.includes(".."))) return null;
  return `https://${tenant}.${shard}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/job/${jobPath}`;
}

const workday: JobProvider = {
  name: "workday",
  matches: (url) => detectProvider(url.href) === "workday",
  sourceJobId: (url) => extractSourceJobId(url.href, "workday"),
  async fetch(url, context) {
    const endpoint = workdayEndpoint(url);
    if (!endpoint) return null;
    const payload = await jsonResponse(context.fetch, endpoint, { headers: { accept: "application/json" } }) as Record<string, unknown> | null;
    const info = payload?.jobPostingInfo && typeof payload.jobPostingInfo === "object" ? payload.jobPostingInfo as Record<string, unknown> : null;
    if (!info) return null;
    const additional = Array.isArray(info.additionalLocations) ? info.additionalLocations : [];
    return {
      source: "workday",
      sourceJobId: typeof info.jobReqId === "string" ? info.jobReqId : this.sourceJobId(url),
      url: url.href,
      company: typeof info.company === "string" ? info.company : null,
      title: typeof info.title === "string" ? info.title : null,
      location: [info.location, ...additional].filter((item): item is string => typeof item === "string" && !!item.trim()).join(" · ") || null,
      employmentType: typeof info.timeType === "string" ? info.timeType : null,
      description: typeof info.jobDescription === "string" ? info.jobDescription : null,
      postedAt: typeof info.postedOn === "string" ? info.postedOn : null,
    };
  },
};

const ashby: JobProvider = {
  name: "ashby",
  matches: (url) => detectProvider(url.href) === "ashby",
  sourceJobId: (url) => extractSourceJobId(url.href, "ashby"),
  async fetch(url, context) {
    const [organization, id] = pathParts(url);
    if (!organization || !id) return null;
    const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(organization)}?includeCompensation=true`;
    const payload = await jsonResponse(context.fetch, endpoint) as Record<string, unknown> | null;
    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    const job = jobs.find((item) => item && typeof item === "object" && String((item as Record<string, unknown>).id).toLowerCase() === id.toLowerCase()) as Record<string, unknown> | undefined;
    if (!job) return null;
    const secondary = Array.isArray(job.secondaryLocations) ? job.secondaryLocations : [];
    const locations = [job.location, ...secondary.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).location : null)]
      .filter((item): item is string => typeof item === "string" && !!item.trim());
    if ((String(job.workplaceType).toLowerCase() === "remote" || job.isRemote === true) && !locations.some((item) => /remote/i.test(item))) locations.push("Remote");
    return {
      source: "ashby",
      sourceJobId: id,
      url: typeof job.jobUrl === "string" ? job.jobUrl : url.href,
      company: typeof job.organizationName === "string" ? job.organizationName : null,
      title: typeof job.title === "string" ? job.title : null,
      location: [...new Set(locations)].join(" · ") || null,
      employmentType: typeof job.employmentType === "string" ? job.employmentType : null,
      description: typeof job.descriptionPlain === "string" ? job.descriptionPlain : null,
      salaryRange: formatSalary(job.compensation),
      postedAt: typeof job.publishedAt === "string" ? job.publishedAt : null,
    };
  },
};

const passive = (name: JobProviderName): JobProvider => ({
  name,
  matches: (url) => detectProvider(url.href) === name,
  sourceJobId: (url) => extractSourceJobId(url.href, name),
});

export const providers: JobProvider[] = [greenhouse, lever, workday, ashby, passive("linkedin"), passive("indeed"), passive("generic")];

export function providerFor(url: URL): JobProvider {
  return providers.find((provider) => provider.matches(url)) ?? providers.at(-1)!;
}

export async function fetchProviderDraft(url: URL, context: ProviderFetchContext): Promise<JobExtractionDraft | null> {
  return providerFor(url).fetch?.(url, context) ?? null;
}
