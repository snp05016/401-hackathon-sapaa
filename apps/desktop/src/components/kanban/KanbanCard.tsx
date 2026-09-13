import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { evaluateApplicationStaleness } from "@ghostboard/tracking";
import { GhostDrift } from "../motion";
import { DISTANCE, DURATION, EASE, SCALE, SPRING, STAGGER, TRANSITION } from "../../lib/motion";
import { cn, daysSince, formatDate } from "../../lib/utils";
import { GhostBadge } from "../ui/GhostBadge";

// Stages where silence plausibly means the employer stopped responding.
// "found" hasn't been sent yet and "offer"/"rejected"/"ghosted" already got a
// response (or are excluded from staleness entirely), so ghosting doesn't apply.
const GHOSTABLE_STAGES = new Set<ApplicationStage>(["applied", "interviewing"]);

const STAGE_EDGE: Record<ApplicationStage, string> = {
  found: "hover:border-ink-3",
  applied: "hover:border-ink",
  interviewing: "hover:border-brass",
  offer: "hover:border-verdigris",
  rejected: "hover:border-oxblood",
  ghosted: "hover:border-ink-3",
};

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
              rotate: -1.5,
              scale: 1.03,
              skewX: 0,
              y: 0,
            }
      }
      transition={SPRING.card}
      className={cn(
        "relative overflow-hidden rounded-sm border bg-paper px-3.5 py-3 shadow-[5px_5px_0_0_var(--card-shadow)]",
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
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(28deg,transparent_0,transparent_18px,rgb(var(--oxblood)/0.15)_19px,transparent_20px)]"
        animate={{ opacity: isCrumbling ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />
    </motion.article>
  );
}

export function KanbanCard({
  application,
  stage,
  index,
  isShaking = false,
  onOpen,
}: {
  application: Application;
  stage: ApplicationStage;
  index: number;
  isShaking?: boolean;
  onOpen: (application: Application) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });
  const prefersReducedMotion = useReducedMotion();

  // dnd-kit owns `transform` on this node. Every motion wrapper lives inside it so
  // framer never competes for the same transform.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative" as const,
    zIndex: isDragging ? 50 : "auto",
  };

  const dateApplied = formatDate(application.dateApplied || "");
  const staleness = evaluateApplicationStaleness(application);
  const isGhosting = staleness.isStale && GHOSTABLE_STAGES.has(stage);
  const isGhosted = stage === "ghosted";
  const haunted = isGhosted && prefersReducedMotion !== true;
  const restingOpacity = isDragging ? 0.35 : haunted ? 0.82 : 1;
  const enterDelay = Math.min(index, 11) * STAGGER.list;

  const card = (
    <motion.article
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
      animate={
        isShaking
          ? { opacity: restingOpacity, x: [0, -4, 4, -3, 0] }
          : { opacity: restingOpacity, x: 0 }
      }
      transition={
        isShaking
          ? { duration: DURATION.base, ease: EASE.out }
          : { duration: DURATION.quick, ease: EASE.subtle }
      }
      whileHover={{ y: DISTANCE.lift, opacity: 1, transition: SPRING.hover }}
      whileTap={{ scale: SCALE.press, transition: SPRING.press }}
      className={cn(
        "group relative cursor-grab rounded-sm border bg-paper px-3.5 py-3 active:cursor-grabbing",
        "transition-[box-shadow,border-color] duration-200 hover:shadow-[5px_5px_0_0_var(--card-shadow)]",
        // A ghosted card hands its border to the pulsing overlay below so the two
        // never draw concentric dashed rings.
        isGhosted ? "border-transparent" : "border-hairline",
        !isGhosted && STAGE_EDGE[stage],
      )}
    >
      {isGhosted && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-sm border border-dashed border-hairline group-hover:border-ink-3",
            haunted && "pulse-soft",
          )}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-semibold leading-tight text-ink">{application.company}</h4>
        {isGhosting && <GhostBadge days={staleness.daysSinceLastActivity} className="mt-0.5" />}
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{application.title}</p>
      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-hairline pt-2 text-[11px] text-ink-3">
        <span className={cn("tnum", isGhosting && "text-oxblood/80")}>{daysSince(application.lastActivityAt)}d quiet</span>
        {dateApplied && <span className="tnum">applied on {dateApplied}</span>}
      </div>
    </motion.article>
  );

  // Ghosted cards drift so the stale metaphor is literal. Periods are detuned per
  // index so neighbouring ghosts never breathe in unison.
  const body: ReactNode = haunted ? (
    <GhostDrift amplitude={3} period={6 + (index % 4) * 0.8}>
      {card}
    </GhostDrift>
  ) : (
    card
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <motion.div
        className="mb-2 last:mb-0"
        initial={{ opacity: 0, y: DISTANCE.rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TRANSITION.base, delay: enterDelay }}
      >
        {body}
      </motion.div>
    </div>
  );
}
