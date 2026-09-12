import { useEffect, useRef } from "react";
import { useApplications } from "../../lib/useApplications";
import type { Application } from "@ghostboard/shared";
import { buildFollowUpSuggestions, evaluateDeadline, FOLLOW_UP_KIND_LABELS } from "@ghostboard/tracking";

export function LaunchAlerts() {
  const { applications, now } = useApplications();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!applications || shownRef.current) return;
    shownRef.current = true;
    const dueSoon = applications.filter((app: Application) => {
      if (app.status === "rejected" || app.status === "ghosted") return false;
      const { daysRemaining } = evaluateDeadline(app.deadline ?? null, now);
      return daysRemaining === 0 || daysRemaining === 1;
    });

    const alerts = [
      ...dueSoon.map((app: Application) => {
        const { daysRemaining, label } = evaluateDeadline(app.deadline ?? null, now);
        return {
          id: app.id,
          type: "deadline" as const,
          company: app.company,
          title: app.title,
          label,
        };
      }),
    ];

    if (alerts.length === 0) return;

    const container = document.createElement("div");
    container.id = "launch-alerts";
    container.className = "fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none";
    document.body.appendChild(container);

    alerts.forEach((alert, index) => {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "pointer-events-auto animate-slide-in bg-paper-raised border border-hairline rounded-lg shadow-lg p-4 min-w-[320px] max-w-[420px]";
        el.innerHTML = `
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <p class="mt-0.5 text-[12px] text-ink-2">${alert.company}</p>
              <p class="mt-2 text-[11px] uppercase tracking-[0.14em] text-oxblood">${alert.label}</p>
            </div>
            <button class="shrink-0 text-ink-3 hover:text-ink" aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;
        const closeBtn = el.querySelector("button");
        closeBtn?.addEventListener("click", () => {
          el.style.animation = "slideOut 0.2s ease-in forwards";
          setTimeout(() => el.remove(), 200);
        });
        container.appendChild(el);
      }, index * 150);
    });

    return () => {
      container.remove();
    };
  }, [applications, now]);

  return null;
}