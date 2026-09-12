import { useEffect, useState } from "react";
import type { Application } from "@ghostboard/shared";
import { ipc } from "../lib/ipc";
import { KanbanBoard } from "../components/kanban/KanbanBoard";

export function Applications() {
  const [applications, setApplications] = useState<Application[] | null>(null);

  useEffect(() => {
    ipc()
      .listApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  if (!applications) return <div className="text-slate-500">Loading…</div>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Applications</h1>
      <KanbanBoard initialApplications={applications} />
    </div>
  );
}
