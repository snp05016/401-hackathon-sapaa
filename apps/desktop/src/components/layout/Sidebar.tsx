import { LayoutDashboard, KanbanSquare, Compass, FileText, User, LineChart } from "lucide-react";
import { cn } from "../../lib/utils";

export type NavPage = "today" | "applications" | "discover" | "resumes" | "profile" | "tracking";

const NAV_ITEMS: Array<{ id: NavPage; label: string; icon: typeof LayoutDashboard }> = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "applications", label: "Applications", icon: KanbanSquare },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "resumes", label: "Resumes", icon: FileText },
  { id: "profile", label: "Profile", icon: User },
  { id: "tracking", label: "Tracking", icon: LineChart },
];

export function Sidebar({ page, onNavigate }: { page: NavPage; onNavigate: (page: NavPage) => void }) {
  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r border-slate-200 bg-slate-50 p-3">
      <div className="mb-4 px-2 text-lg font-semibold text-slate-900">👻 Ghostboard</div>
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
            page === id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200",
          )}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </nav>
  );
}
