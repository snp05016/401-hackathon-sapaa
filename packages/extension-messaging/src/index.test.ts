import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { WebSocket } from "ws";
import { createExtensionMessageServer } from "./index";

test("delivers JSON messages to extension clients", async () => {
  const server = createExtensionMessageServer({ port: 0 });
  await server.ready;

  const client = new WebSocket(`ws://127.0.0.1:${server.port}/extension-messages`);
  await once(client, "open");

  const message = once(client, "message");
  assert.equal(server.sendJson({ type: "autofill", fields: ["email"] }), 1);
  const [rawMessage] = await message;
  assert.deepEqual(JSON.parse(rawMessage.toString()), { type: "autofill", fields: ["email"] });

  client.close();
  await once(client, "close");
  await server.close();
});

test("rejects values that JSON cannot represent", async () => {
  const server = createExtensionMessageServer({ port: 0 });
  await server.ready;

  assert.throws(() => server.sendJson({ value: Number.NaN }), /valid JSON values/);

  await server.close();
});

test("delivers extension messages and replies only to the requesting client", async () => {
  const server = createExtensionMessageServer({ port: 0 });
  await server.ready;

  server.onJsonMessage((message, client) => {
    if ((message as { type?: string }).type === "extension-connect") {
      server.sendJsonTo(client, { type: "bridge-authentication", port: 4173, token: "bridge-token" });
    }
  });

  const client = new WebSocket(`ws://127.0.0.1:${server.port}/extension-messages`);
  await once(client, "open");
  const authentication = once(client, "message");
  client.send(JSON.stringify({ type: "extension-connect" }));
  const [rawMessage] = await authentication;
  assert.deepEqual(JSON.parse(rawMessage.toString()), {
    type: "bridge-authentication",
    port: 4173,
    token: "bridge-token",
  });

  client.close();
  await once(client, "close");
  await server.close();
});
