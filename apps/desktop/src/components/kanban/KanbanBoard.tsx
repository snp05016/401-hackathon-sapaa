import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { APPLICATION_STAGES } from "@ghostboard/shared";
import { EmojiBurst, type EmojiBurstEffect } from "./EmojiBurst";
import { KanbanCardPreview } from "./KanbanCard";
import { KanbanColumn } from "./KanbanColumn";
import { moveApplication } from "./moveApplication";
import { PaperConfetti } from "../motion";
import { DURATION, EASE, TRANSITION, fadeRise, modalBackdrop, modalPanel } from "../../lib/motion";
import { playSound } from "../../lib/sound";
import { ipc } from "../../lib/ipc";

const DELETE_DROP_ID = "kanban-delete-drop-zone";

function DeleteDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: DELETE_DROP_ID });
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      ref={setNodeRef}
      aria-label="Delete application drop zone"
      animate={{ scale: isOver ? 1.0 : 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
    >
      <motion.span
        aria-hidden="true"
        className="inline-flex"
        animate={isOver ? { rotate: [0, -8, 8, -6, 0] } : { rotate: 0 }}
        transition={
          isOver
            ? { duration: 0.6, ease: EASE.inOut, repeat: Infinity }
            : { duration: DURATION.quick, ease: EASE.subtle }
        }
      >
        <div className="relative mt-3 ml-2 h-[48px] w-[40px] cursor-pointer">
          {/* Animating Container: Holds both the lid and the handle so they rotate together */}
          <div 
            className={`absolute left-0 w-[40px] origin-left transition-all duration-200 ease-out
              ${isOver ? '-top-[8px] -rotate-35' : '-top-[.5px] rotate-0'}`}
          >
            {/* Handle (Centered precisely on top of the lid) */}
            <div className="absolute -top-[6px] left-[10px] h-[10px] w-[20px] rounded-t-[3px] border-4 border-ink border-b-0" />
            
            {/* The Lid Bar */}
            <div className="absolute top-0 -left-[5px] h-[8px] w-[50px] rounded-[4px] bg-ink" />
          </div>
          {/* The Bin */}
          <div className="absolute bottom-0 h-[38px] w-[40px] rounded-b-[6px] bg-ink">
            {/* Left Line */}
            <div className="absolute top-[8px] left-[8px] w-[4px] h-[24px] rounded-full bg-paper" />
            {/* Middle Line */}
            <div className="absolute top-[8px] left-[18px] w-[4px] h-[24px] rounded-full bg-paper" />
            {/* Right Line */}
            <div className="absolute top-[8px] right-[8px] w-[4px] h-[24px] rounded-full bg-paper" />
          </div>
        </div>
      </motion.span>
      {/* <p className="ml-2 text-[8px] leading-snug text-ink-2">delete here</p> */}
    </motion.div>
  );
}

