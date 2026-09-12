import { cn } from "../../lib/utils";
import { GhostMark } from "../ui/GhostMark";

const WORDMARK = "Ghostboard";

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
      <GhostMark size={24} className="animate-mark-in mb-5 text-oxblood sm:mb-7 sm:size-[30px]" />

      <h1 className="flex font-display text-[44px] leading-none tracking-[-0.02em] text-ink sm:text-[76px]">
        {WORDMARK.split("").map((letter, i) => (
          <span key={`${letter}-${i}`} className="inline-block overflow-hidden pb-[0.12em]">
            <span className="animate-letter-rise inline-block" style={{ animationDelay: `${180 + i * 42}ms` }}>
              {letter}
            </span>
          </span>
        ))}
      </h1>

      <div
        className="animate-draw-rule mt-5 h-px w-[220px] origin-center bg-hairline sm:mt-7 sm:w-[340px]"
        style={{ animationDelay: "620ms" }}
      />

      <p className="animate-reveal mt-5 text-[12px] text-ink-2" style={{ animationDelay: "900ms" }}>
        Every application, from found to ghosted.
      </p>
    </div>
  );
}
