import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import type { Application } from "@ghostboard/shared";
import { AlertCircle, Loader2, Plus, X } from "lucide-react";
import { ipc, type CreateApplicationRequest } from "../../lib/ipc";
import { modalBackdrop, modalPanel } from "../../lib/motion";
import { playSound } from "../../lib/sound";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface CreateApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (application: Application) => void;
}

export function CreateApplicationModal({
  isOpen,
  onClose,
  onCreated,
}: CreateApplicationModalProps) {
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"found" | "applied">("found");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setCompany("");
      setTitle("");
      setStatus("found");
      setLocation("");
      setJobUrl("");
      setDeadline("");
      setJobDescription("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanCompany = company.trim();
    const cleanTitle = title.trim();

    if (!cleanCompany || !cleanTitle) {
      setError("Company and Job Title are required.");
      playSound("error");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: CreateApplicationRequest = {
      company: cleanCompany,
      title: cleanTitle,
      status,
      location: location.trim() || null,
      jobUrl: jobUrl.trim() || undefined,
      deadline: deadline || null,
      jobDescription: jobDescription.trim() || undefined,
    };

    try {
      const createdApp = await ipc().createApplication(payload);
      playSound("success");
      onCreated(createdApp);
      onClose();
    } catch {
      setError("Failed to create application. Please check your inputs and try again.");
      playSound("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-application-title"
    >
      <motion.button
        type="button"
        variants={modalBackdrop}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 cursor-default bg-ink/40"
        aria-label="Close modal backdrop"
        onClick={onClose}
      />
      <motion.section
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden border border-hairline bg-paper-raised shadow-2xl"
      >
        {/* Modal Header */}
        <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-oxblood" />
            <h2 id="create-application-title" className="font-display text-[22px] text-ink">
              Add Application
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-2 transition-colors hover:text-ink focus:outline-none"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="space-y-4 overflow-y-auto px-6 py-5 text-[13px]">
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-oxblood/30 bg-oxblood/5 p-3 text-[12px] text-oxblood"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Company & Title */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="app-company" className="block text-[12px] font-medium text-ink">
                  Company <span className="text-oxblood">*</span>
                </label>
                <Input
                  id="app-company"
                  variant="default"
                  required
                  placeholder="e.g. Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label htmlFor="app-title" className="block text-[12px] font-medium text-ink">
                  Job Title / Role <span className="text-oxblood">*</span>
                </label>
                <Input
                  id="app-title"
                  variant="default"
                  required
                  placeholder="e.g. Senior Software Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Stage Segmented Toggle */}
            <div>
              <label className="block text-[12px] font-medium text-ink">Initial Stage</label>
              <div
                role="radiogroup"
                aria-label="Initial stage"
                className="mt-1.5 flex rounded-md border border-hairline bg-paper p-0.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={status === "found"}
                  onClick={() => setStatus("found")}
                  className={`flex-1 rounded py-1.5 text-center text-[12px] font-medium transition-all ${
                    status === "found"
                      ? "bg-paper-raised text-ink shadow-sm font-semibold"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  Found / Bookmarked
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={status === "applied"}
                  onClick={() => setStatus("applied")}
                  className={`flex-1 rounded py-1.5 text-center text-[12px] font-medium transition-all ${
                    status === "applied"
                      ? "bg-paper-raised text-ink shadow-sm font-semibold"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  Applied
                </button>
              </div>
            </div>

            {/* Location & Job URL */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="app-location" className="block text-[12px] font-medium text-ink">
                  Location (optional)
                </label>
                <Input
                  id="app-location"
                  variant="default"
                  placeholder="e.g. Remote, New York, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label htmlFor="app-url" className="block text-[12px] font-medium text-ink">
                  Job URL (optional)
                </label>
                <Input
                  id="app-url"
                  type="url"
                  variant="default"
                  placeholder="https://company.com/jobs/..."
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Application Deadline */}
            <div>
              <label htmlFor="app-deadline" className="block text-[12px] font-medium text-ink">
                Application Deadline (optional)
              </label>
              <Input
                id="app-deadline"
                type="date"
                variant="default"
                min="0001-01-01"
                max="9999-12-31"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 max-w-[220px]"
              />
            </div>

            {/* Job Description */}
            <div>
              <label htmlFor="app-description" className="block text-[12px] font-medium text-ink">
                Job Description (optional)
              </label>
              <textarea
                id="app-description"
                rows={4}
                placeholder="Paste the job description or role requirements here…"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-3 focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <footer className="flex items-center justify-end gap-3 border-t border-hairline bg-paper px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isSubmitting || !company.trim() || !title.trim()}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Application
                </>
              )}
            </Button>
          </footer>
        </form>
      </motion.section>
    </div>
  );
}
