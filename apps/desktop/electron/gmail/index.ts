  import { app, dialog, ipcMain, safeStorage, shell, type IpcMainInvokeEvent } from "electron";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GhostboardDb } from "@ghostboard/database";
import { IPC_CHANNELS } from "../ipc/channels";
import { parseGmailCredentials } from "./oauth";
import { createGmailStore } from "./store";
import { createGmailService } from "./service";

export function registerGmailHandlers(db: GhostboardDb): void {
  const store = createGmailStore(app.getPath("userData"), {
    available: () => safeStorage.isEncryptionAvailable()
      && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"),
    encrypt: (value) => safeStorage.encryptString(value),
    decrypt: (value) => safeStorage.decryptString(value),
  });
  const service = createGmailService(db, {
    store,
    chooseCredentials: async () => {
      const selection = await dialog.showOpenDialog({ title: "Choose Google Desktop app credentials", properties: ["openFile"], filters: [{ name: "Google OAuth credentials", extensions: ["json"] }] });
      if (selection.canceled || !selection.filePaths[0]) return null;
      const file = selection.filePaths[0];
      if (!(await stat(file)).isFile() || (await stat(file)).size > 64_000) throw new Error("Choose the small Desktop app JSON downloaded from Google Cloud.");
      return parseGmailCredentials(await readFile(file, "utf8"));
    },
    openExternal: (url) => shell.openExternal(url),
  });
  function trusted(event: IpcMainInvokeEvent) {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error("Gmail actions are available only in the desktop app.");
    const url = new URL(event.senderFrame.url);
    if (process.env.ELECTRON_RENDERER_URL) {
      if (url.origin !== new URL(process.env.ELECTRON_RENDERER_URL).origin) throw new Error("Untrusted Gmail request.");
    } else {
      const expected = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../renderer/index.html");
      if (url.protocol !== "file:" || fileURLToPath(url) !== expected) throw new Error("Untrusted Gmail request.");
    }
  }
  const handlers: Array<[string, (...arguments_: unknown[]) => unknown]> = [
    [IPC_CHANNELS.gmailState, () => service.getState()],
    [IPC_CHANNELS.gmailImport, () => service.importCredentials()],
    [IPC_CHANNELS.gmailConnect, () => service.connect()],
    [IPC_CHANNELS.gmailCheck, () => service.check()],
    [IPC_CHANNELS.gmailAutomatic, (enabled) => service.setAutomaticChecks(enabled)],
    [IPC_CHANNELS.gmailRecentOnly, (enabled) => service.setRecentOnly(enabled)],
    [IPC_CHANNELS.gmailDisconnect, () => service.disconnect()],
    [IPC_CHANNELS.gmailDismiss, (id) => service.dismiss(id)],
    [IPC_CHANNELS.gmailApply, (id, applicationId, updatedAt) => service.apply(id, applicationId, updatedAt)],
    [IPC_CHANNELS.gmailCancel, () => service.cancel()],
  ];
  for (const [channel, handler] of handlers) ipcMain.handle(channel, (event, ...arguments_) => { trusted(event); return handler(...arguments_); });
  const polling = setInterval(() => { void service.poll(); }, 5 * 60_000);
  app.once("before-quit", () => { clearInterval(polling); service.stop(); });
}
