import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { STAGE_LABELS, STAGE_SUBTITLES } from "@ghostboard/shared";
import { KanbanCard } from "./KanbanCard";

export function KanbanColumn({ stage, applications }: { stage: ApplicationStage; applications: Application[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const subtitle = STAGE_SUBTITLES[stage];

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50 p-2 ${isOver ? "ring-2 ring-slate-400" : ""}`}
    >
      <div className="mb-2 px-1">
        <div className="text-sm font-semibold text-slate-800">{STAGE_LABELS[stage]}</div>
        {subtitle && <div className="text-xs italic text-slate-400">{subtitle}</div>}
      </div>
      <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[40px] flex-1">
          {applications.map((app) => (
            <KanbanCard key={app.id} application={app} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
