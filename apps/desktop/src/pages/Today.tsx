import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { ActivityCalendar } from "react-activity-calendar";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { FollowUpSuggestion } from "@ghostboard/shared";
import { FOLLOW_UP_KIND_LABELS, summarizeToday } from "@ghostboard/tracking";
import { useApplications } from "../lib/useApplications";
import { ipc } from "../lib/ipc";
import { renderMessageTemplate, capitalize, cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { AnimatedNumber, DrawRule, Reveal, Sheen } from "../components/motion";
import { DISTANCE, DURATION, SPRING, STAGGER, TRANSITION, modalBackdrop, modalPanel } from "../lib/motion";
import { playSound } from "../lib/sound";

function SettledTick({ delay }: { delay: number }) {
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-3 inline-block h-[0.42em] w-[0.42em] align-baseline text-verdigris"
    >
      <motion.path
        d="M3 12.5 L9.5 19 L21 5.5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...SPRING.overshoot, delay }}
      />
    </motion.svg>
  );
}

function Figure({
  count,
  label,
  accent,
  delay,
  pulse = false,
  tick = false,
}: {
  count: number;
  label: string;
  accent: string;
  delay: number;
  pulse?: boolean;
  tick?: boolean;
}) {
  return (
    <div className="px-5 first:pl-0 last:pr-0 sm:px-7">
      <motion.div
        initial={{ opacity: 0, y: DISTANCE.rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TRANSITION.hero, delay }}
      >
        <div className={cn("tnum font-display text-[40px] leading-[0.85] sm:text-[64px]", accent, pulse && "pulse-soft")}>
          <AnimatedNumber value={count} duration={DURATION.deliberate} delay={delay} />
          {tick && <SettledTick delay={delay + DURATION.deliberate * 0.8} />}
        </div>
        <DrawRule delay={delay + DURATION.deliberate * 0.7} className="mt-3" />
        <div className="mt-3 text-[12px] text-ink-2">{label}</div>
      </motion.div>
    </div>
  );
}

