import { summarizeToday } from "@ghostboard/tracking";
import { useApplications } from "../lib/useApplications";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function Today() {
  const { applications, error, now, reload } = useApplications();
  const counts = summarizeToday(applications ?? [], now);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Today</h1>
      <p className="mb-6 text-slate-500">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      {error && <div role="alert" className="mb-4 text-red-800">{error} <Button variant="outline" onClick={reload}>Retry</Button></div>}
      {!applications && !error && <p role="status">Loading saved jobs…</p>}
      {applications && <>
        <h2 className="mb-2 text-lg font-semibold">Application deadlines</h2>
        <p className="mb-4 text-sm text-slate-600">Jobs in Found that still need an application. Set their deadlines in Tracking.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Due today", count: counts.dueToday, color: "text-red-800" },
            { title: "Due in the next 7 days", count: counts.upcoming, color: "text-amber-800" },
            { title: "Overdue", count: counts.overdue, color: "text-red-800" },
          ].map(({ title, count, color }) => (
            <Card key={title}>
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent className={`text-3xl font-bold ${color}`}>{count}</CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">{counts.noDeadline} {counts.noDeadline === 1 ? "job has" : "jobs have"} no deadline set.</p>
        {applications.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-slate-600">Save a job using the browser extension to start tracking deadlines.</p>}
        <h2 className="mb-3 mt-8 text-lg font-semibold">Application overview</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Total applications", count: counts.total },
            { title: "Applied", count: counts.applied },
            { title: "Interviewing", count: counts.interviewing },
          ].map(({ title, count }) => (
            <Card key={title}>
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{count}</CardContent>
            </Card>
          ))}
        </div>
      </>}
    </div>
  );
}
