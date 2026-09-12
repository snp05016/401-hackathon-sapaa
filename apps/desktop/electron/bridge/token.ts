import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

interface BridgeFile {
  port: number;
  token: string;
}

function bridgeFilePath(): string {
  return path.join(app.getPath("userData"), "bridge.json");
}

function savedToken(file: string): string | null {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<BridgeFile>;
    return typeof value.token === "string" && /^[0-9a-f-]{36}$/i.test(value.token) ? value.token : null;
  } catch {
    return null;
  }
}

/** Reuses the local pairing token across restarts and updates the configured port. */
export function getOrCreateBridgeToken(port: number): BridgeFile {
  const filePath = bridgeFilePath();
  const token = savedToken(filePath) ?? crypto.randomUUID();
  const file: BridgeFile = { port, token };
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2), { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
  return file;
}

export function readBridgeFile(): BridgeFile | null {
  const file = bridgeFilePath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as BridgeFile;
}
