import type { ReactNode } from "react";
import { Sidebar, type NavPage } from "./Sidebar";

export function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: NavPage;
  onNavigate: (page: NavPage) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar page={page} onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
