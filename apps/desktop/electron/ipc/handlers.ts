import { ipcMain } from "electron";
import { applications, type GhostboardDb } from "@ghostboard/database";
import type { ProfileField } from "@ghostboard/shared";
import { readProfile, writeProfile } from "../db/index";
import { readBridgeFile } from "../bridge/token";
import { IPC_CHANNELS } from "./channels";

export function registerIpcHandlers(db: GhostboardDb): void {
  ipcMain.handle(IPC_CHANNELS.listApplications, async () => {
    return db.select().from(applications);
  });

  ipcMain.handle(IPC_CHANNELS.getProfile, () => {
    return readProfile();
  });

  ipcMain.handle(IPC_CHANNELS.saveProfile, (_event, fields: ProfileField[]) => {
    return writeProfile(fields);
  });

  ipcMain.handle(IPC_CHANNELS.bridgeInfo, () => {
    return readBridgeFile();
  });
}
