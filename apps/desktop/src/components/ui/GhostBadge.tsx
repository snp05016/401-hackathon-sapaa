import ghostImage from "../../assets/ghost.png";
import { cn } from "../../lib/utils";

/**
 * Playful indicator for applications with no response past the stage's
 * staleness threshold (see @ghostboard/tracking evaluateApplicationStaleness).
 * Subtle by design per the product brief: a small drifting ghost, not a banner.
 */
export function GhostBadge({
  days,
  className,
  imageClassName,
}: {
  days: number;
  className?: string;
  imageClassName?: string;
}) {
  const label = `Possibly ghosted — no response in ${days} day${days === 1 ? "" : "s"}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("relative inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center", className)}
    >
      <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-oxblood/25 blur-[7px]" />
      <img
        src={ghostImage}
        alt=""
        width={22}
        height={22}
        className={cn("animate-haunt drop-shadow-[0_2px_3px_rgba(23,23,19,0.35)]", imageClassName)}
      />
    </span>
  );
}
