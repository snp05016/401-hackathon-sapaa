import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { cn } from "../../lib/utils";
import { ipc } from "../../lib/ipc";

type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;

export interface PredictiveInputProps extends NativeInputProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Text sent before the current field value to guide this field's completion. */
  microPrompt: string;
  variant?: "default" | "rule";
  displayClassName?: string;
}

interface QueuedPrediction {
  value: string;
  requestId: number;
}

function normalizeInputSpaces(input: string): string {
  return input.replace(/\s+/g, " ").replace(/^\s+/, "");
}

export function PredictiveInput({
  value,
  onValueChange,
  microPrompt,
  variant = "default",
  displayClassName,
  className,
  onKeyDown,
  ...props
}: PredictiveInputProps) {
  const statusId = useId();
  const [prediction, setPrediction] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const requestId = useRef(0);
  const generationActive = useRef(false);
  const queuedPrediction = useRef<QueuedPrediction | null>(null);

  function acceptPrediction() {
    if (!prediction) return;
    const nextValue = normalizeInputSpaces(`${value}${prediction}`).trimEnd();
    onValueChange(nextValue);
    setPrediction(null);
  }

  async function generatePrediction(nextValue: string, nextRequestId: number): Promise<void> {
    if (generationActive.current) {
      queuedPrediction.current = { value: nextValue, requestId: nextRequestId };
      return;
    }

    generationActive.current = true;
    setPredicting(true);
    try {
      const result = await ipc().predictJobTitle(`${microPrompt}${nextValue}`);
      if (nextRequestId === requestId.current) setPrediction(result.completion.replace(/\s+/g, " ").trimEnd());
    } catch (error) {
      if (nextRequestId === requestId.current) {
        setPredictionError(error instanceof Error ? error.message : "Could not generate a title prediction.");
      }
    } finally {
      generationActive.current = false;
      const queued = queuedPrediction.current;
      queuedPrediction.current = null;
      if (queued && queued.requestId === requestId.current) {
        void generatePrediction(queued.value, queued.requestId);
      } else {
        setPredicting(false);
      }
    }
  }

  useEffect(() => {
    const nextRequestId = ++requestId.current;
    setPrediction(null);
    setPredictionError(null);

    if (!value.trim()) {
      queuedPrediction.current = null;
      return;
    }

    const debounce = window.setTimeout(() => {
      void generatePrediction(value, nextRequestId);
    }, 100);
    return () => window.clearTimeout(debounce);
  }, [value, microPrompt]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Tab" || !prediction) return;
    event.preventDefault();
    acceptPrediction();
  }

  return (
    <div>
      <div className="relative">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-30 overflow-hidden whitespace-pre text-ink",
            variant === "default" && "px-3 py-2 text-sm",
            variant === "rule" && "border-b border-transparent pb-2 pt-1 text-[14px]",
            displayClassName,
          )}
        >
          <span className="text-ink">{value}</span>
          {prediction && <span className="text-ink-3">{prediction}</span>}
        </div>
        <input
          {...props}
          value={value}
          onChange={(event) => onValueChange(normalizeInputSpaces(event.target.value))}
          onKeyDown={handleKeyDown}
          aria-busy={predicting || undefined}
          aria-describedby={prediction || predictionError ? statusId : props["aria-describedby"]}
          className={cn(
            "relative z-20 text-transparent caret-[rgb(var(--ink))] placeholder:text-ink-3",
            variant === "default" && "w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood",
            variant === "rule" && "focus-rule w-full border-0 border-b border-hairline bg-transparent px-0 pb-2 pt-1 text-[14px] transition-colors focus:border-oxblood focus:outline-none focus:ring-0",
            className,
          )}
        />
      </div>
      <div id={statusId} aria-live="polite" className="sr-only">
        {prediction ? `Prediction available: ${prediction}. Press Tab to accept.` : predictionError}
      </div>
      {predictionError && <p role="alert" className="mt-2 text-[11px] text-oxblood">{predictionError}</p>}
    </div>
  );
}
