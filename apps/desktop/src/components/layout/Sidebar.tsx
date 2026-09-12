
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
    <nav className="flex h-full w-[228px] shrink-0 flex-col border-r border-hairline bg-paper-rail">
      <div className="flex items-center gap-2.5 px-7 pb-9 pt-11">
        <GhostMark size={19} className="text-oxblood" />
        <span className="font-display text-[21px] leading-none text-ink">Ghostboard</span>
      </div>

      <div className="flex flex-col">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={cn(
                "group relative flex items-center gap-3 py-2.5 pl-7 pr-5 text-left text-[13px] transition-colors duration-200",
                active ? "text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 bg-oxblood transition-transform duration-300",
                  active ? "scale-y-100" : "scale-y-0",
                )}
              />
              <Icon size={15} strokeWidth={1.6} className={active ? "text-oxblood" : "text-ink-3"} />
              <span className={active ? "font-medium" : ""}>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto border-t border-hairline px-7 py-5">
        <ThemeSwitcher />
      </div>
    </nav>
  );
}
