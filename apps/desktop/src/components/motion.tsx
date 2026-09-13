import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, type Transition } from "framer-motion";
import {
  DISTANCE,
  DURATION,
  EASE,
  SCALE,
  SPRING,
  STAGGER,
  TRANSITION,
  staggerContainerWith,
  staggerItem,
} from "../lib/motion";
import { cn } from "../lib/utils";

const MOTION_ELEMENTS = {
  div: motion.div,
  section: motion.section,
  li: motion.li,
  ol: motion.ol,
  ul: motion.ul,
  article: motion.article,
  header: motion.header,
  tr: motion.tr,
  span: motion.span,
};

type MotionElementName = keyof typeof MOTION_ELEMENTS;

function motionElement(name: MotionElementName) {
  return MOTION_ELEMENTS[name];
}

export function Reveal({
  children,
  delay = 0,
  distance = DISTANCE.rise,
  as = "div",
  className,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  as?: "div" | "section" | "li" | "article" | "header";
  className?: string;
}): JSX.Element {
  const Element = motionElement(as);
  return (
    <Element
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: SCALE.exit }}
      transition={{ ...TRANSITION.hero, delay }}
    >
      {children}
    </Element>
  );
}

export function Stagger({
  children,
  gap = STAGGER.list,
  lead = STAGGER.lead,
  as = "div",
  className,
}: {
  children: ReactNode;
  gap?: number;
  lead?: number;
  as?: "div" | "ul" | "ol" | "section";
  className?: string;
}): JSX.Element {
  const Element = motionElement(as);
  const variants = useMemo(() => staggerContainerWith(gap, lead), [gap, lead]);
  return (
    <Element className={className} variants={variants} initial="hidden" animate="visible">
      {children}
    </Element>
  );
}

export function StaggerItem({
  children,
  as = "div",
  className,
}: {
  children: ReactNode;
  as?: "div" | "li" | "tr" | "article";
  className?: string;
}): JSX.Element {
  const Element = motionElement(as);
  return (
    <Element className={className} variants={staggerItem}>
      {children}
    </Element>
  );
}

export function RevealOnScroll({
  children,
  className,
  amount = 0.25,
  once = true,
  distance = DISTANCE.rise,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  once?: boolean;
  distance?: number;
}): JSX.Element {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount, margin: "-8% 0px" }}
      transition={TRANSITION.slow}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({
  pageKey,
  children,
}: {
  pageKey: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, transition: { duration: DURATION.quick, ease: EASE.out } }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.08, ease: EASE.in } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function HoverLift({
  children,
  lift = DISTANCE.lift,
  className,
  onClick,
  as = "div",
  disabled = false,
}: {
  children: ReactNode;
  lift?: number;
  className?: string;
  onClick?: () => void;
  as?: "div" | "article" | "li";
  disabled?: boolean;
}): JSX.Element {
  const Element = motionElement(as);
  return (
    <Element
      className={className}
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? undefined : { y: lift, transition: SPRING.hover }}
      whileTap={disabled ? undefined : { scale: SCALE.press, transition: SPRING.press }}
    >
      {children}
    </Element>
  );
}

export function AnimatedNumber({
  value,
  duration = DURATION.deliberate,
  className,
  format,
  delay = 0,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
  delay?: number;
}): JSX.Element {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(() => (format ? format(0) : "0"));
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const render = (n: number) => {
      const formatter = formatRef.current;
      setDisplay(formatter ? formatter(n) : String(Math.round(n)));
    };
    const controls = animate(motionValue, value, {
      duration,
      delay,
      ease: EASE.out,
      onUpdate: render,
    });
    return () => controls.stop();
  }, [delay, duration, motionValue, value]);

  return (
    <span className={className} aria-label={String(value)}>
      {display}
    </span>
  );
}

export function Shimmer({
  className,
  lines = 1,
  height = 12,
  rounded = true,
}: {
  className?: string;
  lines?: number;
  height?: number;
  rounded?: boolean;
}): JSX.Element {
  const count = Math.max(1, lines);
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={cn("shimmer-band w-full", rounded && "rounded-sm")}
          style={{ height }}
        />
      ))}
    </div>
  );
}

const STAMP_TONE_CLASS: Record<"oxblood" | "verdigris" | "brass" | "ink", string> = {
  oxblood: "text-oxblood border-oxblood/50",
  verdigris: "text-verdigris border-verdigris/50",
  brass: "text-brass border-brass/50",
  ink: "text-ink border-hairline",
};

export function Stamp({
  label,
  show,
  tone = "oxblood",
  onDone,
}: {
  label: string;
  show: boolean;
  tone?: "oxblood" | "verdigris" | "brass" | "ink";
  onDone?: () => void;
}): JSX.Element | null {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => onDoneRef.current?.(), 1100);
    return () => clearTimeout(timer);
  }, [show, label]);

  if (!show) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={TRANSITION.quick}
    >
      <motion.span
        className={cn(
          "select-none whitespace-nowrap rounded-sm border-2 px-3 py-1 font-display text-[15px] uppercase tracking-[0.18em]",
          STAMP_TONE_CLASS[tone],
        )}
        initial={{ scale: 1.35, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: -8, opacity: 1 }}
        transition={SPRING.overshoot}
      >
        {label}
      </motion.span>
    </motion.div>
  );
}

