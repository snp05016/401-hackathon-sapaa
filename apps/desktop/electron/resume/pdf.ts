import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import type { BrowserWindow as BrowserWindowType } from "electron";

const execFileAsync = promisify(execFile);
const MAX_LATEX_LENGTH = 100_000;

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

export async function compileLatexToPdf(latex: string): Promise<Uint8Array> {
  if (!latex.trim()) throw new Error("There is no LaTeX source to compile.");
  if (latex.length > MAX_LATEX_LENGTH) throw new Error("The LaTeX source is too large to compile.");

  const directory = await mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "resume-latex-"));
  const sourcePath = path.join(directory, "resume.tex");
  const outputPath = path.join(directory, "resume.pdf");
  const candidates = process.env.PDFLATEX_PATH?.trim()
    ? [process.env.PDFLATEX_PATH.trim()]
    : ["/Library/TeX/texbin/pdflatex", "/opt/homebrew/bin/pdflatex", "/usr/local/bin/pdflatex", "pdflatex"];
  let executable = "pdflatex";
  for (const candidate of candidates) {
    if (candidate === "pdflatex") {
      executable = candidate;
      break;
    }
    try {
      await access(candidate);
      executable = candidate;
      break;
    } catch {
    }
  }

  try {
    await writeFile(sourcePath, latex, "utf-8");
    await execFileAsync(executable, [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      "-no-shell-escape",
      "-output-directory",
      directory,
      sourcePath,
    ], { timeout: 15_000, maxBuffer: 1_000_000 });
    const pdf = await readFile(outputPath);
    return new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("pdflatex is not installed. Install MacTeX with `brew install --cask mactex-no-gui`, then restart the app.");
    }
    const detail = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.split("\n").filter(Boolean).slice(-3).join(" ")
      : error instanceof Error ? error.message : "unknown failure";
    throw new Error(`LaTeX compilation failed. ${detail}`.slice(0, 1000));
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}