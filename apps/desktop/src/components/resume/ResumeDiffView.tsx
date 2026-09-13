import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Columns2, Rows2, ArrowRight } from "lucide-react";
import {
  computeSideBySideDiff,
  parseChangesSummaryFallback,
  type SideBySideDiffItem,
} from "@ghostboard/resume";
import { DISTANCE, TRANSITION } from "../../lib/motion";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

interface DiffToken {
  text: string;
  changed: boolean;
}

function tokenizeWords(text: string): string[] {
  return text.split(/(\s+)/);
}

function diffWordTokens(beforeText: string, afterText: string): { beforeTokens: DiffToken[]; afterTokens: DiffToken[] } {
  const bTokens = tokenizeWords(beforeText);
  const aTokens = tokenizeWords(afterText);
  const columns = aTokens.length + 1;
  const cells = (bTokens.length + 1) * columns;

  if (cells > 250_000) {
    return {
      beforeTokens: [{ text: beforeText, changed: false }],
      afterTokens: [{ text: afterText, changed: false }],
    };
  }

  const lengths = new Uint16Array(cells);
  for (let b = 1; b <= bTokens.length; b += 1) {
    for (let a = 1; a <= aTokens.length; a += 1) {
      const cell = b * columns + a;
      lengths[cell] = bTokens[b - 1] === aTokens[a - 1]
        ? lengths[(b - 1) * columns + a - 1] + 1
        : Math.max(lengths[(b - 1) * columns + a], lengths[cell - 1]);
    }
  }

  let b = bTokens.length;
  let a = aTokens.length;
  const bRes: DiffToken[] = [];
  const aRes: DiffToken[] = [];

  while (b > 0 || a > 0) {
    if (b > 0 && a > 0 && bTokens[b - 1] === aTokens[a - 1]) {
      bRes.push({ text: bTokens[b - 1], changed: false });
      aRes.push({ text: aTokens[a - 1], changed: false });
      b -= 1;
      a -= 1;
    } else {
      const removeScore = b > 0 ? lengths[(b - 1) * columns + a] : -1;
      const addScore = a > 0 ? lengths[b * columns + a - 1] : -1;
      if (a > 0 && addScore >= removeScore) {
        aRes.push({ text: aTokens[a - 1], changed: true });
        a -= 1;
      } else if (b > 0) {
        bRes.push({ text: bTokens[b - 1], changed: true });
        b -= 1;
      }
    }
  }

  return {
    beforeTokens: bRes.reverse(),
    afterTokens: aRes.reverse(),
  };
}

interface ResumeDiffViewProps {
  masterLatex: string;
  tailoredLatex: string;
  changesSummary?: string[];
}