const CONFETTI_CAP = 24;

export function PaperConfetti({
  fire,
  count = 18,
  origin,
  onDone,
}: {
  fire: boolean;
  count?: number;
  origin?: { x: number; y: number };
  onDone?: () => void;
}): JSX.Element | null {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const shards = useMemo(() => {
    const total = Math.min(Math.max(0, count), CONFETTI_CAP);
    return Array.from({ length: total }, (_, index) => {
      const spread = (index / Math.max(1, total - 1) - 0.5) * 2;
      return {
        id: index,
        x: spread * (90 + ((index * 37) % 70)),
        y: 150 + ((index * 53) % 130),
        rotate: (index % 2 === 0 ? 1 : -1) * (120 + ((index * 29) % 180)),
        width: 5 + (index % 3) * 2,
        height: 9 + (index % 4) * 3,
        delay: (index % 6) * 0.035,
        duration: 0.9 + ((index * 17) % 40) / 100,
      };
    });
  }, [count]);

  useEffect(() => {
    if (!fire) return;
    const timer = setTimeout(() => onDoneRef.current?.(), 1400);
    return () => clearTimeout(timer);
  }, [fire]);

  if (!fire) return null;

  const left = origin ? `${origin.x}px` : "50%";
  const top = origin ? `${origin.y}px` : "40%";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90] overflow-hidden text-oxblood">
      {shards.map((shard) => (
        <motion.div
          key={shard.id}
          className="absolute"
          style={{
            left,
            top,
            width: shard.width,
            height: shard.height,
            backgroundColor: "currentColor",
          }}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.7 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: [0, shard.x * 0.5, shard.x],
            y: [0, -28, shard.y],
            rotate: [0, shard.rotate * 0.5, shard.rotate],
            scale: [0.7, 1, 0.92],
          }}
          transition={{
            duration: shard.duration,
            delay: shard.delay,
            ease: EASE.out,
            times: [0, 0.2, 0.7, 1],
          }}
        />
      ))}
    </div>
  );
}

export function Sheen({
  play,
  className,
  durationMs = 900,
}: {
  play: boolean;
  className?: string;
  durationMs?: number;
}): JSX.Element | null {
  if (!play) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("sheen-sweep pointer-events-none absolute inset-0 z-10", className)}
      style={{ "--sheen-duration": `${durationMs}ms` } as CSSProperties}
    />
  );
}

export function DrawRule({
  delay = 0,
  className,
  origin = "left",
}: {
  delay?: number;
  className?: string;
  origin?: "left" | "center" | "right";
}): JSX.Element {
  return (
    <motion.div
      aria-hidden="true"
      className={cn("h-px w-full bg-hairline", className)}
      style={{ transformOrigin: origin }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ ...TRANSITION.hero, delay }}
    />
  );
}

export function GhostDrift({
  children,
  amplitude = 3,
  period = 6,
  className,
}: {
  children: ReactNode;
  amplitude?: number;
  period?: number;
  className?: string;
}): JSX.Element {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amplitude, 0, amplitude, 0], rotate: [0, -0.6, 0, 0.6, 0] }}
      transition={{ duration: period, ease: "easeInOut", repeat: Infinity, repeatType: "loop" }}
    >
      {children}
    </motion.div>
  );
}

export function ThemeWipe({
  origin,
  color,
  onHalfway,
  onDone,
}: {
  origin: { x: number; y: number } | null;
  color: string;
  onHalfway: () => void;
  onDone: () => void;
}): JSX.Element | null {
  const onHalfwayRef = useRef(onHalfway);
  const onDoneRef = useRef(onDone);
  onHalfwayRef.current = onHalfway;
  onDoneRef.current = onDone;

  const radius = useMemo(() => {
    if (!origin || typeof window === "undefined") return 0;
    const corners = [
      Math.hypot(origin.x, origin.y),
      Math.hypot(window.innerWidth - origin.x, origin.y),
      Math.hypot(origin.x, window.innerHeight - origin.y),
      Math.hypot(window.innerWidth - origin.x, window.innerHeight - origin.y),
    ];
    // Oversized so the viewport is fully covered well before the 55% swap,
    // otherwise the corners would flash the incoming ground early.
    return Math.max(...corners) * 1.8;
  }, [origin]);

  useEffect(() => {
    if (!origin) return;
    const halfway = setTimeout(() => onHalfwayRef.current(), DURATION.slow * 1000 * 0.55);
    const done = setTimeout(
      () => onDoneRef.current(),
      DURATION.slow * 1000 + DURATION.quick * 1000 + 40,
    );
    return () => {
      clearTimeout(halfway);
      clearTimeout(done);
    };
  }, [origin]);

  if (!origin || radius <= 0) return null;

  const size = radius * 2;
  const wipeTransition: Transition = { duration: DURATION.slow, ease: EASE.inOut };

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
      <motion.div
        className="absolute rounded-full"
        style={{
          left: origin.x - radius,
          top: origin.y - radius,
          width: size,
          height: size,
          background: color,
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 1, 1], opacity: [1, 1, 0] }}
        transition={{
          ...wipeTransition,
          duration: DURATION.slow + DURATION.quick,
          times: [0, DURATION.slow / (DURATION.slow + DURATION.quick), 1],
        }}
      />
    </div>
  );
}
