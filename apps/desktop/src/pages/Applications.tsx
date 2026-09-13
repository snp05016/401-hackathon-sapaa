import { useEffect, useState } from "react";
import type { Application } from "@ghostboard/shared";
import { ipc } from "../lib/ipc";
import { KanbanBoard } from "../components/kanban/KanbanBoard";
import { AnimatedNumber, Reveal, Shimmer } from "../components/motion";
import { DURATION } from "../lib/motion";

export function Applications() {
  const [applications, setApplications] = useState<Application[] | null>(null);

  useEffect(() => {
    ipc()
      .listApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  if (!applications) {
    return (
      <div>
        <p role="status" className="text-[13px] text-ink-2">Loading applications…</p>
        <div className="mt-6 flex gap-4 overflow-hidden" aria-hidden="true">
          {[0, 1, 2, 3].map((column) => (
            <div key={column} className="w-[252px] shrink-0 rounded-sm border border-hairline bg-paper-raised p-4">
              <Shimmer lines={4} height={46} rounded />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Reveal as="header" className="mb-9 flex flex-col gap-3 border-b border-hairline pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
        <h1 className="font-display text-[36px] leading-[0.9] tracking-[-0.015em] text-ink sm:text-[52px]">Applications</h1>
        <p className="tnum text-[12px] text-ink-2">
          <AnimatedNumber value={applications.length} duration={DURATION.deliberate} delay={0.12} /> tracked
        </p>
      </Reveal>
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
