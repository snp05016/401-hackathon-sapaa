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

/** Generates (or reuses, within a run) the bridge auth token and persists port+token to disk. */
export function getOrCreateBridgeToken(port: number): BridgeFile {
  const token = crypto.randomUUID();
  const file: BridgeFile = { port, token };
  fs.writeFileSync(bridgeFilePath(), JSON.stringify(file, null, 2));
  return file;
}

export function readBridgeFile(): BridgeFile | null {
  const file = bridgeFilePath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as BridgeFile;
}
