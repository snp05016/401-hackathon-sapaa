import type { InputHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { DURATION, EASE } from "../../lib/motion";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd" | "onTransitionEnd"
>;

export interface InputProps extends NativeInputProps {
  variant?: "default" | "rule";
  /** Shakes the field once and keeps the native `aria-invalid` semantics. */
  invalid?: boolean;
}

export function Input({ className, variant = "default", invalid = false, ...props }: InputProps) {
  return (
    <motion.input
      aria-invalid={invalid || undefined}
      animate={invalid ? { x: [0, -4, 4, -3, 0] } : { x: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.out }}
      className={cn(
        variant === "default" &&
          "w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-oxblood focus:outline-none focus:ring-1 focus:ring-oxblood",
        variant === "rule" &&
          "focus-rule w-full border-0 border-b border-hairline bg-transparent px-0 pb-2 pt-1 text-[14px] text-ink transition-colors placeholder:text-ink-3 focus:border-oxblood focus:outline-none focus:ring-0",
        className,
      )}
      {...props}
    />
  );
}
