
import { LayoutDashboard, KanbanSquare, ListTodo, Compass, FileText, User, LineChart, Mail } from "lucide-react";
import { cn } from "../../lib/utils";
import { GhostMark } from "../ui/GhostMark";
import { ThemeSwitcher } from "./ThemeSwitcher";

export type NavPage = "today" | "todo" | "applications" | "discover" | "resumes" | "profile" | "tracking" | "recruiterInbox";

const NAV_ITEMS: Array<{ id: NavPage; label: string; icon: typeof LayoutDashboard }> = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "todo", label: "To Do", icon: ListTodo },
  { id: "applications", label: "Applications", icon: KanbanSquare },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "resumes", label: "Resumes", icon: FileText },
  { id: "profile", label: "Profile", icon: User },
  { id: "tracking", label: "Tracking", icon: LineChart },
  { id: "recruiterInbox", label: "Recruiter inbox", icon: Mail },
];

export function Sidebar({ page, onNavigate }: { page: NavPage; onNavigate: (page: NavPage) => void }) {
  return (
    <nav className="flex w-full shrink-0 flex-col border-b border-hairline bg-paper-rail sm:h-full sm:w-[228px] sm:border-b-0 sm:border-r">
      <div className="flex items-center justify-between gap-2.5 px-4 py-3 sm:justify-start sm:px-7 sm:pb-9 sm:pt-11">
        <div className="flex items-center gap-2">
          <GhostMark size={16} className="text-oxblood sm:size-[19px]" />
          <span className="font-display text-[16px] leading-none text-ink sm:text-[21px]">Ghostboard</span>
        </div>
        <div className="sm:hidden">
          <ThemeSwitcher />
        </div>
      </div>

      <div className="flex overflow-x-auto border-t border-hairline sm:flex-col sm:overflow-visible sm:border-t-0">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-left text-[11px] transition-colors duration-200",
                "sm:gap-3 sm:pl-7 sm:pr-5 sm:text-[13px]",
                active ? "text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "absolute inset-x-2 bottom-0 h-[2px] origin-center scale-x-0 bg-oxblood transition-transform duration-300",
                  "sm:inset-x-auto sm:inset-y-0 sm:left-0 sm:top-1/2 sm:h-[18px] sm:w-[2px] sm:-translate-y-1/2 sm:scale-x-100",
                  active ? "scale-x-100 sm:scale-y-100" : "sm:scale-y-0",
                )}
              />
              <Icon size={15} strokeWidth={1.6} className={active ? "text-oxblood" : "text-ink-3"} />
              <span className={cn("hidden sm:inline", active ? "font-medium" : "")}>{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto hidden border-t border-hairline px-7 py-5 sm:block">
        <ThemeSwitcher />
      </div>
    </nav>
  );
}