export function ResumeDiffView({
  masterLatex,
  tailoredLatex,
  changesSummary = [],
}: ResumeDiffViewProps) {
  const [layout, setLayout] = useState<"side-by-side" | "stacked">("side-by-side");

  const diffItems: SideBySideDiffItem[] = useMemo(() => {
    if (masterLatex && tailoredLatex) {
      const direct = computeSideBySideDiff(masterLatex, tailoredLatex);
      if (direct.length > 0) return direct;
    }
    if (changesSummary && changesSummary.length > 0) {
      return parseChangesSummaryFallback(changesSummary);
    }
    return [];
  }, [masterLatex, tailoredLatex, changesSummary]);

  if (diffItems.length === 0) {
    return (
      <div className="mt-5 rounded-md border border-hairline bg-paper-raised/50 p-4">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">AI changes</h4>
        <p className="mt-2 text-[12px] text-ink-2">
          The AI did not make any line-level changes. You can still edit the bullets below.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-2.5">
        <div className="flex items-center gap-2.5">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">AI changes</h4>
          <Badge variant="mist" className="text-[11px]">
            {diffItems.length} {diffItems.length === 1 ? "change" : "changes"}
          </Badge>
        </div>
        <div className="flex items-center gap-1 rounded-sm border border-hairline bg-paper p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setLayout("side-by-side")}
            className={cn(
              "flex items-center gap-1 rounded-sm px-2 py-1 transition-colors",
              layout === "side-by-side"
                ? "bg-paper-raised text-ink shadow-sm font-medium"
                : "text-ink-2 hover:text-ink",
            )}
            title="Side by side diff view"
          >
            <Columns2 size={12} aria-hidden="true" />
            <span>Side by side</span>
          </button>
          <button
            type="button"
            onClick={() => setLayout("stacked")}
            className={cn(
              "flex items-center gap-1 rounded-sm px-2 py-1 transition-colors",
              layout === "stacked"
                ? "bg-paper-raised text-ink shadow-sm font-medium"
                : "text-ink-2 hover:text-ink",
            )}
            title="Stacked diff view"
          >
            <Rows2 size={12} aria-hidden="true" />
            <span>Stacked</span>
          </button>
        </div>
      </div>

      {layout === "side-by-side" ? (
        <div className="mt-3 overflow-hidden rounded-md border border-hairline bg-paper-raised/40">
          <div className="grid grid-cols-2 border-b border-hairline bg-paper-rail/70 text-[11px] font-medium tracking-wide">
            <div className="flex items-center gap-2 border-r border-hairline px-3.5 py-2 text-oxblood">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-oxblood" />
              <span>Before (Master)</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 text-verdigris">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-verdigris" />
              <span>After (Casper)</span>
            </div>
          </div>

          <div className="max-h-[380px] divide-y divide-hairline/60 overflow-y-auto pr-0.5">
            {diffItems.map((item, index) => (
              <SideBySideRow key={item.id || index} item={item} index={index} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 max-h-[380px] space-y-2.5 overflow-y-auto pr-0.5">
          {diffItems.map((item, index) => (
            <StackedCard key={item.id || index} item={item} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function SideBySideRow({ item, index }: { item: SideBySideDiffItem; index: number }) {
  const wordDiff = useMemo(() => {
    if (item.type === "modified" && item.before?.text && item.after?.text) {
      return diffWordTokens(item.before.text, item.after.text);
    }
    return null;
  }, [item]);

  return (
    <motion.div
      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION.base, delay: Math.min(index, 8) * 0.04 }}
      className="p-3 text-[12px] leading-relaxed"
    >
      {item.section && (
        <div className="mb-1.5 flex items-center gap-2">
          <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-ink-3 border border-hairline/50">
            {item.section}
          </span>
          {item.before?.line && (
            <span className="text-[10px] text-ink-3">Line {item.before.line}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 items-stretch">
        {/* Before Column */}
        <div
          className={cn(
            "rounded-sm border p-2.5 transition-colors",
            item.type === "added"
              ? "border-dashed border-hairline/60 bg-paper/30 flex items-center justify-center text-center"
              : "border-oxblood/25 bg-oxblood/[0.02]",
          )}
        >
          {item.type === "added" ? (
            <span className="text-[11px] italic text-ink-3">(No previous line)</span>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-oxblood/80">
                <span>–</span>
                <span>{item.type === "removed" ? "Removed" : "Original"}</span>
              </div>
              <p className="text-ink">
                {wordDiff ? (
                  wordDiff.beforeTokens.map((token, i) =>
                    token.changed ? (
                      <mark
                        key={i}
                        className="rounded-sm bg-oxblood/15 px-0.5 text-oxblood font-medium not-italic"
                      >
                        {token.text}
                      </mark>
                    ) : (
                      <span key={i}>{token.text}</span>
                    ),
                  )
                ) : (
                  item.before?.text
                )}
              </p>
            </div>
          )}
        </div>

        {/* After Column */}
        <div
          className={cn(
            "rounded-sm border p-2.5 transition-colors",
            item.type === "removed"
              ? "border-dashed border-hairline/60 bg-paper/30 flex items-center justify-center text-center"
              : "border-verdigris/30 bg-verdigris/[0.03]",
          )}
        >
          {item.type === "removed" ? (
            <span className="text-[11px] italic text-ink-3">(Line removed)</span>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-verdigris">
                <span>+</span>
                <span>{item.type === "added" ? "Added" : "Tailored"}</span>
              </div>
              <p className="text-ink">
                {wordDiff ? (
                  wordDiff.afterTokens.map((token, i) =>
                    token.changed ? (
                      <mark
                        key={i}
                        className="rounded-sm bg-verdigris/20 px-0.5 text-verdigris font-medium not-italic"
                      >
                        {token.text}
                      </mark>
                    ) : (
                      <span key={i}>{token.text}</span>
                    ),
                  )
                ) : (
                  item.after?.text
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StackedCard({ item, index }: { item: SideBySideDiffItem; index: number }) {
  const wordDiff = useMemo(() => {
    if (item.type === "modified" && item.before?.text && item.after?.text) {
      return diffWordTokens(item.before.text, item.after.text);
    }
    return null;
  }, [item]);

  return (
    <motion.div
      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION.base, delay: Math.min(index, 8) * 0.04 }}
      className="rounded-md border border-hairline bg-paper-raised/50 p-3 text-[12px] leading-relaxed"
    >
      {item.section && (
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-ink-3 border border-hairline/50">
            {item.section}
          </span>
          {item.before?.line && (
            <span className="text-[10px] text-ink-3">Line {item.before.line}</span>
          )}
        </div>
      )}

      {item.before && (
        <div className="rounded-sm border border-oxblood/20 bg-oxblood/[0.02] p-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-oxblood">Before: </span>
          <span className="text-ink">
            {wordDiff ? (
              wordDiff.beforeTokens.map((token, i) =>
                token.changed ? (
                  <mark key={i} className="rounded-sm bg-oxblood/15 px-0.5 text-oxblood font-medium not-italic">
                    {token.text}
                  </mark>
                ) : (
                  <span key={i}>{token.text}</span>
                ),
              )
            ) : (
              item.before.text
            )}
          </span>
        </div>
      )}

      {item.before && item.after && (
        <div className="my-1 flex justify-center text-ink-3">
          <ArrowRight size={12} className="rotate-90 text-ink-3" aria-hidden="true" />
        </div>
      )}

      {item.after && (
        <div className="rounded-sm border border-verdigris/25 bg-verdigris/[0.03] p-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-verdigris">After: </span>
          <span className="text-ink">
            {wordDiff ? (
              wordDiff.afterTokens.map((token, i) =>
                token.changed ? (
                  <mark key={i} className="rounded-sm bg-verdigris/20 px-0.5 text-verdigris font-medium not-italic">
                    {token.text}
                  </mark>
                ) : (
                  <span key={i}>{token.text}</span>
                ),
              )
            ) : (
              item.after.text
            )}
          </span>
        </div>
      )}
    </motion.div>
  );
}
