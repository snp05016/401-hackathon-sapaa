import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Application } from "@ghostboard/shared";
import {
  FOLLOW_UP_KIND_LABELS,
  evaluateDeadline,
  evaluateFollowUpKind,
} from "@ghostboard/tracking";
import { useApplications } from "../lib/useApplications";
import { ipc } from "../lib/ipc";
import { Button } from "../components/ui/button";
import { DrawRule, GhostDrift, Reveal } from "../components/motion";
import {
  DISTANCE,
  DURATION,
  EASE,
  SCALE,
  SPRING,
  STAGGER,
  TRANSITION,
} from "../lib/motion";
import { playSound } from "../lib/sound";

function rowMotion(index: number, restOpacity = 1) {
  return {
    initial: { opacity: 0, y: DISTANCE.rise },
    animate: { opacity: restOpacity, y: 0 },
    exit: { opacity: 0, y: -6, scale: SCALE.exit, transition: TRANSITION.exit },
    transition: { ...TRANSITION.base, delay: Math.min(index, 11) * STAGGER.list },
    whileHover: { y: DISTANCE.liftRow, transition: SPRING.hover },
  };
}

function GhostGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 56"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        d="M24 3C13.5 3 5 11.5 5 22v31l6-5 6 5 7-5 7 5 6-5 6 5V22C43 11.5 34.5 3 24 3Z"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="23" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="31" cy="23" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FollowUpCheckbox({
  checked,
  ticked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  ticked: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <span className="relative mt-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        aria-label={label}
        className="peer absolute inset-0 z-10 h-4 w-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-sm border border-ink-3 transition-colors duration-150 peer-hover:border-oxblood peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-oxblood"
      />
      <motion.svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none relative h-3.5 w-3.5 text-oxblood"
        initial={false}
        animate={{ scale: ticked ? 1 : 0.82 }}
        transition={SPRING.overshoot}
      >
        <motion.path
          d="M3 8.4 L6.4 11.8 L13 4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: ticked ? 1 : 0, opacity: ticked ? 1 : 0 }}
          transition={{ duration: DURATION.base, ease: EASE.out }}
        />
      </motion.svg>
    </span>
  );
}

function StrikeText({
  children,
  struck,
  className,
}: {
  children: ReactNode;
  struck: boolean;
  className?: string;
}) {
  return (
    <span className={`relative inline-block max-w-full truncate align-bottom ${className ?? ""}`}>
      {children}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 h-px w-full origin-left bg-current"
        initial={false}
        animate={{ scaleX: struck ? 1 : 0 }}
        transition={{ duration: DURATION.base, ease: EASE.out }}
      />
    </span>
  );
}

