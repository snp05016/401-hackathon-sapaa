import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { NavPage } from "./components/layout/Sidebar";
import { Today } from "./pages/Today";
import { Applications } from "./pages/Applications";
import { Discover } from "./pages/Discover";
import { Resumes } from "./pages/Resumes";
import { Profile } from "./pages/Profile";
import { Tracking } from "./pages/Tracking";

const PAGES: Record<NavPage, () => JSX.Element> = {
  today: Today,
  applications: Applications,
  discover: Discover,
  resumes: Resumes,
  profile: Profile,
  tracking: Tracking,
};

export function App() {
  const [page, setPage] = useState<NavPage>("today");
  const Page = PAGES[page];

  return (
    <AppShell page={page} onNavigate={setPage}>
      <Page />
    </AppShell>
  );
}
