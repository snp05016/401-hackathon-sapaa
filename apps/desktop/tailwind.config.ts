import type { Config } from "tailwindcss";

// Themes swap these custom properties; every token below reads through them so
// one palette definition drives the whole UI.
const channel = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: channel("--paper"),
          raised: channel("--paper-raised"),
          rail: channel("--paper-rail"),
        },
        ink: {
          DEFAULT: channel("--ink"),
          "2": channel("--ink-2"),
          "3": channel("--ink-3"),
        },
        oxblood: channel("--oxblood"),
        verdigris: channel("--verdigris"),
        brass: channel("--brass"),
        hairline: "var(--hairline)",
      },
      fontFamily: {
        display: ["Bodoni Moda", "Georgia", "serif"],
        sans: ["Archivo", "Helvetica Neue", "sans-serif"],
      },
      keyframes: {
        reveal: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "none" },
        },
        "draw-rule": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        "letter-rise": {
          from: { transform: "translateY(115%)" },
          to: { transform: "translateY(0)" },
        },
        "mark-in": {
          from: { opacity: "0", transform: "scale(0.82)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        curtain: {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-101%)" },
        },
      },
      animation: {
        reveal: "reveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "draw-rule": "draw-rule 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "letter-rise": "letter-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        "mark-in": "mark-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        curtain: "curtain 0.8s cubic-bezier(0.76, 0, 0.24, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
