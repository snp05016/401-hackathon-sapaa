import { contextBridge, ipcRenderer } from "electron";
import type { Application, ApplicationStage, ApplicationEvent, FollowUpSuggestion, GmailState } from "@ghostboard/shared";
import type { MasterResume, ProfileField, Profile } from "@ghostboard/shared";
import { IPC_CHANNELS } from "./ipc/channels";

export type DiscoverSite = "linkedin" | "indeed" | "glassdoor" | "google" | "zip_recruiter";

export interface DiscoverSearchRequest {
  sites: DiscoverSite[];
  searchTerm: string;
  alternateTitles: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  preferredIndustries: string[];
  excludedKeywords: string[];
  experienceLevel: string;
  timingKeywords: string[];
  location: string;
  countryIndeed: string;
  distance: number;
  resultsWanted?: number;
  hoursOld?: number;
  isRemote?: boolean;
  jobType?: "fulltime" | "parttime" | "contract" | "internship";
}

export interface DiscoveredJob {
  site: string;
  id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  jobUrl: string | null;
  jobUrlDirect: string | null;
  companyUrl: string | null;
  companyUrlDirect: string | null;
  description: string | null;
  isRemote: boolean | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  currency: string | null;
  interval: string | null;
  datePosted: string | null;
  jobType: string | null;
  matchScore?: number;
  matchReasons?: string[];
  matchedSkills?: string[];
}

export interface DiscoverSearchResponse {
  cached: boolean;
  count: number;
  results: DiscoveredJob[];
  warnings: string[];
}

export interface SaveDiscoveredJobResult {
  application: Application;
  alreadySaved: boolean;
}

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
  searchDiscoveredJobs(request: DiscoverSearchRequest): Promise<DiscoverSearchResponse>;
  saveDiscoveredJob(job: DiscoveredJob): Promise<SaveDiscoveredJobResult>;
  visitDiscoveredJob(job: DiscoveredJob, targetUrl?: string): Promise<SaveDiscoveredJobResult>;
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
  searchDiscoveredJobs: (request) => ipcRenderer.invoke(IPC_CHANNELS.searchDiscoveredJobs, request),
  saveDiscoveredJob: (job) => ipcRenderer.invoke(IPC_CHANNELS.saveDiscoveredJob, job),
  visitDiscoveredJob: (job, targetUrl) => ipcRenderer.invoke(IPC_CHANNELS.visitDiscoveredJob, job, targetUrl),
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
