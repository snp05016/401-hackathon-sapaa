import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { BrowserWindow as BrowserWindowType } from "electron";

export function sanitizeFolderName(value: string): string {
  const cleaned = (value ?? "")
    .replace(/[/\\:*?"<>|]/g, " ")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const capped = cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned;
  if (capped === "." || capped === "..") return "untitled";
  return capped || "untitled";
}

export async function printHtmlToPdf(html: string): Promise<Uint8Array> {
  const { app, BrowserWindow } = await import("electron");
  const tempPath = path.join(app.getPath("temp"), `resume-pdf-${randomUUID()}.html`);
  let window: BrowserWindowType | null = null;
  try {
    await writeFile(tempPath, html, "utf-8");
    window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    await window.loadFile(tempPath);
    const pdf = await window.webContents.printToPDF({ printBackground: true, pageSize: "A4" });
    return new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown failure";
    throw new Error(`Could not generate the PDF: ${detail}`);
  } finally {
    await unlink(tempPath).catch(() => {});
    if (window && !window.isDestroyed()) window.destroy();
  }
}