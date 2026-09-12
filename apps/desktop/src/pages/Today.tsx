import { useEffect, useState } from "react";
import type { Application } from "@ghostboard/shared";
import { ipc } from "../lib/ipc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function Today() {
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    ipc()
      .listApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  // TODO(team)[beginner]: replace with real "today" logic (things due today, stale reminders, etc.)
  const counts = {
    total: applications.length,
    applied: applications.filter((a) => a.status === "applied").length,
    interviewing: applications.filter((a) => a.status === "interviewing").length,
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Good to see you 👋</h1>
      <p className="mb-6 text-slate-500">Here's where things stand.</p>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total applications</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{counts.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Applied</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{counts.applied}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Interviewing</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{counts.interviewing}</CardContent>
        </Card>
      </div>
    </div>
  );
}
