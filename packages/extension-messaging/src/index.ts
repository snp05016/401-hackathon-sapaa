import {
  BRIDGE_EXTENSION_MESSAGES_DEFAULT_PORT,
  BRIDGE_EXTENSION_MESSAGES_PATH,
} from "@ghostboard/shared";
import { WebSocket, WebSocketServer } from "ws";

export type JsonMessage = null | boolean | number | string | JsonMessage[] | { [key: string]: JsonMessage };

export interface ExtensionMessageServerOptions {
  port?: number;
}

export type ExtensionMessageClient = WebSocket;
export type ExtensionMessageListener = (message: JsonMessage, client: ExtensionMessageClient) => void;

export interface ExtensionMessageServer {
  readonly port: number;
  readonly ready: Promise<void>;
  sendJson(message: JsonMessage): number;
  sendJsonTo(client: ExtensionMessageClient, message: JsonMessage): void;
  onJsonMessage(listener: ExtensionMessageListener): () => void;
  close(): Promise<void>;
}

function isJsonMessage(value: unknown, ancestors = new Set<object>()): value is JsonMessage {
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (
    typeof value !== "object" ||
    ancestors.has(value) ||
    (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    return false;
  }

  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonMessage(item, ancestors))
    : Object.values(value).every((item) => isJsonMessage(item, ancestors));
  ancestors.delete(value);
  return valid;
}

/**
 * Hosts the loopback-only WebSocket endpoint used to exchange messages with
 * the Chromium extension.
 */
export function createExtensionMessageServer(options: ExtensionMessageServerOptions): ExtensionMessageServer {
  let port = options.port ?? BRIDGE_EXTENSION_MESSAGES_DEFAULT_PORT;
  const messageListeners = new Set<ExtensionMessageListener>();
  const server = new WebSocketServer({
    host: "127.0.0.1",
    path: BRIDGE_EXTENSION_MESSAGES_PATH,
    port,
  });

  server.on("connection", (client) => {
    client.on("message", (rawMessage, isBinary) => {
      if (isBinary) return;
      try {
        const message = JSON.parse(rawMessage.toString()) as JsonMessage;
        if (!isJsonMessage(message)) return;
        for (const listener of messageListeners) listener(message, client);
      } catch {
        // Invalid client messages are ignored and do not terminate the channel.
      }
    });
  });

  const ready = new Promise<void>((resolve, reject) => {
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Extension message server did not expose a TCP port"));
        return;
      }
      port = address.port;
      resolve();
    });
    server.once("error", reject);
  });

  return {
    get port() {
      return port;
    },
    ready,
    sendJson(message) {
      if (!isJsonMessage(message)) throw new Error("Extension messages must be valid JSON values");
      const serializedMessage = JSON.stringify(message);
      let recipients = 0;
      for (const client of server.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        client.send(serializedMessage);
        recipients += 1;
      }
      return recipients;
    },
    sendJsonTo(client, message) {
      if (!isJsonMessage(message)) throw new Error("Extension messages must be valid JSON values");
      if (client.readyState !== WebSocket.OPEN) throw new Error("Extension message client is not connected");
      client.send(JSON.stringify(message));
    },
    onJsonMessage(listener) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
