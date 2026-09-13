import { useEffect, useRef, useState } from "react";
import type { GmailState, GmailSuggestion } from "@ghostboard/shared";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Inbox, LoaderCircle, Mail, RefreshCw, Unplug, UserRoundSearch } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ipc } from "../lib/ipc";
import { Badge, type BadgeProps } from "./ui/badge";
import { Button } from "./ui/button";
import { GhostDrift } from "./motion";
import { DISTANCE, DURATION, EASE, SPRING, STAGGER, TRANSITION } from "../lib/motion";
import { playSound } from "../lib/sound";
import { cn } from "../lib/utils";

function ConnectedTick() {
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={11}
      height={11}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-verdigris"
    >
      <motion.path
        d="M3 12.5 L9.5 19 L21 5.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={SPRING.overshoot}
      />
    </motion.svg>
  );
}

const STATUS_PRESENTATION: Record<NonNullable<GmailSuggestion["newStatus"]> | "message", { label: string; variant: BadgeProps["variant"] }> = {
  applied: { label: "Application confirmed", variant: "ink" },
  interviewing: { label: "Interview update", variant: "brass" },
  offer: { label: "Offer received", variant: "verdigris" },
  rejected: { label: "Application closed", variant: "oxblood" },
  message: { label: "Needs review", variant: "mist" },
};

function suggestionLabel(suggestion: GmailSuggestion): { label: string; variant: BadgeProps["variant"] } {
  const base = STATUS_PRESENTATION[suggestion.newStatus ?? "message"];
  if (suggestion.action === "created" && suggestion.newStatus) return { ...base, label: `New job · ${base.label}` };
  if (suggestion.action === "moved" && suggestion.newStatus) return { ...base, label: `Board updated · ${base.label}` };
  return base;
}

function formatReceivedAt(value: string): { date: string; time: string } {
  const received = new Date(value);
  if (Number.isNaN(received.getTime())) return { date: "Unknown date", time: "" };
  return {
    date: received.toLocaleDateString(undefined, { month: "short", day: "numeric", year: received.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }),
    time: received.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

function Suggestion({ suggestion, index }: { suggestion: GmailSuggestion; index: number }) {
  const status = suggestionLabel(suggestion);
  const received = formatReceivedAt(suggestion.receivedAt);
  const application = suggestion.candidates.length === 1 ? suggestion.candidates[0] : null;
  const confidence = Math.round(suggestion.confidence * 100);

  return (
    <motion.li
      initial={{ opacity: 0, y: DISTANCE.rise }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION.base, delay: Math.min(index, 11) * STAGGER.list }}
      whileHover={{ y: DISTANCE.liftRow, transition: SPRING.hover }}
      className="border-b border-hairline last:border-b-0"
    >
      <article className="grid min-w-0 gap-5 py-6 sm:grid-cols-[42px_minmax(0,1fr)_110px] sm:gap-4">
        <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-hairline bg-paper text-oxblood sm:flex" aria-hidden="true">
          <Mail size={17} strokeWidth={1.6} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {suggestion.decision === "applied" && <Badge variant="verdigris"><CheckCircle2 size={10} className="mr-1" />Applied to board</Badge>}
          </div>
          <h3 className="mt-3 break-words font-display text-[23px] leading-tight text-ink">{suggestion.subject || "No subject"}</h3>
          <p className="mt-2 break-words text-[12px] text-ink-2">
            <span className="text-ink-3">From</span> <span className="font-medium text-ink">{suggestion.sender || "Unknown sender"}</span>
          </p>

          {suggestion.evidence && (
            <blockquote className="mt-4 border-l-2 border-brass/60 pl-3 text-[12px] leading-relaxed text-ink-2">
              “{suggestion.evidence.replace(/\s+/g, " ").trim()}”
            </blockquote>
          )}

          {application ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
              <UserRoundSearch size={13} className="text-verdigris" />
              <span>Matched to</span>
              <strong className="font-medium text-ink">{application.title} at {application.company}</strong>
              <ArrowRight size={12} className="text-ink-3" />
              <span className="capitalize">{application.status}</span>
            </div>
          ) : (
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-brass">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />No single application matched confidently. Your board was left unchanged.
            </p>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 sm:block sm:text-right">
          <time className="tnum block text-[11px] leading-relaxed text-ink-3" dateTime={suggestion.receivedAt}>{received.date}<br className="hidden sm:block" /> {received.time}</time>
          <div className="mt-0 sm:mt-5" aria-label={`${confidence}% classifier confidence`}>
            <span className="tnum text-[11px] text-ink-2">{confidence}% confidence</span>
            <div className="mt-1.5 hidden h-1 w-full overflow-hidden bg-hairline sm:block"><span className="block h-full bg-verdigris" style={{ width: `${confidence}%` }} /></div>
          </div>
        </div>
      </article>
    </motion.li>
  );
}

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-6 border-b border-hairline py-3 text-[12px] text-ink last:border-b-0">
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 shrink-0 accent-[rgb(var(--oxblood))] disabled:opacity-50" />
    </label>
  );
}

