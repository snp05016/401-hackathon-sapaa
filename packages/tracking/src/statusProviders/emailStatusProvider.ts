import type { Application, ApplicationStatusProvider, ApplicationStatusUpdate } from "@ghostboard/shared";

export const GMAIL_METADATA_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users";
const DEFAULT_MAX_RESULTS = 50;
const DEFAULT_LOOKBACK_DAYS = 90;

interface GmailMessageReference {
  id: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
}

interface GmailMessageList {
  messages?: GmailMessageReference[];
}

export interface GmailStatusProviderOptions {
  getAccessToken: () => string | Promise<string>;
  fetch?: typeof fetch;
  userId?: string;
  maxResults?: number;
  lookbackDays?: number;
  now?: () => Date;
}

interface ClassifiedStatus {
  status: "interviewing" | "rejected";
  confidence: number;
}

const REJECTION_PATTERNS = [
  /\bregret to inform\b/i,
  /\b(?:will|are|have|were) not (?:be )?moving forward\b/i,
  /\bnot selected\b/i,
  /\bposition has been filled\b/i,
  /\b(?:move|moving|proceed) forward with (?:an)?other candidates?\b/i,
  /\bunable to offer you (?:the|a) (?:role|position)\b/i,
];

const INTERVIEW_PATTERNS = [
  /\binterview invitation\b/i,
  /\binvit(?:e|ed|ation).*\binterview\b/i,
  /\bschedul(?:e|ing).*\b(?:interview|phone screen|screening call)\b/i,
  /\b(?:interview|phone screen|screening call).*\bschedul(?:e|ing)\b/i,
  /\bnext steps?.*\b(?:interview|phone screen|call)\b/i,
];

function classifyStatus(text: string): ClassifiedStatus | null {
  if (REJECTION_PATTERNS.some((pattern) => pattern.test(text))) return { status: "rejected", confidence: 0.96 };
  if (INTERVIEW_PATTERNS.some((pattern) => pattern.test(text))) return { status: "interviewing", confidence: 0.92 };
  return null;
}

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value.trim() ?? "";
}

function normalizedWords(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1 && !["the", "and", "for", "inc", "ltd", "llc", "corp", "company"].includes(word));
}

function overlapRatio(expected: string[], actual: Set<string>): number {
  if (!expected.length) return 0;
  return expected.filter((word) => actual.has(word)).length / expected.length;
}

function applicationMatchScore(application: Application, messageText: string): number {
  const actual = new Set(normalizedWords(messageText));
  const company = normalizedWords(application.company);
  const title = normalizedWords(application.title).filter(
    (word) => !["engineer", "developer", "manager", "intern"].includes(word),
  );
  const companyScore = overlapRatio(company, actual);
  const titleScore = title.length ? overlapRatio(title, actual) : 0;
  return companyScore * 0.75 + titleScore * 0.25;
}

function matchingApplication(
  applications: Application[],
  messageText: string,
): { application: Application; score: number } | null {
  const matches = applications
    .map((application) => ({ application, score: applicationMatchScore(application, messageText) }))
    .filter((match) => match.score >= 0.55)
    .sort((left, right) => right.score - left.score || left.application.id.localeCompare(right.application.id));
  if (!matches.length) return null;
  if (matches[1] && matches[0].score - matches[1].score < 0.1) return null;
  return matches[0];
}

function canTransition(application: Application, nextStatus: ClassifiedStatus["status"]): boolean {
  if (application.status === nextStatus) return false;
  if (nextStatus === "interviewing") return ["found", "applied", "ghosted"].includes(application.status);
  return application.status !== "offer";
}

async function responseJson<T>(fetcher: typeof fetch, url: URL, token: string): Promise<T> {
  const response = await fetcher(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Gmail API request failed (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  return response.json() as Promise<T>;
}

interface ResolvedGmailOptions {
  getAccessToken: () => string | Promise<string>;
  fetch: typeof fetch;
  userId: string;
  maxResults: number;
  lookbackDays: number;
  now: () => Date;
}

async function loadMessages(options: ResolvedGmailOptions): Promise<GmailMessage[]> {
  const token = (await options.getAccessToken()).trim();
  if (!token) throw new Error("A Gmail OAuth access token is required.");

  const user = encodeURIComponent(options.userId);
  const listUrl = new URL(`${GMAIL_API_BASE}/${user}/messages`);
  // gmail.metadata cannot use Gmail's q parameter, so bound the inbox read and
  // classify only the returned headers locally instead of requesting bodies.
  listUrl.searchParams.set("labelIds", "INBOX");
  listUrl.searchParams.set("maxResults", String(Math.min(100, Math.max(1, options.maxResults))));
  listUrl.searchParams.set("includeSpamTrash", "false");
  const listed = await responseJson<GmailMessageList>(options.fetch, listUrl, token);

  const messages = await Promise.all((listed.messages ?? []).map((reference) => {
    const messageUrl = new URL(`${GMAIL_API_BASE}/${user}/messages/${encodeURIComponent(reference.id)}`);
    messageUrl.searchParams.set("format", "METADATA");
    messageUrl.searchParams.append("metadataHeaders", "Subject");
    messageUrl.searchParams.append("metadataHeaders", "From");
    messageUrl.searchParams.append("metadataHeaders", "Date");
    return responseJson<GmailMessage>(options.fetch, messageUrl, token);
  }));

  const oldest = options.now().getTime() - options.lookbackDays * 24 * 60 * 60 * 1000;
  return messages.filter((message) => {
    if (!message.internalDate) return true;
    const receivedAt = Number(message.internalDate);
    return Number.isFinite(receivedAt) && receivedAt >= oldest;
  });
}

export function createEmailStatusProvider(options: GmailStatusProviderOptions): ApplicationStatusProvider {
  const resolved: ResolvedGmailOptions = {
    getAccessToken: options.getAccessToken,
    fetch: options.fetch ?? fetch,
    userId: options.userId ?? "me",
    maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
    lookbackDays: options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
    now: options.now ?? (() => new Date()),
  };

  return {
    name: "gmail",
    async checkForUpdates(applications: Application[]): Promise<ApplicationStatusUpdate[]> {
      if (!applications.length) return [];
      const messages = await loadMessages(resolved);
      const updates = new Map<string, ApplicationStatusUpdate>();

      for (const message of messages) {
        const subject = header(message, "Subject");
        const sender = header(message, "From");
        const classificationText = `${subject}\n${sender}\n${message.snippet ?? ""}`;
        const classification = classifyStatus(classificationText);
        if (!classification) continue;
        const match = matchingApplication(applications, classificationText);
        if (!match || updates.has(match.application.id) || !canTransition(match.application, classification.status)) continue;

        updates.set(match.application.id, {
          applicationId: match.application.id,
          newStatus: classification.status,
          confidence: Number((classification.confidence * match.score).toFixed(3)),
          evidence: `Gmail subject "${subject.slice(0, 160)}"${sender ? ` from ${sender.slice(0, 120)}` : ""}`,
        });
      }

      return [...updates.values()];
    },
  };
}

export const emailStatusProvider = createEmailStatusProvider({
  // OAuth acquisition and refresh stay at the application boundary. This
  // environment token is a development seam and is never persisted here.
  getAccessToken: () => process.env.GMAIL_ACCESS_TOKEN ?? "",
});
