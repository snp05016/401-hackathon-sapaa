import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { SCALE, SPRING } from "../../lib/motion";
import { playSound } from "../../lib/sound";

// framer's motion props collide with these DOM handler names; nothing in the
// app passes them to a Button.
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd" | "onTransitionEnd"
>;

export interface ButtonProps extends NativeButtonProps {
  variant?: "default" | "outline" | "ghost" | "ink" | "rule" | "quiet";
  /** Opt out of the press click for buttons that already own an outcome sound. */
  silent?: boolean;
}

export function Button({ className, variant = "default", silent = false, onClick, disabled, ...props }: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!silent) playSound("tap");
    onClick?.(event);
  };

  return (
    <motion.button
      disabled={disabled}
      onClick={handleClick}
      whileHover={disabled ? undefined : { scale: SCALE.hover }}
      whileTap={disabled ? undefined : { scale: SCALE.press, transition: SPRING.press }}
      transition={SPRING.hover}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variant === "default" && "bg-slate-900 text-white hover:bg-slate-700",
        variant === "outline" && "border border-slate-300 bg-white hover:bg-slate-50",
        variant === "ghost" && "hover:bg-slate-100",
        variant === "ink" && "rounded-sm bg-ink px-6 py-3 text-[13px] font-normal text-paper-raised hover:bg-oxblood",
        variant === "rule" &&
          "rounded-sm border border-hairline bg-transparent px-4 py-2 text-[12px] font-normal text-ink hover:border-ink hover:bg-paper-raised",
        variant === "quiet" &&
          "rounded-none px-0 py-0 text-[12px] font-normal text-ink underline underline-offset-4 hover:text-oxblood",
        className,
      )}
      {...props}
    />
  );
}
