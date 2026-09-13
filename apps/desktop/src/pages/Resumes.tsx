import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { Application, ExperienceEntry, TailoredResumeRecord } from "@ghostboard/shared";
import type { ResumeCustomizeResult } from "@ghostboard/resume";
import { FileDown, FileUp, FolderDown, Mic, Pencil, Plus, Save, Square, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { ipc } from "../lib/ipc";
import { cn, formatDate } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { PredictiveInput } from "../components/ui/PredictiveInput";
import {
  AnimatedNumber,
  GhostDrift,
  RevealOnScroll,
  Sheen,
  Shimmer,
  Stagger,
  StaggerItem,
  Stamp,
} from "../components/motion";
import {
  DISTANCE,
  DURATION,
  EASE,
  SCALE,
  SPRING,
  STAGGER,
  TRANSITION,
} from "../lib/motion";
import { playSound } from "../lib/sound";

const MAX_RECORDING_SECONDS = 120;

interface ExperienceDraft {
  id: string;
  isNew: boolean;
  role: string;
  employer: string;
  source: string;
  startDate: string;
  endDate: string;
  bullets: string[];
  skillsText: string;
}

const EXPERIENCE_SOURCES = ["experience", "project", "skill", "education", "volunteer", "custom"] as const;

const TEXTAREA_CLASSES =
  "w-full resize-y rounded-md border border-hairline bg-paper p-3 font-mono text-xs leading-5 text-ink placeholder:text-ink-3 focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood";

const SAMPLE_MASTER_LATEX = String.raw`
\documentclass{article}
\pagestyle{empty}
\begin{document}

\begin{center}
{\Huge\textbf{Your Name}}

Your City, Province | your.email@example.com | (555) 555-0100
\end{center}

\section{Professional Summary}
Write two or three truthful sentences here, for example what you do, who you work with, and what you are known for.

\section{Experience}

\textbf{Your most recent role} -- Jan 2022 to Present\\
\textit{Your Employer, Your City}
\begin{itemize}
  \item One concrete accomplishment, with a number if you have one.
  \item A second accomplishment that shows scope or ownership.
\end{itemize}

\textbf{An earlier role} -- Jun 2019 to Dec 2021\\
\textit{Your Employer, Your City}
\begin{itemize}
  \item One concrete accomplishment.
  \item A second accomplishment.
\end{itemize}

\section{Education}

\textbf{Your degree} -- Graduation year\\
\textit{Your University, Your City}
\end{document}
`;

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function pdfDataUrl(pdf: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < pdf.length; offset += chunkSize) {
    binary += String.fromCharCode(...pdf.subarray(offset, offset + chunkSize));
  }
  return `data:application/pdf;base64,${window.btoa(binary)}`;
}

function createId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function entryDateRange(entry: ExperienceEntry): string | null {
  if (!entry.startDate && !entry.endDate) return null;
  const start = entry.startDate ? formatDate(entry.startDate) : "Unknown start";
  const end = entry.endDate ? formatDate(entry.endDate) : "Present";
  return `${start} – ${end}`;
}

function DrawnRule({
  delay = 0,
  tone = "bg-hairline",
  className,
}: {
  delay?: number;
  tone?: string;
  className?: string;
}) {
  return (
    <motion.div
      aria-hidden="true"
      className={cn("h-px w-full origin-left", tone, className)}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ ...TRANSITION.hero, delay }}
    />
  );
}

function GhostGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 56"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        d="M24 3C13.5 3 5 11.5 5 22v31l6-5 6 5 7-5 7 5 6-5 6 5V22C43 11.5 34.5 3 24 3Z"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="23" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="31" cy="23" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PagePlaceholder() {
  return (
    <div className="flex justify-center p-3">
      <div className="w-[460px] max-w-full rounded-sm border border-hairline bg-paper-raised p-8">
        <Shimmer lines={1} height={20} />
        <div className="mt-5">
          <Shimmer lines={5} height={8} />
        </div>
        <div className="mt-7">
          <Shimmer lines={1} height={13} />
        </div>
        <div className="mt-4">
          <Shimmer lines={6} height={8} />
        </div>
      </div>
    </div>
  );
}

function LevelBars({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex h-4 items-end gap-[3px]", className)}>
      {[0, 1, 2].map((bar) => (
        <motion.span
          key={bar}
          className="block w-[3px] origin-bottom rounded-sm bg-oxblood"
          style={{ height: 14 }}
          animate={{ scaleY: [0.3, 1, 0.4] }}
          transition={{
            duration: 0.4,
            ease: EASE.inOut,
            repeat: Infinity,
            repeatType: "mirror",
            delay: bar * 0.09,
          }}
        />
      ))}
    </span>
  );
}

function useLatexPdf(source: string) {
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const request = ++requestRef.current;
    if (!source.trim()) {
      setPdf(null);
      setCompileError(null);
      setCompiling(false);
      return;
    }

    setCompiling(true);
    setCompileError(null);
    const timer = window.setTimeout(() => {
      void ipc().compileLatexToPdf(source).then((compiled) => {
        if (request !== requestRef.current) return;
        setPdf(compiled);
        setCompileError(null);
      }).catch((error: unknown) => {
        if (request !== requestRef.current) return;
        setPdf(null);
        setCompileError(errorMessage(error, "Unable to compile this LaTeX."));
      }).finally(() => {
        if (request === requestRef.current) setCompiling(false);
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [source]);

  return { pdf, compileError, compiling };
}

function LatexPdfPreview({
  pdf,
  compileError,
  compiling,
  minHeight = "min-h-96",
}: {
  pdf: Uint8Array | null;
  compileError: string | null;
  compiling: boolean;
  minHeight?: string;
}) {
  const [pageCount, setPageCount] = useState(0);
  const [pdfSource, setPdfSource] = useState<string | null>(null);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sheenPlaying, setSheenPlaying] = useState(false);
  const riseControls = useAnimationControls();

  useEffect(() => {
    setPageCount(0);
    setDisplayError(null);
    setZoom(1);
    if (!pdf) {
      setPdfSource(null);
      return;
    }
    try {
      setPdfSource(pdfDataUrl(pdf));
    } catch (error) {
      setPdfSource(null);
      setDisplayError(errorMessage(error, "Could not prepare the compiled PDF."));
    }
  }, [pdf]);

  // The sheet rises on the wrapper only — never on the react-pdf Page or its
  // parent, whose text layer assumes an untransformed ancestor chain.
  useEffect(() => {
    if (!pdfSource) return;
    void riseControls.start(
      { opacity: [0, 1], y: [DISTANCE.slide, 0] },
      TRANSITION.slow,
    );
    setSheenPlaying(true);
    const timer = window.setTimeout(() => setSheenPlaying(false), 1100);
    return () => window.clearTimeout(timer);
  }, [pdfSource, riseControls]);

  const visibleError = compileError ?? displayError;

  function changeZoom(delta: number) {
    playSound("tap");
    setZoom((current) => {
      const next = Number((current + delta).toFixed(1));
      return Math.min(1.6, Math.max(0.6, next));
    });
  }

  return (
    <motion.div className="relative" animate={riseControls}>
      <div className={cn("relative overflow-auto rounded-md border border-hairline bg-paper", minHeight)}>
        {visibleError ? (
          <motion.div
            key={visibleError}
            role="alert"
            className="p-3 text-[12px] leading-relaxed text-oxblood"
            initial={{ opacity: 0, y: DISTANCE.rise }}
            animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
            transition={{
              ...TRANSITION.base,
              x: { duration: DURATION.base, ease: EASE.out },
            }}
          >
            {visibleError}
          </motion.div>
        ) : pdfSource ? (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-end gap-1 border-b border-hairline bg-paper/95 p-2">
              <motion.button
                type="button"
                onClick={() => changeZoom(-0.1)}
                disabled={zoom <= 0.6}
                className="rounded-md p-1.5 text-ink-2 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Zoom out preview"
                title="Zoom out"
                whileHover={zoom <= 0.6 ? undefined : { scale: 1.08, transition: SPRING.hover }}
                whileTap={zoom <= 0.6 ? undefined : { scale: SCALE.press, transition: SPRING.press }}
              >
                <ZoomOut size={15} />
              </motion.button>
              <AnimatedNumber
                value={Math.round(zoom * 100)}
                duration={DURATION.base}
                format={(n) => `${Math.round(n)}%`}
                className="tnum min-w-12 text-center text-[11px] text-ink-2"
              />
              <motion.button
                type="button"
                onClick={() => changeZoom(0.1)}
                disabled={zoom >= 1.6}
                className="rounded-md p-1.5 text-ink-2 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Zoom in preview"
                title="Zoom in"
                whileHover={zoom >= 1.6 ? undefined : { scale: 1.08, transition: SPRING.hover }}
                whileTap={zoom >= 1.6 ? undefined : { scale: SCALE.press, transition: SPRING.press }}
              >
                <ZoomIn size={15} />
              </motion.button>
            </div>
            <Document
              file={pdfSource}
              onLoadSuccess={({ numPages }) => setPageCount(numPages)}
              onLoadError={(error) => setDisplayError(errorMessage(error, "Could not display the compiled PDF."))}
              loading={<p className="p-3 text-[12px] text-ink-3">Loading PDF…</p>}
              error={<p role="alert" className="p-3 text-[12px] text-oxblood">Could not display the compiled PDF.</p>}
              className="flex min-w-fit justify-center p-3"
            >
              <div className="space-y-3">
                {Array.from({ length: pageCount }, (_, index) => (
                  <Page key={index + 1} pageNumber={index + 1} width={460 * zoom} renderAnnotationLayer renderTextLayer />
                ))}
              </div>
            </Document>
          </>
        ) : compiling ? (
          <div className="flex h-full min-h-96 flex-col items-center justify-center">
            <PagePlaceholder />
            <p role="status" className="p-3 text-center text-[12px] text-ink-3">
              Compiling with pdflatex…
            </p>
          </div>
        ) : (
          <div className="flex h-full min-h-96 items-center justify-center p-3 text-center text-[12px] text-ink-3">
            PDF preview appears here after compilation.
          </div>
        )}
      </div>
      <Sheen play={sheenPlaying} className="absolute inset-0 rounded-md" />
    </motion.div>
  );
}

function ChangeLine({ line, index }: { line: string; index: number }) {
  const added = line.startsWith("Added");
  const removed = line.startsWith("Removed");
  return (
    <motion.li
      className="flex gap-2 text-[12px] leading-relaxed"
      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION.base, delay: Math.min(index, 11) * STAGGER.list }}
    >
      <motion.span
        aria-hidden="true"
        className={cn(
          "mt-px inline-block origin-left select-none font-semibold",
          added ? "text-verdigris" : removed ? "text-oxblood" : "text-ink-3",
        )}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{
          duration: DURATION.base,
          ease: EASE.out,
          delay: Math.min(index, 11) * STAGGER.list + 0.08,
        }}
      >
        {added ? "+" : removed ? "–" : "·"}
      </motion.span>
      <span className={cn(added ? "text-verdigris" : removed ? "text-oxblood" : "text-ink-2")}>{line}</span>
    </motion.li>
  );
}

