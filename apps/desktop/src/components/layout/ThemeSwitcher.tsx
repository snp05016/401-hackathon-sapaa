import { THEMES, useTheme } from "../../lib/theme";
import { cn } from "../../lib/utils";

export function ThemeSwitcher() {
  const [theme, setTheme] = useTheme();
  const current = THEMES.find((t) => t.id === theme);

  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Theme" className="flex items-center gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={theme === t.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTheme(t.id)}
            style={{ background: `linear-gradient(135deg, ${t.ground} 56%, ${t.accent} 56%)` }}
            className={cn(
              "h-[18px] w-[18px] rounded-full border transition-transform duration-200",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-oxblood",
              theme === t.id
                ? "border-transparent ring-1 ring-oxblood ring-offset-2 ring-offset-paper-rail"
                : "border-hairline hover:scale-110",
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-ink-2">{current?.label}</span>
    </div>
  );
}
