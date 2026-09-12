import { contextBridge, ipcRenderer } from "electron";
import type { Application, ApplicationStage, ApplicationEvent, FollowUpSuggestion, GmailState } from "@ghostboard/shared";
import type { MasterResume, ProfileField, Profile } from "@ghostboard/shared";
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
  getGmailState(): Promise<GmailState>;
  importGmailCredentials(): Promise<GmailState>;
  connectGmail(): Promise<GmailState>;
  checkGmail(): Promise<GmailState>;
  setGmailAutomaticChecks(enabled: boolean): Promise<GmailState>;
  setGmailRecentOnly(enabled: boolean): Promise<GmailState>;
  disconnectGmail(): Promise<GmailState>;
  dismissGmailSuggestion(id: string): Promise<GmailState>;
  applyGmailSuggestion(id: string, applicationId: string, expectedUpdatedAt: string): Promise<GmailState>;
  cancelGmail(): Promise<void>;
  listApplications(): Promise<Application[]>;
  updateDeadline(applicationId: string, deadline: string | null): Promise<Application>;
  moveApplication(request: MoveApplicationRequest): Promise<MoveApplicationResult>;
  evaluateFollowUps(): Promise<FollowUpSuggestion[]>;
  dismissFollowUp(applicationId: string): Promise<Application>;
  deleteApplication(applicationId: string): Promise<void>;
  getProfile(): Promise<Profile>;
  saveProfile(fields: ProfileField[]): Promise<Profile>;
  getMasterResume(): Promise<MasterResume>;
  saveMasterResume(latex: string): Promise<MasterResume>;
  getBridgeInfo(): Promise<{ port: number; token: string } | null>;
}

const api: GhostboardApi = {
  getGmailState: () => ipcRenderer.invoke(IPC_CHANNELS.gmailState),
  importGmailCredentials: () => ipcRenderer.invoke(IPC_CHANNELS.gmailImport),
  connectGmail: () => ipcRenderer.invoke(IPC_CHANNELS.gmailConnect),
  checkGmail: () => ipcRenderer.invoke(IPC_CHANNELS.gmailCheck),
  setGmailAutomaticChecks: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.gmailAutomatic, enabled),
  setGmailRecentOnly: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.gmailRecentOnly, enabled),
  disconnectGmail: () => ipcRenderer.invoke(IPC_CHANNELS.gmailDisconnect),
  dismissGmailSuggestion: (id) => ipcRenderer.invoke(IPC_CHANNELS.gmailDismiss, id),
  applyGmailSuggestion: (id, applicationId, updatedAt) => ipcRenderer.invoke(IPC_CHANNELS.gmailApply, id, applicationId, updatedAt),
  cancelGmail: () => ipcRenderer.invoke(IPC_CHANNELS.gmailCancel),
  listApplications: () => ipcRenderer.invoke(IPC_CHANNELS.listApplications),
  updateDeadline: (applicationId, deadline) => ipcRenderer.invoke(IPC_CHANNELS.updateDeadline, applicationId, deadline),
  moveApplication: (request) => ipcRenderer.invoke(IPC_CHANNELS.moveApplication, request),
  evaluateFollowUps: () => ipcRenderer.invoke(IPC_CHANNELS.evaluateFollowUps),
  dismissFollowUp: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.dismissFollowUp, applicationId),
  deleteApplication: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.deleteApplication, applicationId),
  getProfile: () => ipcRenderer.invoke(IPC_CHANNELS.getProfile),
  saveProfile: (fields) => ipcRenderer.invoke(IPC_CHANNELS.saveProfile, fields),
  getMasterResume: () => ipcRenderer.invoke(IPC_CHANNELS.getMasterResume),
  saveMasterResume: (latex) => ipcRenderer.invoke(IPC_CHANNELS.saveMasterResume, latex),
  getBridgeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.bridgeInfo),
};

contextBridge.exposeInMainWorld("ghostboard", api);
