import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "ink" | "rule" | "quiet";
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
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
