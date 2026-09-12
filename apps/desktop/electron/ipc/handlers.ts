import { registerGmailHandlers } from "../gmail";
import { ipcMain } from "electron";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { applications, applicationEvents, type GhostboardDb } from "@ghostboard/database";
import type { ProfileField } from "@ghostboard/shared";
import { STAGE_LABELS, type ApplicationEvent } from "@ghostboard/shared";
import type { MoveApplicationRequest, MoveApplicationResult } from "../preload";
import { readProfile, writeProfile } from "../db/index";
import { readBridgeFile } from "../bridge/token";
import { IPC_CHANNELS } from "./channels";
import { updateApplicationDeadline } from "../db/deadlines";

export function registerIpcHandlers(db: GhostboardDb): void {
  registerGmailHandlers(db);
  ipcMain.handle(IPC_CHANNELS.updateDeadline, (_event, applicationId: unknown, deadline: unknown) => {
    return updateApplicationDeadline(db, applicationId, deadline);
  });
  ipcMain.handle(IPC_CHANNELS.listApplications, async () => {
    return db.select().from(applications);
  });

  ipcMain.handle(
    IPC_CHANNELS.moveApplication,
    async (_event, request: MoveApplicationRequest): Promise<MoveApplicationResult> => {
      const now = new Date().toISOString();

      return db.transaction(async (tx) => {
        const [existing] = await tx.select().from(applications).where(eq(applications.id, request.applicationId));
        if (!existing) throw new Error("application not found");
        if (existing.status === request.toStage) return { application: existing, event: null };

        await tx
          .update(applications)
          .set({
            status: request.toStage,
            updatedAt: now,
            lastActivityAt: now,
            ...(request.toStage === "applied" && !(request.fromStage === "interviewing" || request.fromStage === "offer") ? { dateApplied: now } : {}),
          })
          .where(eq(applications.id, request.applicationId));

        const event: ApplicationEvent = {
          id: crypto.randomUUID(),
          applicationId: request.applicationId,
          type: "stage_changed",
          title: `Moved to ${STAGE_LABELS[request.toStage]}`,
          description: null,
          occurredAt: now,
          metadata: { fromStage: request.fromStage, toStage: request.toStage },
        };

        await tx.insert(applicationEvents).values(event);

        const [updated] = await tx.select().from(applications).where(eq(applications.id, request.applicationId));
        if (!updated) throw new Error("application not found");

        return { application: updated, event };
      });
    }
  );

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
