import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transcribeWithGroq } from "@ghostboard/ai";
import { customizeResume, parseExperienceBank, type ParsedExperienceEntry, type ResumeCustomizeRequest, type ResumeCustomizeResult } from "@ghostboard/resume";
import type { ExperienceEntry, TailoredResumeRecord } from "@ghostboard/shared";
import {
  readExperienceBank,
  readMasterResume,
  readTailoredResumes,
  writeExperienceBank,
  writeMasterResume,
  writeTailoredResumes,
} from "../db";
import { IPC_CHANNELS } from "../ipc/channels";
import { compileLatexToPdf, printHtmlToPdf, sanitizeFolderName } from "./pdf";
import { validateAudioForTranscription } from "./transcribe";
import { mergeImportedExperienceEntries } from "./import";

const MAX_MASTER_LATEX_LENGTH = 100_000;
const MAX_JOB_DESCRIPTION_LENGTH = 75_000;
const MAX_TAILORED_LATEX_LENGTH = 500_000;
const MAX_HTML_LENGTH = 5_000_000;
const MAX_PDF_BYTES = 50_000_000;
const MAX_SUMMARY_LENGTH = 100_000;

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}: expected non-empty text.`);
  if (value.length > maxLength) throw new Error(`${field} is too large.`);
  return value.trim();
}

function plainText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`Invalid ${field}: expected text.`);
  if (value.length > maxLength) throw new Error(`${field} is too large.`);
  return value;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function stringList(value: unknown, field: string, maxItems: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}: expected a list.`);
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 1000))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function asPdf(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new Error("Invalid PDF data.");
  if (value.byteLength === 0) throw new Error("PDF data is empty.");
  if (value.byteLength > MAX_PDF_BYTES) throw new Error("PDF data is too large to write.");
  return value;
}

function normalizeExperienceEntry(value: unknown): ExperienceEntry {
  if (!value || typeof value !== "object") throw new Error("Invalid experience entry.");
  const entry = value as Record<string, unknown>;
  const id = typeof entry.id === "string" && entry.id.trim() ? entry.id : crypto.randomUUID();
  const role = requiredText(entry.role, "experience entry role", 200);
  const employer = requiredText(entry.employer, "experience entry employer", 200);
  const startDate = optionalText(entry.startDate, 50);
  const endDate = optionalText(entry.endDate, 50);
  const bullets = stringList(entry.bullets, "experience entry bullets", 200);
  const skills = stringList(entry.skills, "experience entry skills", 100);
  const source = optionalText(entry.source, 300);
  return { id, role, employer, startDate, endDate, bullets, skills, ...(source ? { source } : {}) };
}

function normalizeTailoredRecord(value: unknown): TailoredResumeRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid tailored resume record.");
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id : crypto.randomUUID();
  return {
    id,
    masterId: typeof record.masterId === "string" && record.masterId.trim() ? record.masterId : "local",
    latex: requiredText(record.latex, "tailored resume LaTeX", MAX_TAILORED_LATEX_LENGTH),
    company: optionalText(record.company, 200),
    title: optionalText(record.title, 200),
    jobUrl: optionalText(record.jobUrl, 2000),
    jobDescription: optionalText(record.jobDescription, MAX_JOB_DESCRIPTION_LENGTH),
    changesSummary: stringList(record.changesSummary, "changes summary", 500),
    createdAt: typeof record.createdAt === "string" && record.createdAt ? record.createdAt : new Date().toISOString(),
  };
}

function asCustomizeRequest(value: unknown): ResumeCustomizeRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid tailoring request.");
  const request = value as ResumeCustomizeRequest;
  if (typeof request.masterLatex !== "string" || typeof request.jobDescription !== "string") {
    throw new Error("Tailoring requires a master resume and a job description.");
  }
  return request;
}

function readableTailoringError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.startsWith("Master LaTeX is required")
      || message.startsWith("A job description is required")
      || message.startsWith("Master resume is not valid LaTeX")
      || message.startsWith("Experience bank")
      || message.includes("too large")
      || message.startsWith("GROQ_API_KEY is not set")
      || message.startsWith("The model did not return a valid LaTeX document")
    ) {
      return error;
    }
    return new Error(`Resume tailoring failed. ${message}`);
  }
  return new Error("Resume tailoring failed. Try again.");
}

