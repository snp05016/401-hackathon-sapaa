import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { cn, daysSince, formatDate } from "../../lib/utils";

const STAGE_EDGE: Record<ApplicationStage, string> = {
  found: "hover:border-ink-3",
  applied: "hover:border-ink",
  interviewing: "hover:border-brass",
  offer: "hover:border-verdigris",
  rejected: "hover:border-oxblood",
  ghosted: "hover:border-ink-3",
};

export function KanbanCard({ application, stage }: { application: Application; stage: ApplicationStage }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : "auto",
  };

  const dateApplied = formatDate(application.dateApplied || "");

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <article
        className={cn(
          "mb-2 cursor-grab rounded-sm border bg-paper px-3.5 py-3 transition-all duration-200 last:mb-0",
          "hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--card-shadow)] active:cursor-grabbing",
          stage === "ghosted" ? "border-dashed border-hairline" : "border-hairline",
          STAGE_EDGE[stage],
        )}
      >
        <h4 className="text-[13px] font-semibold leading-tight text-ink">{application.company}</h4>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{application.title}</p>
        <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-hairline pt-2 text-[11px] text-ink-3">
          <span className="tnum">{daysSince(application.lastActivityAt)}d quiet</span>
          {dateApplied && <span className="tnum">applied on {dateApplied}</span>}
        </div>
      </article>
    </div>
  );
}
