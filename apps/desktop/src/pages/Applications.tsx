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

  if (!applications) return <div className="text-[13px] text-ink-2">Loading applications…</div>;

  return (
    <div>
      <header className="animate-reveal mb-9 flex flex-col gap-3 border-b border-hairline pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
        <h1 className="font-display text-[36px] leading-[0.9] tracking-[-0.015em] text-ink sm:text-[52px]">Applications</h1>
        <p className="tnum text-[12px] text-ink-2">{applications.length} tracked</p>
      </header>
      <KanbanBoard
        initialApplications={applications}
        onApplicationDeleted={(applicationId) =>
          setApplications((current) =>
            current?.filter((application) => application.id !== applicationId) ?? [],
          )
        }
      />
    </div>
  );
}
