import { contextBridge, ipcRenderer } from "electron";
import type { Application, ApplicationStage, ApplicationEvent, FollowUpSuggestion, GmailState } from "@ghostboard/shared";
import type { ProfileField, Profile } from "@ghostboard/shared";
import type { ExperienceEntry, MasterResume, TailoredResumeRecord } from "@ghostboard/shared";
import type { ParsedExperienceEntry, ResumeCustomizeRequest, ResumeCustomizeResult } from "@ghostboard/resume";
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

export interface SyncPairingInfo {
  enabled: boolean;
  port: number;
  addresses: string[];
  token: string;
  error: string | null;
}

export interface GemmaPrediction {
  completion: string;
}

export interface GemmaJobSummary {
  summary: string;
}

export interface GemmaJobSummaryRequest {
  company: string | null;
  title: string | null;
  description: string;
}

export interface GemmaFollowUpTailoringRequest {
  company: string;
  title: string;
  jobDescription: string;
  template: string;
  kind: "application" | "interview" | "thank_you";
}

export interface GemmaFollowUpTailoringResult {
  body: string;
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
  onApplicationsChanged(listener: () => void): () => void;
  searchDiscoveredJobs(request: DiscoverSearchRequest): Promise<DiscoverSearchResponse>;
  predictJobTitle(prompt: string): Promise<GemmaPrediction>;
  summarizeJobDescription(request: GemmaJobSummaryRequest): Promise<GemmaJobSummary>;
  tailorFollowUpMessage(request: GemmaFollowUpTailoringRequest): Promise<GemmaFollowUpTailoringResult>;
  saveDiscoveredJob(job: DiscoveredJob): Promise<SaveDiscoveredJobResult>;
  visitDiscoveredJob(job: DiscoveredJob, targetUrl?: string): Promise<SaveDiscoveredJobResult>;
  updateDeadline(applicationId: string, deadline: string | null): Promise<Application>;
  moveApplication(request: MoveApplicationRequest): Promise<MoveApplicationResult>;
  evaluateFollowUps(): Promise<FollowUpSuggestion[]>;
  dismissFollowUp(applicationId: string): Promise<Application>;
  deleteApplication(applicationId: string): Promise<void>;
  getProfile(): Promise<Profile>;
  saveProfile(fields: ProfileField[]): Promise<Profile>;
  getBridgeInfo(): Promise<{ port: number; token: string } | null>;
  getSyncInfo(): Promise<SyncPairingInfo>;
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
  compileLatexToPdf(latex: string): Promise<Uint8Array>;
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
  onApplicationsChanged: (listener) => {
    const handleChanged = () => listener();
    ipcRenderer.on(IPC_CHANNELS.applicationsChanged, handleChanged);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.applicationsChanged, handleChanged);
  },
  searchDiscoveredJobs: (request) => ipcRenderer.invoke(IPC_CHANNELS.searchDiscoveredJobs, request),
  predictJobTitle: (prompt) => ipcRenderer.invoke(IPC_CHANNELS.predictJobTitle, prompt),
  summarizeJobDescription: (request) => ipcRenderer.invoke(IPC_CHANNELS.summarizeJobDescription, request),
  tailorFollowUpMessage: (request) => ipcRenderer.invoke(IPC_CHANNELS.tailorFollowUpMessage, request),
  saveDiscoveredJob: (job) => ipcRenderer.invoke(IPC_CHANNELS.saveDiscoveredJob, job),
  visitDiscoveredJob: (job, targetUrl) => ipcRenderer.invoke(IPC_CHANNELS.visitDiscoveredJob, job, targetUrl),
  updateDeadline: (applicationId, deadline) => ipcRenderer.invoke(IPC_CHANNELS.updateDeadline, applicationId, deadline),
  moveApplication: (request) => ipcRenderer.invoke(IPC_CHANNELS.moveApplication, request),
  evaluateFollowUps: () => ipcRenderer.invoke(IPC_CHANNELS.evaluateFollowUps),
  dismissFollowUp: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.dismissFollowUp, applicationId),
  deleteApplication: (applicationId) => ipcRenderer.invoke(IPC_CHANNELS.deleteApplication, applicationId),
  getProfile: () => ipcRenderer.invoke(IPC_CHANNELS.getProfile),
  saveProfile: (fields) => ipcRenderer.invoke(IPC_CHANNELS.saveProfile, fields),
  getBridgeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.bridgeInfo),
  getSyncInfo: () => ipcRenderer.invoke(IPC_CHANNELS.syncInfo),
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
  compileLatexToPdf: (latex) => ipcRenderer.invoke(IPC_CHANNELS.resumeCompileLatex, latex),
  printResumePdf: (html) => ipcRenderer.invoke(IPC_CHANNELS.resumePrintPdf, html),
  downloadResumePdf: (input) => ipcRenderer.invoke(IPC_CHANNELS.resumeDownloadPdf, input),
  exportResumeToFolder: (input) => ipcRenderer.invoke(IPC_CHANNELS.resumeExportFolder, input),
};

contextBridge.exposeInMainWorld("ghostboard", api);
