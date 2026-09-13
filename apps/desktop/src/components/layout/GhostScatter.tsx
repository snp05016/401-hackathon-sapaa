import { useMemo } from "react";
import { motion } from "framer-motion";
import { EASE } from "../../lib/motion";

const GHOST_COUNT = 18;

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
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    return Array.from({ length: GHOST_COUNT }, (_, index) => {
      const edge = index % 4;
      const horizontalDirection = edge === 0 ? -1 : edge === 1 ? 1 : random() > 0.5 ? 1 : -1;
      const verticalDirection = edge === 2 ? -1 : edge === 3 ? 1 : random() > 0.5 ? 1 : -1;

      return {
        id: index,
        startX: 32 + random() * 36,
        startY: 34 + random() * 34,
        x:
          edge < 2
            ? horizontalDirection * (viewportWidth * (0.68 + random() * 0.28))
            : horizontalDirection * viewportWidth * (0.2 + random() * 0.45),
        y:
          edge >= 2
            ? verticalDirection * (viewportHeight * (0.7 + random() * 0.3))
            : verticalDirection * viewportHeight * (0.18 + random() * 0.48),
        delay: random() * 0.2,
        duration: 1.05 + random() * 0.65,
        size: 24 + Math.round(random() * 22),
        rotation: horizontalDirection * (18 + random() * 38),
      };
    });
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {ghosts.map((ghost) => (
        <motion.span
          key={ghost.id}
          className="absolute block select-none leading-none drop-shadow-md"
          style={{ left: `${ghost.startX}%`, top: `${ghost.startY}%`, fontSize: ghost.size }}
          initial={{ opacity: 0, scale: 0.45, x: 0, y: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0.85, 0],
            scale: [0.45, 1.15, 0.95, 0.7],
            x: [0, ghost.x * 0.18, ghost.x * 0.55, ghost.x],
            y: [0, ghost.y * 0.22 - 12, ghost.y * 0.58 + 10, ghost.y],
            rotate: [0, -ghost.rotation * 0.25, ghost.rotation * 0.35, ghost.rotation],
          }}
          transition={{
            duration: ghost.duration,
            delay: 0.62 + ghost.delay,
            times: [0, 0.18, 0.58, 1],
            ease: EASE.out,
          }}
        >
          👻
        </motion.span>
      ))}
    </div>
  );
}
