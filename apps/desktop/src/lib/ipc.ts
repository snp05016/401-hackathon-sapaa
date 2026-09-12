import type { GhostboardApi } from "../../electron/preload";

declare global {
  interface Window {
    ghostboard: GhostboardApi;
  }
}

export const ipc = (): GhostboardApi => window.ghostboard;
