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

    moveApplication(activeApp.id, fromStage, toStage).catch(() => {
      setApplications(previous);
      setBanner("This move didn't save — the application was returned to its previous stage.");
    });
  }

  return (
    <div>
      {banner && (
        <div className="mb-3 flex items-center justify-between rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="font-semibold">
            Dismiss
          </button>
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {APPLICATION_STAGES.map((stage) => (
            <KanbanColumn key={stage} stage={stage} applications={byStage[stage]} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
