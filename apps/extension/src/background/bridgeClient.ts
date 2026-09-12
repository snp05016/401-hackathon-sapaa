import { BRIDGE_DEFAULT_PORT } from "@ghostboard/shared";
import type { BridgeSettings } from "../shared/messages";

export async function getBridgeSettings(): Promise<BridgeSettings> {
  const stored = await chrome.storage.local.get(["bridgePort", "bridgeToken"]);
  return {
    port: (stored.bridgePort as number | undefined) ?? BRIDGE_DEFAULT_PORT,
    token: (stored.bridgeToken as string | undefined) ?? "",
  };
}

export async function saveBridgeSettings(settings: BridgeSettings): Promise<void> {
  await chrome.storage.local.set({ bridgePort: settings.port, bridgeToken: settings.token });
}

async function bridgeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { port, token } = await getBridgeSettings();
  return fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

export async function checkBridgeHealth(): Promise<boolean> {
  try {
    const res = await bridgeFetch("/profile");
    return res.ok;
  } catch {
    return false;
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await bridgeFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Bridge token does not match. Copy the current token from Ghostboard Profile, paste it into the extension, and save settings.");
    throw new Error(`Bridge request to ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