export function GmailPanel({ onUpdated, heading = "Gmail status updates" }: { onUpdated: () => void; heading?: string }) {
  const [state, setState] = useState<GmailState | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const busy = working || Boolean(state?.busy);

  async function load() {
    const request = ++generation.current;
    try {
      const result = await ipc().getGmailState();
      if (alive.current && request === generation.current) { setState(result); setError(null); }
    } catch {
      if (alive.current && request === generation.current) setError("Could not load Gmail settings. Try again.");
    }
  }

  useEffect(() => {
    alive.current = true;
    void load();
    const refresh = () => { void load(); };
    const interval = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => { alive.current = false; generation.current++; clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);

  async function perform(action: () => Promise<GmailState>) {
    const wasConnected = Boolean(state?.connected);
    setWorking(true);
    setError(null);
    generation.current++;
    try {
      const result = await action();
      if (alive.current) {
        generation.current++;
        setState(result);
        onUpdated();
        // Only a user-initiated action reaches here, so an outcome sound is safe.
        if (!wasConnected && result.connected) playSound("success");
        else if (wasConnected && !result.connected) playSound("toggle");
      }
    } catch {
      if (alive.current) {
        setError("Could not complete that Gmail action. Try again.");
        playSound("error");
      }
    } finally {
      if (alive.current) setWorking(false);
    }
  }

  if (!state && !error) {
    return <section aria-labelledby="gmail-heading" className="mt-7 border-y border-hairline py-16 text-center"><LoaderCircle size={22} className="mx-auto animate-spin text-oxblood" /><h2 id="gmail-heading" className="mt-4 font-display text-[24px] text-ink">Loading recruiter inbox</h2><p role="status" className="mt-2 text-[11px] text-ink-2">Checking the local Gmail connection…</p></section>;
  }

  return (
    <section aria-labelledby="gmail-heading" className="mt-7">
      <div className={cn("grid border-y border-hairline", state?.connected && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className={cn("px-0 py-7", state?.connected && "lg:border-r lg:border-hairline lg:pr-9")}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex h-4 items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ink-3">
                <AnimatePresence mode="wait" initial={false}>
                  {state?.connected ? (
                    <motion.span key="connected" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TRANSITION.quick}>
                      <ConnectedTick />Connection active
                    </motion.span>
                  ) : (
                    <motion.span key="disconnected" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TRANSITION.quick}>
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />Connection required
                    </motion.span>
                  )}
                </AnimatePresence>
                <span>·</span>
                <span className="text-ink-2">Casper classifier</span>
              </div>
              <h2 id="gmail-heading" className="mt-3 font-display text-[29px] leading-tight text-ink">{state?.connected ? state.account : heading}</h2>
              <p className="mt-2 max-w-[570px] text-[12px] leading-relaxed text-ink-2">{state?.connected ? "Recruiting messages are checked and classified by Antigravity only when you ask, or on the schedule you enable below." : "Connect Gmail to bring confirmations, interviews, offers, and explicit rejections into the same place as your applications."}</p>
            </div>
            {state?.lastCheckedAt && <div className="flex items-center gap-2 text-[10px] text-ink-3"><Clock3 size={12} />Last checked {new Date(state.lastCheckedAt).toLocaleString()}</div>}
          </div>

          {(error || state?.error) && <div role="alert" className="mt-5 flex items-start gap-3 border-l-2 border-oxblood bg-paper-raised px-4 py-3 text-[12px] text-ink"><AlertCircle size={15} className="mt-0.5 shrink-0 text-oxblood" /><span>{error || state?.error}</span></div>}
          {state?.notice && <div role="status" className="mt-5 flex items-start gap-3 border-l-2 border-verdigris bg-paper-raised px-4 py-3 text-[12px] text-ink"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-verdigris" /><span>{state.notice}</span></div>}

          <div className="mt-6 flex flex-wrap gap-2">
            {!state?.connected && <Button variant="ink" disabled={busy} onClick={() => { void perform(() => ipc().connectGmail()); }}><Mail size={14} />{state?.configured ? "Connect Gmail" : "Choose credentials & connect"}</Button>}
            {!state?.connected && <Button variant="rule" disabled={busy} onClick={() => { void perform(() => ipc().importGmailCredentials()); }}>Import credentials JSON</Button>}
            {state?.connected && <Button variant="ink" disabled={busy} onClick={() => { void perform(() => ipc().checkGmail()); }}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}{busy ? "Checking with Casper…" : state.hasMore ? "Check next batch with Casper" : "Check for updates with Casper"}</Button>}
            {(state?.connected || state?.configured) && <Button variant="rule" disabled={busy} onClick={() => { void perform(() => ipc().disconnectGmail()); }}><Unplug size={14} />Disconnect</Button>}
            {busy && <Button variant="quiet" onClick={() => { void ipc().cancelGmail().catch(() => setError("Could not cancel. Please wait for the operation to finish.")); }}>Cancel</Button>}
            {error && <Button variant="quiet" onClick={() => { void load(); }}>Retry</Button>}
          </div>
          {busy && (
            <p role="status" className={cn("mt-4 flex items-center gap-2 text-[11px] text-ink-2", prefersReducedMotion !== true && "pulse-soft")}>
              <motion.span
                aria-hidden="true"
                className="inline-flex text-oxblood"
                animate={{ y: [0, -2, 0, 2, 0] }}
                transition={{ duration: DURATION.ambient, ease: EASE.inOut, repeat: Infinity }}
              >
                <Mail size={13} strokeWidth={1.8} />
              </motion.span>
              {state?.connected
                ? "Reading emails and classifying recruiter updates with Casper…"
                : "Working… If a sign-in window opened, finish Google consent in your browser."}
            </p>
          )}
        </div>

        {state?.connected && (
          <aside className="bg-paper-raised/50 px-0 py-7 lg:px-7" aria-label="Inbox preferences">
            <Toggle checked={state.automaticChecks} disabled={busy} label="Check every 5 minutes" onChange={(enabled) => { void perform(() => ipc().setGmailAutomaticChecks(enabled)); }} />
            <Toggle checked={state.recentOnly} disabled={busy} label="Only check 10 newest emails" onChange={(enabled) => { void perform(() => ipc().setGmailRecentOnly(enabled)); }} />
          </aside>
        )}
      </div>

      {state?.connected && !state.suggestions.length && (
        <div className="mt-9 flex min-h-[230px] flex-col items-center justify-center border border-dashed border-hairline px-6 text-center">
          <GhostDrift><Inbox size={25} strokeWidth={1.4} className="text-ink-3" /></GhostDrift>
          <h3 className="mt-4 font-display text-[25px] text-ink">No recruiter updates yet</h3>
          <p className="mt-2 max-w-[430px] text-[11px] leading-relaxed text-ink-2">Run a check when you expect news. Messages that cannot be matched confidently will never change your board.</p>
        </div>
      )}

      {!!state?.suggestions.length && (
        <div className="mt-10">
          <div className="flex items-end justify-between border-b border-hairline pb-3">
            <div><p className="text-[10px] uppercase tracking-[0.14em] text-oxblood">Message intelligence</p><h2 className="mt-1 font-display text-[30px] text-ink">Recent activity</h2></div>
            <span className="tnum text-[11px] text-ink-2">{state.suggestions.length} {state.suggestions.length === 1 ? "message" : "messages"}</span>
          </div>
          <ul>{state.suggestions.map((suggestion, index) => <Suggestion key={suggestion.id} suggestion={suggestion} index={index} />)}</ul>
        </div>
      )}
    </section>
  );
}