function LatexSourceEditor({
  value,
  onChange,
  latexId,
  compileError,
  pdf,
  compiling,
  minHeight = "min-h-96",
  scanning = false,
}: {
  value: string;
  onChange: (value: string) => void;
  latexId: string;
  compileError: string | null;
  pdf: Uint8Array | null;
  compiling: boolean;
  minHeight?: string;
  scanning?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div>
        <label htmlFor={latexId} className="mb-1.5 block text-[12px] font-medium text-ink-2">
          LaTeX source
        </label>
        <div className="relative overflow-hidden rounded-md">
          <motion.textarea
            id={latexId}
            spellCheck={false}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={String.raw`\documentclass{article}% start with a LaTeX document…`}
            className={cn(TEXTAREA_CLASSES, minHeight)}
            animate={{ opacity: scanning ? 0.75 : 1 }}
            transition={{ duration: DURATION.quick, ease: EASE.subtle }}
          />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-oxblood"
            initial={false}
            animate={{ opacity: focused ? 1 : 0 }}
            transition={{ duration: DURATION.quick, ease: EASE.subtle }}
          />
          <AnimatePresence>
            {scanning && (
              <motion.span
                key="scanline"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 bottom-1.5 overflow-hidden rounded-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: TRANSITION.exit }}
                transition={{ duration: DURATION.quick, ease: EASE.subtle }}
              >
                <motion.span
                  className="absolute inset-x-0 top-0 block h-1/2"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgb(var(--oxblood) / 0) 0%, rgb(var(--oxblood) / 0.14) 82%, rgb(var(--oxblood) / 0.3) 100%)",
                    borderBottom: "2px solid rgb(var(--oxblood) / 0.75)",
                  }}
                  animate={{ y: ["-100%", "200%"] }}
                  transition={{
                    duration: DURATION.ambient,
                    ease: EASE.inOut,
                    repeat: Infinity,
                  }}
                />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-2">Preview</p>
        <LatexPdfPreview pdf={pdf} compileError={compileError} compiling={compiling} minHeight={minHeight} />
      </div>
    </div>
  );
}