export function Todo() {
  const { applications, error, now, reload } = useApplications();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorNonce, setActionErrorNonce] = useState(0);

  useEffect(() => {
    let active = true;
    async function evaluate() {
      try {
        await ipc().evaluateFollowUps();
        if (active) reload();
      } catch {
        // Follow-up evaluation failures are surfaced on the Today page.
      }
    }
    void evaluate();
    return () => {
      active = false;
    };
  }, [reload]);

  const due = (applications ?? []).filter(
    (application) => application.followUpOn && !doneIds.has(application.id),
  );
  const sendApplications = (applications ?? []).filter(
    (application) => application.status === "found",
  );

  async function handleDone(application: Application) {
    setDismissingId(application.id);
    setActionError(null);
    playSound("tap");
    try {
      await ipc().dismissFollowUp(application.id);
      setDoneIds((ids) => new Set(ids).add(application.id));
      reload();
    } catch {
      setActionError("Could not mark that item done. Please try again.");
      setActionErrorNonce((nonce) => nonce + 1);
      playSound("error");
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="max-w-[980px]">
      <Reveal as="header">
        <h1 className="font-display text-[88px] leading-[0.88] tracking-[-0.02em] text-ink">
          To Do
        </h1>
        <p className="mt-4 max-w-[520px] text-[13px] leading-relaxed text-ink-2">
          Applications nearing their deadline or that are due for a follow-up,
          picked out automatically by the Today page. Check an item off once you
          have followed up.
        </p>
      </Reveal>
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            key="load-error"
            role="alert"
            className="mt-8 flex items-center gap-4 border-l-2 border-oxblood pl-4 text-[13px] text-ink"
            initial={{ opacity: 0, y: DISTANCE.riseSmall }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: TRANSITION.exit }}
            transition={TRANSITION.base}
          >
            {error}
            <Button variant="quiet" onClick={reload}>
              Retry
            </Button>
          </motion.div>
        )}
        {!applications && !error && (
          <motion.p
            key="loading"
            role="status"
            className="pulse-soft mt-8 text-[13px] text-ink-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: TRANSITION.exit }}
            transition={TRANSITION.base}
          >
            Loading follow-ups…
          </motion.p>
        )}
        {actionError && (
          <motion.div
            key={`action-error-${actionErrorNonce}`}
            role="alert"
            className="mt-6 border-l-2 border-oxblood pl-4 text-[13px] text-ink"
            initial={{ opacity: 0, y: DISTANCE.riseSmall }}
            animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
            exit={{ opacity: 0, y: -6, transition: TRANSITION.exit }}
            transition={{
              ...TRANSITION.base,
              x: { duration: DURATION.base, ease: EASE.out },
            }}
          >
            {actionError}
          </motion.div>
        )}
      </AnimatePresence>
      {applications && (
        <section className="mt-10">
          <DrawRule />
          {due.length === 0 && sendApplications.length === 0 && (
            <motion.div
              className="flex max-w-[560px] items-center gap-6 border-b border-dashed border-hairline py-10"
              initial={{ opacity: 0, y: DISTANCE.rise }}
              animate={{ opacity: 1, y: 0 }}
              transition={TRANSITION.hero}
            >
              <GhostDrift className="shrink-0">
                <GhostGlyph className="h-12 w-12 text-ink-3" />
              </GhostDrift>
              <p className="font-display text-[20px] leading-snug text-ink-2">
                Nothing to chase today. The Today page flags applications two
                weeks after applying and after interviews go quiet.
              </p>
            </motion.div>
          )}
          <AnimatePresence initial={false}>
            {due.map((item, index) => {
              const kind = evaluateFollowUpKind(item, now);
              if (!kind) return null;
              const ticked = doneIds.has(item.id) || dismissingId === item.id;
              return (
                <motion.div
                  key={item.id}
                  className="flex items-start gap-4 border-b border-hairline py-5"
                  {...rowMotion(index, ticked ? 0.6 : 1)}
                >
                  <FollowUpCheckbox
                    checked={doneIds.has(item.id)}
                    ticked={ticked}
                    disabled={dismissingId === item.id}
                    label={`Mark follow-up done for ${item.title} at ${item.company}`}
                    onToggle={() => void handleDone(item)}
                  />
                  <div className="min-w-0 flex-1">
                    <StrikeText struck={ticked} className="text-[15px] font-medium text-ink">
                      {item.title}
                    </StrikeText>
                    <p className="mt-1 truncate text-[12px] text-ink-2">
                      {item.company}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-oxblood">
                      {FOLLOW_UP_KIND_LABELS[kind]}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}
      {applications && sendApplications.length > 0 && (
        <section className="mt-10">
          <DrawRule delay={0.12} />
          {sendApplications.map((item, index) => {
            const deadlineStatus = evaluateDeadline(item.deadline, now);
            const urgencyColor =
              deadlineStatus.color === "red"
                ? "text-red-800"
                : deadlineStatus.color === "yellow"
                  ? "text-amber-800"
                  : "text-ink";
            return (
              <motion.div
                key={item.id}
                className="border-b border-hairline py-5 pl-8"
                {...rowMotion(index)}
              >
                <p
                  className={`truncate text-[15px] font-medium ${urgencyColor}`}
                >
                  {item.title}
                </p>
                <p className="mt-1 truncate text-[12px] text-ink-2">
                  {item.company}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-oxblood">
                    Send application
                  </span>
                  {deadlineStatus.daysRemaining !== null && (
                    <span
                      className={`text-[11px] ${
                        deadlineStatus.color === "none"
                          ? "text-ink-3"
                          : deadlineStatus.color === "red"
                            ? `${urgencyColor} pulse-soft`
                            : urgencyColor
                      }`}
                    >
                      {deadlineStatus.label}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </section>
      )}
    </div>
  );
}