function readableTranscriptionError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.startsWith("GROQ_API_KEY is not set")) return error;
    return new Error(`Transcription failed. ${error.message}`);
  }
  return new Error("Transcription failed. Try again.");
}

function upsertExperienceEntry(value: unknown): ExperienceEntry[] {
  const entry = normalizeExperienceEntry(value);
  const entries = readExperienceBank();
  const existingIndex = entries.findIndex((candidate) => candidate.id === entry.id);
  if (existingIndex >= 0) entries[existingIndex] = entry;
  else entries.push(entry);
  return writeExperienceBank(entries);
}

function deleteExperienceEntry(value: unknown): ExperienceEntry[] {
  const id = requiredText(value, "experience entry id", 200);
  const entries = readExperienceBank().filter((entry) => entry.id !== id);
  return writeExperienceBank(entries);
}

async function generateTailoredResume(value: unknown): Promise<ResumeCustomizeResult> {
  const request = asCustomizeRequest(value);
  try {
    return await customizeResume(request);
  } catch (error) {
    throw readableTailoringError(error);
  }
}

function saveTailoredResume(value: unknown): TailoredResumeRecord {
  const record = normalizeTailoredRecord(value);
  const records = readTailoredResumes();
  const existingIndex = records.findIndex((candidate) => candidate.id === record.id);
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  const saved = writeTailoredResumes(records);
  return saved.find((candidate) => candidate.id === record.id) ?? record;
}

async function printResumePdf(value: unknown): Promise<Uint8Array> {
  const html = plainText(value, "HTML content", MAX_HTML_LENGTH);
  if (!html.trim()) throw new Error("There is no content to print to PDF.");
  return printHtmlToPdf(html);
}

interface PdfDownloadPayload {
  pdf: Uint8Array;
  suggestedFileName: string;
}

function asPdfDownloadPayload(value: unknown): PdfDownloadPayload {
  if (!value || typeof value !== "object") throw new Error("Invalid PDF download request.");
  const payload = value as { pdf?: unknown; suggestedFileName?: unknown };
  const suggested = typeof payload.suggestedFileName === "string" ? payload.suggestedFileName.trim() : "";
  return {
    pdf: asPdf(payload.pdf),
    suggestedFileName: suggested ? path.basename(suggested) : "resume.pdf",
  };
}

