import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Application } from "@ghostboard/shared";
import { evaluateApplicationStaleness, evaluateDeadline, mixedSourceGroups, redundantApplicationIds } from "@ghostboard/tracking";
import { ipc } from "../lib/ipc";
import { useApplications } from "../lib/useApplications";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Reveal } from "../components/motion";
import { DISTANCE, DURATION, EASE, SCALE, SPRING, STAGGER, TRANSITION } from "../lib/motion";
import { playSound } from "../lib/sound";
import { cn } from "../lib/utils";

const deadlineColors = {
  green: "border-verdigris/35 text-verdigris",
  yellow: "border-brass/40 text-brass",
  red: "border-oxblood/35 text-oxblood",
  none: "border-hairline text-ink-3",
};

function DeadlineBadge({
  color,
  urgent = false,
  children,
}: {
  color: keyof typeof deadlineColors;
  urgent?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px]",
        deadlineColors[color],
        urgent && "pulse-soft",
      )}
    >
      {children}
    </span>
  );
}

function DeadlineEditor({ application, onSaved }: { application: Application; onSaved: () => void }) {
  const [deadline, setDeadline] = useState(application.deadline ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDeadline(application.deadline ?? ""); }, [application.deadline]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await ipc().updateDeadline(application.id, deadline || null);
      setSaved(true);
      playSound("success");
      onSaved();
    } catch {
      setError("Could not save the deadline. Check the date and try again.");
      playSound("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="min-w-[230px]">
      <div className="flex items-center gap-3">
        <Input
          variant="rule"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          className="tnum w-[135px]"
          aria-label={`Deadline for ${application.title} at ${application.company}`}
          aria-describedby={error ? `deadline-error-${application.id}` : undefined}
          aria-invalid={!!error}
          invalid={!!error}
          value={deadline}
          disabled={saving}
          onChange={(event) => { setDeadline(event.target.value); setSaved(false); setError(null); }}
        />
        <Button type="submit" variant="rule" silent disabled={saving || deadline === (application.deadline ?? "")}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="deadline-error"
            id={`deadline-error-${application.id}`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASE.out }}
            className="mt-1.5 text-[11px] text-oxblood"
          >
            {error}
          </motion.p>
        )}
        {saved && (
          <motion.p
            key="deadline-saved"
            role="status"
            initial={{ opacity: 0, scale: SCALE.pop }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: SCALE.exit }}
            transition={SPRING.overshoot}
            className="mt-1.5 text-[11px] text-verdigris"
          >
            Deadline saved.
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

export function Tracking() {
  const { applications, error, now, reload } = useApplications();
  const prefersReducedMotion = useReducedMotion();

  const mixedGroups = useMemo(() => mixedSourceGroups(applications ?? []), [applications]);
  const mixedKeysByApplicationId = useMemo(() => {
    const keys = new Set<string>();
    for (const group of mixedGroups) {
      for (const entry of group.applications) keys.add(entry.id);
    }
    return keys;
  }, [mixedGroups]);

  const redundantIds = useMemo(() => redundantApplicationIds(applications ?? []), [applications]);
  const redundantSignature = redundantIds.slice().sort().join("|");
  const cleanedSignature = useRef("");
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);

  // Re-keying the row list on its signature restages the table after a reload
  // without ever handing framer a `layout` animation to fight over.
  const rowSignature = (applications ?? []).map((application) => application.id).join("|");

  useEffect(() => {
    if (!redundantSignature || cleanedSignature.current === redundantSignature) return;
    cleanedSignature.current = redundantSignature;
    let cancelled = false;
    (async () => {
      try {
        for (const applicationId of redundantIds) await ipc().deleteApplication(applicationId);
        if (cancelled) return;
        setCleanupNotice(
          `Removed ${redundantIds.length} duplicate ${redundantIds.length === 1 ? "copy" : "copies"} saved from the same website.`
        );
        reload();
      } catch {
        if (!cancelled) setCleanupNotice("Could not remove duplicate copies. Try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redundantSignature, redundantIds, reload]);

  return (
    <div>
      <Reveal as="header" className="flex flex-col gap-3 border-b border-hairline pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
        <h1 className="font-display text-[36px] leading-[0.9] tracking-[-0.015em] text-ink sm:text-[52px]">Tracking</h1>
        <p className="max-w-[320px] text-[12px] leading-relaxed text-ink-2 sm:text-right">
          Set the application deadline from each posting. Clear the date and save to remove it.
        </p>
      </Reveal>

      <motion.div
        aria-label="Deadline color legend"
        initial={{ opacity: 0, y: DISTANCE.rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TRANSITION.hero, delay: STAGGER.lead }}
        className="mt-6 flex flex-wrap items-center gap-2"
      >
        <DeadlineBadge color="green">7+ days</DeadlineBadge>
        <DeadlineBadge color="yellow">2–6 days</DeadlineBadge>
        <DeadlineBadge color="red">Today, tomorrow, or overdue</DeadlineBadge>
      </motion.div>

      {error && (
        <div role="alert" className="mt-8 flex items-center gap-4 border-l-2 border-oxblood pl-4 text-[13px] text-ink">
          {error}
          <Button variant="quiet" onClick={reload}>Retry</Button>
        </div>
      )}
      {!applications && !error && <p role="status" className="mt-8 text-[13px] text-ink-2">Loading saved jobs…</p>}
      {applications?.length === 0 && (
        <p className="mt-9 max-w-[560px] border-y border-dashed border-hairline py-7 font-display text-[22px] leading-snug text-ink-2">
          No saved jobs yet. Save a posting with the browser extension, then add its deadline here.
        </p>
      )}

      {!!mixedGroups.length && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: DISTANCE.rise }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION.hero}
          className="mt-8 max-w-[720px] border-l-2 border-brass pl-4 text-[13px] text-ink"
        >
          <strong className="font-semibold">
            {mixedGroups.length} {mixedGroups.length === 1 ? "job" : "jobs"} saved from more than one website — open each to see where its copies came from.
          </strong>
          <ul className="mt-2 space-y-2">
            {mixedGroups.map((group) => {
              const places = [...new Set(group.applications.map((entry) => entry.source))];
              return (
                <li key={group.key}>
                  <details>
                    <summary className="cursor-pointer text-ink-2">
                      {group.applications[0].title} at {group.applications[0].company} — saved from {places.join(" and ")}
                    </summary>
                    <ul className="mt-1.5 space-y-1 border-l border-hairline pl-3 text-ink-2">
                      {group.applications.map((entry) => (
                        <li key={entry.id}>
                          {entry.source} · saved {new Date(entry.createdAt).toLocaleDateString()}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {cleanupNotice && (
          <motion.div
            key="cleanup-notice"
            role="status"
            initial={{ opacity: 0, y: DISTANCE.rise }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, scale: SCALE.exit }}
            transition={TRANSITION.base}
            className="mt-8 max-w-[720px] border-l-2 border-verdigris pl-4 text-[13px] text-ink"
          >
            {cleanupNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {!!applications?.length && (
        <Reveal className="mt-9 overflow-x-auto" delay={STAGGER.section}>
          <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[11px] text-ink-2">
                <th scope="col" className="px-3 pb-3 pl-0 font-normal">Company / role</th>
                <th scope="col" className="px-3 pb-3 font-normal">Stage</th>
                <th scope="col" className="px-3 pb-3 font-normal">Application deadline</th>
                <th scope="col" className="px-3 pb-3 font-normal">Deadline status</th>
                <th scope="col" className="px-3 pb-3 font-normal">Days quiet</th>
                <th scope="col" className="px-3 pb-3 pr-0 font-normal">Staleness</th>
              </tr>
            </thead>
            <tbody key={rowSignature}>
              {applications?.map((application, index) => {
                const staleness = evaluateApplicationStaleness(application, now);
                const deadline = evaluateDeadline(application.deadline, now);
                return (
                  <motion.tr
                    key={application.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...TRANSITION.base, delay: Math.min(index, 11) * STAGGER.tight }}
                    whileHover={{ y: DISTANCE.liftRow, transition: SPRING.hover }}
                    className="border-b border-hairline transition-colors hover:bg-paper-raised"
                  >
                    <td className="min-w-[170px] max-w-xs break-words px-3 py-5 pl-0">
                      <div className="font-semibold text-ink">{application.company}</div>
                      <div className="mt-0.5 text-ink-2">{application.title}</div>
                      {mixedKeysByApplicationId.has(application.id) && (
                        <div className="mt-1.5">
                          <Badge variant="brass">Saved from multiple sites</Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-3 text-ink-2">{application.status}</td>
                    <td className="px-3"><DeadlineEditor application={application} onSaved={reload} /></td>
                    <td className="px-3">
                      <DeadlineBadge color={deadline.color} urgent={deadline.color === "red" && prefersReducedMotion !== true}>
                        {deadline.label}
                      </DeadlineBadge>
                    </td>
                    <td className="tnum px-3 text-ink-2">{staleness.daysSinceLastActivity}</td>
                    <td className="px-3 pr-0">
                      <Badge variant={staleness.isStale ? "brass" : "mist"}>{staleness.isStale ? "Stale" : "OK"}</Badge>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </Reveal>
      )}
    </div>
  );
}
