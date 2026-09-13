import type { HTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { DISTANCE, SCALE, SPRING } from "../../lib/motion";

type NativeDivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd" | "onTransitionEnd"
>;

export interface CardProps extends NativeDivProps {
  /** Swaps the CSS raise for a spring lift; use for cards that respond to click. */
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  const base = "rounded-lg border border-slate-200 bg-white shadow-sm";

  if (!interactive) {
    // CSS raise keeps static cards free of a motion node.
    return <div className={cn(base, "hover-raise", className)} {...props} />;
  }

  return (
    <motion.div
      whileHover={{ y: DISTANCE.lift, boxShadow: "5px 5px 0 0 var(--card-shadow)", transition: SPRING.hover }}
      whileTap={{ scale: SCALE.press, transition: SPRING.press }}
      className={cn(base, className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-slate-900", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-2", className)} {...props} />;
}
