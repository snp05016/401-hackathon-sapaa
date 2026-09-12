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
import { useReducedMotion } from "framer-motion";
import type { Application, ApplicationStage } from "@ghostboard/shared";
import { APPLICATION_STAGES } from "@ghostboard/shared";
import { EmojiBurst, type EmojiBurstEffect } from "./EmojiBurst";
import { KanbanCardPreview } from "./KanbanCard";
import { KanbanColumn } from "./KanbanColumn";
import { moveApplication } from "./moveApplication";
import { ipc } from "../../lib/ipc";

const DELETE_DROP_ID = "kanban-delete-drop-zone";

function DeleteDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: DELETE_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      aria-label="Delete application drop zone"
      className={[
        "mt-3 flex h-14 w-full items-center justify-center rounded-sm border text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors duration-200",
        isOver
          ? "border-oxblood/70 bg-oxblood/20 text-oxblood/75"
          : "border-oxblood/30 bg-oxblood/10 text-oxblood/55",
      ].join(" ")}
    >
      Delete
    </div>
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
      <button type="button" className="absolute inset-0 cursor-default bg-ink/40" aria-label="Close application details" onClick={onClose} />
      <section className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden border border-hairline bg-paper-raised shadow-2xl">
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
      </section>
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
    setDraggedApplication(null);
    setIsOverDelete(false);
    const { active, over } = event;
    if (!over) return;

    const activeApp = applications.find((a) => a.id === active.id);
    if (!activeApp) return;

    if (over.id === DELETE_DROP_ID) {
      setBanner(null);
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
        if (!prefersReducedMotion) {
          const id = nextBurstId.current++;
          setEmojiBursts((bursts) => [...bursts, { id, stage: toStage, ...dropPoint }]);
        }
      })
      .catch(() => {
        setApplications(previous);
        setBanner("This move didn't save — the application was returned to its previous stage.");
      });
  }

  function openApplication(application: Application) {
    setSelectedApplication(application);
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
      {banner && (
        <div className="mb-5 flex items-center justify-between gap-6 border-l-2 border-oxblood bg-paper-raised py-2.5 pl-4 pr-3 text-[12px] text-ink">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="shrink-0 text-ink-2 underline underline-offset-4 transition-colors hover:text-oxblood">
            Dismiss
          </button>
        </div>
      )}
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
            <KanbanColumn key={stage} stage={stage} applications={byStage[stage]} index={index} onOpen={openApplication} />
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
      {selectedApplication && <ApplicationDetails application={selectedApplication} onClose={() => setSelectedApplication(null)} />}
    </div>
  );
}
