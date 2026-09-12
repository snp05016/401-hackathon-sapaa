import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "warning" | "danger" | "ink" | "oxblood" | "verdigris" | "brass" | "mist";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const editorial = ["ink", "oxblood", "verdigris", "brass", "mist"].includes(variant);

  return (
    <span
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
    />
  );
}
