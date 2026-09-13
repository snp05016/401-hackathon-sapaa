import type { Application, ApplicationEvent } from "../types/application";

/**
 * Read-only synchronization channel consumed by the Ghostboard iOS companion.
 *
 * This is a separate endpoint from the extension bridge: the extension bridge
 * is loopback-only by design, and a phone can never reach loopback on the Mac.
 * The sync channel therefore binds to the LAN, is token authenticated, and
 * never accepts a product-data mutation.
 */
export const SYNC_PROTOCOL_VERSION = 1;
export const SYNC_DEFAULT_PORT = 4175;
export const SYNC_PATH = "/sync";

export type SyncStage = "found" | "applied" | "interviewing" | "offer" | "rejected" | "ghosted";

export interface SyncStageCount {
  stage: SyncStage;
  count: number;
}

/** Metrics computed once on the desktop so every client reports identical numbers. */
export interface SyncAnalytics {
  totalApplications: number;
  stageCounts: SyncStageCount[];
  appliedThisWeek: number;
  appliedLast7Days: number[];
  activeApplications: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  staleCount: number;
  averageDaysToFirstResponse: number | null;
  sourceCounts: { source: string; count: number }[];
}

export interface SyncDeadline {
  applicationId: string;
  color: "green" | "yellow" | "red" | "none";
  daysRemaining: number | null;
  label: string;
}

/** The exact figures the desktop "Today" screen renders. */
export interface SyncTodaySummary {
  total: number;
  applied: number;
  interviewing: number;
  dueToday: number;
  upcoming: number;
  overdue: number;
  noDeadline: number;
  followUpOn: number;
}

/** A pending Gmail-derived status suggestion, surfaced read-only. */
export interface SyncRecruiterSignal {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  newStatus: SyncStage | null;
  confidence: number;
  evidence: string;
  candidateApplicationIds: string[];
}

/** A follow-up the desktop recommends, with its copyable message template. */
export interface SyncFollowUp {
  applicationId: string;
  company: string;
  title: string;
  kind: "application" | "interview" | "thank_you";
  kindLabel: string;
  messageTitle: string;
  messageDescription: string;
  messageBody: string;
}

/** A job saved from more than one website, as the desktop Tracking page groups them. */
export interface SyncDuplicateGroup {
  key: string;
  company: string;
  title: string;
  sources: string[];
  copies: { applicationId: string; source: string; savedAt: string }[];
}

export interface SyncStaleness {
  applicationId: string;
  isStale: boolean;
  daysSinceLastActivity: number;
  suggestedAction: string | null;
}

export interface SyncSnapshotData {
  applications: Application[];
  events: ApplicationEvent[];
  staleness: SyncStaleness[];
  deadlines: SyncDeadline[];
  today: SyncTodaySummary;
  followUps: SyncFollowUp[];
  duplicateGroups: SyncDuplicateGroup[];
  recruiterSignals: SyncRecruiterSignal[];
  analytics: SyncAnalytics;
}

export interface SyncHelloMessage {
  type: "sync-hello";
  protocolVersion: number;
  token: string;
  clientId: string;
}

export interface SyncRequestSnapshotMessage {
  type: "sync-request-snapshot";
}

export interface SyncPongMessage {
  type: "sync-pong";
}

export type SyncClientMessage = SyncHelloMessage | SyncRequestSnapshotMessage | SyncPongMessage;

export interface SyncWelcomeMessage {
  type: "sync-welcome";
  protocolVersion: number;
  serverVersion: string;
  /** Changes across a server restart, telling the client its revisions are void. */
  sessionId: string;
  revision: number;
}

export type SyncErrorCode = "unauthorized" | "protocol_version_mismatch" | "malformed" | "internal";

export interface SyncErrorMessage {
  type: "sync-error";
  code: SyncErrorCode;
  message: string;
}

export interface SyncSnapshotMessage {
  type: "sync-snapshot";
  sessionId: string;
  revision: number;
  generatedAt: string;
  data: SyncSnapshotData;
}

export interface SyncChangeMessage {
  type: "sync-change";
  sessionId: string;
  revision: number;
  changedAt: string;
  applications: { upserted: Application[]; deletedIds: string[] };
  events: { upserted: ApplicationEvent[]; deletedIds: string[] };
  staleness: SyncStaleness[];
  deadlines: SyncDeadline[];
  today: SyncTodaySummary;
  followUps: SyncFollowUp[];
  duplicateGroups: SyncDuplicateGroup[];
  recruiterSignals: SyncRecruiterSignal[];
  analytics: SyncAnalytics;
}

export interface SyncPingMessage {
  type: "sync-ping";
  at: string;
}

export type SyncServerMessage =
  | SyncWelcomeMessage
  | SyncErrorMessage
  | SyncSnapshotMessage
  | SyncChangeMessage
  | SyncPingMessage;

export function isSyncHelloMessage(message: unknown): message is SyncHelloMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as { type?: unknown; protocolVersion?: unknown; token?: unknown; clientId?: unknown };
  return (
    candidate.type === "sync-hello" &&
    typeof candidate.protocolVersion === "number" &&
    Number.isInteger(candidate.protocolVersion) &&
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.clientId === "string" &&
    candidate.clientId.length > 0
  );
}

export function isSyncClientMessageType(message: unknown, type: SyncClientMessage["type"]): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === type;
}
