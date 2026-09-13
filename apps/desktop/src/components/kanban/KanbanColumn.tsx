import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, useAnimationControls } from "framer-motion";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { STAGE_LABELS, STAGE_SUBTITLES, STAGE_EMPTY } from "@ghostboard/shared";
import { KanbanCard } from "./KanbanCard";
import { AnimatedNumber, Stamp } from "../motion";
import { DISTANCE, DURATION, EASE, SCALE, SPRING, STAGGER, TRANSITION } from "../../lib/motion";
import { cn } from "../../lib/utils";

const STAGE_RULE: Record<ApplicationStage, string> = {
  found: "bg-ink-3",
  applied: "bg-ink",
  interviewing: "bg-brass",
  offer: "bg-verdigris",
  rejected: "bg-oxblood",
  ghosted: "bg-ink-3/50",
};

// Product semantics, not decoration: oxblood closes a door, brass means in
// progress, verdigris means good news.
const STAGE_STAMP_TONE: Record<ApplicationStage, "oxblood" | "verdigris" | "brass" | "ink"> = {
  found: "ink",
  applied: "brass",
  interviewing: "brass",
  offer: "verdigris",
  rejected: "oxblood",
  ghosted: "ink",
};

export function KanbanColumn({
  stage,
  applications,
  index,
  onOpen,
  promotionToken = 0,
  onPromotionDone,
  shakingApplicationId = null,
}: {
  stage: ApplicationStage;
  applications: Application[];
  index: number;
  onOpen: (application: Application) => void;
  promotionToken?: number;
  onPromotionDone?: () => void;
  shakingApplicationId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const subtitle = STAGE_SUBTITLES[stage];
  const emptyLine = STAGE_EMPTY[stage];
  const count = applications.length;

  const countControls = useAnimationControls();
  const previousCount = useRef(count);

  useEffect(() => {
    if (previousCount.current === count) return;
    previousCount.current = count;
    void countControls
      .start({ scale: SCALE.pop }, SPRING.press)
      .then(() => countControls.start({ scale: 1 }, SPRING.overshoot))
      .catch(() => undefined);
  }, [count, countControls]);

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: DISTANCE.rise }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION.slow, delay: index * STAGGER.section }}
      className={cn(
        "relative flex w-[78vw] max-w-[280px] shrink-0 snap-center flex-col rounded-sm border transition-colors duration-200 sm:w-[252px] sm:max-w-none sm:snap-align-none",
        isOver ? "border-oxblood bg-oxblood/5" : "border-hairline bg-paper-raised",
      )}
    >
      {isOver && (
        <span
          aria-hidden="true"
          className="pulse-soft pointer-events-none absolute inset-0 rounded-sm border border-dashed border-oxblood/70"
        />
      )}

      <div className="relative h-[2px] overflow-hidden">
        <motion.div
          className={cn("h-full w-full origin-left", STAGE_RULE[stage])}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ ...TRANSITION.hero, delay: index * STAGGER.section + 0.12 }}
        />
        {promotionToken > 0 && (
          <motion.div
            key={promotionToken}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 origin-left bg-oxblood"
            initial={{ scaleX: 0, opacity: 0.35 }}
            animate={{ scaleX: 1, opacity: [0.35, 0.35, 0] }}
            transition={{ duration: DURATION.deliberate, ease: EASE.out }}
          />
        )}
      </div>

      <div className="relative px-4 pb-4 pt-3.5">
        {promotionToken > 0 && (
          <Stamp
            key={promotionToken}
            label={STAGE_LABELS[stage]}
            show
            tone={STAGE_STAMP_TONE[stage]}
            onDone={onPromotionDone}
          />
        )}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[19px] leading-none text-ink">{STAGE_LABELS[stage]}</h3>
          <motion.span animate={countControls} className="tnum inline-block text-[12px] text-ink-3">
            <AnimatedNumber value={count} duration={DURATION.slow} />
          </motion.span>
        </div>
        {subtitle && <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{subtitle}</p>}
        <div className="mt-3.5 border-t border-hairline pt-3.5">
          <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div className="min-h-[44px]">
              {applications.map((app, cardIndex) => (
                <KanbanCard
                  key={app.id}
                  application={app}
                  stage={stage}
                  index={cardIndex}
                  isShaking={shakingApplicationId === app.id}
                  onOpen={onOpen}
                />
              ))}
              {applications.length === 0 && emptyLine && (
                <p className="pt-1 text-[11px] italic text-ink-3">{emptyLine}</p>
              )}
            </div>
          </SortableContext>
        </div>
      </div>
    </motion.div>
  );
}
