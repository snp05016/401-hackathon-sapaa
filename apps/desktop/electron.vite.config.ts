import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

// Workspace packages ship raw .ts source (no build step) — bundle them into
// the main/preload output instead of externalizing, since Node can't import
// .ts files directly at runtime.
const WORKSPACE_PACKAGES = [
  "@ghostboard/shared",
  "@ghostboard/database",
  "@ghostboard/extension-messaging",
  "@ghostboard/matching",
  "@ghostboard/scraping",
  "@ghostboard/autofill",
  "@ghostboard/resume",
  "@ghostboard/tracking",
  "@ghostboard/ai",
];

const ROOT_DIRECTORY = fileURLToPath(new URL("../..", import.meta.url));
const MAIN_ENVIRONMENT_KEYS = [
  "GHOSTBOARD_LLM_PROVIDER",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GEMINI_API_KEY",
  "GHOSTBOARD_BRIDGE_PORT",
  "GHOSTBOARD_SYNC_PORT",
  "GHOSTBOARD_SYNC_DISABLED",
  "JOBSPY_URL",
] as const;

export default defineConfig(({ mode }) => {
  const rootEnvironment = loadEnv(mode, ROOT_DIRECTORY, "");
  for (const key of MAIN_ENVIRONMENT_KEYS) {
    if (process.env[key] === undefined && rootEnvironment[key] !== undefined) process.env[key] = rootEnvironment[key];
  }

  return {
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
    server: {
      strictPort: true,
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".keep": "text",
        },
      },
    },
    root: ".",
    build: {
      rollupOptions: {
        input: "index.html",
      },
    },
  },
  };
});
