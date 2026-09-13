import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { runMigrations } from "@ghostboard/database";
import * as schema from "../../../../packages/database/src/schema";
import type { GhostboardDb } from "@ghostboard/database";
import { readSyncPairingInfo, setSyncServerDisabled, setSyncServerInfo, setSyncServerUnavailable } from "./info";
import { createSyncServer } from "./server";

const migrations = fileURLToPath(new URL("../../../../packages/database/migrations/", import.meta.url));
const unusedDatabase = {} as GhostboardDb;

test("ready resolves only after listening and reports an ephemeral port", async () => {
  const server = createSyncServer({ db: unusedDatabase, token: "synthetic-token", port: 0 });

  const info = await server.ready;

  assert.ok(info.port > 0);
  assert.equal(server.info.port, info.port);
  await server.close();
});

test("a port collision rejects readiness and both servers close cleanly", async () => {
  const owner = createSyncServer({ db: unusedDatabase, token: "synthetic-token", port: 0 });
  const ownerInfo = await owner.ready;
  const contender = createSyncServer({ db: unusedDatabase, token: "synthetic-token", port: ownerInfo.port });

  await assert.rejects(contender.ready, /EADDRINUSE|address already in use/i);
  await contender.close();
  await owner.close();
});

test("close is safe before readiness and releases startup resources", async () => {
  const server = createSyncServer({ db: unusedDatabase, token: "synthetic-token", port: 0 });
  const readiness = server.ready.then(
    () => "ready",
    () => "closed"
  );

  await server.close();

  assert.equal(await readiness, "closed");
  await server.close();
});

test("pairing info reads current addresses and hides credentials when unavailable", () => {
  let addresses = ["192.168.1.20"];
  setSyncServerInfo(
    { port: 4_175, sessionId: "session", addresses: [] },
    "synthetic-token",
    () => addresses
  );

  assert.deepEqual(readSyncPairingInfo(), {
    enabled: true,
    port: 4_175,
    addresses: ["192.168.1.20"],
    token: "synthetic-token",
    error: null,
  });

  addresses = ["172.20.10.2"];
  assert.deepEqual(readSyncPairingInfo().addresses, ["172.20.10.2"]);

  setSyncServerUnavailable("Companion unavailable.");
  assert.deepEqual(readSyncPairingInfo(), {
    enabled: false,
    port: 0,
    addresses: [],
    token: "",
    error: "Companion unavailable.",
  });

  setSyncServerDisabled();
});

test("companion socket handles authentication, snapshot, and snapshot request", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sync-socket-test-"));
  const client = createClient({ url: `file:${path.join(directory, "test.db")}` });
  try {
    const db = drizzle(client, { schema });
    await runMigrations(db, migrations);

    const token = "valid-pairing-token";
    const server = createSyncServer({ db, token, port: 0 });
    const info = await server.ready;

    // 1. Rejects invalid token
    await new Promise<void>((resolve, reject) => {
      const badWs = new WebSocket(`ws://127.0.0.1:${info.port}/sync`);
      badWs.on("open", () => {
        badWs.send(JSON.stringify({ type: "sync-hello", protocolVersion: 1, token: "wrong-token", clientId: "c1" }));
      });
      badWs.on("close", (code) => {
        try {
          assert.equal(code, 4401);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      badWs.on("error", () => {});
    });

    // 2. Authenticates, receives welcome and snapshot, then requests fresh snapshot
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${info.port}/sync`);
      const received: any[] = [];
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "sync-hello", protocolVersion: 1, token, clientId: "c1" }));
      });
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          received.push(msg);
          if (received.length === 2) {
            assert.equal(received[0].type, "sync-welcome");
            assert.equal(received[1].type, "sync-snapshot");
            assert.equal(received[0].revision, 0);
            assert.equal(received[1].revision, 0);
            ws.send(JSON.stringify({ type: "sync-request-snapshot" }));
          } else if (received.length === 3) {
            assert.equal(received[2].type, "sync-snapshot");
            ws.close();
            resolve();
          }
        } catch (e) {
          ws.close();
          reject(e);
        }
      });
      ws.on("error", reject);
    });

    await server.close();
  } finally {
    await client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
