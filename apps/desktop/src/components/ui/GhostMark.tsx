import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { SPRING } from "../../lib/motion";

export function GhostMark({
  size = 20,
  className,
  layoutId,
  drift = false,
  hoverLift = false,
  wrapperClassName,
}: {
  size?: number;
  className?: string;
  /** Opt in to the shared boot flight. Only `"ghost-mark"` is sanctioned. */
  layoutId?: string;
  drift?: boolean;
  hoverLift?: boolean;
  wrapperClassName?: string;
}) {
  const glyph = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* Eyes are punched out so the ground shows through in every theme. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.4 21.2V10.4a7.6 7.6 0 0 1 15.2 0v10.8l-2.53-2.05-2.53 2.05-2.54-2.05-2.53 2.05-2.54-2.05-2.53 2.05ZM9.6 8.7a1.15 1.5 0 1 0 0 3 1.15 1.5 0 1 0 0-3ZM14.4 8.7a1.15 1.5 0 1 0 0 3 1.15 1.5 0 1 0 0-3Z"
        fill="currentColor"
      />
    </svg>
  );

  if (!layoutId && !drift && !hoverLift) return glyph;

  // The drift lives on an inner span so its CSS `transform` never competes with
  // framer's layout projection or hover transform on the outer element.
  return (
    <motion.span
      layoutId={layoutId}
      className={cn("inline-flex align-middle", wrapperClassName)}
      whileHover={hoverLift ? { y: -3, scale: 1.06 } : undefined}
      transition={layoutId ? SPRING.layout : SPRING.drift}
    >
      <span className={cn("inline-flex", drift && "drift-slower")}>{glyph}</span>
    </motion.span>
  );
}
