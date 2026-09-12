import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Application } from "@ghostboard/shared";
import { evaluateApplicationStaleness, evaluateDeadline } from "@ghostboard/tracking";
import { ipc } from "../lib/ipc";
import { useApplications } from "../lib/useApplications";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const deadlineColors = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
  none: "bg-slate-100 text-slate-600",
};

function DeadlineBadge({ color, children }: { color: keyof typeof deadlineColors; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${deadlineColors[color]}`}>{children}</span>;
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
      <div className="flex items-center gap-2">
        <Input
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          aria-label={`Deadline for ${application.title} at ${application.company}`}
          aria-describedby={error ? `deadline-error-${application.id}` : undefined}
          aria-invalid={!!error}
          value={deadline}
          disabled={saving}
          onChange={(event) => { setDeadline(event.target.value); setSaved(false); setError(null); }}
        />
        <Button type="submit" variant="outline" disabled={saving || deadline === (application.deadline ?? "")}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <p id={`deadline-error-${application.id}`} role="alert" className="mt-1 text-xs text-red-800">{error}</p>}
      {saved && <p role="status" className="mt-1 text-xs text-green-800">Deadline saved.</p>}
    </form>
  );
}

export function Tracking() {
  const { applications, error, now, reload } = useApplications();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Tracking</h1>
      <p className="mb-3 text-sm text-slate-600">Set the application deadline from each posting. Clear the date and save to remove it.</p>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Deadline color legend">
        <DeadlineBadge color="green">7+ days</DeadlineBadge>
        <DeadlineBadge color="yellow">2–6 days</DeadlineBadge>
        <DeadlineBadge color="red">Today, tomorrow, or overdue</DeadlineBadge>
      </div>
      {error && <div role="alert" className="mb-4 text-red-800">{error} <Button variant="outline" onClick={reload}>Retry</Button></div>}
      {!applications && !error && <p role="status">Loading saved jobs…</p>}
      {applications?.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-slate-600">No saved jobs yet. Save a posting using the browser extension, then add its deadline here.</p>}
      {!!applications?.length && <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th scope="col" className="px-2 py-3">Company / role</th>
              <th scope="col" className="px-2">Stage</th>
              <th scope="col" className="px-2">Application deadline</th>
              <th scope="col" className="px-2">Deadline status</th>
              <th scope="col" className="px-2">Days since activity</th>
              <th scope="col" className="px-2">Staleness</th>
            </tr>
          </thead>
          <tbody>
            {applications?.map((application) => {
              const staleness = evaluateApplicationStaleness(application, now);
              const deadline = evaluateDeadline(application.deadline, now);
              return (
                <tr key={application.id} className="border-b border-slate-100">
                  <td className="min-w-[160px] max-w-xs break-words px-2 py-4"><div className="font-medium">{application.company}</div><div>{application.title}</div></td>
                  <td className="px-2">{application.status}</td>
                  <td className="px-2"><DeadlineEditor application={application} onSaved={reload} /></td>
                  <td className="px-2"><DeadlineBadge color={deadline.color}>{deadline.label}</DeadlineBadge></td>
                  <td className="px-2">{staleness.daysSinceLastActivity}</td>
                  <td className="px-2"><Badge variant={staleness.isStale ? "warning" : "outline"}>{staleness.isStale ? "Stale" : "OK"}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
