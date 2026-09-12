import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Application } from "@ghostboard/shared";
import { Card, CardContent } from "../ui/card";
import { daysSince, formatDate } from "../../lib/utils";

export function KanbanCard({ application }: { application: Application }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-2 cursor-grab active:cursor-grabbing">
        <CardContent className="p-3">
          <div className="text-sm font-semibold text-slate-900">{application.company}</div>
          <div className="text-xs text-slate-600">{application.title}</div>
          <div className="mt-2 text-xs text-slate-400">
            {daysSince(application.lastActivityAt)}d since activity
          </div>
          <div className="mt-2 text-xs text-slate-400">
            applied on {formatDate(application.dateApplied || '')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
