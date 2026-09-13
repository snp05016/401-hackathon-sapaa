import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, GripVertical, Pencil, Plus, Undo2, X } from "lucide-react";
import { applyBulletDocument, benchBullets, encodeBulletText, parseBulletDocument, type BulletItem, type BulletList } from "@ghostboard/resume";
import { DISTANCE, SPRING, TRANSITION } from "../../lib/motion";
import { cn } from "../../lib/utils";

const BENCH = "bench";

interface DragSource {
  listId: string;
  index: number;
}

interface BulletDraft {
  listId: string;
  index: number;
  mode: "edit" | "add";
  text: string;
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
  const [draft, setDraft] = useState<BulletDraft | null>(null);

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
    setDraft(null);

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
    setDraft(null);
    onChange(applyBulletDocument(latex, lists.map((list) => list.id === listId
      ? { ...list, bullets: list.bullets.filter((_, position) => position !== index) }
      : list)));
  }

  function saveDraft() {
    if (!draft) return;
    const text = draft.text.replace(/\s+/g, " ").trim();
    if (!text) return;
    const next = lists.map((list) => {
      if (list.id !== draft.listId) return list;
      const bullet: BulletItem = {
        id: draft.mode === "add" ? `${list.id}-new-${Date.now()}` : list.bullets[draft.index].id,
        latex: encodeBulletText(text),
        text,
      };
      const bullets = draft.mode === "add"
        ? [...list.bullets, bullet]
        : list.bullets.map((current, index) => index === draft.index ? bullet : current);
      return { ...list, bullets };
    });
    setDraft(null);
    onChange(applyBulletDocument(latex, next));
  }

  function editorRow(activeDraft: BulletDraft) {
    return (
      <motion.li
        key={`${activeDraft.listId}-${activeDraft.mode}-${activeDraft.index}`}
        layout
        initial={{ opacity: 0, y: DISTANCE.riseSmall }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-verdigris bg-paper-raised p-2.5 shadow-sm"
      >
        <label className="sr-only" htmlFor={`bullet-${activeDraft.listId}-${activeDraft.index}`}>
          {activeDraft.mode === "add" ? "New resume bullet" : "Edit resume bullet"}
        </label>
        <textarea
          id={`bullet-${activeDraft.listId}-${activeDraft.index}`}
          autoFocus
          rows={3}
          value={activeDraft.text}
          onChange={(event) => setDraft({ ...activeDraft, text: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDraft(null);
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveDraft();
          }}
          className="w-full resize-y rounded-sm border border-hairline bg-paper px-2.5 py-2 text-[12px] leading-relaxed text-ink outline-none focus:border-verdigris focus:ring-1 focus:ring-verdigris"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] text-ink-3">⌘/Ctrl + Enter to save · Esc to cancel</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setDraft(null)} className="text-[11px] text-ink-2 hover:text-ink">
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={!activeDraft.text.trim()}
              className="inline-flex items-center gap-1 rounded-sm bg-ink px-2.5 py-1.5 text-[11px] text-paper-raised hover:bg-oxblood disabled:pointer-events-none disabled:opacity-40"
            >
              <Check size={11} aria-hidden="true" />
              {activeDraft.mode === "add" ? "Add bullet" : "Save edit"}
            </button>
          </span>
        </div>
      </motion.li>
    );
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
        <button
          type="button"
          onClick={() => tone === "kept" && setDraft({ listId, index, mode: "edit", text: bullet.text })}
          className={cn("flex-1 text-left", tone === "kept" && "cursor-text")}
          aria-label={tone === "kept" ? `Edit bullet: ${bullet.text.slice(0, 60)}` : undefined}
        >
          {bullet.text}
        </button>
        {tone === "kept" && (
          <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setDraft({ listId, index, mode: "edit", text: bullet.text })}
              aria-label={`Edit bullet: ${bullet.text.slice(0, 60)}`}
              className="text-ink-3 hover:text-verdigris"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => remove(listId, index)}
              aria-label={`Remove bullet: ${bullet.text.slice(0, 60)}`}
              className="text-ink-3 hover:text-oxblood"
            >
              <X size={13} />
            </button>
          </span>
        )}
      </motion.li>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-ink-2">
        Click a bullet to rewrite it. You can also add, reorder, move, or remove bullets; the PDF preview updates after every change.
      </p>

      {lists.map((list) => (
        <section key={list.id}>
          <h5 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{list.label}</h5>
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {list.bullets.map((bullet, index) => (
                draft?.listId === list.id && draft.index === index && draft.mode === "edit"
                  ? editorRow(draft)
                  : bulletRow(bullet, list.id, index, "kept")
              ))}
              {draft?.listId === list.id && draft.mode === "add" && editorRow(draft)}
            </AnimatePresence>
            {dropTail(list)}
          </ul>
          <button
            type="button"
            onClick={() => setDraft({ listId: list.id, index: list.bullets.length, mode: "add", text: "" })}
            disabled={draft !== null}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-2 hover:text-verdigris disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus size={11} aria-hidden="true" />
            Add a bullet
          </button>
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
