import http from "node:http";
import type { GhostboardDb } from "@ghostboard/database";
import type { BridgeErrorResponse, HealthResponse } from "@ghostboard/shared";
import { handleGetProfile, handleCreateJob, handleIngestJob, handleUpsertApplication, handlePageContext } from "./routes";

const BRIDGE_VERSION = "0.1.0";
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopback(address: string | undefined): boolean {
  return !!address && LOOPBACK_ADDRESSES.has(address);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, origin: string | undefined): void {
  // Only the extension origin gets CORS access — never fall back to "*",
  // which would let any webpage the user has open read bridge responses.
  const headers: http.OutgoingHttpHeaders = { "content-type": "application/json" };
  if (origin && origin.startsWith("chrome-extension://")) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "authorization, content-type";
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

async function readBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

export function createBridgeServer(db: GhostboardDb, token: string, port: number): http.Server {
  const server = http.createServer((req, res) => {
    void (async () => {
      const origin = req.headers.origin;

      if (!isLoopback(req.socket.remoteAddress)) {
        res.writeHead(403).end();
        return;
      }

      if (req.method === "OPTIONS") {
        sendJson(res, 204, {}, origin);
        return;
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/health") {
        const body: HealthResponse = { ok: true, version: BRIDGE_VERSION };
        sendJson(res, 200, body, origin);
        return;
      }

      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${token}`) {
        const body: BridgeErrorResponse = { error: "unauthorized" };
        sendJson(res, 401, body, origin);
        return;
      }

      try {
        if (req.method === "GET" && url.pathname === "/profile") {
          sendJson(res, 200, handleGetProfile(), origin);
          return;
        }

        if (req.method === "POST" && url.pathname === "/jobs") {
          const body = await readBody(req);
          sendJson(res, 200, await handleCreateJob(db, body as never), origin);
          return;
        }

        if (req.method === "POST" && url.pathname === "/job-intelligence/ingest") {
          const body = await readBody(req);
          sendJson(res, 200, await handleIngestJob(body as never), origin);
          return;
        }

        if (req.method === "POST" && url.pathname === "/applications") {
          const body = await readBody(req);
          sendJson(res, 200, await handleUpsertApplication(db, body as never), origin);
          return;
        }

        if (req.method === "POST" && url.pathname === "/page-context") {
          const body = await readBody(req);
          sendJson(res, 200, handlePageContext(body as never), origin);
          return;
        }

        const notFound: BridgeErrorResponse = { error: "not_found" };
        sendJson(res, 404, notFound, origin);
      } catch (err) {
        const errorBody: BridgeErrorResponse = { error: err instanceof Error ? err.message : "internal_error" };
        sendJson(res, 500, errorBody, origin);
      }
    })();
  });

  // Bind loopback only — never 0.0.0.0.
  server.listen(port, "127.0.0.1");
  return server;
}
