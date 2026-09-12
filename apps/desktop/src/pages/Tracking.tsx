import { useEffect, useState } from "react";
import type { Application } from "@ghostboard/shared";
import { evaluateApplicationStaleness } from "@ghostboard/tracking";
import { ipc } from "../lib/ipc";
import { Badge } from "../components/ui/badge";

export function Tracking() {
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    ipc()
      .listApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Tracking</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Company</th>
            <th>Title</th>
            <th>Status</th>
            <th>Days since activity</th>
            <th>Staleness</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => {
            const staleness = evaluateApplicationStaleness(app);
            return (
              <tr key={app.id} className="border-b border-slate-100">
                <td className="py-2">{app.company}</td>
                <td>{app.title}</td>
                <td>{app.status}</td>
                <td>{staleness.daysSinceLastActivity}</td>
                <td>
                  <Badge variant={staleness.isStale ? "warning" : "outline"}>
                    {staleness.isStale ? "Stale" : "OK"}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
