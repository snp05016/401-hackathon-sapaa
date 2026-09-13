import crypto from "node:crypto";
import os from "node:os";
import { WebSocket, WebSocketServer } from "ws";
import {
  applications as applicationsTable,
  applicationEvents as applicationEventsTable,
  gmailSuggestions as gmailSuggestionsTable,
  type GhostboardDb,
} from "@ghostboard/database";
import { eq } from "drizzle-orm";
import {
  SYNC_PATH,
  SYNC_PROTOCOL_VERSION,
  isSyncHelloMessage,
  isSyncClientMessageType,
  type Application,
  type ApplicationEvent,
  type SyncChangeMessage,
  type SyncErrorCode,
  type SyncServerMessage,
  type SyncRecruiterSignal,
  type SyncSnapshotData,
} from "@ghostboard/shared";
import { buildSnapshotData, diffCollection } from "./snapshot";

const SYNC_SERVER_VERSION = "0.1.0";
const POLL_INTERVAL_MS = 1_500;
const HEARTBEAT_INTERVAL_MS = 20_000;
const HANDSHAKE_TIMEOUT_MS = 10_000;

export interface SyncServerOptions {
  db: GhostboardDb;
  token: string;
  port: number;
}

export interface SyncServerInfo {
  port: number;
  sessionId: string;
  /** LAN addresses the phone can reach this Mac on. */
  addresses: string[];
}

export interface SyncServer {
  readonly info: SyncServerInfo;
  /** Resolves only after the WebSocket is accepting connections. */
  readonly ready: Promise<SyncServerInfo>;
  close(): Promise<void>;
}

/** Non-internal IPv4 addresses, which is what an iPhone on the same Wi-Fi can dial. */
export function localNetworkAddresses(): string[] {
  const addresses: Array<{ address: string; interfaceName: string }> = [];
  for (const [interfaceName, interfaces] of Object.entries(os.networkInterfaces())) {
    for (const entry of interfaces ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      // A self-assigned address is not routable from an iPhone on Wi-Fi and
      // commonly appears beside the real address on macOS USB interfaces.
      if (entry.address.startsWith("169.254.")) continue;
      addresses.push({ address: entry.address, interfaceName });
    }
  }
  return addresses
    .sort((left, right) => interfacePriority(left.interfaceName) - interfacePriority(right.interfaceName))
    .map((entry) => entry.address);
}

function interfacePriority(interfaceName: string): number {
  if (interfaceName === "en0" || /^(wi-?fi|wlan)/i.test(interfaceName)) return 0;
  if (/^(en|eth)/i.test(interfaceName)) return 1;
  if (/^(utun|awdl|llw|bridge|docker|vbox|vmnet)/i.test(interfaceName)) return 3;
  return 2;
}

function timingSafeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf-8");
  const rightBuffer = Buffer.from(right, "utf-8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

interface SyncConnection {
  socket: WebSocket;
  authenticated: boolean;
  /** True only once this client holds a snapshot; gates change broadcasts. */
  ready: boolean;
  awaitingPong: boolean;
  handshakeTimer: NodeJS.Timeout | undefined;
}

/**
 * Serves the read-only companion synchronization channel.
 *
 * Unlike the extension bridge this listens on the LAN, because a phone cannot
 * reach loopback on the desktop. Every connection must present the bridge token
 * before receiving any data, and no client message can mutate product data.
 */
export function createSyncServer({ db, token, port }: SyncServerOptions): SyncServer {
  const sessionId = crypto.randomUUID();
  let revision = 0;
  let lastApplications: Application[] = [];
  let lastEvents: ApplicationEvent[] = [];
  let lastSnapshot: SyncSnapshotData | null = null;
  let closed = false;
  let readinessSettled = false;
  let serverInfo: SyncServerInfo = { port, sessionId, addresses: [] };
  let workQueue: Promise<void> = Promise.resolve();
  let pollTimer: NodeJS.Timeout | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let closePromise: Promise<void> | undefined;

  const connections = new Set<SyncConnection>();
  const server = new WebSocketServer({ host: "0.0.0.0", path: SYNC_PATH, port, maxPayload: 16 * 1024 });
  let resolveReady: (info: SyncServerInfo) => void = () => undefined;
  let rejectReady: (error: Error) => void = () => undefined;
  const ready = new Promise<SyncServerInfo>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  server.once("listening", () => {
    if (closed) return;
    const address = server.address();
    if (!address || typeof address === "string") {
      readinessSettled = true;
      rejectReady(new Error("Sync server did not report a listening port."));
      return;
    }
    serverInfo = { port: address.port, sessionId, addresses: localNetworkAddresses() };
    readinessSettled = true;
    startMaintenanceTimers();
    resolveReady(serverInfo);
  });

  server.on("error", (error) => {
    if (!readinessSettled) {
      readinessSettled = true;
      rejectReady(error);
      return;
    }
    console.error("[sync] server error:", error instanceof Error ? error.message : "unknown server error");
  });

  function send(socket: WebSocket, message: SyncServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }

  function sendError(socket: WebSocket, code: SyncErrorCode, message: string): void {
    send(socket, { type: "sync-error", code, message });
  }

  async function readState(): Promise<{
    applications: Application[];
    events: ApplicationEvent[];
    recruiterSignals: SyncRecruiterSignal[];
  }> {
    const [applications, events, suggestions] = await Promise.all([
      db.select().from(applicationsTable),
      db.select().from(applicationEventsTable),
      db.select().from(gmailSuggestionsTable).where(eq(gmailSuggestionsTable.decision, "pending")),
    ]);
    const recruiterSignals: SyncRecruiterSignal[] = suggestions.map((row) => ({
      id: row.id,
      subject: row.suggestion.subject,
      sender: row.suggestion.sender,
      receivedAt: row.suggestion.receivedAt,
      newStatus: row.suggestion.newStatus,
      confidence: row.suggestion.confidence,
      evidence: row.suggestion.evidence,
      candidateApplicationIds: (row.suggestion.candidates ?? []).map((candidate) => candidate.applicationId),
    }));
    return {
      applications: applications as Application[],
      events: events as ApplicationEvent[],
      recruiterSignals,
    };
  }

  /**
   * Serializes every operation that reads or advances shared sync state, so a
   * poll can never interleave with a handshake or a snapshot request. Without
   * this the revision stamped on a frame can disagree with the data in it.
   */
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = workQueue.then(work);
    workQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  function broadcast(message: SyncServerMessage): void {
    for (const connection of connections) {
      if (!connection.ready) continue;
      send(connection.socket, message);
    }
  }

  /**
   * Brings the baseline up to date (broadcasting any delta so other clients
   * stay in step) and then sends this client the snapshot with the matching
   * revision. Data and revision are captured with no await between them.
   */
  async function serveSnapshot(socket: WebSocket, includeWelcome: boolean): Promise<void> {
    await pollForChanges();
    const data = lastSnapshot ?? (await refreshBaseline());
    const currentRevision = revision;
    const generatedAt = new Date().toISOString();

    if (includeWelcome) {
      send(socket, {
        type: "sync-welcome",
        protocolVersion: SYNC_PROTOCOL_VERSION,
        serverVersion: SYNC_SERVER_VERSION,
        sessionId,
        revision: currentRevision,
      });
    }
    send(socket, { type: "sync-snapshot", sessionId, revision: currentRevision, generatedAt, data });
  }

  async function refreshBaseline(): Promise<SyncSnapshotData> {
    const { applications, events, recruiterSignals } = await readState();
    lastApplications = applications;
    lastEvents = events;
    lastSnapshot = buildSnapshotData(applications, events, recruiterSignals);
    return lastSnapshot;
  }

  /**
   * Derived state (staleness, follow-ups, deadlines) changes with the clock and
   * not only with the database, so the change marker covers both.
   */
  function derivedFingerprint(snapshot: SyncSnapshotData): string {
    return JSON.stringify([
      snapshot.staleness,
      snapshot.deadlines,
      snapshot.followUps,
      snapshot.today,
      snapshot.duplicateGroups,
      snapshot.recruiterSignals,
      snapshot.analytics,
    ]);
  }

  async function pollForChanges(): Promise<void> {
    if (closed) return;
    const { applications, events, recruiterSignals } = await readState();
    const applicationDiff = diffCollection(
      lastApplications,
      applications,
      (item) => `${item.updatedAt}:${item.status}:${item.deadline ?? ""}:${item.followUpOn}:${item.lastActivityAt}`
    );
    const eventDiff = diffCollection(
      lastEvents,
      events,
      (item) => `${item.occurredAt}:${item.type}:${item.title}`
    );
    const signalIds = recruiterSignals.map((signal) => signal.id).sort().join(",");
    const previousSnapshot = lastSnapshot;

    lastApplications = applications;
    lastEvents = events;
    lastSnapshot = buildSnapshotData(applications, events, recruiterSignals);

    if (!previousSnapshot) return;

    const previousSignalIds = previousSnapshot.recruiterSignals
      .map((signal) => signal.id)
      .sort()
      .join(",");
    const hasChange =
      applicationDiff.upserted.length > 0 ||
      applicationDiff.deletedIds.length > 0 ||
      eventDiff.upserted.length > 0 ||
      eventDiff.deletedIds.length > 0 ||
      signalIds !== previousSignalIds ||
      derivedFingerprint(previousSnapshot) !== derivedFingerprint(lastSnapshot);
    if (!hasChange) return;

    revision += 1;
    const message: SyncChangeMessage = {
      type: "sync-change",
      sessionId,
      revision,
      changedAt: new Date().toISOString(),
      applications: applicationDiff,
      events: eventDiff,
      staleness: lastSnapshot.staleness,
      deadlines: lastSnapshot.deadlines,
      today: lastSnapshot.today,
      followUps: lastSnapshot.followUps,
      duplicateGroups: lastSnapshot.duplicateGroups,
      recruiterSignals: lastSnapshot.recruiterSignals,
      analytics: lastSnapshot.analytics,
    };
    broadcast(message);
  }

  function startMaintenanceTimers(): void {
    pollTimer = setInterval(() => {
      void serialize(pollForChanges).catch((error) => {
        console.error("[sync] poll failed:", error instanceof Error ? error.message : error);
      });
    }, POLL_INTERVAL_MS);

    heartbeatTimer = setInterval(() => {
      const at = new Date().toISOString();
      for (const connection of connections) {
        if (!connection.ready) continue;
        if (connection.awaitingPong) {
          connection.socket.terminate();
          continue;
        }
        connection.awaitingPong = true;
        send(connection.socket, { type: "sync-ping", at });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  server.on("connection", (socket) => {
    const connection: SyncConnection = {
      socket,
      authenticated: false,
      ready: false,
      awaitingPong: false,
      handshakeTimer: undefined,
    };
    connections.add(connection);

    connection.handshakeTimer = setTimeout(() => {
      if (!connection.authenticated) socket.close(4401, "handshake timeout");
    }, HANDSHAKE_TIMEOUT_MS);

    socket.on("message", (rawMessage, isBinary) => {
      if (isBinary) return;
      let message: unknown;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        sendError(socket, "malformed", "Expected a JSON text frame");
        return;
      }

      void serialize(async () => {
        if (!connection.authenticated) {
          if (!isSyncHelloMessage(message)) {
            sendError(socket, "unauthorized", "Expected sync-hello");
            socket.close(4401, "unauthorized");
            return;
          }
          if (message.protocolVersion !== SYNC_PROTOCOL_VERSION) {
            sendError(
              socket,
              "protocol_version_mismatch",
              `Server speaks protocol ${SYNC_PROTOCOL_VERSION}, client sent ${message.protocolVersion}`
            );
            socket.close(4426, "protocol version mismatch");
            return;
          }
          if (!timingSafeEquals(message.token, token)) {
            sendError(socket, "unauthorized", "Invalid pairing token");
            socket.close(4401, "unauthorized");
            return;
          }

          connection.authenticated = true;
          if (connection.handshakeTimer) clearTimeout(connection.handshakeTimer);
          connection.handshakeTimer = undefined;
          console.log("[sync] client authenticated");

          await serveSnapshot(socket, true);
          // Only now may this client receive change frames: a change that
          // arrived before its snapshot would read as an unrecoverable gap.
          connection.ready = true;
          return;
        }

        if (isSyncClientMessageType(message, "sync-pong")) {
          connection.awaitingPong = false;
          return;
        }

        if (isSyncClientMessageType(message, "sync-request-snapshot")) {
          await serveSnapshot(socket, false);
          connection.ready = true;
          return;
        }

        // Unknown frames are ignored rather than fatal, so a newer client can
        // add messages without breaking this server.
      }).catch((error: unknown) => {
        console.error("[sync] message handling failed:", error instanceof Error ? error.message : error);
        sendError(socket, "internal", "Request could not be served");
      });
    });

    socket.on("close", () => {
      if (connection.handshakeTimer) clearTimeout(connection.handshakeTimer);
      connections.delete(connection);
    });

    socket.on("error", () => {
      socket.terminate();
    });
  });

  return {
    get info() {
      return serverInfo;
    },
    ready,
    close() {
      if (closePromise) return closePromise;
      closed = true;
      if (!readinessSettled) {
        readinessSettled = true;
        rejectReady(new Error("Sync server closed before becoming ready."));
      }
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      pollTimer = undefined;
      heartbeatTimer = undefined;
      for (const connection of connections) {
        if (connection.handshakeTimer) clearTimeout(connection.handshakeTimer);
        connection.handshakeTimer = undefined;
        connection.socket.terminate();
      }
      connections.clear();
      closePromise = new Promise((resolve) => {
        // Closing before `listening` reports ERR_SERVER_NOT_RUNNING through the
        // callback. Resources are already released, so shutdown still succeeds.
        server.close(() => resolve());
      });
      return closePromise;
    },
  };
}
