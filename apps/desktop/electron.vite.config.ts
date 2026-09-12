import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// Workspace packages ship raw .ts source (no build step) — bundle them into
// the main/preload output instead of externalizing, since Node can't import
// .ts files directly at runtime.
const WORKSPACE_PACKAGES = [
  "@ghostboard/shared",
  "@ghostboard/database",
  "@ghostboard/matching",
  "@ghostboard/autofill",
  "@ghostboard/resume",
  "@ghostboard/tracking",
  "@ghostboard/ai",
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: {
      lib: { entry: "electron/main.ts" },
      rollupOptions: {
        // @libsql/client ships a native .node binding — never bundle it, even
        // though it's only reachable transitively through @ghostboard/database.
        external: ["@libsql/client", "libsql"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: {
      lib: { entry: "electron/preload.ts" },
    },
  },
  renderer: {
    plugins: [react()],
    root: ".",
    build: {
      rollupOptions: {
        input: "index.html",
      },
    },
  },
});
