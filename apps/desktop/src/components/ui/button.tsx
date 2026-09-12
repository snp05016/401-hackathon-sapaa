import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variant === "default" && "bg-slate-900 text-white hover:bg-slate-700",
        variant === "outline" && "border border-slate-300 bg-white hover:bg-slate-50",
        variant === "ghost" && "hover:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}
