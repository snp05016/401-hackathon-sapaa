import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { STAGE_LABELS, STAGE_SUBTITLES, STAGE_EMPTY } from "@ghostboard/shared";
import { KanbanCard } from "./KanbanCard";
import { cn } from "../../lib/utils";

const STAGE_RULE: Record<ApplicationStage, string> = {
  found: "bg-ink-3",
  applied: "bg-ink",
  interviewing: "bg-brass",
  offer: "bg-verdigris",
  rejected: "bg-oxblood",
  ghosted: "bg-ink-3/50",
};

export function KanbanColumn({
  stage,
  applications,
  index,
}: {
  stage: ApplicationStage;
  applications: Application[];
  index: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const subtitle = STAGE_SUBTITLES[stage];
  const emptyLine = STAGE_EMPTY[stage];

  return (
    <div
      ref={setNodeRef}
      style={{ animationDelay: `${index * 70}ms` }}
      className={cn(
        "animate-reveal flex w-[252px] shrink-0 flex-col rounded-sm border bg-paper-raised transition-colors duration-200",
        isOver ? "border-oxblood" : "border-hairline",
      )}
    >
      <div className={cn("h-[2px] origin-left animate-draw-rule", STAGE_RULE[stage])} style={{ animationDelay: `${index * 70 + 120}ms` }} />
      <div className="px-4 pb-4 pt-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[19px] leading-none text-ink">{STAGE_LABELS[stage]}</h3>
          <span className="tnum text-[12px] text-ink-3">{applications.length}</span>
        </div>
        {subtitle && <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{subtitle}</p>}
        <div className="mt-3.5 border-t border-hairline pt-3.5">
          <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div className="min-h-[44px]">
              {applications.map((app) => (
                <KanbanCard key={app.id} application={app} stage={stage} />
              ))}
              {applications.length === 0 && emptyLine && (
                <p className="pt-1 text-[11px] italic text-ink-3">{emptyLine}</p>
              )}
            </div>
          </SortableContext>
        </div>
      </div>
    </div>
  );
}