export function Resumes() {
  const [masterId, setMasterId] = useState("");
  const [masterLatex, setMasterLatex] = useState("");
  const [persistedLatex, setPersistedLatex] = useState("");
  const [masterLoading, setMasterLoading] = useState(true);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterSaveState, setMasterSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [masterSaveError, setMasterSaveError] = useState<string | null>(null);
  const [masterSaveNonce, setMasterSaveNonce] = useState(0);
  const [usingSample, setUsingSample] = useState(false);
  const [resumeImporting, setResumeImporting] = useState(false);
  const [resumeImportError, setResumeImportError] = useState<string | null>(null);
  const [resumeImportResult, setResumeImportResult] = useState<{ added: number; skipped: number } | null>(null);

  const [experienceEntries, setExperienceEntries] = useState<ExperienceEntry[] | null>(null);
  const [experienceLoading, setExperienceLoading] = useState(true);
  const [experienceError, setExperienceError] = useState<string | null>(null);
  const [experienceActionError, setExperienceActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExperienceDraft | null>(null);
  const [draftValidation, setDraftValidation] = useState<{ role?: string; employer?: string } | null>(null);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entrySaved, setEntrySaved] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingSuccess, setRecordingSuccess] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingMimeTypeRef = useRef("audio/webm");
  const mountedRef = useRef(true);

  const [applications, setApplications] = useState<Application[] | null>(null);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [tailoredResult, setTailoredResult] = useState<ResumeCustomizeResult | null>(null);
  const [tailoredLatex, setTailoredLatex] = useState("");
  const [reviewSaving, setReviewSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reviewSaveError, setReviewSaveError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfOutcome, setPdfOutcome] = useState<{ kind: "success" | "cancel" | "error"; message: string } | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportOutcome, setExportOutcome] = useState<{ kind: "success" | "cancel" | "error"; message: string } | null>(null);
  const [exportStamp, setExportStamp] = useState(false);
  const [tailorErrorNonce, setTailorErrorNonce] = useState(0);

  const masterRequestRef = useRef(0);
  const experienceRequestRef = useRef(0);
  const applicationsRequestRef = useRef(0);
  const tailorRequestRef = useRef(0);
  const masterEditorValueRef = useRef("");

  const masterPreview = useLatexPdf(masterLatex);
  const tailoredPreview = useLatexPdf(tailoredLatex);

  const loadMaster = useCallback(async () => {
    const request = ++masterRequestRef.current;
    setMasterLoading(true);
    setMasterError(null);
    setMasterSaveState("idle");
    try {
      const resume = await ipc().getMasterResume();
      if (request !== masterRequestRef.current) return;
      setMasterId(resume.id);
      masterEditorValueRef.current = resume.latex;
      setMasterLatex(resume.latex);
      setPersistedLatex(resume.latex);
    } catch (error) {
      if (request !== masterRequestRef.current) return;
      setMasterError(errorMessage(error, "Could not load your master resume."));
    } finally {
      if (request === masterRequestRef.current) setMasterLoading(false);
    }
  }, []);

  const loadExperienceEntries = useCallback(async () => {
    const request = ++experienceRequestRef.current;
    setExperienceLoading(true);
    setExperienceError(null);
    try {
      const entries = await ipc().listExperienceEntries();
      if (request !== experienceRequestRef.current) return;
      setExperienceEntries(entries);
    } catch (error) {
      if (request !== experienceRequestRef.current) return;
      setExperienceError(errorMessage(error, "Could not load your experience entries."));
    } finally {
      if (request === experienceRequestRef.current) setExperienceLoading(false);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    const request = ++applicationsRequestRef.current;
    setApplicationsLoading(true);
    setApplicationsError(null);
    try {
      const list = await ipc().listApplications();
      if (request !== applicationsRequestRef.current) return;
      setApplications(list);
    } catch (error) {
      if (request !== applicationsRequestRef.current) return;
      setApplicationsError(errorMessage(error, "Could not load your saved applications."));
    } finally {
      if (request === applicationsRequestRef.current) setApplicationsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadMaster();
    void loadExperienceEntries();
    void loadApplications();
    return () => {
      mountedRef.current = false;
      masterRequestRef.current += 1;
      experienceRequestRef.current += 1;
      applicationsRequestRef.current += 1;
    };
  }, [loadMaster, loadExperienceEntries, loadApplications]);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          // recorder may already be stopping; the stream is released below.
        }
      }
      const stream = streamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
    },
    [],
  );

  function handleMasterChange(value: string) {
    setMasterLatex(value);
    masterEditorValueRef.current = value;
    setUsingSample(false);
    setMasterSaveState("idle");
    setMasterSaveError(null);
    tailorRequestRef.current += 1;
    setIsTailoring(false);
    setTailoredResult(null);
  }

  async function handleSaveMaster() {
    if (masterSaving || !masterLatex.trim()) return;
    const submitted = masterLatex;
    setMasterSaving(true);
    setMasterSaveState("idle");
    setMasterSaveError(null);
    try {
      const saved = await ipc().saveMasterResume(submitted);
      setMasterId(saved.id);
      if (masterEditorValueRef.current === submitted) {
        masterEditorValueRef.current = saved.latex;
        setMasterLatex(saved.latex);
      }
      setPersistedLatex(saved.latex);
      setUsingSample(false);
      setMasterSaveState("saved");
      playSound("success");
    } catch (error) {
      setMasterSaveState("error");
      setMasterSaveError(errorMessage(error, "Could not save the master resume."));
      setMasterSaveNonce((nonce) => nonce + 1);
      playSound("error");
    } finally {
      setMasterSaving(false);
    }
  }

  async function handleResumeUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setResumeImporting(true);
    setResumeImportError(null);
    setResumeImportResult(null);

    try {
      if (!file.name.toLowerCase().endsWith(".tex")) {
        throw new Error("Please select a LaTeX .tex file.");
      }

      const latex = await file.text();
      if (!latex.trim()) throw new Error("The selected LaTeX file is empty.");

      const parsedEntries = await ipc().extractExperienceEntries(latex);
      if (parsedEntries.length === 0) {
        throw new Error("No experience entries were detected. Add an Experience or Employment section and try again.");
      }

      const previousEntries = experienceEntries ?? [];
      const previousKeys = new Set(
        previousEntries.map((entry) => `${entry.role.trim().toLowerCase()}|${entry.employer.trim().toLowerCase()}`),
      );
      const savedMaster = await ipc().saveMasterResume(latex);
      const updatedEntries = await ipc().importExperienceEntries(parsedEntries);
      const added = updatedEntries.filter(
        (entry) => !previousKeys.has(`${entry.role.trim().toLowerCase()}|${entry.employer.trim().toLowerCase()}`),
      ).length;

      setMasterId(savedMaster.id);
      masterEditorValueRef.current = savedMaster.latex;
      setMasterLatex(savedMaster.latex);
      setPersistedLatex(savedMaster.latex);
      setUsingSample(false);
      setMasterSaveState("saved");
      setMasterSaveError(null);
      setExperienceEntries(updatedEntries);
      setExperienceError(null);
      setResumeImportResult({ added, skipped: parsedEntries.length - added });
      playSound("success");
    } catch (error) {
      setResumeImportError(errorMessage(error, "Could not import the LaTeX resume."));
      playSound("error");
    } finally {
      setResumeImporting(false);
    }
  }

  function loadSample() {
    setMasterLatex(SAMPLE_MASTER_LATEX);
    masterEditorValueRef.current = SAMPLE_MASTER_LATEX;
    setUsingSample(true);
    setMasterSaveState("idle");
    setMasterSaveError(null);
    tailorRequestRef.current += 1;
    setIsTailoring(false);
    setTailoredResult(null);
  }

  function clearSample() {
    setMasterLatex("");
    masterEditorValueRef.current = "";
    setUsingSample(false);
    setMasterSaveState("idle");
    tailorRequestRef.current += 1;
    setIsTailoring(false);
    setTailoredResult(null);
  }

  function openAddDraft() {
    setDraftValidation(null);
    setExperienceActionError(null);
    setEntrySaved(false);
    setRecordingError(null);
    setRecordingSuccess(false);
    setDraft({
      id: createId(),
      isNew: true,
      role: "",
      employer: "",
      source: "experience",
      startDate: "",
      endDate: "",
      bullets: [""],
      skillsText: "",
    });
  }

  function openEditDraft(entry: ExperienceEntry) {
    setDraftValidation(null);
    setExperienceActionError(null);
    setEntrySaved(false);
    setRecordingError(null);
    setRecordingSuccess(false);
    setDraft({
      id: entry.id,
      isNew: false,
      role: entry.role,
      employer: entry.employer,
      source: entry.source ?? "experience",
      startDate: entry.startDate ?? "",
      endDate: entry.endDate ?? "",
      bullets: entry.bullets.length ? [...entry.bullets] : [""],
      skillsText: entry.skills.join(", "),
    });
  }

  function closeDraft() {
    if (entrySaving || recordingState !== "idle") return;
    setDraft(null);
    setDraftValidation(null);
    setRecordingError(null);
    setRecordingSuccess(false);
  }

  function setDraftField<K extends keyof ExperienceDraft>(key: K, value: ExperienceDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function changeDraftSource(source: string) {
    setDraft((current) => {
      if (!current) return current;
      if (source === "skill") return { ...current, source, employer: "Skills", startDate: "", endDate: "", bullets: [] };
      if (source === "project") return { ...current, source, employer: current.employer === "Skills" ? "Project" : current.employer };
      return { ...current, source, employer: current.employer === "Skills" || current.employer === "Project" ? "" : current.employer };
    });
  }

  function sourceLabel(source: string): string {
    if (source === "experience") return "Job Experience";
    if (source === "project") return "Project";
    if (source === "skill") return "Skills";
    return source.charAt(0).toUpperCase() + source.slice(1);
  }

  function updateBullet(index: number, value: string) {
    setDraft((current) => {
      if (!current) return current;
      const bullets = current.bullets.slice();
      bullets[index] = value;
      return { ...current, bullets };
    });
  }

  function addBullet() {
    setDraft((current) => (current ? { ...current, bullets: [...current.bullets, ""] } : current));
  }

  function removeBullet(index: number) {
    setDraft((current) => {
      if (!current) return current;
      const bullets = current.bullets.filter((_, bulletIndex) => bulletIndex !== index);
      return { ...current, bullets: bullets.length ? bullets : [""] };
    });
  }

  async function handleUpsertEntry(event: FormEvent) {
    event.preventDefault();
    if (!draft || entrySaving) return;
    const validation: { role?: string; employer?: string } = {};
    if (!draft.role.trim()) validation.role = draft.source === "skill" ? "Add a skill category." : draft.source === "project" ? "Add a project name." : "Add a role title.";
    if (draft.source !== "skill" && !draft.employer.trim()) validation.employer = draft.source === "project" ? "Add a project or organization." : "Add an employer or organization.";
    setDraftValidation(validation);
    if (validation.role || validation.employer) return;

    const entry: ExperienceEntry = {
      id: draft.id,
      role: draft.role.trim(),
      employer: draft.employer.trim() || "Skills",
      startDate: draft.startDate || null,
      endDate: draft.endDate || null,
      bullets: draft.bullets.map((bullet) => bullet.trim()).filter(Boolean),
      skills: draft.skillsText.split(",").map((skill) => skill.trim()).filter(Boolean),
      source: draft.source,
    };

    setEntrySaving(true);
    setEntrySaved(false);
    setExperienceActionError(null);
    try {
      const updatedList = await ipc().upsertExperienceEntry(entry);
      setExperienceEntries(updatedList);
      setDraft(null);
      setDraftValidation(null);
      setEntrySaved(true);
      playSound("success");
    } catch (error) {
      setExperienceActionError(errorMessage(error, "Could not save the entry."));
      playSound("error");
    } finally {
      setEntrySaving(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    if (deletingEntryId) return;
    setDeletingEntryId(id);
    setExperienceActionError(null);
    try {
      const updatedList = await ipc().deleteExperienceEntry(id);
      setExperienceEntries(updatedList);
      setConfirmingDeleteId(null);
      playSound("delete");
    } catch (error) {
      setExperienceActionError(errorMessage(error, "Could not delete the entry."));
      playSound("error");
    } finally {
      setDeletingEntryId(null);
    }
  }

  function pickRecordingMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm"];
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
      const supported = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      if (supported) return supported;
    }
    return "audio/webm";
  }

  function releaseRecordingStream() {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;
    recorderRef.current = null;
  }

  function recordingErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        return "Microphone permission denied. Allow microphone access and try again.";
      }
      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        return "No microphone was found on this computer.";
      }
      if (error.name === "NotReadableError") {
        return "Your microphone is busy or unavailable right now.";
      }
    }
    return errorMessage(error, "Couldn't start recording. Try again.");
  }

  async function startRecording() {
    if (recordingState !== "idle" || !draft) return;
    setRecordingError(null);
    setRecordingSuccess(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access isn't available in this window.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordingMimeTypeRef.current = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, { mimeType: recordingMimeTypeRef.current });
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseRecordingStream();
        const blob = new Blob(recordingChunksRef.current, { type: recordingMimeTypeRef.current });
        recordingChunksRef.current = [];
        setRecordingSeconds(0);
        setRecordingState("transcribing");
        void transcribeBlob(blob);
      };
      recorder.onerror = () => {
        releaseRecordingStream();
        if (!mountedRef.current) return;
        setRecordingSeconds(0);
        setRecordingState("idle");
        setRecordingError("Recording failed. Try again.");
      };
      recorder.start(250);
      setRecordingSeconds(0);
      setRecordingState("recording");
    } catch (error) {
      setRecordingState("idle");
      setRecordingError(recordingErrorMessage(error));
    }
  }

  const stopActiveRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseRecordingStream();
      setRecordingState("idle");
      setRecordingSeconds(0);
      return;
    }
    try {
      recorder.stop();
    } catch {
      releaseRecordingStream();
      setRecordingState("idle");
      setRecordingSeconds(0);
    }
  }, []);

  async function transcribeBlob(blob: Blob) {
    try {
      if (blob.size === 0) throw new Error("No audio was captured. Try again.");
      const audio = new Uint8Array(await blob.arrayBuffer());
      const result = await ipc().transcribeAudio({ audio, mimeType: blob.type || "audio/webm" });
      const text = result.text.trim();
      if (!text) {
        if (mountedRef.current) setRecordingError("No speech was detected. Try recording again.");
        return;
      }
      if (mountedRef.current) {
        setDraft((current) => {
          if (!current) return current;
          const bullets = current.bullets.slice();
          const last = bullets[bullets.length - 1];
          if (last && !last.trim()) {
            bullets[bullets.length - 1] = text;
          } else {
            bullets.push(text);
          }
          return { ...current, bullets };
        });
        setRecordingSuccess(true);
      }
    } catch (error) {
      if (mountedRef.current) setRecordingError(errorMessage(error, "Transcription failed. Try again."));
    } finally {
      if (mountedRef.current) {
        setRecordingState("idle");
        setRecordingSeconds(0);
      }
    }
  }

  useEffect(() => {
    if (recordingState !== "recording") return;
    if (recordingSeconds >= MAX_RECORDING_SECONDS) {
      stopActiveRecording();
      return;
    }
    const tick = window.setTimeout(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearTimeout(tick);
  }, [recordingState, recordingSeconds, stopActiveRecording]);

  const selectedApplication = applications?.find((application) => application.id === selectedApplicationId) ?? null;

  function handleSelectApplication(id: string) {
    setSelectedApplicationId(id);
    setTailorError(null);
    setTailoredResult(null);
    const application = applications?.find((candidate) => candidate.id === id);
    if (application) {
      setJobCompany(application.company);
      setJobTitle(application.title);
      setJobUrl(application.jobUrl);
      setJobDescription(application.jobDescription);
    } else {
      setJobCompany("");
      setJobTitle("");
      setJobUrl("");
      setJobDescription("");
    }
  }

  function updateJobField(setter: (value: string) => void, value: string) {
    setter(value);
    if (tailoredResult) setTailoredResult(null);
  }

  const masterReady = masterLatex.trim().length > 0;
  const jobReady = jobDescription.trim().length > 0;
  const canTailor = masterReady && jobReady && !isTailoring;

  async function handleTailor() {
    if (!canTailor) return;
    const requestId = ++tailorRequestRef.current;
    setIsTailoring(true);
    setTailorError(null);
    setTailoredResult(null);
    const jobContext = { company: jobCompany.trim(), title: jobTitle.trim(), jobUrl: jobUrl.trim() };
    try {
      const request = {
        masterLatex,
        jobDescription: jobDescription.trim(),
        ...(Object.values(jobContext).some(Boolean) ? { jobContext } : {}),
        ...(experienceEntries && experienceEntries.length > 0 ? { experienceBank: experienceEntries } : {}),
      };
      const result = await ipc().generateTailoredResume(request);
      if (requestId !== tailorRequestRef.current) return;
      setTailoredResult(result);
      setTailoredLatex(result.latex);
      playSound("success");
    } catch (error) {
      if (requestId !== tailorRequestRef.current) return;
      setTailorError(errorMessage(error, "Could not tailor the resume. Try again."));
      setTailorErrorNonce((nonce) => nonce + 1);
      playSound("error");
    } finally {
      if (requestId === tailorRequestRef.current) setIsTailoring(false);
    }
  }

  // id "" and empty masterId ask the backend to assign or resolve identifiers for the saved version.
  async function handleSaveTailored() {
    if (reviewSaving === "saving" || !tailoredResult || !tailoredLatex) return;
    setReviewSaving("saving");
    setReviewSaveError(null);
    const now = new Date().toISOString();
    const record: TailoredResumeRecord = {
      id: "",
      masterId: masterId || "",
      latex: tailoredLatex,
      company: jobCompany.trim() || null,
      title: jobTitle.trim() || null,
      jobUrl: jobUrl.trim() || null,
      jobDescription: jobDescription.trim() || null,
      changesSummary: tailoredResult.changesSummary,
      createdAt: now,
    };
    try {
      await ipc().saveTailoredResume(record);
      setReviewSaving("saved");
      playSound("success");
    } catch (error) {
      setReviewSaving("error");
      setReviewSaveError(errorMessage(error, "Could not save the tailored resume."));
      playSound("error");
    }
  }

  function suggestedPdfFileName(): string {
    const parts = [jobCompany.trim(), jobTitle.trim()].filter(Boolean);
    return parts.length ? `${parts.join(" - ")} - Tailored.pdf` : "Tailored resume.pdf";
  }

  async function handleDownloadPdf() {
    if (pdfBusy || exportBusy || !tailoredResult) return;
    setPdfBusy(true);
    setPdfOutcome(null);
    try {
      const pdf = getTailoredPdf();
      const savedPath = await ipc().downloadResumePdf({ pdf, suggestedFileName: suggestedPdfFileName() });
      if (savedPath) {
        setPdfOutcome({ kind: "success", message: `Saved to ${savedPath}.` });
        playSound("success");
      } else {
        setPdfOutcome({ kind: "cancel", message: "No file saved — you cancelled." });
      }
    } catch (error) {
      setPdfOutcome({ kind: "error", message: errorMessage(error, "Could not create the PDF.") });
      playSound("error");
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleExportToFolder() {
    if (pdfBusy || exportBusy || !tailoredResult) return;
    setExportBusy(true);
    setExportOutcome(null);
    try {
      const pdf = getTailoredPdf();
      const target = [jobCompany.trim(), jobTitle.trim()].filter(Boolean).join(" — ") || "this role";
      const provenance = `Generated for ${target} on ${new Date().toLocaleDateString()}. Tailored from the master resume and reviewed before export.`;
      const folderPath = await ipc().exportResumeToFolder({
        pdf,
        latex: tailoredLatex,
        summary: `${tailoredResult.changesSummary.join("\n")}\n${provenance}`,
        company: jobCompany.trim(),
        title: jobTitle.trim(),
      });
      if (folderPath) {
        setExportOutcome({ kind: "success", message: `Saved PDF, LaTeX, and change summary to ${folderPath}.` });
        setExportStamp(true);
        playSound("success");
      } else {
        setExportOutcome({ kind: "cancel", message: "No file saved — you cancelled." });
      }
    } catch (error) {
      setExportOutcome({ kind: "error", message: errorMessage(error, "Could not export the resume.") });
      playSound("error");
    } finally {
      setExportBusy(false);
    }
  }

  function getTailoredPdf(): Uint8Array {
    if (tailoredPreview.compileError) throw new Error(tailoredPreview.compileError);
    if (!tailoredPreview.pdf) throw new Error("Wait for the LaTeX PDF preview to finish compiling.");
    return tailoredPreview.pdf;
  }

  const exportDisabled = pdfBusy || exportBusy || reviewSaving === "saving" || tailoredPreview.compiling || tailoredPreview.compileError !== null || !tailoredPreview.pdf;
  const masterDirty = !masterLoading && !masterError && masterLatex !== persistedLatex;

  return (
    <Stagger className="mx-auto min-w-0 max-w-[1240px]" gap={STAGGER.section} lead={STAGGER.lead}>
      <StaggerItem>
       <header>
        <div className="flex items-baseline justify-between gap-8 pb-3">
          <h1 className="font-display text-[40px] leading-[0.95] tracking-[-0.015em] text-ink">Resumes</h1>
          <p className="max-w-[300px] text-right text-[12px] leading-relaxed text-ink-2">
            Your master resume stays on this computer — tailored copies are reviewed here before they are saved.
          </p>
        </div>
        <DrawnRule delay={0.12} />
       </header>
      </StaggerItem>

      <StaggerItem className="mt-8">
       <section aria-labelledby="master-resume-heading">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="master-resume-heading" className="font-display text-[24px] leading-none text-ink">
                  Master resume
                </h2>
                <DrawnRule className="mt-2 max-w-[132px]" tone="bg-oxblood/70" delay={0.24} />
                <p className="mt-1.5 text-[12px] text-ink-2">
                  The single source of truth for tailoring — tailoring never edits this document.
                </p>
              </div>
              {usingSample && (
                <div className="flex items-center gap-3">
                  <p role="status" className="text-[12px] text-ink-2">
                    You are editing sample text.
                  </p>
                  <Button variant="ghost" onClick={clearSample}>
                    Clear sample
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence initial={false}>
              {masterLoading && (
                <motion.p
                  key="master-loading"
                  role="status"
                  className="pulse-soft mb-3 text-[12px] text-ink-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: TRANSITION.exit }}
                  transition={TRANSITION.base}
                >
                  Loading master resume…
                </motion.p>
              )}
              {masterError && (
                <motion.div
                  key="master-error"
                  role="alert"
                  className="mb-4 flex flex-wrap items-center gap-3 border-l-2 border-oxblood pl-3 text-[12px] text-ink-2"
                  initial={{ opacity: 0, y: DISTANCE.rise }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6, transition: TRANSITION.exit }}
                  transition={TRANSITION.base}
                >
                  <span>{masterError}</span>
                  <Button variant="quiet" onClick={() => void loadMaster()}>
                    Retry
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {!masterLoading && !masterError && !masterLatex.trim() && (
              <motion.div
                className="mb-4 flex flex-wrap items-start gap-5 rounded-md border border-dashed border-hairline bg-paper px-4 py-5"
                initial={{ opacity: 0, y: DISTANCE.rise }}
                animate={{ opacity: 1, y: 0 }}
                transition={TRANSITION.slow}
              >
                <GhostDrift className="shrink-0">
                  <GhostGlyph className="h-11 w-11 text-ink-3" />
                </GhostDrift>
                <div className="min-w-[240px] flex-1">
                  <p className="text-[13px] font-medium text-ink">No master resume yet.</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                    Write your LaTeX resume below, and it is stored only on this computer. Use the sample
                    to preview the flow with placeholder text.
                  </p>
                  <div className="mt-3">
                    <Button variant="outline" onClick={loadSample}>
                      Use a sample resume
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
            <div className="mb-4 rounded-md border border-hairline bg-paper px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="resume-tex-upload"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-md border border-hairline bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink hover:bg-paper",
                    resumeImporting && "cursor-not-allowed opacity-60",
                  )}
                >
                  <FileUp size={13} />
                  {resumeImporting ? "Importing resume…" : "Upload .tex resume"}
                </label>
                <input
                  id="resume-tex-upload"
                  type="file"
                  accept=".tex,text/plain"
                  onChange={(event) => void handleResumeUpload(event)}
                  disabled={resumeImporting}
                  className="sr-only"
                />
                <p className="text-[12px] text-ink-2">
                  Upload your LaTeX file to save it as the master resume and add detected experience entries automatically.
                </p>
              </div>
              <AnimatePresence initial={false}>
                {resumeImportError && (
                  <motion.p
                    key="import-error"
                    role="alert"
                    className="mt-2 text-[12px] text-oxblood"
                    initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                    animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                    exit={{ opacity: 0, transition: TRANSITION.exit }}
                    transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                  >
                    {resumeImportError}
                  </motion.p>
                )}
                {resumeImportResult && (
                  <motion.p
                    key="import-result"
                    role="status"
                    className="mt-2 text-[12px] text-verdigris"
                    initial={{ opacity: 0, scale: 0.9, y: DISTANCE.riseSmall }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                    transition={SPRING.overshoot}
                  >
                    Resume imported. Added {resumeImportResult.added} {resumeImportResult.added === 1 ? "entry" : "entries"}
                    {resumeImportResult.skipped > 0 ? `; skipped ${resumeImportResult.skipped} duplicate or unsupported ${resumeImportResult.skipped === 1 ? "entry" : "entries"}.` : "."}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <LatexSourceEditor
              value={masterLatex}
              onChange={handleMasterChange}
              latexId="master-latex"
              compileError={masterPreview.compileError}
              pdf={masterPreview.pdf}
              compiling={masterPreview.compiling}
              scanning={isTailoring}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="ink" silent onClick={() => void handleSaveMaster()} disabled={masterSaving || masterLoading || !masterLatex.trim()}>
                <Save size={13} />
                {masterSaving ? "Saving…" : "Save master resume"}
              </Button>
              <AnimatePresence initial={false} mode="wait">
                {masterDirty && masterSaveState === "idle" && (
                  <motion.p
                    key="master-dirty"
                    role="status"
                    className="flex items-center gap-2 text-[12px] text-ink-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: TRANSITION.exit }}
                    transition={{ duration: DURATION.quick, ease: EASE.subtle }}
                  >
                    <motion.span
                      aria-hidden="true"
                      className="pulse-soft block h-1.5 w-1.5 rounded-full bg-oxblood"
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, SCALE.pop, 1] }}
                      transition={SPRING.overshoot}
                    />
                    Unsaved changes.
                  </motion.p>
                )}
                {masterSaveState === "saved" && (
                  <motion.p
                    key="master-saved"
                    role="status"
                    className="text-[12px] text-verdigris"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                    transition={SPRING.overshoot}
                  >
                    Master resume saved.
                  </motion.p>
                )}
                {masterSaveState === "error" && (
                  <motion.p
                    key={`master-save-error-${masterSaveNonce}`}
                    role="alert"
                    className="text-[12px] text-oxblood"
                    initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                    animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                    exit={{ opacity: 0, transition: TRANSITION.exit }}
                    transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                  >
                    {masterSaveError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
       </section>
      </StaggerItem>

      <StaggerItem className="mt-6">
       <section aria-labelledby="experience-bank-heading">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 id="experience-bank-heading" className="font-display text-[24px] leading-none text-ink">
                  Experience bank
                </h2>
                <DrawnRule className="mt-2 max-w-[132px]" tone="bg-oxblood/70" delay={0.3} />
                <p className="mt-1.5 text-[12px] text-ink-2">
                  Structured roles, projects, and education that tailoring can draw from.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {experienceEntries && (
                  <div className="tnum flex items-center gap-1 text-[12px] text-ink-2">
                    <AnimatedNumber value={experienceEntries.length} duration={DURATION.slow} className="tnum" />
                    {experienceEntries.length === 1 ? "entry" : "entries"}
                  </div>
                )}
                {!draft && (
                  <Button variant="outline" onClick={openAddDraft}>
                    <Plus size={13} />
                    Add entry
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence initial={false}>
              {experienceLoading && (
                <motion.p
                  key="experience-loading"
                  role="status"
                  className="pulse-soft text-[12px] text-ink-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: TRANSITION.exit }}
                  transition={TRANSITION.base}
                >
                  Loading experience entries…
                </motion.p>
              )}
              {experienceError && (
                <motion.div
                  key="experience-error"
                  role="alert"
                  className="flex flex-wrap items-center gap-3 border-l-2 border-oxblood pl-3 text-[12px] text-ink-2"
                  initial={{ opacity: 0, y: DISTANCE.rise }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6, transition: TRANSITION.exit }}
                  transition={TRANSITION.base}
                >
                  <span>{experienceError}</span>
                  <Button variant="quiet" onClick={() => void loadExperienceEntries()}>
                    Retry
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {experienceEntries && experienceEntries.length === 0 && !draft && (
              <motion.div
                className="flex flex-wrap items-center gap-5 border-y border-dashed border-hairline py-6"
                initial={{ opacity: 0, y: DISTANCE.rise }}
                animate={{ opacity: 1, y: 0 }}
                transition={TRANSITION.slow}
              >
                <GhostDrift className="shrink-0">
                  <GhostGlyph className="h-11 w-11 text-ink-3" />
                </GhostDrift>
                <p className="min-w-[240px] flex-1 font-display text-[18px] leading-snug text-ink-2">
                  No experience entries yet. Add roles, projects, or education so tailoring has more to draw from.
                </p>
              </motion.div>
            )}
            <AnimatePresence mode="wait" initial={false}>
            {draft ? (
              <motion.form
                key="experience-draft"
                onSubmit={(event) => void handleUpsertEntry(event)}
                className="rounded-md border border-hairline bg-paper p-4"
                initial={{ opacity: 0, y: DISTANCE.rise }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: TRANSITION.exit }}
                transition={TRANSITION.base}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="exp-role" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      {draft.source === "skill" ? "Skill category" : draft.source === "project" ? "Project name" : "Role title"}
                    </label>
                    <Input
                      id="exp-role"
                      variant="default"
                      value={draft.role}
                      onChange={(event) => setDraftField("role", event.target.value)}
                      aria-invalid={!!draftValidation?.role}
                      aria-describedby={draftValidation?.role ? "exp-role-error" : undefined}
                    />
                    {draftValidation?.role && (
                      <p id="exp-role-error" role="alert" className="mt-1 text-[11px] text-oxblood">
                        {draftValidation.role}
                      </p>
                    )}
                  </div>
                  {draft.source !== "skill" && (
                    <div>
                      <label htmlFor="exp-employer" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                        {draft.source === "project" ? "Project or organization" : "Employer"}
                      </label>
                      <Input
                        id="exp-employer"
                        variant="default"
                        value={draft.employer}
                        onChange={(event) => setDraftField("employer", event.target.value)}
                        aria-invalid={!!draftValidation?.employer}
                        aria-describedby={draftValidation?.employer ? "exp-employer-error" : undefined}
                      />
                      {draftValidation?.employer && (
                        <p id="exp-employer-error" role="alert" className="mt-1 text-[11px] text-oxblood">
                          {draftValidation.employer}
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label htmlFor="exp-source" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      Source
                    </label>
                    <select
                      id="exp-source"
                      value={draft.source}
                      onChange={(event) => changeDraftSource(event.target.value)}
                      className="w-full rounded-md border border-hairline bg-paper-raised px-3 py-2 text-sm text-ink focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood"
                    >
                      {EXPERIENCE_SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {sourceLabel(source)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {draft.source !== "skill" && <div>
                    <label htmlFor="exp-dates-note" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      Dates
                    </label>
                    <p id="exp-dates-note" className="text-[11px] leading-relaxed text-ink-3">
                      Leave the end date empty for a current role.
                    </p>
                  </div>}
                  {draft.source !== "skill" && <div>
                    <label htmlFor="exp-start-date" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      Start date
                    </label>
                    <Input
                      id="exp-start-date"
                      variant="default"
                      type="date"
                      className="tnum"
                      value={draft.startDate}
                      onChange={(event) => setDraftField("startDate", event.target.value)}
                    />
                  </div>}
                  {draft.source !== "skill" && <div>
                    <label htmlFor="exp-end-date" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      End date
                    </label>
                    <Input
                      id="exp-end-date"
                      variant="default"
                      type="date"
                      className="tnum"
                      value={draft.endDate}
                      onChange={(event) => setDraftField("endDate", event.target.value)}
                    />
                  </div>}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-medium text-ink-2">Bullets</p>
                    <Button type="button" variant="ghost" onClick={addBullet}>
                      <Plus size={13} />
                      Add bullet
                    </Button>
                  </div>
                  {draft.bullets.length === 0 ? (
                    <p className="mt-1.5 text-[11px] text-ink-3">No bullets yet. Add a few concrete accomplishments.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {draft.bullets.map((bullet, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Input
                            variant="default"
                            value={bullet}
                            onChange={(event) => updateBullet(index, event.target.value)}
                            placeholder="One concrete accomplishment"
                            aria-label={`Bullet ${index + 1}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2 py-2"
                            onClick={() => removeBullet(index)}
                            aria-label={`Remove bullet ${index + 1}`}
                          >
                            <X size={14} />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="relative inline-flex">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={recordingState === "recording" ? stopActiveRecording : () => void startRecording()}
                        disabled={recordingState === "transcribing" || entrySaving}
                        aria-label={
                          recordingState === "recording"
                            ? "Stop recording and transcribe"
                            : recordingState === "transcribing"
                              ? "Transcribing recording"
                              : "Record experience from microphone"
                        }
                      >
                        {recordingState === "recording" ? (
                          <>
                            <Square size={13} className="fill-current" />
                            Stop recording
                          </>
                        ) : recordingState === "transcribing" ? (
                          "Transcribing"
                        ) : (
                          <>
                            <Mic size={13} />
                            Record from microphone
                          </>
                        )}
                      </Button>
                      <AnimatePresence>
                        {recordingState === "recording" && (
                          <motion.span
                            key="record-ring"
                            aria-hidden="true"
                            className="pulse-soft pointer-events-none absolute -inset-1 rounded-md ring-2 ring-oxblood"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0, transition: SPRING.press }}
                            transition={SPRING.overshoot}
                          />
                        )}
                      </AnimatePresence>
                    </span>
                    {recordingState === "recording" && (
                      <p role="status" className="tnum flex items-center gap-2 text-[12px] text-ink-2">
                        <LevelBars />
                        Recording {formatClock(recordingSeconds)} / {formatClock(MAX_RECORDING_SECONDS)}
                      </p>
                    )}
                    {recordingState === "transcribing" && (
                      <p role="status" className="pulse-soft text-[12px] text-ink-2">
                        Transcribing… this may take a moment.
                      </p>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {recordingError && (
                      <motion.p
                        key="recording-error"
                        role="alert"
                        className="mt-2 text-[11px] leading-relaxed text-oxblood"
                        initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                        animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                        exit={{ opacity: 0, transition: TRANSITION.exit }}
                        transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                      >
                        {recordingError}
                      </motion.p>
                    )}
                    {recordingSuccess && (
                      <motion.p
                        key="recording-success"
                        role="status"
                        className="mt-2 text-[11px] text-verdigris"
                        initial={{ opacity: 0, y: DISTANCE.rise }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: TRANSITION.exit }}
                        transition={TRANSITION.base}
                      >
                        Transcription added as a new bullet.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-4">
                  <label htmlFor="exp-skills" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                    Skills
                  </label>
                  <Input
                    id="exp-skills"
                    variant="default"
                    value={draft.skillsText}
                    onChange={(event) => setDraftField("skillsText", event.target.value)}
                    placeholder="Leadership, React, Public speaking"
                    aria-describedby="exp-skills-hint"
                  />
                  <p id="exp-skills-hint" className="mt-1 text-[11px] text-ink-3">
                    Comma separated. Optional.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="ink" silent disabled={entrySaving || recordingState !== "idle"}>
                    {entrySaving ? "Saving…" : draft.isNew ? "Save entry" : "Save changes"}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDraft} disabled={entrySaving || recordingState !== "idle"}>
                    Cancel
                  </Button>
                  <AnimatePresence initial={false}>
                    {experienceActionError && (
                      <motion.p
                        key="entry-action-error"
                        role="alert"
                        className="text-[12px] text-oxblood"
                        initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                        animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                        exit={{ opacity: 0, transition: TRANSITION.exit }}
                        transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                      >
                        {experienceActionError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.form>
            ) : experienceEntries && experienceEntries.length > 0 ? (
              <motion.ul
                key="experience-list"
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: TRANSITION.exit }}
                transition={TRANSITION.base}
              >
                <AnimatePresence initial={false}>
                {experienceEntries.map((entry, entryIndex) => {
                  const dateRange = entryDateRange(entry);
                  return (
                    <motion.li
                      key={entry.id}
                      className="rounded-md border border-hairline bg-paper-raised p-4"
                      initial={{ opacity: 0, y: DISTANCE.rise }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 10, scale: SCALE.exit, transition: TRANSITION.exit }}
                      transition={{ ...TRANSITION.base, delay: Math.min(entryIndex, 11) * STAGGER.list }}
                      whileHover={{
                        y: DISTANCE.liftRow,
                        boxShadow: "5px 5px 0 0 var(--card-shadow)",
                        transition: SPRING.hover,
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-semibold text-ink">{entry.role}</h3>
                            {entry.source && <Badge>{entry.source}</Badge>}
                          </div>
                          <p className="mt-0.5 text-[12px] text-ink-2">{entry.employer}</p>
                          {dateRange && <p className="tnum mt-0.5 text-[12px] text-ink-3">{dateRange}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <AnimatePresence mode="wait" initial={false}>
                          {confirmingDeleteId === entry.id ? (
                            <motion.span
                              key="confirm"
                              className="flex items-center gap-1"
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                              transition={TRANSITION.base}
                            >
                              <Button
                                variant="outline"
                                silent
                                className="px-2 py-1.5 text-oxblood"
                                onClick={() => void handleDeleteEntry(entry.id)}
                                disabled={deletingEntryId !== null}
                              >
                                {deletingEntryId === entry.id ? "Deleting…" : "Confirm delete"}
                              </Button>
                              <Button
                                variant="ghost"
                                className="px-2 py-1.5"
                                onClick={() => setConfirmingDeleteId(null)}
                                aria-label="Cancel delete"
                              >
                                Cancel
                              </Button>
                            </motion.span>
                          ) : (
                            <motion.span
                              key="actions"
                              className="flex items-center gap-1"
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                              transition={TRANSITION.base}
                            >
                              <Button
                                variant="ghost"
                                className="px-2 py-1.5"
                                onClick={() => openEditDraft(entry)}
                                aria-label={`Edit ${entry.role}`}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                className="px-2 py-1.5 text-oxblood"
                                onClick={() => {
                                  setExperienceActionError(null);
                                  setConfirmingDeleteId(entry.id);
                                }}
                                aria-label={`Delete ${entry.role}`}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </motion.span>
                          )}
                          </AnimatePresence>
                        </div>
                      </div>
                      {entry.bullets.length > 0 && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] leading-relaxed text-ink-2">
                          {entry.bullets.map((bullet, index) => (
                            <li key={index}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                      {entry.skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {entry.skills.map((skill) => (
                            <Badge key={skill}>{skill}</Badge>
                          ))}
                        </div>
                      )}
                    </motion.li>
                  );
                })}
                </AnimatePresence>
              </motion.ul>
            ) : null}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {experienceEntries && entrySaved && (
                <motion.p
                  key="entry-saved"
                  role="status"
                  className="mt-3 text-[12px] text-verdigris"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                  transition={SPRING.overshoot}
                >
                  Entry saved.
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
       </section>
      </StaggerItem>

      <StaggerItem className="mt-6 pb-10">
       <RevealOnScroll amount={0.02}>
       <section aria-labelledby="tailor-heading">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="tailor-heading" className="font-display text-[24px] leading-none text-ink">
                  Tailor to a job
                </h2>
                <DrawnRule className="mt-2 max-w-[132px]" tone="bg-oxblood/70" delay={0.18} />
                <p className="mt-1.5 text-[12px] text-ink-2">
                  Pick a saved application or paste a description, then review everything before it is saved.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor="job-select" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                  Select a saved application
                </label>
                {applicationsLoading && (
                  <p role="status" className="pulse-soft text-[12px] text-ink-2">
                    Loading saved applications…
                  </p>
                )}
                {applicationsError && (
                  <div role="alert" className="flex flex-wrap items-center gap-3 border-l-2 border-oxblood pl-3 text-[12px] text-ink-2">
                    <span>{applicationsError}</span>
                    <Button variant="quiet" onClick={() => void loadApplications()}>
                      Retry
                    </Button>
                  </div>
                )}
                {!applicationsLoading && !applicationsError && (
                  <select
                    id="job-select"
                    value={selectedApplicationId}
                    onChange={(event) => handleSelectApplication(event.target.value)}
                    disabled={!applications || applications.length === 0 || isTailoring}
                    className="w-full rounded-md border border-hairline bg-paper-raised px-3 py-2 text-sm text-ink focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood disabled:bg-paper disabled:text-ink-3"
                  >
                    <option value="">
                      {applications && applications.length > 0 ? "Choose a saved application…" : "No saved applications yet"}
                    </option>
                    {applications?.map((application) => (
                      <option key={application.id} value={application.id}>
                        {application.company} — {application.title}
                      </option>
                    ))}
                  </select>
                )}
                {applications && applications.length === 0 && !applicationsError && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-2">
                    Save a job from the browser extension, or paste a description below instead.
                  </p>
                )}
                {selectedApplication && (
                  <div className="mt-3 rounded-md border border-hairline bg-paper px-3 py-2.5 text-[12px] leading-relaxed text-ink-2">
                    <p>
                      <span className="font-medium">
                        {selectedApplication.company} — {selectedApplication.title}
                      </span>
                      {selectedApplication.location ? ` · ${selectedApplication.location}` : ""}
                      {selectedApplication.dateFound ? ` · found ${formatDate(selectedApplication.dateFound)}` : ""}
                      {selectedApplication.jobUrl ? (
                        <>
                          {" · "}
                          <a
                            href={selectedApplication.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2 hover:text-ink"
                          >
                            posting
                          </a>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-ink-3">
                      This saved application fills in the job details used for the tailored version.
                    </p>
                  </div>
                )}
                {selectedApplication && !jobDescription.trim() && (
                  <p role="status" className="mt-2 border-l-2 border-brass pl-3 text-[11px] leading-relaxed text-ink-2">
                    This saved job has no description saved yet. Paste the job text below and it will be used instead.
                  </p>
                )}
              </div>

              <div>
                <p className="text-[12px] text-ink-2">
                  Or paste a job description manually — company, title, and URL are optional.
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="job-company" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      Company
                    </label>
                    <Input
                      id="job-company"
                      variant="default"
                      value={jobCompany}
                      onChange={(event) => updateJobField(setJobCompany, event.target.value)}
                      disabled={isTailoring}
                    />
                  </div>
                  <div>
                    <label htmlFor="job-title" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      Title
                    </label>
                    <PredictiveInput
                      id="job-title"
                      variant="default"
                      value={jobTitle}
                      onValueChange={(value) => updateJobField(setJobTitle, value)}
                      disabled={isTailoring}
                      microPrompt="Complete this job posting title for resume tailoring returning only its continuation: "
                    />
                  </div>
                  <div>
                    <label htmlFor="job-url" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                      Job posting URL
                    </label>
                    <Input
                      id="job-url"
                      variant="default"
                      type="url"
                      value={jobUrl}
                      onChange={(event) => updateJobField(setJobUrl, event.target.value)}
                      disabled={isTailoring}
                      placeholder="https://"
                    />
                  </div>
                </div>
                <label htmlFor="job-description" className="mt-4 mb-1.5 block text-[12px] font-medium text-ink-2">
                  Job description
                </label>
                <textarea
                  id="job-description"
                  rows={8}
                  value={jobDescription}
                  onChange={(event) => updateJobField(setJobDescription, event.target.value)}
                  disabled={isTailoring}
                  placeholder="Paste the responsibilities, requirements, and anything the employer emphasized."
                  className="w-full resize-y rounded-md border border-hairline bg-paper-raised p-3 text-[13px] leading-5 text-ink placeholder:text-ink-3 focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood disabled:bg-paper"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-hairline pt-5">
              <Button variant="ink" silent onClick={() => void handleTailor()} disabled={!canTailor}>
                {isTailoring ? "Tailoring…" : "Tailor resume to this job"}
              </Button>
              <AnimatePresence initial={false} mode="wait">
                {isTailoring && (
                  <motion.p
                    key="tailoring"
                    role="status"
                    className="pulse-soft text-[12px] text-ink-2"
                    initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: TRANSITION.exit }}
                    transition={TRANSITION.base}
                  >
                    Generating a tailored draft…
                  </motion.p>
                )}
                {tailorError && !isTailoring && (
                  <motion.p
                    key={`tailor-error-${tailorErrorNonce}`}
                    role="alert"
                    className="text-[12px] leading-relaxed text-oxblood"
                    initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                    animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                    exit={{ opacity: 0, transition: TRANSITION.exit }}
                    transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                  >
                    {tailorError}
                  </motion.p>
                )}
              </AnimatePresence>
              {!tailoredResult && !isTailoring && !tailorError && (
                <p className="text-[12px] leading-relaxed text-ink-2">
                  {!masterReady
                    ? "Write a master resume above before tailoring."
                    : !jobReady
                      ? "Choose a saved application or paste a job description to tailor against."
                      : "Tailored drafts appear here for review — nothing is saved until you choose."}
                </p>
              )}
            </div>

            {tailoredResult && (
              <motion.div
                className="mt-8 border-t border-hairline pt-6"
                initial={{ opacity: 0, y: DISTANCE.riseLarge }}
                animate={{ opacity: 1, y: 0 }}
                transition={TRANSITION.slow}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h3 className="font-display text-[20px] text-ink">Review the tailored resume</h3>
                  <p className="text-[12px] text-ink-2">Your master resume is never modified.</p>
                </div>

                <div className="mt-5">
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Changes</h4>
                  {tailoredResult.changesSummary.length === 0 ? (
                    <p className="mt-2 text-[12px] text-ink-2">
                      No line-level changes were detected. This version may reword or reorder without removing content.
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                      {tailoredResult.changesSummary.map((line, index) => (
                        <ChangeLine key={index} line={line} index={index} />
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-6">
                  <LatexSourceEditor
                    value={tailoredLatex}
                    onChange={setTailoredLatex}
                    latexId="tailored-latex"
                    compileError={tailoredPreview.compileError}
                    pdf={tailoredPreview.pdf}
                    compiling={tailoredPreview.compiling}
                    minHeight="min-h-72"
                  />
                </div>

                <div className="relative mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    variant="ink"
                    silent
                    onClick={() => void handleSaveTailored()}
                    disabled={reviewSaving === "saving" || pdfBusy || exportBusy}
                  >
                    {reviewSaving === "saving" ? "Saving…" : "Save tailored resume"}
                  </Button>
                  <Button variant="outline" silent onClick={() => void handleDownloadPdf()} disabled={exportDisabled}>
                    <FileDown size={13} />
                    {pdfBusy ? "Generating PDF…" : "Download PDF"}
                  </Button>
                  <Button variant="outline" silent onClick={() => void handleExportToFolder()} disabled={exportDisabled}>
                    <FolderDown size={13} />
                    {exportBusy ? "Exporting…" : "Export to folder"}
                  </Button>
                  <Stamp label="EXPORTED" show={exportStamp} tone="ink" onDone={() => setExportStamp(false)} />
                </div>
                <AnimatePresence initial={false}>
                  {tailoredPreview.compileError && (
                    <motion.p
                      key="export-blocked"
                      role="alert"
                      className="mt-2 text-[11px] text-oxblood"
                      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: TRANSITION.exit }}
                      transition={TRANSITION.base}
                    >
                      Fix the LaTeX errors above before exporting.
                    </motion.p>
                  )}
                  {reviewSaving === "saved" && (
                    <motion.p
                      key="tailored-saved"
                      role="status"
                      className="mt-2 text-[12px] text-verdigris"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                      transition={SPRING.overshoot}
                    >
                      Tailored resume saved.
                    </motion.p>
                  )}
                  {reviewSaving === "error" && (
                    <motion.p
                      key="tailored-save-error"
                      role="alert"
                      className="mt-2 text-[12px] text-oxblood"
                      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                      animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                      exit={{ opacity: 0, transition: TRANSITION.exit }}
                      transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                    >
                      {reviewSaveError}
                    </motion.p>
                  )}
                  {pdfOutcome?.kind === "success" && (
                    <motion.p
                      key="pdf-success"
                      role="status"
                      className="mt-2 text-[12px] text-verdigris"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                      transition={SPRING.overshoot}
                    >
                      {pdfOutcome.message}
                    </motion.p>
                  )}
                  {pdfOutcome?.kind === "cancel" && (
                    <motion.p
                      key="pdf-cancel"
                      role="status"
                      className="mt-2 text-[12px] text-ink-2"
                      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: TRANSITION.exit }}
                      transition={TRANSITION.base}
                    >
                      {pdfOutcome.message}
                    </motion.p>
                  )}
                  {pdfOutcome?.kind === "error" && (
                    <motion.p
                      key="pdf-error"
                      role="alert"
                      className="mt-2 text-[12px] text-oxblood"
                      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                      animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                      exit={{ opacity: 0, transition: TRANSITION.exit }}
                      transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                    >
                      {pdfOutcome.message}
                    </motion.p>
                  )}
                  {exportOutcome?.kind === "success" && (
                    <motion.p
                      key="export-success"
                      role="status"
                      className="mt-2 text-[12px] text-verdigris"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit }}
                      transition={SPRING.overshoot}
                    >
                      {exportOutcome.message}
                    </motion.p>
                  )}
                  {exportOutcome?.kind === "cancel" && (
                    <motion.p
                      key="export-cancel"
                      role="status"
                      className="mt-2 text-[12px] text-ink-2"
                      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: TRANSITION.exit }}
                      transition={TRANSITION.base}
                    >
                      {exportOutcome.message}
                    </motion.p>
                  )}
                  {exportOutcome?.kind === "error" && (
                    <motion.p
                      key="export-error"
                      role="alert"
                      className="mt-2 text-[12px] text-oxblood"
                      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                      animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                      exit={{ opacity: 0, transition: TRANSITION.exit }}
                      transition={{ ...TRANSITION.base, x: { duration: DURATION.base, ease: EASE.out } }}
                    >
                      {exportOutcome.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </CardContent>
        </Card>
       </section>
       </RevealOnScroll>
      </StaggerItem>
    </Stagger>
  );
}