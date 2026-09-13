import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical, Undo2, X } from "lucide-react";
import { applyBulletDocument, benchBullets, parseBulletDocument, type BulletItem, type BulletList } from "@ghostboard/resume";
import { DISTANCE, SPRING, TRANSITION } from "../../lib/motion";
import { cn } from "../../lib/utils";

const BENCH = "bench";

interface DragSource {
  listId: string;
  index: number;
}

/**
 * Drag-and-drop editor for a resume's bullet points. Every drop rewrites the LaTeX
 * source, so the live PDF preview and the download button stay in step without the
 * reader ever opening the LaTeX.
 */
export function BulletBoard({
  latex,
  masterLatex,
  onChange,
}: {
  latex: string;
  masterLatex: string;
  onChange: (latex: string) => void;
}) {
  const lists = useMemo(() => parseBulletDocument(latex), [latex]);
  const bench = useMemo(() => benchBullets(masterLatex, latex), [masterLatex, latex]);
  const [drag, setDrag] = useState<DragSource | null>(null);
  const [over, setOver] = useState<{ listId: string; index: number } | null>(null);

  function bulletAt(source: DragSource): BulletItem | null {
    if (source.listId === BENCH) return bench[source.index] ?? null;
    return lists.find((list) => list.id === source.listId)?.bullets[source.index] ?? null;
  }

  function drop(listId: string, index: number) {
    const source = drag;
    setDrag(null);
    setOver(null);
    if (!source) return;
    if (source.listId === listId && (source.index === index || source.index === index - 1)) return;
    const bullet = bulletAt(source);
    if (!bullet) return;

    const next: BulletList[] = lists.map((list) => {
      if (list.id !== source.listId && list.id !== listId) return list;
      let bullets = list.bullets;
      if (list.id === source.listId) bullets = bullets.filter((_, position) => position !== source.index);
      if (list.id === listId) {
        // The removal above shifts anything after the dragged bullet up by one.
        const at = source.listId === listId && source.index < index ? index - 1 : index;
        bullets = [...bullets.slice(0, at), bullet, ...bullets.slice(at)];
      }
      return { ...list, bullets };
    });
    onChange(applyBulletDocument(latex, next));
  }

  function remove(listId: string, index: number) {
    onChange(applyBulletDocument(latex, lists.map((list) => list.id === listId
      ? { ...list, bullets: list.bullets.filter((_, position) => position !== index) }
      : list)));
  }

  if (lists.length === 0) {
    return (
      <p className="border border-dashed border-hairline p-4 text-[12px] leading-relaxed text-ink-2">
        The bullet points in this resume aren&apos;t in a layout this editor recognises. Switch on the LaTeX source below to edit it directly.
      </p>
    );
  }

  function dropTail(list: BulletList) {
    const active = over?.listId === list.id && over.index === list.bullets.length && drag !== null;
    return (
      <li
        onDragOver={(event) => {
          event.preventDefault();
          setOver({ listId: list.id, index: list.bullets.length });
        }}
        onDrop={(event) => {
          event.preventDefault();
          drop(list.id, list.bullets.length);
        }}
        className={cn(
          "mt-1.5 border border-dashed px-2.5 py-1.5 text-[11px] transition-colors",
          active ? "border-verdigris text-verdigris" : "border-transparent text-ink-3",
        )}
      >
        {active ? "Drop here" : drag ? "Drop at the end" : "\u00a0"}
      </li>
    );
  }

  function bulletRow(bullet: BulletItem, listId: string, index: number, tone: "kept" | "bench") {
    const dragging = drag?.listId === listId && drag.index === index;
    return (
      <motion.li
        key={bullet.id}
        layout
        transition={SPRING.layout}
        initial={{ opacity: 0, y: DISTANCE.riseSmall }}
        animate={{ opacity: dragging ? 0.4 : 1, y: 0 }}
        exit={{ opacity: 0, transition: TRANSITION.exit }}
        draggable
        onDragStart={() => setDrag({ listId, index })}
        onDragOver={(event) => {
          if (!drag || tone === "bench") return;
          event.preventDefault();
          setOver({ listId, index });
        }}
        onDrop={(event) => {
          if (tone === "bench") return;
          event.preventDefault();
          drop(listId, index);
        }}
        onDragEnd={() => {
          setDrag(null);
          setOver(null);
        }}
        className={cn(
          "group flex cursor-grab items-start gap-2 border px-2.5 py-2 text-[12px] leading-relaxed transition-[border-color,box-shadow] active:cursor-grabbing",
          tone === "bench"
            ? "border-dashed border-hairline bg-transparent text-ink-2"
            : "border-hairline bg-paper-raised text-ink",
          over?.listId === listId && over.index === index && drag && "border-t-2 border-t-verdigris",
        )}
      >
        <GripVertical size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
        <span className="flex-1">{bullet.text}</span>
        {tone === "kept" && (
          <button
            type="button"
            onClick={() => remove(listId, index)}
            aria-label={`Remove bullet: ${bullet.text.slice(0, 60)}`}
            className="shrink-0 text-ink-3 opacity-0 transition-opacity hover:text-oxblood focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X size={13} />
          </button>
        )}
      </motion.li>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-ink-2">
        Drag a bullet to reorder it, move it to another role, or send it to the bench. The preview and the PDF update as you go.
      </p>

      {lists.map((list) => (
        <section key={list.id}>
          <h5 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{list.label}</h5>
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {list.bullets.map((bullet, index) => bulletRow(bullet, list.id, index, "kept"))}
            </AnimatePresence>
            {dropTail(list)}
          </ul>
        </section>
      ))}

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setOver({ listId: BENCH, index: 0 });
        }}
        onDrop={(event) => {
          event.preventDefault();
          const source = drag;
          setDrag(null);
          setOver(null);
          if (source && source.listId !== BENCH) remove(source.listId, source.index);
        }}
        className={cn(
          "border border-dashed p-3 transition-colors",
          over?.listId === BENCH && drag ? "border-oxblood bg-paper-raised" : "border-hairline",
        )}
      >
        <h5 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">
          <Undo2 size={12} aria-hidden="true" />
          Bench · {bench.length} cut from your master
        </h5>
        {bench.length === 0 ? (
          <p className="text-[12px] text-ink-3">Nothing cut. Drop a bullet here to take it off this version.</p>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {bench.map((bullet, index) => bulletRow(bullet, BENCH, index, "bench"))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