function ApplicationDetails({ application, onClose }: { application: Application; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="application-details-title">
      <motion.button
        type="button"
        variants={modalBackdrop}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 cursor-default bg-ink/40"
        aria-label="Close application details"
        onClick={onClose}
      />
      <motion.section
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden border border-hairline bg-paper-raised shadow-2xl"
      >
        <header className="flex items-start justify-between gap-5 border-b border-hairline px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-3">{application.status}</p>
            <h2 id="application-details-title" className="mt-1 break-words font-display text-[28px] leading-tight text-ink sm:text-[34px]">{application.title}</h2>
            <p className="mt-1 text-[13px] text-ink-2">{application.company}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-ink-2 transition-colors hover:text-ink" aria-label="Close application details">
            <span aria-hidden="true" className="text-2xl leading-none">×</span>
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <dl className="grid gap-x-6 gap-y-4 border-b border-hairline pb-5 text-[13px] sm:grid-cols-2">
            <div><dt className="text-[11px] text-ink-3">Stage</dt><dd className="mt-1 capitalize text-ink">{application.status}</dd></div>
            <div><dt className="text-[11px] text-ink-3">Location</dt><dd className="mt-1 text-ink">{application.location || "Not specified"}</dd></div>
            <div><dt className="text-[11px] text-ink-3">Source</dt><dd className="mt-1 text-ink">{application.source}</dd></div>
            <div><dt className="text-[11px] text-ink-3">Saved</dt><dd className="mt-1 text-ink">{new Date(application.dateFound).toLocaleDateString()}</dd></div>
            <div><dt className="text-[11px] text-ink-3">Applied</dt><dd className="mt-1 text-ink">{application.dateApplied ? new Date(application.dateApplied).toLocaleDateString() : "Not applied"}</dd></div>
            <div><dt className="text-[11px] text-ink-3">Last activity</dt><dd className="mt-1 text-ink">{new Date(application.lastActivityAt).toLocaleDateString()}</dd></div>
          </dl>

          <div className="mt-5">
            <h3 className="font-display text-[22px] text-ink">Job description</h3>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{application.jobDescription || "No job description was saved for this application."}</p>
          </div>

          <a href={application.jobUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block break-all text-[12px] text-oxblood underline underline-offset-4">
            Open original job posting
          </a>
        </div>
      </motion.section>
    </div>
  );
}

export function KanbanBoard({
  initialApplications,
  onApplicationDeleted,
}: {
  initialApplications: Application[];
  onApplicationDeleted: (applicationId: string) => void;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [banner, setBanner] = useState<string | null>(null);
  const [emojiBursts, setEmojiBursts] = useState<EmojiBurstEffect[]>([]);
  const [draggedApplication, setDraggedApplication] = useState<Application | null>(null);
  const [isOverDelete, setIsOverDelete] = useState(false);
  const nextBurstId = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [promotion, setPromotion] = useState<{ stage: ApplicationStage; token: number } | null>(null);
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null);
  const [shakingApplicationId, setShakingApplicationId] = useState<string | null>(null);
  const nextPromotionToken = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Safety nets so a one-shot overlay can never linger if its own callback is missed.
  useEffect(() => {
    if (!promotion) return;
    const timer = window.setTimeout(() => setPromotion(null), 1800);
    return () => window.clearTimeout(timer);
  }, [promotion]);

  useEffect(() => {
    if (!confettiOrigin) return;
    const timer = window.setTimeout(() => setConfettiOrigin(null), 2400);
    return () => window.clearTimeout(timer);
  }, [confettiOrigin]);

  useEffect(() => {
    if (!shakingApplicationId) return;
    const timer = window.setTimeout(() => setShakingApplicationId(null), 420);
    return () => window.clearTimeout(timer);
  }, [shakingApplicationId]);

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
    setDraggedApplication(null);
    setIsOverDelete(false);
    const { active, over } = event;
    if (!over) return;

    const activeApp = applications.find((a) => a.id === active.id);
    if (!activeApp) return;

    if (over.id === DELETE_DROP_ID) {
      setBanner(null);
      playSound("delete");
      setApplications((current) => current.filter((application) => application.id !== activeApp.id));
      ipc()
        .deleteApplication(activeApp.id)
        .then(() => {
          onApplicationDeleted(activeApp.id);
          if (selectedApplication?.id === activeApp.id) setSelectedApplication(null);
        })
        .catch(() => {
          setApplications((current) =>
            current.some((application) => application.id === activeApp.id)
              ? current
              : [...current, activeApp],
          );
          playSound("error");
          setBanner("This application couldn't be deleted and was returned to the board.");
        });
      return;
    }

    const toStage = stageForId(String(over.id));
    if (!toStage || activeApp.status === toStage) return;

    const fromStage = activeApp.status;
    const previous = applications;
    const droppedRect = active.rect.current.translated ?? over.rect;
    const dropPoint = {
      x: droppedRect.left + droppedRect.width / 2,
      y: droppedRect.top + droppedRect.height / 2,
    };

    // Real optimistic local move — dnd-kit driven, works immediately in the UI.
    setApplications((apps) => apps.map((a) => (a.id === activeApp.id ? { ...a, status: toStage } : a)));

    moveApplication(activeApp.id, fromStage, toStage)
      .then((savedApplication) => {
        setApplications((apps) => apps.map((app) => (app.id === savedApplication.id ? savedApplication : app)));
        nextPromotionToken.current += 1;
        setPromotion({ stage: toStage, token: nextPromotionToken.current });
        playSound("drop");
        if (toStage === "offer") {
          playSound("chime");
          if (!prefersReducedMotion) setConfettiOrigin(dropPoint);
        }
        if (!prefersReducedMotion) {
          const id = nextBurstId.current++;
          setEmojiBursts((bursts) => [...bursts, { id, stage: toStage, ...dropPoint }]);
        }
      })
      .catch(() => {
        setApplications(previous);
        setShakingApplicationId(activeApp.id);
        playSound("error");
        setBanner("This move didn't save — the application was returned to its previous stage.");
      });
  }

  function openApplication(application: Application) {
    playSound("open");
    setSelectedApplication(application);
  }

  function closeApplication() {
    playSound("close");
    setSelectedApplication(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setIsOverDelete(false);
    setDraggedApplication(
      applications.find((application) => application.id === event.active.id) ?? null,
    );
  }

  function handleDragOver(event: DragOverEvent) {
    setIsOverDelete(event.over?.id === DELETE_DROP_ID);
  }

  return (
    <div>
      <AnimatePresence initial={false}>
        {banner && (
          <motion.div
            key="kanban-banner"
            variants={fadeRise}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={TRANSITION.base}
            className="mb-5 flex items-center justify-between gap-6 border-l-2 border-oxblood bg-paper-raised py-2.5 pl-4 pr-3 text-[12px] text-ink"
          >
            <span>{banner}</span>
            <button onClick={() => setBanner(null)} className="shrink-0 text-ink-2 underline underline-offset-4 transition-colors hover:text-oxblood">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={() => {
          setDraggedApplication(null);
          setIsOverDelete(false);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-5 snap-x snap-mandatory sm:snap-none">
          {APPLICATION_STAGES.map((stage, index) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              applications={byStage[stage]}
              index={index}
              onOpen={openApplication}
              promotionToken={promotion?.stage === stage ? promotion.token : 0}
              onPromotionDone={() => setPromotion(null)}
              shakingApplicationId={shakingApplicationId}
            />
          ))}
        </div>
        <DeleteDropZone />
        <DragOverlay dropAnimation={null} style={{ zIndex: 100 }}>
          {draggedApplication ? (
            <KanbanCardPreview
              application={draggedApplication}
              stage={draggedApplication.status}
              isCrumbling={isOverDelete && prefersReducedMotion !== true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {emojiBursts.map((effect) => (
        <EmojiBurst
          key={effect.id}
          effect={effect}
          onComplete={(completedId) =>
            setEmojiBursts((bursts) => bursts.filter((burst) => burst.id !== completedId))
          }
        />
      ))}
      <PaperConfetti
        fire={confettiOrigin !== null}
        count={18}
        origin={confettiOrigin ?? undefined}
        onDone={() => setConfettiOrigin(null)}
      />
      <AnimatePresence>
        {selectedApplication && (
          <ApplicationDetails key={selectedApplication.id} application={selectedApplication} onClose={closeApplication} />
        )}
      </AnimatePresence>
    </div>
  );
}
