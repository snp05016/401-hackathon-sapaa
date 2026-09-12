import { contextBridge, ipcRenderer } from "electron";
import type { Application, ApplicationStage, ApplicationEvent, FollowUpSuggestion, GmailState } from "@ghostboard/shared";
import type { ProfileField, Profile } from "@ghostboard/shared";
import type { ExperienceEntry, MasterResume, TailoredResumeRecord } from "@ghostboard/shared";
import type { ParsedExperienceEntry, ResumeCustomizeRequest, ResumeCustomizeResult } from "@ghostboard/resume";
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
  getBridgeInfo(): Promise<{ port: number; token: string } | null>;
  getMasterResume(): Promise<MasterResume>;
  saveMasterResume(latex: string): Promise<MasterResume>;
  listExperienceEntries(): Promise<ExperienceEntry[]>;
  upsertExperienceEntry(entry: ExperienceEntry): Promise<ExperienceEntry[]>;
  deleteExperienceEntry(id: string): Promise<ExperienceEntry[]>;
  extractExperienceEntries(latex: string): Promise<ParsedExperienceEntry[]>;
  importExperienceEntries(entries: ParsedExperienceEntry[]): Promise<ExperienceEntry[]>;
  generateTailoredResume(request: ResumeCustomizeRequest): Promise<ResumeCustomizeResult>;
  listTailoredResumes(): Promise<TailoredResumeRecord[]>;
  saveTailoredResume(record: TailoredResumeRecord): Promise<TailoredResumeRecord>;
  transcribeAudio(input: { audio: Uint8Array; mimeType: string }): Promise<{ text: string }>;
  printResumePdf(html: string): Promise<Uint8Array>;
  downloadResumePdf(input: { pdf: Uint8Array; suggestedFileName: string }): Promise<string | null>;
  exportResumeToFolder(input: { pdf: Uint8Array; latex: string; summary: string; company?: string; title?: string }): Promise<string | null>;
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
  getBridgeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.bridgeInfo),
  getMasterResume: () => ipcRenderer.invoke(IPC_CHANNELS.resumeMasterGet),
  saveMasterResume: (latex) => ipcRenderer.invoke(IPC_CHANNELS.resumeMasterSave, latex),
  listExperienceEntries: () => ipcRenderer.invoke(IPC_CHANNELS.resumeExperienceList),
  upsertExperienceEntry: (entry) => ipcRenderer.invoke(IPC_CHANNELS.resumeExperienceUpsert, entry),
  deleteExperienceEntry: (id) => ipcRenderer.invoke(IPC_CHANNELS.resumeExperienceDelete, id),
  extractExperienceEntries: (latex) => ipcRenderer.invoke(IPC_CHANNELS.resumeExtractExperience, latex),
  importExperienceEntries: (entries) => ipcRenderer.invoke(IPC_CHANNELS.resumeExperienceImport, entries),
  generateTailoredResume: (request) => ipcRenderer.invoke(IPC_CHANNELS.resumeGenerate, request),
  listTailoredResumes: () => ipcRenderer.invoke(IPC_CHANNELS.resumeTailoredList),
  saveTailoredResume: (record) => ipcRenderer.invoke(IPC_CHANNELS.resumeTailoredSave, record),
  transcribeAudio: (input) => ipcRenderer.invoke(IPC_CHANNELS.resumeTranscribe, input),
  printResumePdf: (html) => ipcRenderer.invoke(IPC_CHANNELS.resumePrintPdf, html),
  downloadResumePdf: (input) => ipcRenderer.invoke(IPC_CHANNELS.resumeDownloadPdf, input),
  exportResumeToFolder: (input) => ipcRenderer.invoke(IPC_CHANNELS.resumeExportFolder, input),
};

contextBridge.exposeInMainWorld("ghostboard", api);
