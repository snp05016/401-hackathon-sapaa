import { motion } from "framer-motion";
import { LayoutDashboard, KanbanSquare, ListTodo, Compass, FileText, User, LineChart, Mail, Network } from "lucide-react";
import { cn } from "../../lib/utils";
import { GhostMark } from "../ui/GhostMark";
import { ThemeSwitcher, SoundToggle } from "./ThemeSwitcher";
import { useApplications } from "../../lib/useApplications";
import { DISTANCE, SCALE, SPRING, STAGGER, TRANSITION } from "../../lib/motion";
import { playSound } from "../../lib/sound";

export type NavPage = "today" | "todo" | "applications" | "discover" | "resumes" | "profile" | "tracking" | "recruiterInbox" | "skillsGraph";

const NAV_ITEMS: Array<{ id: NavPage; label: string; icon: typeof LayoutDashboard }> = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "todo", label: "To Do", icon: ListTodo },
  { id: "applications", label: "Applications", icon: KanbanSquare },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "resumes", label: "Resumes", icon: FileText },
  { id: "profile", label: "Profile", icon: User },
  { id: "tracking", label: "Tracking", icon: LineChart },
  { id: "recruiterInbox", label: "Recruiter inbox", icon: Mail },
  { id: "skillsGraph", label: "Skills graph", icon: Network },
];

export function Sidebar({
  page,
  onNavigate,
  ghostMarkLayoutId,
}: {
  page: NavPage;
  onNavigate: (page: NavPage) => void;
  /** Set once the splash has handed the mark over, so the flight lands here. */
  ghostMarkLayoutId?: string;
}) {
  const { applications } = useApplications();
  const todoCount = (applications ?? []).filter(
    (application) => application.followUpOn || application.status === "found",
  ).length;

  return (
    <nav className="flex w-full shrink-0 flex-col border-b border-hairline bg-paper-rail sm:h-full sm:w-[228px] sm:border-b-0 sm:border-r">
      <div className="flex items-center justify-between gap-2.5 px-4 py-3 sm:justify-start sm:px-7 sm:pb-9 sm:pt-11">
        <div className="flex items-center gap-2">
          <GhostMark
            key={ghostMarkLayoutId ?? "static"}
            size={16}
            layoutId={ghostMarkLayoutId}
            drift
            hoverLift
            className="text-oxblood sm:size-[19px]"
          />
          <span className="font-display text-[16px] leading-none text-ink sm:text-[21px]">Ghostboard</span>
        </div>
        <div className="flex items-center gap-2 sm:hidden">
          <SoundToggle />
          <ThemeSwitcher />
        </div>
      </div>

      <motion.div
        className="flex overflow-x-auto border-t border-hairline sm:flex-col sm:overflow-visible sm:border-t-0"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: STAGGER.list, delayChildren: STAGGER.lead } },
        }}
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <motion.button
              key={id}
              onClick={() => {
                if (!active) playSound("navigate");
                onNavigate(id);
              }}
              aria-current={active ? "page" : undefined}
              variants={{
                hidden: { opacity: 0, y: DISTANCE.riseSmall },
                visible: { opacity: 1, y: 0, transition: TRANSITION.base },
                navHover: { x: 2, transition: SPRING.hover },
              }}
              whileHover="navHover"
              whileTap={{ scale: SCALE.press, transition: SPRING.press }}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-left text-[11px] transition-colors duration-200",
                "sm:gap-3 sm:pl-7 sm:pr-5 sm:text-[13px]",
                active ? "text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  aria-hidden="true"
                  layoutId="nav-indicator"
                  transition={SPRING.layout}
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-[2px] bg-oxblood",
                    "sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(50%-9px)] sm:h-[18px] sm:w-[2px]",
                  )}
                />
              )}
              <span className="relative">
                <motion.span
                  className="block"
                  variants={{ navHover: { scale: 1.08, transition: SPRING.hover } }}
                >
                  <Icon size={15} strokeWidth={1.6} className={active ? "text-oxblood" : "text-ink-3"} />
                </motion.span>
                {id === "todo" && todoCount > 0 && (
                  <motion.span
                    aria-label={`${todoCount} follow-up${todoCount === 1 ? "" : "s"} pending`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={SPRING.overshoot}
                    className="absolute -right-[7px] -top-[5px] h-[7px] w-[7px] rounded-full bg-oxblood"
                  />
                )}
              </span>
              <span className={active ? "font-medium" : ""}>{label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="mt-auto hidden items-center justify-between gap-3 border-t border-hairline px-7 py-5 sm:flex">
        <ThemeSwitcher />
        <SoundToggle />
      </div>
    </nav>
  );
}
