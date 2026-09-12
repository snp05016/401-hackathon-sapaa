import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import type { FollowUpKind, FollowUpSuggestion } from "@ghostboard/shared";
import { summarizeToday } from "@ghostboard/tracking";
import { useApplications } from "../lib/useApplications";
import { ipc } from "../lib/ipc";
import { renderMessageTemplate, capitalize } from "../lib/utils";
import { Button } from "../components/ui/button";

const FOLLOW_UP_KIND_LABELS: Record<FollowUpKind, string> = {
  application: "Following up on application",
  interview: "Following up on interview",
  thank_you: "Thank the recruiter for the interview",
};

function Figure({ count, label, accent, delay }: { count: number; label: string; accent: string; delay: number }) {
  return (
    <div className="animate-reveal px-7 first:pl-0 last:pr-0" style={{ animationDelay: `${delay}ms` }}>
      <div className={`tnum font-display text-[64px] leading-[0.85] ${accent}`}>{count}</div>
      <div className="mt-3 text-[12px] text-ink-2">{label}</div>
    </div>
  );
}

export function Today() {
  const { applications, error, now, reload } = useApplications();
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const counts = summarizeToday(applications ?? [], now);

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  async function copyMessage(item: FollowUpSuggestion) {
    const body = renderMessageTemplate(item.message.body, {
      Company: capitalize(item.company),
      "Job Title": item.title.toLowerCase(),
    });
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(item.applicationId);
    } catch (error) {
      console.error("Could not copy follow-up message", error);
    }
  }

  useEffect(() => {
    if (!applications || applications.length === 0) return;
    const loaded = applications;
    let active = true;
    async function evaluate() {
      try {
        const suggestions = await ipc().evaluateFollowUps();
        if (!active) return;
        setFollowUps(suggestions);
        if (suggestions.length > 0) {
          setModalOpen(true);
          const missingFromView = suggestions.some(
            (suggestion) => !loaded.some((item) => item.id === suggestion.applicationId && item.followUpOn)
          );
          if (missingFromView) reload();
        }
      } catch {
        // Keep the page usable when follow-up evaluation fails.
      }
    }
    void evaluate();
    return () => {
      active = false;
    };
  }, [applications, reload]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  return (
    <div className="max-w-[980px]">
      <header className="animate-reveal">
        <p className="text-[12px] text-ink-2">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 font-display text-[88px] leading-[0.88] tracking-[-0.02em] text-ink">Today</h1>
      </header>

      {error && (
        <div role="alert" className="mt-8 flex items-center gap-4 border-l-2 border-oxblood pl-4 text-[13px] text-ink">
          {error}
          <Button variant="quiet" onClick={reload}>Retry</Button>
        </div>
      )}
      {!applications && !error && <p role="status" className="mt-8 text-[13px] text-ink-2">Loading saved jobs…</p>}

      {applications && (
        <>
          <section className="mt-14">
            <div className="flex items-baseline justify-between gap-10 border-b border-hairline pb-3">
              <h2 className="font-display text-[26px] leading-none text-ink">Application deadlines</h2>
              <p className="max-w-[300px] text-right text-[12px] leading-relaxed text-ink-2">
                Jobs in Found that still need an application. Set their deadlines in Tracking.
              </p>
            </div>
            <div className="mt-9 flex divide-x divide-hairline">
              <Figure count={counts.dueToday} label="Due today" accent="text-oxblood" delay={80} />
              <Figure count={counts.upcoming} label="Due in the next 7 days" accent="text-ink" delay={160} />
              <Figure count={counts.overdue} label="Overdue" accent="text-oxblood" delay={240} />
            </div>
            <p className="mt-8 text-[12px] text-ink-2">
              {counts.noDeadline} {counts.noDeadline === 1 ? "job has" : "jobs have"} no deadline set.
            </p>
            {applications.length === 0 && (
              <p className="mt-7 max-w-[560px] border-y border-dashed border-hairline py-7 font-display text-[22px] leading-snug text-ink-2">
                Nothing here yet. Save a job with the browser extension and it lands in Found.
              </p>
            )}
          </section>

          <section className="mt-20 ml-auto w-[78%] animate-reveal" style={{ animationDelay: "320ms" }}>
            <h2 className="border-b border-hairline pb-3 font-display text-[26px] leading-none text-ink">
              Application overview
            </h2>
            <div className="mt-8 flex divide-x divide-hairline">
              <Figure count={counts.total} label="Total applications" accent="text-ink" delay={380} />
              <Figure count={counts.applied} label="Applied" accent="text-ink" delay={440} />
              <Figure count={counts.interviewing} label="Interviewing" accent="text-brass" delay={500} />
              <Figure count={counts.followUpOn} label="Follow-up on" accent="text-ink" delay={560} />
            </div>
          </section>
        </>
      )}

      {modalOpen && followUps.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Follow-up reminders">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-hairline bg-paper-raised shadow-2xl">
            <header className="flex items-center justify-between border-b px-3 py-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close follow-up reminders"
                className="text-ink-2 transition-colors hover:text-ink"
              >
                <X size={18} strokeWidth={1.6} />
              </button>
            </header>
            <div className="space-y-8 px-7 py-6">
              {followUps.map((item) => {
                const body = renderMessageTemplate(item.message.body, {
                  Company: capitalize(item.company),
                  "Job Title": item.title.toLowerCase(),
                });
                const copied = copiedId === item.applicationId;
                return (
                  <section key={item.applicationId}>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-oxblood">
                      {FOLLOW_UP_KIND_LABELS[item.kind]}
                    </p>
                    <p className="mt-3 text-[13px] text-ink">
                      {item.company} · {item.title}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-2">{item.message.description}</p>
                    <div className="relative mt-4">
                      <button
                        type="button"
                        onClick={() => void copyMessage(item)}
                        aria-label={copied ? "Message copied" : "Copy message"}
                        title={copied ? "Copied" : "Copy"}
                        className="absolute right-2 top-2 rounded border border-hairline bg-paper-raised p-1.5 text-ink-2 transition-colors hover:border-ink hover:text-ink"
                      >
                        {copied ? <Check size={14} strokeWidth={1.6} /> : <Copy size={14} strokeWidth={1.6} />}
                      </button>
                      <pre className="whitespace-pre-wrap border border-hairline bg-paper p-4 pr-12 font-sans text-[13px] leading-relaxed text-ink">
                        {body}
                      </pre>
                    </div>
                  </section>
                );
              })}
            </div>
            <footer className="border-t border-hairline px-7 py-4 text-[12px] text-ink-2">
              Dismiss these reminders to check them again later from wherever you left off.
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}