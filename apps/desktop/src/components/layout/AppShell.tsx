import type { ReactNode } from "react";
import { Sidebar, type NavPage } from "./Sidebar";
import { cn } from "../../lib/utils";

export function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: NavPage;
  onNavigate: (page: NavPage) => void;
  children: ReactNode;
}) {
  const isResumes = page === "resumes";

  return (
    <div className={cn("flex h-screen w-screen overflow-hidden", isResumes ? "bg-slate-100 text-slate-900" : "bg-paper text-ink")}>
      <Sidebar page={page} onNavigate={onNavigate} />
      <main
        className={cn(
          "flex-1 overflow-y-auto",
          isResumes ? "bg-slate-100 p-6" : "editorial font-sans px-12 py-11",
        )}
      >
        {children}
      </main>
    </div>
  );
}
