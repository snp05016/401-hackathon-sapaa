import type { Transition, Variants } from "framer-motion";

export type Cubic = [number, number, number, number];

export const DURATION = {
  instant: 0.09,
  quick: 0.16,
  base: 0.24,
  slow: 0.42,
  deliberate: 0.7,
  ambient: 2.4,
} as const;

// Not `as const`: framer's Easing type rejects readonly tuples.
export const EASE: Record<"out" | "subtle" | "in" | "inOut", Cubic> = {
  out: [0.16, 1, 0.3, 1],
  subtle: [0.33, 1, 0.68, 1],
  in: [0.7, 0, 0.84, 0],
  inOut: [0.76, 0, 0.24, 1],
};

export const SPRING = {
  press: { type: "spring", stiffness: 620, damping: 32, mass: 0.6 },
  hover: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
  card: { type: "spring", stiffness: 420, damping: 28, mass: 1 },
  layout: { type: "spring", stiffness: 260, damping: 34, mass: 0.9 },
  overshoot: { type: "spring", stiffness: 500, damping: 18, mass: 0.8 },
  drift: { type: "spring", stiffness: 120, damping: 20, mass: 1.2 },
} satisfies Record<string, Transition>;

export const TRANSITION = {
  quick: { duration: DURATION.quick, ease: EASE.subtle },
  base: { duration: DURATION.base, ease: EASE.out },
  slow: { duration: DURATION.slow, ease: EASE.out },
  exit: { duration: DURATION.quick, ease: EASE.in },
  hero: { duration: DURATION.deliberate, ease: EASE.out },
} satisfies Record<string, Transition>;

export const STAGGER = { tight: 0.028, list: 0.045, section: 0.08, lead: 0.06 } as const;

export const DISTANCE = {
  riseSmall: 8,
  rise: 14,
  riseLarge: 24,
  lift: -3,
  liftRow: -2,
  slide: 18,
} as const;

export const SCALE = { press: 0.975, hover: 1.015, pop: 1.06, exit: 0.96 } as const;

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: DISTANCE.rise },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
  exit: { opacity: 0, y: -6, transition: TRANSITION.exit },
};

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: TRANSITION.base },
  exit: { opacity: 0, scale: SCALE.exit, transition: TRANSITION.exit },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER.list, delayChildren: STAGGER.lead },
  },
  exit: {},
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: DISTANCE.rise },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
  exit: { opacity: 0, y: -6, transition: TRANSITION.exit },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
  exit: { opacity: 0, y: -6, scale: SCALE.exit, transition: TRANSITION.exit },
};

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: TRANSITION.quick },
  exit: { opacity: 0, transition: TRANSITION.exit },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, y: DISTANCE.riseLarge, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.card },
  exit: { opacity: 0, y: 12, scale: SCALE.exit, transition: TRANSITION.exit },
};

export const ruleDraw: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: TRANSITION.hero },
  exit: { scaleX: 0, transition: TRANSITION.exit },
};

export function staggerContainerWith(gap: number = STAGGER.list, lead: number = STAGGER.lead): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: gap, delayChildren: lead } },
    exit: {},
  };
}

export function hoverLift(lift: number = DISTANCE.lift): {
  whileHover: { y: number; transition: Transition };
  whileTap: { scale: number; transition: Transition };
} {
  return {
    whileHover: { y: lift, transition: SPRING.hover },
    whileTap: { scale: SCALE.press, transition: SPRING.press },
  };
}

export const pressable: {
  whileHover: { scale: number };
  whileTap: { scale: number };
  transition: Transition;
} = {
  whileHover: { scale: SCALE.hover },
  whileTap: { scale: SCALE.press },
  transition: SPRING.press,
};
