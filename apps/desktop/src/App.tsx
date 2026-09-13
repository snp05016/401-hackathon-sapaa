import { useEffect, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { ApplicationsProvider } from "./lib/useApplications";
import { AppShell } from "./components/layout/AppShell";
import { SplashScreen } from "./components/layout/SplashScreen";
import { GhostScatter } from "./components/layout/GhostScatter";
import { LaunchAlerts } from "./components/layout/LaunchAlerts";
import type { NavPage } from "./components/layout/Sidebar";
import { Today } from "./pages/Today";
import { Todo } from "./pages/Todo";
import { Applications } from "./pages/Applications";
import { Discover } from "./pages/Discover";
import { Resumes } from "./pages/Resumes";
import { Profile } from "./pages/Profile";
import { Tracking } from "./pages/Tracking";
import { RecruiterInbox } from "./pages/RecruiterInbox";
import { SkillsGraph } from "./pages/SkillsGraph";

const PAGES: Record<NavPage, () => JSX.Element> = {
  today: Today,
  todo: Todo,
  applications: Applications,
  discover: Discover,
  resumes: Resumes,
  profile: Profile,
  tracking: Tracking,
  recruiterInbox: RecruiterInbox,
  skillsGraph: SkillsGraph,
};

// Title card holds, then lifts away; pages mount as it lifts so their own
// stagger plays through the reveal rather than after it.
type BootPhase = "intro" | "revealing" | "done";

function initialPhase(): BootPhase {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "intro";
}

export function App() {
  const [page, setPage] = useState<NavPage>("today");
  const [phase, setPhase] = useState<BootPhase>(initialPhase);
  const Page = PAGES[page];

  useEffect(() => {
    if (phase !== "intro") return;
    const lift = setTimeout(() => setPhase("revealing"), 1550);
    return () => clearTimeout(lift);
  }, [phase]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const finish = setTimeout(() => setPhase("done"), 850);
    return () => clearTimeout(finish);
  }, [phase]);

  return (
    <ApplicationsProvider>
      <LayoutGroup>
        <LaunchAlerts />
        <AppShell
          page={page}
          onNavigate={setPage}
          ghostMarkLayoutId={phase === "intro" ? undefined : "ghost-mark"}
        >
          {phase !== "intro" && <Page />}
        </AppShell>
        {phase !== "done" && <GhostScatter />}
        {phase !== "done" && (
          <SplashScreen exiting={phase === "revealing"} onSkip={() => setPhase("revealing")} />
        )}
      </LayoutGroup>
    </ApplicationsProvider>
  );
}