export function Today() {
  const { applications, error, now, reload } = useApplications();
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [heatmapSheen, setHeatmapSheen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const counts = summarizeToday(applications ?? [], now);
  const hasApplications = Boolean(applications);

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  useEffect(() => {
    if (!hasApplications) return;
    const timer = window.setTimeout(() => setHeatmapSheen(true), 400);
    return () => window.clearTimeout(timer);
  }, [hasApplications]);

  async function copyMessage(item: FollowUpSuggestion) {
    const body = renderMessageTemplate(item.message.body, {
      Company: capitalize(item.company),
      "Job Title": item.title.toLowerCase(),
    });
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(item.applicationId);
      playSound("success");
    } catch (error) {
      playSound("error");
      console.error("Could not copy follow-up message", error);
    }
  }

  function closeModal() {
    playSound("close");
    setModalOpen(false);
  }

  useEffect(() => {
    if (!applications || applications.length === 0) return;
    const loaded = applications;
    let active = true;
    async function evaluate() {
      try {
        const suggestions = await ipc().evaluateFollowUps();
        if (!active) return;
        setFollowUps(suggestions);
        if (suggestions.length > 0) {
          setModalOpen(true);
          const missingFromView = suggestions.some(
            (suggestion) => !loaded.some((item) => item.id === suggestion.applicationId && item.followUpOn)
          );
          if (missingFromView) reload();
        }
      } catch {
        // Keep the page usable when follow-up evaluation fails.
      }
    }
    void evaluate();
    return () => {
      active = false;
    };
  }, [applications, reload]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  return (
    <div className="max-w-[980px]">
      <Reveal as="header">
        <p className="text-[12px] text-ink-2">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 font-display text-[48px] leading-[0.88] tracking-[-0.02em] text-ink sm:text-[88px]">Today</h1>
      </Reveal>

      {error && (
        <div role="alert" className="mt-8 flex items-center gap-4 border-l-2 border-oxblood pl-4 text-[13px] text-ink">
          {error}
          <Button variant="quiet" onClick={reload}>Retry</Button>
        </div>
      )}
      {!applications && !error && <p role="status" className="mt-8 text-[13px] text-ink-2">Loading saved jobs…</p>}

      {applications && (
        <>
          <Reveal as="section" className="mt-14" delay={STAGGER.lead}>
            <div className="flex flex-col gap-3 border-b border-hairline pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
              <h2 className="font-display text-[26px] leading-none text-ink">Application deadlines</h2>
              <p className="max-w-[300px] text-[12px] leading-relaxed text-ink-2 sm:text-right">
                Jobs in Found that still need an application. Set their deadlines in Tracking.
              </p>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-4 gap-y-6 divide-x divide-hairline sm:flex-nowrap">
              <Figure
                count={counts.dueToday}
                label="Due today"
                accent="text-oxblood"
                delay={STAGGER.section}
                pulse={counts.dueToday > 0 && prefersReducedMotion !== true}
                tick={counts.dueToday === 0}
              />
              <Figure count={counts.upcoming} label="Due in the next 7 days" accent="text-ink" delay={STAGGER.section * 2} />
              <Figure count={counts.overdue} label="Overdue" accent="text-oxblood" delay={STAGGER.section * 3} />
            </div>
            <p className="mt-8 text-[12px] text-ink-2">
              {counts.noDeadline} {counts.noDeadline === 1 ? "job has" : "jobs have"} no deadline set.
            </p>
            {applications.length === 0 && (
              <p className="mt-7 max-w-[560px] border-y border-dashed border-hairline py-7 font-display text-[22px] leading-snug text-ink-2">
                Nothing here yet. Save a job with the browser extension and it lands in Found.
              </p>
            )}
          </Reveal>

          <Reveal as="section" className="mt-14 w-full sm:mt-20 sm:ml-auto sm:w-[78%]" delay={STAGGER.section * 4}>
            <h2 className="border-b border-hairline pb-3 font-display text-[26px] leading-none text-ink">
              Application overview
            </h2>
            <div className="mt-8 flex flex-wrap gap-x-4 gap-y-6 divide-x divide-hairline sm:flex-nowrap">
              <Figure count={counts.total} label="Total applications" accent="text-ink" delay={STAGGER.section * 5} />
              <Figure count={counts.applied} label="Applied" accent="text-ink" delay={STAGGER.section * 6} />
              <Figure count={counts.interviewing} label="Interviewing" accent="text-brass" delay={STAGGER.section * 7} />
              <Figure count={counts.followUpOn} label="Follow-up on" accent="text-ink" delay={STAGGER.section * 8} />
            </div>
          </Reveal>

          <Reveal as="section" className="mt-14 w-full" delay={STAGGER.section * 5}>
            <h2 className="border-b border-hairline pb-3 font-display text-[26px] leading-none text-ink">
              Application activity
            </h2>
            <div className="relative mt-8">
              <ActivityCalendar
                data={(() => {
                  const counts = new Map<string, number>();
                  for (const app of applications ?? []) {
                    if (app.dateApplied) {
                      const date = app.dateApplied.split("T")[0];
                      counts.set(date, (counts.get(date) ?? 0) + 1);
                    }
                  }

                  const maxCount = Math.max(...counts.values(), 1);

                  // build the full 12-month range, filling gaps with zero
                  const end = new Date();
                  const start = new Date();
                  start.setFullYear(start.getFullYear() - 1);
                  start.setDate(start.getDate() + 1); // inclusive of today, 12 months back

                  const days = [];
                  const cursor = new Date(start);
                  while (cursor <= end) {
                    const iso = cursor.toISOString().split("T")[0];
                    const count = counts.get(iso) ?? 0;
                    const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.floor((count / maxCount) * 4)));
                    days.push({ date: iso, count, level });
                    cursor.setDate(cursor.getDate() + 1);
                  }

                  return days;
                })()}
                blockSize={12}
                blockMargin={3}
                blockRadius={2}
                fontSize={11}
                showMonthLabels={true}
                showWeekdayLabels={["mon", "wed", "fri"]}
                showColorLegend
                showTotalCount
                tooltips={{
                  activity: {
                    text: (activity) =>
                      `${activity.count} application${activity.count === 1 ? "" : "s"} on ${activity.date}`,
                  },
                }}
                minLevel={0}
                maxLevel={4}
              />
              <Sheen play={heatmapSheen} />
            </div>
          </Reveal>
        </>
      )}

      <AnimatePresence>
        {modalOpen && followUps.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Follow-up reminders">
            <motion.div
              variants={modalBackdrop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 bg-ink/40"
              onClick={closeModal}
            />
            <motion.div
              variants={modalPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-hairline bg-paper-raised shadow-2xl"
            >
              <header className="flex items-center justify-between border-b px-3 py-1">
                <motion.button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close follow-up reminders"
                  whileHover={{ scale: 1.08, rotate: 6 }}
                  whileTap={{ scale: 0.975 }}
                  transition={SPRING.hover}
                  className="text-ink-2 transition-colors hover:text-ink"
                >
                  <X size={18} strokeWidth={1.6} />
                </motion.button>
              </header>
              <div className="space-y-8 px-7 py-6">
                {followUps.map((item, index) => {
                  const body = renderMessageTemplate(item.message.body, {
                    Company: capitalize(item.company),
                    "Job Title": item.title.toLowerCase(),
                  });
                  const copied = copiedId === item.applicationId;
                  return (
                    <motion.section
                      key={item.applicationId}
                      initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...TRANSITION.base, delay: STAGGER.lead + Math.min(index, 11) * STAGGER.list }}
                    >
                      <p className="text-[11px] uppercase tracking-[0.14em] text-oxblood">
                        {FOLLOW_UP_KIND_LABELS[item.kind]}
                      </p>
                      <p className="mt-3 text-[13px] text-ink">
                        {item.company} · {item.title}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-2">{item.message.description}</p>
                      <div className="relative mt-4">
                        <motion.button
                          type="button"
                          onClick={() => void copyMessage(item)}
                          aria-label={copied ? "Message copied" : "Copy message"}
                          title={copied ? "Copied" : "Copy"}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.975 }}
                          transition={SPRING.hover}
                          className="absolute right-2 top-2 rounded border border-hairline bg-paper-raised p-1.5 text-ink-2 transition-colors hover:border-ink hover:text-ink"
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={copied ? "copied" : "copy"}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={SPRING.overshoot}
                              className="block"
                            >
                              {copied ? <Check size={14} strokeWidth={1.6} /> : <Copy size={14} strokeWidth={1.6} />}
                            </motion.span>
                          </AnimatePresence>
                        </motion.button>
                        <pre className="whitespace-pre-wrap border border-hairline bg-paper p-4 pr-12 font-sans text-[13px] leading-relaxed text-ink">
                          {body}
                        </pre>
                      </div>
                    </motion.section>
                  );
                })}
              </div>
              <footer className="border-t border-hairline px-7 py-4 text-[12px] text-ink-2">
                Dismiss these reminders to check them again later from wherever you left off.
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
