import { useMemo } from "react";
import { motion } from "framer-motion";
import { EASE } from "../../lib/motion";

const GHOST_COUNT = 24;

function createRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function GhostScatter() {
  const ghosts = useMemo(() => {
    const random = createRandom(401);

    // Color/brightness variants for subtle shifts in tone & luminance
    const colorShifts = [
      { color: "rgb(var(--oxblood))", brightness: 1.0, opacity: 0.95 },
      { color: "rgb(var(--oxblood))", brightness: 1.3, opacity: 1.0 },
      { color: "rgb(var(--oxblood))", brightness: 1.55, opacity: 1.0 },
      { color: "rgb(var(--oxblood))", brightness: 0.85, opacity: 0.85 },
      { color: "rgb(var(--brass))", brightness: 1.2, opacity: 0.9 },
      { color: "rgb(var(--oxblood))", brightness: 1.4, opacity: 0.95 },
      { color: "rgb(var(--verdigris))", brightness: 1.15, opacity: 0.85 },
      { color: "rgb(var(--oxblood))", brightness: 1.65, opacity: 1.0 },
    ];

    return Array.from({ length: GHOST_COUNT }, (_, index) => {
      // Distribute evenly across screen width with jitter
      const basePercent = (index / (GHOST_COUNT - 1)) * 90 + 5; // 5% to 95%
      const jitter = (random() - 0.5) * 6;
      const left = Math.max(3, Math.min(97, basePercent + jitter));

      const shift = colorShifts[index % colorShifts.length];
      const brightness = shift.brightness + (random() - 0.5) * 0.2;
      const maxOpacity = Math.min(1, Math.max(0.7, shift.opacity + (random() - 0.5) * 0.1));

      // Pop-up height from the bottom: varied levels for depth
      const targetHeight = 140 + random() * 320;
      const driftX = (random() - 0.5) * 50;
      const rotation = (random() - 0.5) * 26;

      return {
        id: index,
        left,
        size: 20 + Math.round(random() * 24),
        targetHeight,
        driftX,
        rotation,
        color: shift.color,
        brightness: Math.round(brightness * 100) / 100,
        maxOpacity: Math.round(maxOpacity * 100) / 100,
        delay: 0.12 + (index % 6) * 0.11 + random() * 0.2,
        duration: 1.15 + random() * 0.45,
      };
    });
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {ghosts.map((ghost) => (
        <motion.div
          key={ghost.id}
          className="absolute bottom-0 block select-none leading-none will-change-transform"
          style={{
            left: `${ghost.left}%`,
            color: ghost.color,
            filter: `brightness(${ghost.brightness}) drop-shadow(0 2px 8px rgba(0,0,0,0.18))`,
          }}
          initial={{ opacity: 0, scale: 0.4, y: 50, x: 0, rotate: 0 }}
          animate={{
            opacity: [0, ghost.maxOpacity, ghost.maxOpacity * 0.9, 0],
            scale: [0.4, 1.18, 1.0, 0.75],
            y: [50, -ghost.targetHeight * 1.05, -ghost.targetHeight, -ghost.targetHeight - 40],
            x: [0, ghost.driftX * 0.3, ghost.driftX * 0.7, ghost.driftX],
            rotate: [0, -ghost.rotation * 0.5, ghost.rotation * 0.8, ghost.rotation],
          }}
          transition={{
            duration: ghost.duration,
            delay: ghost.delay,
            times: [0, 0.28, 0.65, 1],
            ease: EASE.out,
          }}
        >
          <svg
            width={ghost.size}
            height={ghost.size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M4.4 21.2V10.4a7.6 7.6 0 0 1 15.2 0v10.8l-2.53-2.05-2.53 2.05-2.54-2.05-2.53 2.05-2.54-2.05-2.53 2.05ZM9.6 8.7a1.15 1.5 0 1 0 0 3 1.15 1.5 0 1 0 0-3ZM14.4 8.7a1.15 1.5 0 1 0 0 3 1.15 1.5 0 1 0 0-3Z"
              fill="currentColor"
            />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}
