import { useCallback, useEffect, useState } from "react";
import type { Application } from "@ghostboard/shared";
import { ipc } from "./ipc";

export function useApplications() {
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
    // Refresh jobs saved by the extension and roll deadline counts over at midnight.
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [revision]);

  return { applications, error, now, reload };
}
