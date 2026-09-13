import { GhostFigure } from "./GhostFigure";
import { cn } from "../../lib/utils";

/**
 * Playful indicator for applications with no response past the stage's
 * staleness threshold (see @ghostboard/tracking evaluateApplicationStaleness).
 * Subtle by design per the product brief: a small drifting ghost, not a banner.
 */
export function GhostBadge({ days, className }: { days: number; className?: string }) {
  const label = `Possibly ghosted — no response in ${days} day${days === 1 ? "" : "s"}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
    >
      <GhostFigure size={18} className="animate-haunt drop-shadow-[0_1px_1px_rgba(23,23,19,0.25)]" />
    </span>
  );
}
