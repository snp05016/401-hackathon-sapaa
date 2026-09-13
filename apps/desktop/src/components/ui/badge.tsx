import type { HTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { SPRING } from "../../lib/motion";

type NativeSpanProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd" | "onTransitionEnd"
>;

export interface BadgeProps extends NativeSpanProps {
  variant?: "default" | "outline" | "warning" | "danger" | "ink" | "oxblood" | "verdigris" | "brass" | "mist";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const editorial = ["ink", "oxblood", "verdigris", "brass", "mist"].includes(variant);
  // Re-pop when the rendered value itself changes, not on every parent render.
  const popKey = typeof children === "string" || typeof children === "number" ? String(children) : undefined;

  return (
    <motion.span
      key={popKey}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.overshoot}
      className={cn(
        editorial
          ? "inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px]"
          : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-slate-100 text-slate-700",
        variant === "outline" && "border border-slate-300 text-slate-600",
        variant === "warning" && "bg-amber-100 text-amber-800",
        variant === "danger" && "bg-red-100 text-red-800",
        variant === "ink" && "border-hairline text-ink",
        variant === "oxblood" && "border-oxblood/35 text-oxblood",
        variant === "verdigris" && "border-verdigris/35 text-verdigris",
        variant === "brass" && "border-brass/40 text-brass",
        variant === "mist" && "border-hairline text-ink-3",
        className,
      )}
      {...props}
    >
      {children}
    </motion.span>
  );
}
