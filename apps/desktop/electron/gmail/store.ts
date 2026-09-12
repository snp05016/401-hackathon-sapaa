import { readFile, writeFile, rename, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import type { GmailCredentials, GmailTokens } from "./oauth";

export interface GmailConnection {
  credentials: GmailCredentials;
  tokens: GmailTokens | null;
  account: string | null;
  automaticChecks: boolean;
  recentOnly?: boolean;
}

export interface SecretStorage {
  available(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

export function createGmailStore(directory: string, secrets: SecretStorage) {
  const file = path.join(directory, "gmail-auth.enc");
  function requireEncryption() {
    if (!secrets.available()) throw new Error("Secure credential storage is unavailable. Unlock your operating-system keychain and try again.");
  }
  return {
    async load(): Promise<GmailConnection | null> {
      let encrypted: Buffer;
      try { encrypted = await readFile(file); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw new Error("Could not read Gmail connection settings."); }
      requireEncryption();
      try {
        const value = JSON.parse(secrets.decrypt(encrypted));
        if (!value?.credentials || typeof value.credentials.clientId !== "string" || typeof value.automaticChecks !== "boolean"
          || (value.account !== null && typeof value.account !== "string")
          || (value.tokens !== null && (typeof value.tokens?.accessToken !== "string" || typeof value.tokens?.refreshToken !== "string" || !Number.isFinite(value.tokens?.expiresAt)))) throw new Error();
        return { ...value, recentOnly: value.recentOnly === true };
      } catch { throw new Error("Could not decrypt Gmail settings. Import your credentials again to reconnect."); }
    },
    async save(value: GmailConnection): Promise<void> {
      requireEncryption();
      await mkdir(directory, { recursive: true });
      await writeFile(`${file}.tmp`, secrets.encrypt(JSON.stringify(value)), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    },
    async clear(): Promise<void> {
      try { await unlink(file); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Could not remove Gmail credentials from this computer."); }
    },
  };
}
export type GmailStore = ReturnType<typeof createGmailStore>;
