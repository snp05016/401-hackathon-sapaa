import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { authorizeGmail, parseGmailCredentials, refreshGmailTokens, googleJson } from "./oauth";
import { createGmailStore } from "./store";
import { GMAIL_READONLY_SCOPE } from "@ghostboard/tracking";

const credentials = { clientId: "test.apps.googleusercontent.com", clientSecret: "test-secret" };

test("Desktop credentials parser rejects other client types and ignores supplied endpoints", () => {
  assert.deepEqual(parseGmailCredentials(JSON.stringify({ installed: { client_id: credentials.clientId, client_secret: credentials.clientSecret, token_uri: "https://untrusted.example/token" } })), credentials);
  for (const text of ["not json", "{}", JSON.stringify({ web: { client_id: credentials.clientId } }), JSON.stringify({ installed: { client_id: "invalid" } })]) assert.throws(() => parseGmailCredentials(text), /Desktop app/);
});

test("OAuth uses system-browser PKCE, rejects wrong state, exchanges code, and closes callback", async () => {
  let authorizationUrl: URL | undefined;
  let callbackUrl = "";
  const result = await authorizeGmail(credentials, async (input) => {
    const url = new URL(input); authorizationUrl = url;
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("scope"), GMAIL_READONLY_SCOPE);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("access_type"), "offline");
    const callback = new URL(url.searchParams.get("redirect_uri")!);
    assert.equal(callback.hostname, "127.0.0.1");
    callback.search = new URLSearchParams({ code: "test-code", state: "incorrect" }).toString();
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set("state", url.searchParams.get("state")!);
    callbackUrl = callback.href;
    assert.equal((await fetch(callback)).status, 200);
  }, new AbortController().signal, async (input, init) => {
    assert.equal(new URL(String(input)).href, "https://oauth2.googleapis.com/token");
    const body = init?.body as URLSearchParams;
    assert.equal(body.get("code"), "test-code");
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(createHash("sha256").update(body.get("code_verifier")!).digest("base64url"), authorizationUrl?.searchParams.get("code_challenge"));
    return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, scope: GMAIL_READONLY_SCOPE });
  });
  assert.equal(result.refreshToken, "refresh");
  await assert.rejects(fetch(callbackUrl));
});

test("OAuth denial and cancellation close the callback without exchanging tokens", async () => {
  await assert.rejects(authorizeGmail(credentials, async (input) => {
    const url = new URL(input);
    const callback = new URL(url.searchParams.get("redirect_uri")!);
    callback.search = new URLSearchParams({ state: url.searchParams.get("state")!, error: "access_denied" }).toString();
    await fetch(callback);
  }, new AbortController().signal, async () => { throw new Error("must not exchange"); }), /not granted/);
  const controller = new AbortController();
  await assert.rejects(authorizeGmail(credentials, async () => { controller.abort(); }, controller.signal), /cancelled/);
});

test("refresh preserves refresh token, revoked credentials give reconnect error, and errors hide response bodies", async () => {
  const tokens = { accessToken: "old", refreshToken: "refresh", expiresAt: 0 };
  const result = await refreshGmailTokens(credentials, tokens, undefined, async () => Response.json({ access_token: "new", expires_in: 3600 }));
  assert.equal(result.accessToken, "new"); assert.equal(result.refreshToken, "refresh");
  await assert.rejects(refreshGmailTokens(credentials, tokens, undefined, async () => new Response("sensitive server detail", { status: 400 })), /Reconnect Gmail/);
  await assert.rejects(googleJson("https://untrusted.example/", {}, async () => { throw new Error("must not fetch"); }), /Unexpected/);
  await assert.rejects(googleJson("https://gmail.googleapis.com/test", {}, async () => new Response("secret contents", { status: 503 })), (error: Error) => error.message.includes("temporarily unavailable") && !error.message.includes("secret"));
});

test("credential store encrypts, survives reopen, detects corruption, and refuses unavailable encryption", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gmail-store-"));
  const key = randomBytes(32);
  const secrets = {
    available: () => true,
    encrypt: (text: string) => { const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, nonce); const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]); return Buffer.concat([nonce, cipher.getAuthTag(), data]); },
    decrypt: (buffer: Buffer) => { const cipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(0, 12)); cipher.setAuthTag(buffer.subarray(12, 28)); return Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString("utf8"); },
  };
  const store = createGmailStore(directory, secrets);
  const value = { credentials, tokens: { accessToken: "private-token", refreshToken: "private-refresh", expiresAt: Date.now() + 3600000 }, account: "test@example.com", automaticChecks: false, recentOnly: false };
  try {
    assert.equal(await store.load(), null);
    await store.save(value);
    const encrypted = await readFile(path.join(directory, "gmail-auth.enc"));
    assert.equal(encrypted.includes(Buffer.from("private-token")), false);
    assert.equal((await stat(path.join(directory, "gmail-auth.enc"))).mode & 0o777, 0o600);
    assert.deepEqual(await createGmailStore(directory, secrets).load(), value);
    await assert.rejects(createGmailStore(directory, { ...secrets, available: () => false }).save(value), /Secure credential storage/);
    await writeFile(path.join(directory, "gmail-auth.enc"), "broken");
    await assert.rejects(store.load(), /decrypt/);
    await store.clear(); assert.equal(await store.load(), null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
