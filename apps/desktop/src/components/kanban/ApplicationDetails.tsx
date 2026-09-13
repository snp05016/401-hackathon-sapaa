import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  STAGE_LABELS,
  type Application,
  type ApplicationEvent,
  type ApplicationStage,
} from "@ghostboard/shared";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { ipc } from "../../lib/ipc";
import { modalBackdrop, modalPanel, TRANSITION } from "../../lib/motion";
import { playSound } from "../../lib/sound";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type DetailsTab = "overview" | "timeline" | "assistant";

function getStageLabel(stage: unknown): string {
  if (typeof stage === "string" && stage in STAGE_LABELS) {
    return STAGE_LABELS[stage as ApplicationStage];
  }
  return typeof stage === "string" ? stage : "";
}

interface ApplicationDetailsProps {
  application: Application;
  onClose: () => void;
  onApplicationUpdated?: (updated: Application) => void;
}

export function ApplicationDetails({
  application,
  onClose,
  onApplicationUpdated,
}: ApplicationDetailsProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>("overview");

  // Timeline events state
  const [events, setEvents] = useState<ApplicationEvent[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // New note form state
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Question Assistant state
  const defaultPresets = [
    "Why are you interested in this role?",
    `Why do you want to work at ${application.company || "our company"}?`,
    "Describe a difficult technical problem you solved.",
  ];
  const [selectedPreset, setSelectedPreset] = useState<string>(defaultPresets[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [draftingAnswer, setDraftingAnswer] = useState(false);
  const [draftedAnswer, setDraftedAnswer] = useState("");
  const [draftMeta, setDraftMeta] = useState<{ provider?: string; model?: string } | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [savingDraftAsNote, setSavingDraftAsNote] = useState(false);
  const [draftSavedFeedback, setDraftSavedFeedback] = useState(false);

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (draftSavedTimeoutRef.current) clearTimeout(draftSavedTimeoutRef.current);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch events when entering timeline tab or on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchEvents() {
      setLoadingEvents(true);
      setEventsError(null);
      try {
        const result = await ipc().listApplicationEvents(application.id);
        if (!cancelled) {
          setEvents(Array.isArray(result) ? result : []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          // If IPC handler is not available yet or errors, default to empty list
          setEvents([]);
          setEventsError("Could not load activity events.");
        }
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    }
    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, [application.id]);

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    const text = newNoteText.trim();
    if (!text || addingNote) return;

    setAddingNote(true);
    setNoteError(null);
    try {
      const createdEvent = await ipc().addApplicationNote({
        applicationId: application.id,
        text,
      });
      if (createdEvent) {
        setEvents((prev) => (prev ? [createdEvent, ...prev] : [createdEvent]));
        onApplicationUpdated?.({
          ...application,
          lastActivityAt: createdEvent.occurredAt,
          updatedAt: createdEvent.occurredAt,
        });
      }
      setNewNoteText("");
      playSound("success");
    } catch {
      setNoteError("Failed to save note. Please try again.");
      playSound("error");
    } finally {
      setAddingNote(false);
    }
  }

  const activeQuestion = customQuestion.trim() || selectedPreset;

  async function handleDraftAnswer() {
    if (!activeQuestion || draftingAnswer) return;
    setDraftingAnswer(true);
    setDraftError(null);
    setDraftSavedFeedback(false);
    try {
      const result = await ipc().draftApplicationAnswer({
        applicationId: application.id,
        company: application.company,
        role: application.title,
        question: activeQuestion,
        jobDescription: application.jobDescription,
      });
      setDraftedAnswer(result.answer);
      setDraftMeta({ provider: result.provider, model: result.model });
      playSound("success");
    } catch {
      setDraftError("Could not generate an answer draft. Please try again.");
      playSound("error");
    } finally {
      setDraftingAnswer(false);
    }
  }

  async function handleCopyAnswer() {
    if (!draftedAnswer) return;
    try {
      await navigator.clipboard.writeText(draftedAnswer);
      setCopiedAnswer(true);
      playSound("tap");
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedAnswer(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleSaveDraftAsNote() {
    if (!draftedAnswer || savingDraftAsNote) return;
    setSavingDraftAsNote(true);
    try {
      const noteTitle = `AI Draft: ${activeQuestion}`;
      const noteContent = `Q: ${activeQuestion}\n\n${draftedAnswer}`;
      const createdEvent = await ipc().addApplicationNote({
        applicationId: application.id,
        title: noteTitle,
        text: noteContent,
      });
      if (createdEvent) {
        setEvents((prev) => (prev ? [createdEvent, ...prev] : [createdEvent]));
        onApplicationUpdated?.({
          ...application,
          lastActivityAt: createdEvent.occurredAt,
          updatedAt: createdEvent.occurredAt,
        });
      }
      setDraftSavedFeedback(true);
      playSound("success");
      if (draftSavedTimeoutRef.current) clearTimeout(draftSavedTimeoutRef.current);
      draftSavedTimeoutRef.current = setTimeout(() => setDraftSavedFeedback(false), 3000);
    } catch {
      setDraftError("Failed to save draft to notes.");
      playSound("error");
    } finally {
      setSavingDraftAsNote(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="application-details-title"
    >
      <motion.button
        type="button"
        variants={modalBackdrop}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 cursor-default bg-ink/40"
        aria-label="Close application details"
        onClick={onClose}
      />
      <motion.section
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden border border-hairline bg-paper-raised shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-5 border-b border-hairline px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="ink" className="uppercase tracking-[0.14em]">
                {getStageLabel(application.status)}
              </Badge>
              {application.location && (
                <span className="text-[12px] text-ink-3">· {application.location}</span>
              )}
            </div>
            <h2
              id="application-details-title"
              className="mt-1 break-words font-display text-[26px] leading-tight text-ink sm:text-[32px]"
            >
              {application.title}
            </h2>
            <p className="mt-0.5 text-[14px] text-ink-2 font-medium">{application.company}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-ink-2 transition-colors hover:text-ink focus:outline-none"
            aria-label="Close application details"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </button>
        </header>

        {/* Tab Navigation */}
        <nav
          role="tablist"
          aria-label="Application details tabs"
          className="flex border-b border-hairline bg-paper px-5 sm:px-7"
        >
          <button
            role="tab"
            id="tab-overview"
            aria-selected={activeTab === "overview"}
            aria-controls="panel-overview"
            tabIndex={activeTab === "overview" ? 0 : -1}
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 px-4 py-3 text-[13px] font-medium transition-colors focus:outline-none ${
              activeTab === "overview"
                ? "border-oxblood text-ink font-semibold"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            Overview
          </button>
          <button
            role="tab"
            id="tab-timeline"
            aria-selected={activeTab === "timeline"}
            aria-controls="panel-timeline"
            tabIndex={activeTab === "timeline" ? 0 : -1}
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors focus:outline-none ${
              activeTab === "timeline"
                ? "border-oxblood text-ink font-semibold"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            <span>Timeline & Notes</span>
            {events && events.length > 0 && (
              <span className="rounded-full bg-paper-raised px-1.5 py-0.2 text-[10px] text-ink-2 border border-hairline">
                {events.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            id="tab-assistant"
            aria-selected={activeTab === "assistant"}
            aria-controls="panel-assistant"
            tabIndex={activeTab === "assistant" ? 0 : -1}
            onClick={() => setActiveTab("assistant")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors focus:outline-none ${
              activeTab === "assistant"
                ? "border-oxblood text-ink font-semibold"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-brass" />
            <span>Question Assistant</span>
          </button>
        </nav>

        {/* Tab Content Panels */}
        <div className="min-h-[360px] max-h-[calc(88vh-145px)] overflow-y-auto px-5 py-5 sm:px-7">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
              <dl className="grid gap-x-6 gap-y-4 border-b border-hairline pb-5 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] text-ink-3">Stage</dt>
                  <dd className="mt-1 capitalize text-ink">
                    {getStageLabel(application.status)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-3">Location</dt>
                  <dd className="mt-1 text-ink">{application.location || "Not specified"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-3">Source</dt>
                  <dd className="mt-1 text-ink">{application.source || "Manual"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-3">Saved</dt>
                  <dd className="mt-1 text-ink">
                    {new Date(application.dateFound).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-3">Applied</dt>
                  <dd className="mt-1 text-ink">
                    {application.dateApplied
                      ? new Date(application.dateApplied).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "Not applied"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-3">Last activity</dt>
                  <dd className="mt-1 text-ink">
                    {new Date(application.lastActivityAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <h3 className="font-display text-[20px] text-ink">Job description</h3>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                  {application.jobDescription || "No job description was saved for this application."}
                </p>
              </div>

              {application.jobUrl && (
                <div className="mt-6 border-t border-hairline pt-4">
                  <a
                    href={application.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] text-oxblood underline underline-offset-4 transition-colors hover:text-ink"
                  >
                    <span>Open original job posting</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TIMELINE & NOTES */}
          {activeTab === "timeline" && (
            <div role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline" className="space-y-6">
              {/* Add Note Section */}
              <form
                onSubmit={handleAddNote}
                className="rounded-md border border-hairline bg-paper p-4"
                aria-label="Add note to application"
              >
                <label htmlFor="application-note-input" className="block text-[12px] font-medium text-ink">
                  Add Note
                </label>
                <p className="text-[11px] text-ink-3">
                  Log phone screen takeaways, interview feedback, or next steps.
                </p>
                <textarea
                  id="application-note-input"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Type a note about this application…"
                  rows={3}
                  className="mt-2 w-full rounded-md border border-hairline bg-paper-raised px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood"
                  disabled={addingNote}
                />
                {noteError && (
                  <p role="alert" className="mt-1 text-[11px] text-oxblood">
                    {noteError}
                  </p>
                )}
                <div className="mt-2.5 flex justify-end">
                  <Button
                    type="submit"
                    variant="default"
                    disabled={addingNote || !newNoteText.trim()}
                    className="gap-1.5 text-[12px]"
                  >
                    {addingNote ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Add Note
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Activity Feed */}
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
                  Activity History
                </h3>

                {loadingEvents && (
                  <div className="py-8 text-center text-[13px] text-ink-2 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-ink-3" />
                    <span>Loading activity timeline…</span>
                  </div>
                )}

                {eventsError && !loadingEvents && (
                  <p className="mt-2 text-[12px] text-oxblood">{eventsError}</p>
                )}

                {!loadingEvents && events && events.length === 0 && (
                  <div className="mt-4 rounded-md border border-dashed border-hairline py-8 text-center">
                    <MessageSquare className="mx-auto h-7 w-7 text-ink-3 opacity-60" />
                    <p className="mt-2 text-[13px] font-medium text-ink">No activity logged yet.</p>
                    <p className="text-[11px] text-ink-3">
                      Stage changes, notes, and emails will automatically appear here.
                    </p>
                  </div>
                )}

                {!loadingEvents && events && events.length > 0 && (
                  <ol className="relative mt-4 space-y-4 border-l border-hairline pl-4">
                    {events.map((event) => {
                      const occurredDate = new Date(event.occurredAt);
                      const formattedTime = Number.isNaN(occurredDate.getTime())
                        ? ""
                        : occurredDate.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          });

                      return (
                        <li key={event.id} className="relative group">
                          {/* Dot / icon indicator */}
                          <div className="absolute -left-[23px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-hairline bg-paper-raised text-ink">
                            {event.type === "email_received" && (
                              <Mail className="h-2.5 w-2.5 text-verdigris" />
                            )}
                            {event.type === "stage_changed" && (
                              <ArrowRight className="h-2.5 w-2.5 text-brass" />
                            )}
                            {event.type === "note_added" && (
                              <FileText className="h-2.5 w-2.5 text-ink" />
                            )}
                            {event.type === "created" && (
                              <Sparkles className="h-2.5 w-2.5 text-oxblood" />
                            )}
                            {event.type !== "email_received" &&
                              event.type !== "stage_changed" &&
                              event.type !== "note_added" &&
                              event.type !== "created" && (
                                <UserCheck className="h-2.5 w-2.5 text-ink-3" />
                              )}
                          </div>

                          <div className="rounded-md border border-hairline bg-paper-raised p-3 transition-colors hover:border-ink/30">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[12px] font-semibold text-ink">
                                {event.title}
                              </span>
                              <time className="tnum shrink-0 text-[10px] text-ink-3">
                                {formattedTime}
                              </time>
                            </div>

                            {/* Stage changed metadata formatting */}
                            {event.type === "stage_changed" && event.metadata && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-2">
                                <span className="capitalize">
                                  {getStageLabel(event.metadata.fromStage)}
                                </span>
                                <span>→</span>
                                <span className="font-medium text-ink capitalize">
                                  {getStageLabel(event.metadata.toStage)}
                                </span>
                              </div>
                            )}

                            {/* Note content or Description */}
                            {event.description && event.type !== "email_received" && (
                              <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-2">
                                {event.description}
                              </p>
                            )}

                            {/* Email Evidence Quote */}
                            {event.type === "email_received" && (
                              <div className="mt-2">
                                {event.description && (
                                  <blockquote className="rounded-sm border-l-2 border-verdigris/70 bg-paper px-2.5 py-1.5 text-[11px] italic text-ink-2">
                                    “{event.description}”
                                  </blockquote>
                                )}
                                {typeof event.metadata?.snippet === "string" && (
                                  <p className="mt-1 text-[11px] text-ink-3">
                                    Snippet: {event.metadata.snippet}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUESTION ASSISTANT */}
          {activeTab === "assistant" && (
            <div role="tabpanel" id="panel-assistant" aria-labelledby="tab-assistant" className="space-y-5">
              <div className="rounded-md border border-hairline bg-paper p-4">
                <div className="flex items-center gap-2 text-ink">
                  <Sparkles className="h-4 w-4 text-brass" />
                  <h3 className="font-display text-[18px]">AI Application Answer Drafter</h3>
                </div>
                <p className="mt-1 text-[12px] text-ink-2">
                  Generate tailored answers using details from this job posting and your resume.
                </p>

                {/* Preset Questions */}
                <div className="mt-4">
                  <label
                    htmlFor="preset-question-select"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3"
                  >
                    Question Presets
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {defaultPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset);
                          setCustomQuestion("");
                        }}
                        className={`rounded-sm border px-2.5 py-1 text-[11px] text-left transition-colors ${
                          selectedPreset === preset && !customQuestion
                            ? "border-oxblood bg-paper-raised text-ink font-medium shadow-sm"
                            : "border-hairline bg-paper text-ink-2 hover:border-ink hover:text-ink"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Question input */}
                <div className="mt-4">
                  <label
                    htmlFor="custom-question-input"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3"
                  >
                    Or Enter a Custom Question
                  </label>
                  <Input
                    id="custom-question-input"
                    variant="default"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="e.g. Tell me about a time you handled ambiguity…"
                    className="mt-1.5 text-[13px]"
                  />
                </div>

                {/* Draft Button */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-ink-3">
                    Active: <span className="text-ink font-medium">"{activeQuestion}"</span>
                  </span>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleDraftAnswer}
                    disabled={draftingAnswer || !activeQuestion.trim()}
                    className="gap-2 text-[12px]"
                  >
                    {draftingAnswer ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting Answer…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-paper" /> Draft Answer with AI
                      </>
                    )}
                  </Button>
                </div>

                {draftError && (
                  <div role="alert" className="mt-3 flex items-center gap-2 text-[12px] text-oxblood">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{draftError}</span>
                  </div>
                )}
              </div>

              {/* Drafted Answer Output */}
              {draftedAnswer && (
                <div className="rounded-md border border-hairline bg-paper-raised p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
                      Drafted Response
                    </h4>
                    {draftMeta?.model && (
                      <span className="text-[10px] text-ink-3">
                        Model: {draftMeta.model} ({draftMeta.provider || "AI"})
                      </span>
                    )}
                  </div>

                  <textarea
                    value={draftedAnswer}
                    onChange={(e) => setDraftedAnswer(e.target.value)}
                    rows={6}
                    aria-label="Editable drafted answer"
                    className="mt-2 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-[13px] leading-relaxed text-ink focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood"
                  />

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyAnswer}
                        className="gap-1.5 text-[12px]"
                      >
                        {copiedAnswer ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-verdigris" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Copy Answer
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveDraftAsNote}
                        disabled={savingDraftAsNote}
                        className="gap-1.5 text-[12px]"
                      >
                        {savingDraftAsNote ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5" /> Save as Note
                          </>
                        )}
                      </Button>
                    </div>

                    <AnimatePresence>
                      {draftSavedFeedback && (
                        <motion.span
                          initial={{ opacity: 0, x: 5 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={TRANSITION.quick}
                          className="flex items-center gap-1 text-[11px] text-verdigris font-medium"
                        >
                          <Check className="h-3.5 w-3.5" /> Logged to application timeline notes!
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
