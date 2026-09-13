import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  DEFAULT_TRACKING_THRESHOLDS,
  type TrackingThresholds,
} from "@ghostboard/tracking";
import { AlertCircle, Loader2, RotateCcw, Sliders, X } from "lucide-react";
import { ipc } from "../../lib/ipc";
import { modalBackdrop, modalPanel } from "../../lib/motion";
import { playSound } from "../../lib/sound";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface TrackingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: TrackingThresholds;
  onSaved: (newSettings: TrackingThresholds) => void;
}

export function TrackingSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSaved,
}: TrackingSettingsModalProps) {
  const [foundDays, setFoundDays] = useState<number | string>(
    currentSettings.stageStalenessDays?.found ?? DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.found
  );
  const [appliedDays, setAppliedDays] = useState<number | string>(
    currentSettings.stageStalenessDays?.applied ?? DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.applied
  );
  const [interviewingDays, setInterviewingDays] = useState<number | string>(
    currentSettings.stageStalenessDays?.interviewing ??
      DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.interviewing
  );
  const [offerDays, setOfferDays] = useState<number | string>(
    currentSettings.stageStalenessDays?.offer ?? DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.offer
  );
  const [ghostedDays, setGhostedDays] = useState<number | string>(
    currentSettings.ghostedInactivityDays ?? DEFAULT_TRACKING_THRESHOLDS.ghostedInactivityDays
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when currentSettings changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFoundDays(
        currentSettings.stageStalenessDays?.found ?? DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.found
      );
      setAppliedDays(
        currentSettings.stageStalenessDays?.applied ?? DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.applied
      );
      setInterviewingDays(
        currentSettings.stageStalenessDays?.interviewing ??
          DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.interviewing
      );
      setOfferDays(
        currentSettings.stageStalenessDays?.offer ?? DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.offer
      );
      setGhostedDays(
        currentSettings.ghostedInactivityDays ?? DEFAULT_TRACKING_THRESHOLDS.ghostedInactivityDays
      );
      setError(null);
      setSaving(false);
    }
  }, [isOpen, currentSettings]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleResetDefaults() {
    setFoundDays(DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.found);
    setAppliedDays(DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.applied);
    setInterviewingDays(DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.interviewing);
    setOfferDays(DEFAULT_TRACKING_THRESHOLDS.stageStalenessDays.offer);
    setGhostedDays(DEFAULT_TRACKING_THRESHOLDS.ghostedInactivityDays);
    setError(null);
    playSound("tap");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();

    const rawValues = [foundDays, appliedDays, interviewingDays, offerDays, ghostedDays];
    if (rawValues.some((val) => typeof val === "string" && val.trim() === "")) {
      setError("Please provide valid day thresholds (numbers between 1 and 365).");
      playSound("error");
      return;
    }

    const parsedFound = Math.round(Number(foundDays));
    const parsedApplied = Math.round(Number(appliedDays));
    const parsedInterviewing = Math.round(Number(interviewingDays));
    const parsedOffer = Math.round(Number(offerDays));
    const parsedGhosted = Math.round(Number(ghostedDays));

    if (
      !Number.isFinite(parsedFound) || parsedFound < 1 || parsedFound > 365 ||
      !Number.isFinite(parsedApplied) || parsedApplied < 1 || parsedApplied > 365 ||
      !Number.isFinite(parsedInterviewing) || parsedInterviewing < 1 || parsedInterviewing > 365 ||
      !Number.isFinite(parsedOffer) || parsedOffer < 1 || parsedOffer > 365 ||
      !Number.isFinite(parsedGhosted) || parsedGhosted < 1 || parsedGhosted > 365
    ) {
      setError("Please provide day thresholds between 1 and 365 days.");
      playSound("error");
      return;
    }

    const payload: TrackingThresholds = {
      stageStalenessDays: {
        found: parsedFound,
        applied: parsedApplied,
        interviewing: parsedInterviewing,
        offer: parsedOffer,
      },
      ghostedInactivityDays: parsedGhosted,
    };

    setSaving(true);
    setError(null);
    try {
      const saved = await ipc().saveTrackingSettings(payload);
      playSound("success");
      onSaved(saved || payload);
      onClose();
    } catch {
      setError("Could not save tracking settings. Please try again.");
      playSound("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-settings-title"
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
        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-brass" />
            <h2 id="tracking-settings-title" className="font-display text-[22px] text-ink">
              Staleness & Inactivity Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-2 transition-colors hover:text-ink focus:outline-none"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
          <div className="space-y-6 overflow-y-auto px-6 py-5 text-[13px]">
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-oxblood/30 bg-oxblood/5 p-3 text-[12px] text-oxblood"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Stage Staleness Section */}
            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink">
                Stage Staleness Thresholds (Days)
              </h3>
              <p className="mt-1 text-[11px] text-ink-3">
                Number of quiet days before an application in that stage is highlighted as stale.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="thresh-found" className="block text-[12px] font-medium text-ink">
                    Found Stage
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="thresh-found"
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={foundDays}
                      onChange={(e) => setFoundDays(e.target.value)}
                      className="tnum w-24"
                    />
                    <span className="text-[12px] text-ink-2">days quiet</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="thresh-applied" className="block text-[12px] font-medium text-ink">
                    Applied Stage
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="thresh-applied"
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={appliedDays}
                      onChange={(e) => setAppliedDays(e.target.value)}
                      className="tnum w-24"
                    />
                    <span className="text-[12px] text-ink-2">days quiet</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="thresh-interviewing"
                    className="block text-[12px] font-medium text-ink"
                  >
                    Interviewing Stage
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="thresh-interviewing"
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={interviewingDays}
                      onChange={(e) => setInterviewingDays(e.target.value)}
                      className="tnum w-24"
                    />
                    <span className="text-[12px] text-ink-2">days quiet</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="thresh-offer" className="block text-[12px] font-medium text-ink">
                    Offer Stage
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="thresh-offer"
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={offerDays}
                      onChange={(e) => setOfferDays(e.target.value)}
                      className="tnum w-24"
                    />
                    <span className="text-[12px] text-ink-2">days quiet</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ghosting Inactivity Section */}
            <div className="border-t border-hairline pt-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink">
                Ghosted Inactivity Threshold (Days)
              </h3>
              <p className="mt-1 text-[11px] text-ink-3">
                After this many days without employer response or activity, applications in Applied
                or Interviewing stages are treated as ghosted.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Input
                  id="thresh-ghosted"
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={ghostedDays}
                  onChange={(e) => setGhostedDays(e.target.value)}
                  className="tnum w-24"
                />
                <span className="text-[12px] text-ink-2">days without activity</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <footer className="flex items-center justify-between border-t border-hairline bg-paper px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetDefaults}
              className="gap-1.5 text-[12px]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Defaults</span>
            </Button>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={saving} className="gap-1.5">
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save Thresholds"
                )}
              </Button>
            </div>
          </footer>
        </form>
      </motion.section>
    </div>
  );
}
