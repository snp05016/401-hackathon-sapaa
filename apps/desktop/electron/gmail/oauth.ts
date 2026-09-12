import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { GMAIL_READONLY_SCOPE } from "@ghostboard/tracking";

export interface GmailCredentials { clientId: string; clientSecret?: string }
export interface GmailTokens { accessToken: string; refreshToken: string; expiresAt: number }

export class GmailRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function googleJson<T>(url: string | URL, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !["gmail.googleapis.com", "oauth2.googleapis.com"].includes(parsed.hostname)) {
    throw new Error("Unexpected Google API address.");
  }
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000);
  const response = await fetcher(parsed, { ...init, signal, redirect: "error" });
  if (!response.ok) {
    const message = response.status === 401 ? "Gmail access expired. Reconnect Gmail."
      : response.status === 403 ? "Google denied access. Check that Gmail API is enabled and your account is an OAuth test user."
      : response.status === 429 ? "Google is limiting requests. Wait a few minutes and try again."
      : response.status >= 500 ? "Gmail is temporarily unavailable. Try again shortly."
      : "Google could not complete the request. Reconnect Gmail or try again.";
    throw new GmailRequestError(message, response.status);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Google returned an empty response.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > 2_000_000) { await reader.cancel(); throw new Error("Google returned too much data. Try a smaller check."); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T; }
  catch { throw new Error("Google returned an invalid response. Try again."); }
}

export function parseGmailCredentials(text: string): GmailCredentials {
  let value;
  try { value = JSON.parse(text)?.installed; } catch { throw new Error("Choose the Desktop app JSON downloaded from Google Cloud."); }
  if (!value || typeof value.client_id !== "string" || !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(value.client_id)
    || (value.client_secret !== undefined && typeof value.client_secret !== "string")) {
    throw new Error("Choose an OAuth Desktop app JSON file from Google Cloud, rather than web or service-account credentials.");
  }
  return { clientId: value.client_id, clientSecret: value.client_secret };
}

async function exchange(credentials: GmailCredentials, parameters: Record<string, string>, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<GmailTokens> {
  const body = new URLSearchParams({ client_id: credentials.clientId, ...parameters });
  if (credentials.clientSecret) body.set("client_secret", credentials.clientSecret);
  const value = await googleJson<{ access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: string }>(
    "https://oauth2.googleapis.com/token", { method: "POST", body, signal }, fetcher,
  );
  if (typeof value.access_token !== "string" || typeof value.expires_in !== "number" || value.expires_in <= 0) {
    throw new Error("Google did not return usable access credentials.");
  }
  if (parameters.grant_type === "authorization_code" && !value.scope?.split(" ").includes(GMAIL_READONLY_SCOPE)) {
    throw new Error("Read-only Gmail access was not granted. Connect again and allow the requested access.");
  }
  const refreshToken = typeof value.refresh_token === "string" ? value.refresh_token : parameters.refresh_token;
  if (!refreshToken) throw new Error("Google did not grant offline access. Reconnect Gmail and approve the request.");
  return { accessToken: value.access_token, refreshToken, expiresAt: Date.now() + value.expires_in * 1000 };
}

export async function refreshGmailTokens(credentials: GmailCredentials, tokens: GmailTokens, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  try { return await exchange(credentials, { grant_type: "refresh_token", refresh_token: tokens.refreshToken }, signal, fetcher); }
  catch (error) {
    if (error instanceof GmailRequestError && [400, 401].includes(error.status)) {
      throw new GmailRequestError("Gmail access expired or was revoked. Reconnect Gmail.", 401);
    }
    throw error;
  }
}

export async function authorizeGmail(credentials: GmailCredentials, openExternal: (url: string) => Promise<void>, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<GmailTokens> {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(32).toString("hex");
  const server = createServer();
  let redirectUri = "";
  const code = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, authorizationCode?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      server.close();
      if (error) reject(error); else resolve(authorizationCode!);
    };
    const abort = () => finish(new Error("Gmail sign-in was cancelled."));
    const timeout = setTimeout(() => finish(new Error("Gmail sign-in timed out. Click Connect Gmail to try again.")), 120_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    server.on("error", () => finish(new Error("Could not open the local Google sign-in callback. Try again.")));
    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", redirectUri);
      const returnedState = Buffer.from(url.searchParams.get("state") ?? "");
      const expectedState = Buffer.from(state);
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.setHeader("cache-control", "no-store");
      response.setHeader("connection", "close");
      if (request.method !== "GET" || url.pathname !== "/" || request.headers.host !== new URL(redirectUri).host
        || returnedState.length !== expectedState.length || !timingSafeEqual(returnedState, expectedState)) {
        response.writeHead(400).end("Invalid sign-in callback."); return;
      }
      if (url.searchParams.has("error")) {
        response.end("Access was not granted. Return to the desktop app.");
        finish(new Error("Gmail access was not granted. You can try again when ready.")); return;
      }
      const authorizationCode = url.searchParams.get("code");
      if (!authorizationCode || authorizationCode.length > 4096) { response.writeHead(400).end("Missing authorization code."); return; }
      response.end("You can return to the desktop app. It is finishing the Gmail connection.");
      finish(undefined, authorizationCode);
    });
    server.listen(0, "127.0.0.1", () => {
      if (settled) { server.close(); return; }
      const address = server.address();
      if (!address || typeof address === "string") { finish(new Error("Could not start Google sign-in.")); return; }
      redirectUri = `http://127.0.0.1:${address.port}/`;
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: credentials.clientId, redirect_uri: redirectUri, response_type: "code",
        scope: GMAIL_READONLY_SCOPE, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        code_challenge_method: "S256", access_type: "offline", prompt: "consent select_account",
      }).toString();
      void openExternal(url.href).catch(() => finish(new Error("Could not open your browser for Google sign-in.")));
    });
  });
  return exchange(credentials, { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri }, signal, fetcher);
}
