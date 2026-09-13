import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { jobDetailBadges } from "@ghostboard/shared";
import { cn, daysSince, formatDate } from "../../lib/utils";

const STAGE_EDGE: Record<ApplicationStage, string> = {
  found: "hover:border-ink-3",
  applied: "hover:border-ink",
  interviewing: "hover:border-brass",
  offer: "hover:border-verdigris",
  rejected: "hover:border-oxblood",
  ghosted: "hover:border-ink-3",
};

/** Detail chips from ingestion. Renders nothing for a manually added application. */
function DetailBadges({ application }: { application: Application }) {
  const badges = jobDetailBadges(application.jobDetails, 2);
  if (!badges.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded-sm border border-hairline px-1.5 py-px text-[9px] lowercase tracking-wide text-ink-3"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

export function KanbanCardPreview({
  application,
  stage,
  isCrumbling = false,
}: {
  application: Application;
  stage: ApplicationStage;
  isCrumbling?: boolean;
}) {
  const dateApplied = formatDate(application.dateApplied || "");

  return (
    <motion.article
      animate={
        isCrumbling
          ? {
              clipPath: "polygon(8% 7%, 88% 0%, 100% 18%, 91% 88%, 68% 100%, 11% 91%, 0% 63%, 5% 24%)",
              opacity: 0.68,
              rotate: 7,
              scale: 0.58,
              skewX: -5,
              y: 8,
            }
          : {
              clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 100% 100%, 100% 100%, 0% 100%, 0% 100%, 0% 0%)",
              opacity: 1,
              rotate: 0,
              scale: 1,
              skewX: 0,
              y: 0,
            }
      }
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "relative overflow-hidden rounded-sm border bg-paper px-3.5 py-3 shadow-[5px_5px_0_0_var(--card-shadow)]",
        stage === "ghosted" ? "border-dashed border-hairline" : "border-hairline",
        STAGE_EDGE[stage],
      )}
    >
      <h4 className="text-[13px] font-semibold leading-tight text-ink">{application.company}</h4>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{application.title}</p>
      <DetailBadges application={application} />
      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-hairline pt-2 text-[11px] text-ink-3">
        <span className="tnum">{daysSince(application.lastActivityAt)}d quiet</span>
        {dateApplied && <span className="tnum">applied on {dateApplied}</span>}
      </div>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(28deg,transparent_0,transparent_18px,rgb(var(--oxblood)/0.15)_19px,transparent_20px)]"
        animate={{ opacity: isCrumbling ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />
    </motion.article>
  );
}

export function KanbanCard({ application, stage, onOpen }: { application: Application; stage: ApplicationStage; onOpen: (application: Application) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : "auto",
  };

  const dateApplied = formatDate(application.dateApplied || "");

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <article
        onClick={() => onOpen(application)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(application);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${application.title} at ${application.company}`}
        className={cn(
          "mb-2 cursor-grab rounded-sm border bg-paper px-3.5 py-3 transition-all duration-200 last:mb-0",
          "hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--card-shadow)] active:cursor-grabbing",
          stage === "ghosted" ? "border-dashed border-hairline" : "border-hairline",
          STAGE_EDGE[stage],
        )}
      >
        <h4 className="text-[13px] font-semibold leading-tight text-ink">{application.company}</h4>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{application.title}</p>
        <DetailBadges application={application} />
        <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-hairline pt-2 text-[11px] text-ink-3">
          <span className="tnum">{daysSince(application.lastActivityAt)}d quiet</span>
          {dateApplied && <span className="tnum">applied on {dateApplied}</span>}
        </div>
      </article>
    </div>
  );
}