async function downloadResumePdf(value: unknown): Promise<string | null> {
  const payload = asPdfDownloadPayload(value);
  const selection = await dialog.showSaveDialog({
    defaultPath: payload.suggestedFileName,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (selection.canceled || !selection.filePath) return null;
  await writeFile(selection.filePath, payload.pdf);
  return selection.filePath;
}

interface ExportToFolderPayload {
  pdf: Uint8Array;
  latex: string;
  summary: string;
  company?: string;
  title?: string;
}

function asExportPayload(value: unknown): ExportToFolderPayload {
  if (!value || typeof value !== "object") throw new Error("Invalid folder export request.");
  const payload = value as { pdf?: unknown; latex?: unknown; summary?: unknown; company?: unknown; title?: unknown };
  return {
    pdf: asPdf(payload.pdf),
    latex: requiredText(payload.latex, "tailored resume LaTeX", MAX_TAILORED_LATEX_LENGTH),
    summary: plainText(payload.summary ?? "", "summary", MAX_SUMMARY_LENGTH),
    company: typeof payload.company === "string" ? payload.company : "",
    title: typeof payload.title === "string" ? payload.title : "",
  };
}

async function exportResumeToFolder(value: unknown): Promise<string | null> {
  const payload = asExportPayload(value);
  const selection = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  const targetDirectory = path.join(selection.filePaths[0], sanitizeFolderName(payload.company ?? ""), sanitizeFolderName(payload.title ?? ""));
  await mkdir(targetDirectory, { recursive: true });
  await writeFile(path.join(targetDirectory, "tailored.pdf"), payload.pdf);
  await writeFile(path.join(targetDirectory, "tailored.tex"), payload.latex, "utf-8");
  await writeFile(path.join(targetDirectory, "summary.md"), payload.summary, "utf-8");
  return targetDirectory;
}

interface TranscriptionPayload {
  audio: Uint8Array;
  mimeType: string;
}

function asTranscriptionPayload(value: unknown): TranscriptionPayload {
  if (!value || typeof value !== "object") throw new Error("Invalid transcription request.");
  const payload = value as { audio?: unknown; mimeType?: unknown };
  if (!(payload.audio instanceof Uint8Array)) throw new Error("Invalid transcription request: missing audio.");
  if (typeof payload.mimeType !== "string") throw new Error("Invalid transcription request: missing audio format.");
  return { audio: payload.audio, mimeType: payload.mimeType };
}

async function transcribeAudio(value: unknown): Promise<{ text: string }> {
  const payload = asTranscriptionPayload(value);
  validateAudioForTranscription(payload);
  try {
    const result = await transcribeWithGroq({ audio: payload.audio, mimeType: payload.mimeType });
    return { text: result.text };
  } catch (error) {
    throw readableTranscriptionError(error);
  }
}

function extractExperienceEntries(value: unknown): ParsedExperienceEntry[] {
  const source = plainText(value, "resume text", MAX_MASTER_LATEX_LENGTH);
  if (!source.trim()) throw new Error("Resume text is required.");
  return parseExperienceBank(source);
}

function importExperienceEntries(value: unknown): ExperienceEntry[] {
  if (!Array.isArray(value)) throw new Error("Import requires an array of parsed experience entries.");
  if (value.length > 200) throw new Error("Too many entries to import (200 maximum).");

  const proposed: ExperienceEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const withSource = { ...(raw as Record<string, unknown>), source: (raw as Record<string, unknown>).source ?? "experience" };
    try {
      const normalized = normalizeExperienceEntry(withSource);
      proposed.push(normalized);
    } catch {
      continue;
    }
  }

  const existing = readExperienceBank();
  const merged = mergeImportedExperienceEntries(existing, proposed);
  return writeExperienceBank(merged);
}

export function registerResumeHandlers(): void {
  function trusted(event: IpcMainInvokeEvent): void {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error("Resume actions are available only in the desktop app.");
    const url = new URL(event.senderFrame.url);
    if (process.env.ELECTRON_RENDERER_URL) {
      if (url.origin !== new URL(process.env.ELECTRON_RENDERER_URL).origin) throw new Error("Untrusted resume request.");
    } else {
      const expected = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../renderer/index.html");
      if (url.protocol !== "file:" || fileURLToPath(url) !== expected) throw new Error("Untrusted resume request.");
    }
  }

  const handlers: Array<[string, (...arguments_: unknown[]) => unknown]> = [
    [IPC_CHANNELS.resumeMasterGet, () => readMasterResume()],
    [IPC_CHANNELS.resumeMasterSave, (latex) => {
      const master = plainText(latex, "master resume", MAX_MASTER_LATEX_LENGTH);
      if (!master.trim()) throw new Error("Master resume cannot be empty.");
      return writeMasterResume(master);
    }],
    [IPC_CHANNELS.resumeExperienceList, () => readExperienceBank()],
    [IPC_CHANNELS.resumeExperienceUpsert, (entry) => upsertExperienceEntry(entry)],
    [IPC_CHANNELS.resumeExperienceDelete, (id) => deleteExperienceEntry(id)],
    [IPC_CHANNELS.resumeExtractExperience, (latex) => extractExperienceEntries(latex)],
    [IPC_CHANNELS.resumeExperienceImport, (entries) => importExperienceEntries(entries)],
    [IPC_CHANNELS.resumeGenerate, (request) => generateTailoredResume(request)],
    [IPC_CHANNELS.resumeTailoredList, () => readTailoredResumes()],
    [IPC_CHANNELS.resumeTailoredSave, (record) => saveTailoredResume(record)],
    [IPC_CHANNELS.resumePrintPdf, (html) => printResumePdf(html)],
    [IPC_CHANNELS.resumeDownloadPdf, (payload) => downloadResumePdf(payload)],
    [IPC_CHANNELS.resumeExportFolder, (payload) => exportResumeToFolder(payload)],
    [IPC_CHANNELS.resumeTranscribe, (payload) => transcribeAudio(payload)],
    [IPC_CHANNELS.resumeCompileLatex, (latex) => compileLatexToPdf(plainText(latex, "LaTeX source", MAX_MASTER_LATEX_LENGTH))],
  ];
  for (const [channel, handler] of handlers) {
    ipcMain.handle(channel, (event, ...arguments_) => {
      trusted(event);
      return handler(...arguments_);
    });
  }
}