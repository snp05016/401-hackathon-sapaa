import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApplications } from "../../lib/useApplications";
import type { Application } from "@ghostboard/shared";
import { evaluateDeadline } from "@ghostboard/tracking";
import { DISTANCE, SCALE, TRANSITION } from "../../lib/motion";

type LaunchAlert = {
  id: string;
  type: "deadline";
  company: string;
  title: string;
  label: string;
};

export function LaunchAlerts() {
  const { applications, now } = useApplications();
  const shownRef = useRef(false);
  const [alerts, setAlerts] = useState<LaunchAlert[]>([]);

  useEffect(() => {
    if (!applications || shownRef.current) return;
    shownRef.current = true;
    const dueSoon = applications.filter((app: Application) => {
      if (app.status === "rejected" || app.status === "ghosted") return false;
      const { daysRemaining } = evaluateDeadline(app.deadline ?? null, now);
      return daysRemaining === 0 || daysRemaining === 1;
    });

    const nextAlerts: LaunchAlert[] = [
      ...dueSoon.map((app: Application) => {
        const { label } = evaluateDeadline(app.deadline ?? null, now);
        return {
          id: app.id,
          type: "deadline" as const,
          company: app.company,
          title: app.title,
          label,
        };
      }),
    ];

    if (nextAlerts.length === 0) return;
    setAlerts(nextAlerts);

    return () => setAlerts([]);
  }, [applications, now]);

  const dismiss = (id: string) => setAlerts((current) => current.filter((alert) => alert.id !== id));

  return (
    <div
      id="launch-alerts"
      className="pointer-events-none fixed right-6 top-6 z-[100] flex flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {alerts.map((alert, index) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: DISTANCE.slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12, scale: SCALE.exit }}
            transition={{ ...TRANSITION.slow, delay: index * 0.15 }}
            className="pointer-events-auto min-w-[320px] max-w-[420px] rounded-lg border border-hairline bg-paper-raised p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="mt-0.5 text-[12px] text-ink-2">{alert.company}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-oxblood">{alert.label}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(alert.id)}
                aria-label="Dismiss"
                className="shrink-0 text-ink-3 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
