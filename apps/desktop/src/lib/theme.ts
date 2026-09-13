import { useEffect, useState } from "react";

export const THEMES = [
  { id: "paper", label: "Paper", ground: "#E9E7E0", accent: "#6E1F26" },
  { id: "noir", label: "Noir", ground: "#12120E", accent: "#C15A62" },
  { id: "bone", label: "Bone", ground: "#F3F1EB", accent: "#2F5A42" },
  { id: "clay", label: "Clay", ground: "#E7D8CC", accent: "#8A3E2D" },
  { id: "tide", label: "Tide", ground: "#DDE8E8", accent: "#245C68" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "ghostboard:theme";

function storedTheme(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : "paper";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(storedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return [theme, setTheme] as const;
}
