import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { GhostMark } from "../ui/GhostMark";
import { DISTANCE, EASE, STAGGER, TRANSITION } from "../../lib/motion";

const WORDMARK = "Ghostboard";
const LETTER_LEAD = 0.18;

export function SplashScreen({ exiting, onSkip }: { exiting: boolean; onSkip: () => void }) {
  return (
    <div
      aria-hidden="true"
      onClick={onSkip}
      className={cn(
        "editorial fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center will-change-transform",
        exiting && "animate-curtain",
      )}
    >
      {/* Hidden while the curtain lifts: the mark has already flown to the rail. */}
      <div className="mb-5 flex h-[24px] items-center sm:mb-7 sm:h-[30px]">
        {!exiting && (
          <GhostMark
            size={24}
            layoutId="ghost-mark"
            className="animate-mark-in text-oxblood sm:size-[30px]"
          />
        )}
      </div>

      <h1 className="flex font-display text-[44px] leading-none tracking-[-0.02em] text-ink sm:text-[76px]">
        {WORDMARK.split("").map((letter, i) => (
          <span key={`${letter}-${i}`} className="inline-block overflow-hidden pb-[0.12em]">
            <motion.span
              className="inline-block"
              initial={{ y: DISTANCE.rise, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.8,
                ease: EASE.out,
                delay: LETTER_LEAD + i * STAGGER.tight,
              }}
            >
              {letter}
            </motion.span>
          </span>
        ))}
      </h1>

      <motion.div
        className="mt-5 h-px w-[220px] origin-left bg-hairline sm:mt-7 sm:w-[340px]"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...TRANSITION.hero, delay: 0.25 }}
      />

      <motion.p
        className="mt-5 text-[12px] text-ink-2"
        initial={{ opacity: 0, y: DISTANCE.rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TRANSITION.hero, delay: 0.9 }}
      >
        Every application, from found to ghosted.
      </motion.p>
    </div>
  );
}
