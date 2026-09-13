import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { THEMES, useTheme, type ThemeId } from "../../lib/theme";
import { cn } from "../../lib/utils";
import { SPRING, TRANSITION } from "../../lib/motion";
import { playSound, useSoundMuted, useSoundVolume } from "../../lib/sound";
import { ThemeWipe } from "../motion";

type PendingWipe = { theme: ThemeId; ground: string; origin: { x: number; y: number } };

export function ThemeSwitcher() {
  const [theme, setTheme] = useTheme();
  const reduceMotion = useReducedMotion();
  const [pending, setPending] = useState<PendingWipe | null>(null);
  const current = THEMES.find((t) => t.id === theme);

  const selectTheme = useCallback(
    (next: ThemeId, ground: string, element: HTMLElement) => {
      playSound("toggle");
      if (next === theme) return;
      if (reduceMotion) {
        setTheme(next);
        return;
      }
      const rect = element.getBoundingClientRect();
      setPending({
        theme: next,
        ground,
        origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      });
    },
    [reduceMotion, setTheme, theme],
  );

  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Theme" className="flex items-center gap-2">
        {THEMES.map((t) => {
          const selected = theme === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t.label}
              title={t.label}
              onClick={(event) => selectTheme(t.id, t.ground, event.currentTarget)}
              style={{ background: `linear-gradient(135deg, ${t.ground} 56%, ${t.accent} 56%)` }}
              whileHover={selected ? { scale: 1.06 } : { scale: 1.12, rotate: 4 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING.hover}
              className={cn(
                "relative h-[18px] w-[18px] rounded-full border",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-oxblood",
                selected ? "border-transparent" : "border-hairline",
              )}
            >
              {selected && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-[3px] rounded-full ring-1 ring-oxblood ring-offset-2 ring-offset-paper-rail"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING.overshoot}
                />
              )}
            </motion.button>
          );
        })}
      </div>
      <span className="hidden text-[11px] text-ink-2 sm:inline">{current?.label}</span>

      <ThemeWipe
        origin={pending?.origin ?? null}
        color={pending?.ground ?? "transparent"}
        onHalfway={() => {
          if (pending) setTheme(pending.theme);
        }}
        onDone={() => setPending(null)}
      />
    </div>
  );
}

export function SoundToggle({ className }: { className?: string }): JSX.Element {
  const [muted, setMuted] = useSoundMuted();
  const [volume, setVolume] = useSoundVolume();
  const volumePercent = Math.round(volume * 100);

  return (
    <div className={cn("group relative", className)}>
      <motion.button
        type="button"
        role="switch"
        aria-checked={!muted}
        aria-label="Sound effects"
        title={muted ? "Sound off" : "Sound on"}
        onClick={() => {
          const next = !muted;
          setMuted(next);
          if (!next) playSound("toggle");
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        transition={SPRING.press}
        className={cn(
          "relative grid h-[18px] w-[18px] place-items-center transition-colors hover:text-ink",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-oxblood",
          muted ? "text-ink-3" : "text-ink-2",
        )}
      >
        <motion.span
          key={muted ? "muted" : "unmuted"}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={TRANSITION.quick}
          className="grid place-items-center"
        >
          {muted ? <VolumeX size={14} strokeWidth={1.6} /> : <Volume2 size={14} strokeWidth={1.6} />}
        </motion.span>
      </motion.button>
      <label className="pointer-events-none absolute right-0 top-full z-20 flex w-36 items-center gap-2 border border-hairline bg-paper-raised px-2.5 py-2 text-[10px] text-ink-2 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 sm:bottom-full sm:top-auto">
        <span className="shrink-0">Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label="Sound effects volume"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-[rgb(var(--oxblood))]"
        />
        <output className="w-7 text-right text-ink">{volumePercent}%</output>
      </label>
    </div>
  );
}
