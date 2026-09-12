import {
  BRIDGE_DEFAULT_PORT,
  BRIDGE_EXTENSION_MESSAGES_DEFAULT_PORT,
  BRIDGE_EXTENSION_MESSAGES_PATH,
  isExtensionAuthenticationMessage,
} from "@ghostboard/shared";
import type { BridgeSettings } from "../shared/messages";

export type JsonMessage = null | boolean | number | string | JsonMessage[] | { [key: string]: JsonMessage };

type BridgeMessageListener = (message: JsonMessage) => void;

const bridgeMessageListeners = new Set<BridgeMessageListener>();
const MESSAGE_RECONNECT_DELAY_MS = 10_000;
let messageSocket: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let messageReceiverStarted = false;

export async function getBridgeSettings(): Promise<BridgeSettings> {
  const stored = await chrome.storage.local.get(["bridgePort", "bridgeToken"]);
  return {
    port: (stored.bridgePort as number | undefined) ?? BRIDGE_DEFAULT_PORT,
  };
}

export async function saveBridgeSettings(settings: BridgeSettings): Promise<void> {
  await chrome.storage.local.set({ bridgePort: settings.port });
}

function notifyBridgeMessageListeners(message: JsonMessage): void {
  for (const listener of bridgeMessageListeners) {
    try {
      listener(message);
    } catch (error) {
      console.error("Extension bridge message listener failed", error);
    }
  }
}

function scheduleMessageReconnect(): void {
  if (!messageReceiverStarted || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void connectToDesktopMessages();
  }, MESSAGE_RECONNECT_DELAY_MS);
}

async function connectToDesktopMessages(): Promise<void> {
  if (messageSocket) {
    return;
  }

  const socket = new WebSocket(
    `ws://127.0.0.1:${BRIDGE_EXTENSION_MESSAGES_DEFAULT_PORT}${BRIDGE_EXTENSION_MESSAGES_PATH}`
  );
  messageSocket = socket;

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "extension-connect" }));
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") {
      console.error("Extension bridge received a non-text message");
      return;
    }

    try {
      const message = JSON.parse(event.data) as JsonMessage;
      if (isExtensionAuthenticationMessage(message)) {
        void chrome.storage.local.set({ bridgePort: message.port, bridgeToken: message.token });
      }
      notifyBridgeMessageListeners(message);
    } catch (error) {
      console.error("Extension bridge received invalid JSON", error);
    }
  });

  socket.addEventListener("close", () => {
    if (messageSocket === socket) messageSocket = undefined;
    scheduleMessageReconnect();
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

/**
 * Opens the desktop-to-extension message channel and keeps it connected while
 * this Manifest V3 service worker is active.
 */
export function startBridgeMessageReceiver(): void {
  if (messageReceiverStarted) return;
  messageReceiverStarted = true;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.bridgePort) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    const socket = messageSocket;
    messageSocket = undefined;
    socket?.close();
    void connectToDesktopMessages();
  });
  void connectToDesktopMessages();
}

export function onBridgeMessage(listener: BridgeMessageListener): () => void {
  bridgeMessageListeners.add(listener);
  return () => bridgeMessageListeners.delete(listener);
}

async function bridgeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { port } = await getBridgeSettings();
  const stored = await chrome.storage.local.get("bridgeToken");
  const token = stored.bridgeToken as string | undefined;
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
