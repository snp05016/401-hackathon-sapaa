import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Application } from "@ghostboard/shared";
import { ipc } from "./ipc";

interface ApplicationsState {
  applications: Application[] | null;
  error: string | null;
  now: Date;
  reload: () => void;
}

function useApplicationsData(): ApplicationsState {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    async function load() {
      const request = ++latestRequest;
      setNow(new Date());
      try {
        const loaded = await ipc().listApplications();
        if (!active || request !== latestRequest) return;
        setApplications(loaded);
        setError(null);
      } catch {
        if (active && request === latestRequest) setError("Could not load saved jobs. Please try again.");
      }
    }
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    const unsubscribe = ipc().onApplicationsChanged(refresh);
    // Refresh jobs saved by the extension and roll deadline counts over at midnight.
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [revision]);

  return { applications, error, now, reload };
}

const ApplicationsContext = createContext<ApplicationsState | null>(null);

export function ApplicationsProvider({ children }: { children: ReactNode }) {
  const state = useApplicationsData();
  return <ApplicationsContext.Provider value={state}>{children}</ApplicationsContext.Provider>;
}

export function useApplications(): ApplicationsState {
  const context = useContext(ApplicationsContext);
  if (!context) throw new Error("useApplications must be used within an ApplicationsProvider");
  return context;
}