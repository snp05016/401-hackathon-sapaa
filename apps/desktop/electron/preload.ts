import { contextBridge, ipcRenderer } from "electron";
import type { Application, ApplicationStage, ApplicationEvent, FollowUpSuggestion } from "@ghostboard/shared";
import type { ProfileField, Profile } from "@ghostboard/shared";
import { IPC_CHANNELS } from "./ipc/channels";

export interface MoveApplicationRequest {
  applicationId: string;
  fromStage: ApplicationStage;
  toStage: ApplicationStage;
}

export interface MoveApplicationResult {
  application: Application;
  event: ApplicationEvent | null;
}

export interface GhostboardApi {
  listApplications(): Promise<Application[]>;
  updateDeadline(applicationId: string, deadline: string | null): Promise<Application>;
  moveApplication(request: MoveApplicationRequest): Promise<MoveApplicationResult>;
  evaluateFollowUps(): Promise<FollowUpSuggestion[]>;
  dismissFollowUp(applicationId: string): Promise<Application>;
  getProfile(): Promise<Profile>;
  saveProfile(fields: ProfileField[]): Promise<Profile>;
  getBridgeInfo(): Promise<{ port: number; token: string } | null>;
}

const api: GhostboardApi = {
  listApplications: () => ipcRenderer.invoke(IPC_CHANNELS.listApplications),
  updateDeadline: (applicationId, deadline) => ipcRenderer.invoke(IPC_CHANNELS.updateDeadline, applicationId, deadline),
  moveApplication: (request) => ipcRenderer.invoke(IPC_CHANNELS.moveApplication, request),
  evaluateFollowUps: () => ipcRenderer.invoke(IPC_CHANNELS.evaluateFollowUps),
  dismissFollowUp: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.dismissFollowUp, applicationId),
  getProfile: () => ipcRenderer.invoke(IPC_CHANNELS.getProfile),
  saveProfile: (fields) => ipcRenderer.invoke(IPC_CHANNELS.saveProfile, fields),
  getBridgeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.bridgeInfo),
};

contextBridge.exposeInMainWorld("ghostboard", api);
