import { useEffect, useState } from "react";
import type { Application } from "@ghostboard/shared";
import { FOLLOW_UP_KIND_LABELS, evaluateDeadline, evaluateFollowUpKind } from "@ghostboard/tracking";
import { useApplications } from "../lib/useApplications";
import { ipc } from "../lib/ipc";
import { Button } from "../components/ui/button";

export function Todo() {
  const { applications, error, now, reload } = useApplications();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function evaluate() {
      try {
        await ipc().evaluateFollowUps();
        if (active) reload();
      } catch {
        // Follow-up evaluation failures are surfaced on the Today page.
      }
    }
    void evaluate();
    return () => {
      active = false;
    };
  }, [reload]);

  const due = (applications ?? []).filter((application) => application.followUpOn && !doneIds.has(application.id));
  const sendApplications = (applications ?? []).filter((application) => application.status === "found");

  async function handleDone(application: Application) {
    setDismissingId(application.id);
    setActionError(null);
    try {
      await ipc().dismissFollowUp(application.id);
      setDoneIds((ids) => new Set(ids).add(application.id));
      reload();
    } catch {
      setActionError("Could not mark that item done. Please try again.");
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="max-w-[980px]">
      <header className="animate-reveal">
        <h1 className="font-display text-[88px] leading-[0.88] tracking-[-0.02em] text-ink">To Do</h1>
        <p className="mt-4 max-w-[520px] text-[13px] leading-relaxed text-ink-2">
          Applications nearing their deadline or that are due for a follow-up, picked out automatically by the Today page. Check an item off once you have followed up.
        </p>
      </header>

      {error && (
        <div role="alert" className="mt-8 flex items-center gap-4 border-l-2 border-oxblood pl-4 text-[13px] text-ink">
          {error}
          <Button variant="quiet" onClick={reload}>Retry</Button>
        </div>
      )}
      {!applications && !error && <p role="status" className="mt-8 text-[13px] text-ink-2">Loading follow-ups…</p>}

      {actionError && (
        <div role="alert" className="mt-6 border-l-2 border-oxblood pl-4 text-[13px] text-ink">
          {actionError}
        </div>
      )}

      {applications && (
        <section className="mt-10 border-t border-hairline">
          {(due.length === 0 && sendApplications.length === 0) && (
            <div className="max-w-[560px] border-y border-dashed border-hairline py-10 font-display text-[20px] leading-snug text-ink-2">
              Nothing to chase today. The Today page flags applications two weeks after applying and after interviews go quiet.
            </div>
          )}
          {due.map((item) => {
            const kind = evaluateFollowUpKind(item, now);
            if (!kind) return null;
            return (
              <div key={item.id} className="flex items-start gap-4 border-b border-hairline py-5">
                <input
                  type="checkbox"
                  checked={doneIds.has(item.id)}
                  onChange={() => void handleDone(item)}
                  disabled={dismissingId === item.id}
                  aria-label={`Mark follow-up done for ${item.title} at ${item.company}`}
                  className="mt-1.5 h-4 w-4 shrink-0 rounded-sm accent-oxblood"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{item.title}</p>
                  <p className="mt-1 truncate text-[12px] text-ink-2">{item.company}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-oxblood">
                    {FOLLOW_UP_KIND_LABELS[kind]}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {applications && sendApplications.length > 0 && (
        <section className="mt-10 border-t border-hairline">
          {sendApplications.map((item) => {
            const deadlineStatus = evaluateDeadline(item.deadline, now);
            const urgencyColor =
              deadlineStatus.color === "red"
                ? "text-red-800"
                : deadlineStatus.color === "yellow"
                  ? "text-amber-800"
                  : "text-ink";
            return (
              <div key={item.id} className="border-b border-hairline py-5 pl-8">
                <p className={`truncate text-[15px] font-medium ${urgencyColor}`}>{item.title}</p>
                <p className="mt-1 truncate text-[12px] text-ink-2">{item.company}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-oxblood">Send application</span>
                  {deadlineStatus.daysRemaining !== null && (
                    <span className={`text-[11px] ${deadlineStatus.color === "none" ? "text-ink-3" : urgencyColor}`}>
                      {deadlineStatus.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}