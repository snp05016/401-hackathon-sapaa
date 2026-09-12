import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { APPLICATION_STAGES } from "@ghostboard/shared";
import { KanbanColumn } from "./KanbanColumn";
import { moveApplication } from "./moveApplication";

export function KanbanBoard({ initialApplications }: { initialApplications: Application[] }) {
  const [applications, setApplications] = useState(initialApplications);
  const [banner, setBanner] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const byStage = useMemo(() => {
    const grouped: Record<ApplicationStage, Application[]> = {
      found: [],
      applied: [],
      interviewing: [],
      offer: [],
      rejected: [],
      ghosted: [],
    };
    for (const app of applications) grouped[app.status].push(app);
    return grouped;
  }, [applications]);

  function stageForId(id: string): ApplicationStage | null {
    if ((APPLICATION_STAGES as readonly string[]).includes(id)) return id as ApplicationStage;
    return applications.find((a) => a.id === id)?.status ?? null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeApp = applications.find((a) => a.id === active.id);
    const toStage = stageForId(String(over.id));
    if (!activeApp || !toStage || activeApp.status === toStage) return;

    const fromStage = activeApp.status;
    const previous = applications;

    // Real optimistic local move — dnd-kit driven, works immediately in the UI.
    setApplications((apps) => apps.map((a) => (a.id === activeApp.id ? { ...a, status: toStage } : a)));

    moveApplication(activeApp.id, fromStage, toStage)
      .then((savedApplication) => {
        setApplications((apps) => apps.map((app) => (app.id === savedApplication.id ? savedApplication : app)));
      })
      .catch(() => {
        setApplications(previous);
        setBanner("This move didn't save — the application was returned to its previous stage.");
      });
  }

  return (
    <div>
      {banner && (
        <div className="mb-5 flex items-center justify-between gap-6 border-l-2 border-oxblood bg-paper-raised py-2.5 pl-4 pr-3 text-[12px] text-ink">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="shrink-0 text-ink-2 underline underline-offset-4 transition-colors hover:text-oxblood">
            Dismiss
          </button>
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-5 snap-x snap-mandatory sm:snap-none">
          {APPLICATION_STAGES.map((stage, index) => (
            <KanbanColumn key={stage} stage={stage} applications={byStage[stage]} index={index} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
