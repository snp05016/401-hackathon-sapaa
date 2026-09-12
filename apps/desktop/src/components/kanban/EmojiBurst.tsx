import { motion } from "framer-motion";
import type { ApplicationStage } from "@ghostboard/shared";

export interface EmojiBurstEffect {
  id: number;
  stage: ApplicationStage;
  x: number;
  y: number;
}

const STAGE_EMOJIS: Record<ApplicationStage, readonly string[]> = {
  found: ["🔖", "💼", "✨"],
  applied: ["🚀", "📨", "✨"],
  interviewing: ["🎤", "💬", "✨"],
  offer: ["🎉", "🥳", "✨"],
  rejected: ["🌱", "💪", "✨"],
  ghosted: ["👻", "🔎", "✨"],
};

const PARTICLE_PATHS = [
  { x: -76, y: -52, rotate: -28, scale: 0.9 },
  { x: -42, y: -86, rotate: 22, scale: 1.15 },
  { x: 0, y: -104, rotate: -12, scale: 0.95 },
  { x: 45, y: -82, rotate: 30, scale: 1.1 },
  { x: 78, y: -46, rotate: -24, scale: 0.85 },
  { x: -62, y: 18, rotate: 24, scale: 0.8 },
  { x: 60, y: 14, rotate: -18, scale: 0.9 },
] as const;

export function EmojiBurst({
  effect,
  onComplete,
}: {
  effect: EmojiBurstEffect;
  onComplete: (id: number) => void;
}) {
  const emojis = STAGE_EMOJIS[effect.stage];

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 h-0 w-0"
      style={{ left: effect.x, top: effect.y }}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: 0.9, times: [0, 0.72, 1] }}
      onAnimationComplete={() => onComplete(effect.id)}
    >
      {PARTICLE_PATHS.map((path, index) => (
        <motion.span
          key={index}
          className="absolute -left-3 -top-3 block text-[22px] leading-none drop-shadow-sm"
          initial={{ x: 0, y: 0, rotate: 0, scale: 0.35 }}
          animate={{
            x: path.x,
            y: [0, path.y, path.y + 34],
            rotate: path.rotate,
            scale: [0.35, path.scale, path.scale * 0.82],
          }}
          transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1], delay: index * 0.025 }}
        >
          {emojis[index % emojis.length]}
        </motion.span>
      ))}
    </motion.div>
  );
}
