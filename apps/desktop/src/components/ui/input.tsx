import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "rule";
}

export function Input({ className, variant = "default", ...props }: InputProps) {
  return (
    <input
      className={cn(
        variant === "default" &&
          "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400",
        variant === "rule" &&
          "w-full border-0 border-b border-hairline bg-transparent px-0 pb-2 pt-1 text-[14px] text-ink transition-colors placeholder:text-ink-3 focus:border-oxblood focus:outline-none focus:ring-0",
        className,
      )}
      {...props}
    />
  );
}
