import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Application } from "@ghostboard/shared";
import { evaluateApplicationStaleness, evaluateDeadline } from "@ghostboard/tracking";
import { ipc } from "../lib/ipc";
import { useApplications } from "../lib/useApplications";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const deadlineColors = {
  green: "border-verdigris/35 text-verdigris",
  yellow: "border-brass/40 text-brass",
  red: "border-oxblood/35 text-oxblood",
  none: "border-hairline text-ink-3",
};

function DeadlineBadge({ color, children }: { color: keyof typeof deadlineColors; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px] ${deadlineColors[color]}`}>
      {children}
    </span>
  );
}

function DeadlineEditor({ application, onSaved }: { application: Application; onSaved: () => void }) {
  const [deadline, setDeadline] = useState(application.deadline ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDeadline(application.deadline ?? ""); }, [application.deadline]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await ipc().updateDeadline(application.id, deadline || null);
      setSaved(true);
      onSaved();
    } catch {
      setError("Could not save the deadline. Check the date and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="min-w-[230px]">
      <div className="flex items-center gap-3">
        <Input
          variant="rule"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          className="tnum w-[135px]"
          aria-label={`Deadline for ${application.title} at ${application.company}`}
          aria-describedby={error ? `deadline-error-${application.id}` : undefined}
          aria-invalid={!!error}
          value={deadline}
          disabled={saving}
          onChange={(event) => { setDeadline(event.target.value); setSaved(false); setError(null); }}
        />
        <Button type="submit" variant="rule" disabled={saving || deadline === (application.deadline ?? "")}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <p id={`deadline-error-${application.id}`} role="alert" className="mt-1.5 text-[11px] text-oxblood">{error}</p>}
      {saved && <p role="status" className="mt-1.5 text-[11px] text-verdigris">Deadline saved.</p>}
    </form>
  );
}

export function Tracking() {
  const { applications, error, now, reload } = useApplications();

  return (
    <div>
      <header className="animate-reveal flex items-baseline justify-between gap-10 border-b border-hairline pb-3">
        <h1 className="font-display text-[52px] leading-[0.9] tracking-[-0.015em] text-ink">Tracking</h1>
        <p className="max-w-[320px] text-right text-[12px] leading-relaxed text-ink-2">
          Set the application deadline from each posting. Clear the date and save to remove it.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2" aria-label="Deadline color legend">
        <DeadlineBadge color="green">7+ days</DeadlineBadge>
        <DeadlineBadge color="yellow">2–6 days</DeadlineBadge>
        <DeadlineBadge color="red">Today, tomorrow, or overdue</DeadlineBadge>
      </div>

      {error && (
        <div role="alert" className="mt-8 flex items-center gap-4 border-l-2 border-oxblood pl-4 text-[13px] text-ink">
          {error}
          <Button variant="quiet" onClick={reload}>Retry</Button>
        </div>
      )}
      {!applications && !error && <p role="status" className="mt-8 text-[13px] text-ink-2">Loading saved jobs…</p>}
      {applications?.length === 0 && (
        <p className="mt-9 max-w-[560px] border-y border-dashed border-hairline py-7 font-display text-[22px] leading-snug text-ink-2">
          No saved jobs yet. Save a posting with the browser extension, then add its deadline here.
        </p>
      )}

      {!!applications?.length && (
        <div className="animate-reveal mt-9 overflow-x-auto" style={{ animationDelay: "100ms" }}>
          <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[11px] text-ink-2">
                <th scope="col" className="px-3 pb-3 pl-0 font-normal">Company / role</th>
                <th scope="col" className="px-3 pb-3 font-normal">Stage</th>
                <th scope="col" className="px-3 pb-3 font-normal">Application deadline</th>
                <th scope="col" className="px-3 pb-3 font-normal">Deadline status</th>
                <th scope="col" className="px-3 pb-3 font-normal">Days quiet</th>
                <th scope="col" className="px-3 pb-3 pr-0 font-normal">Staleness</th>
              </tr>
            </thead>
            <tbody>
              {applications?.map((application) => {
                const staleness = evaluateApplicationStaleness(application, now);
                const deadline = evaluateDeadline(application.deadline, now);
                return (
                  <tr key={application.id} className="border-b border-hairline transition-colors hover:bg-paper-raised">
                    <td className="min-w-[170px] max-w-xs break-words px-3 py-5 pl-0">
                      <div className="font-semibold text-ink">{application.company}</div>
                      <div className="mt-0.5 text-ink-2">{application.title}</div>
                    </td>
                    <td className="px-3 text-ink-2">{application.status}</td>
                    <td className="px-3"><DeadlineEditor application={application} onSaved={reload} /></td>
                    <td className="px-3"><DeadlineBadge color={deadline.color}>{deadline.label}</DeadlineBadge></td>
                    <td className="tnum px-3 text-ink-2">{staleness.daysSinceLastActivity}</td>
                    <td className="px-3 pr-0">
                      <Badge variant={staleness.isStale ? "brass" : "mist"}>{staleness.isStale ? "Stale" : "OK"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
